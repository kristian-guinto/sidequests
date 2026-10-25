"""Cold storage archiver for raw 5-minute nodal dispatch to compressed daily Parquet files."""

import os
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Union
import duckdb

from pipeline.config import BASE_DIR
from pipeline.models import NodalDispatchRecord

DEFAULT_ARCHIVE_DIR = Path(os.environ.get("ARCHIVE_DIR", BASE_DIR / "data" / "archive"))
ARCHIVE_DIR = DEFAULT_ARCHIVE_DIR


class NodalParquetArchiver:
    """Manages cold Parquet storage and deduplication for high-resolution nodal dispatch records."""

    def __init__(self, archive_dir: Optional[Union[Path, str]] = None):
        self.archive_dir = Path(archive_dir) if archive_dir is not None else ARCHIVE_DIR

    def archive_records(
        self,
        records: Sequence[NodalDispatchRecord],
        country_code: str = "PH",
    ) -> List[Path]:
        """
        Groups nodal dispatch records by date and idempotently appends/merges them
        into daily compressed ZSTD Parquet files, deduplicating records by
        (country_code, interval_start, resource_id, resource_type).
        """
        if not records:
            return []

        # Group by day
        day_groups: Dict[date, List[NodalDispatchRecord]] = defaultdict(list)
        for r in records:
            day_groups[r.interval_start.date()].append(r)

        written_paths: List[Path] = []

        for day_date, day_records in day_groups.items():
            c_code = country_code.upper()
            target_dir = self.archive_dir / c_code / str(day_date.year)
            target_dir.mkdir(parents=True, exist_ok=True)
            target_file = target_dir / f"{c_code}_{day_date.isoformat()}.parquet"

            conn = duckdb.connect(":memory:")
            try:
                conn.execute("""
                    CREATE TABLE new_nodal (
                        country_code VARCHAR,
                        interval_start TIMESTAMPTZ,
                        resource_id VARCHAR,
                        resource_type VARCHAR,
                        region VARCHAR,
                        fuel_tech VARCHAR,
                        sched_mw DOUBLE,
                        lmp DOUBLE
                    );
                """)

                rows = [
                    (
                        r.country_code.upper(),
                        r.interval_start,
                        r.resource_id,
                        r.resource_type,
                        r.region,
                        r.fuel_tech,
                        float(r.sched_mw),
                        float(r.lmp),
                    )
                    for r in day_records
                ]
                conn.executemany(
                    "INSERT INTO new_nodal VALUES (?, ?, ?, ?, ?, ?, ?, ?)", rows
                )

                escaped_target = target_file.as_posix().replace("'", "''")

                if target_file.exists():
                    conn.execute(f"""
                        CREATE TABLE combined AS
                        SELECT
                            country_code,
                            interval_start,
                            resource_id,
                            resource_type,
                            region,
                            fuel_tech,
                            sched_mw,
                            lmp
                        FROM (
                            SELECT *, ROW_NUMBER() OVER (
                                PARTITION BY country_code, interval_start, resource_id, resource_type
                                ORDER BY _src_priority DESC, _seq DESC
                            ) AS rn
                            FROM (
                                SELECT country_code, interval_start, resource_id, resource_type, region, fuel_tech, sched_mw, lmp, 0 AS _src_priority, 0 AS _seq
                                FROM read_parquet('{escaped_target}')
                                UNION ALL
                                SELECT country_code, interval_start, resource_id, resource_type, region, fuel_tech, sched_mw, lmp, 1 AS _src_priority, ROW_NUMBER() OVER () AS _seq
                                FROM new_nodal
                            )
                        ) WHERE rn = 1
                        ORDER BY interval_start, resource_id;
                    """)
                else:
                    conn.execute("""
                        CREATE TABLE combined AS
                        SELECT
                            country_code,
                            interval_start,
                            resource_id,
                            resource_type,
                            region,
                            fuel_tech,
                            sched_mw,
                            lmp
                        FROM (
                            SELECT *, ROW_NUMBER() OVER (
                                PARTITION BY country_code, interval_start, resource_id, resource_type
                                ORDER BY _seq DESC
                            ) AS rn
                            FROM (
                                SELECT country_code, interval_start, resource_id, resource_type, region, fuel_tech, sched_mw, lmp, ROW_NUMBER() OVER () AS _seq
                                FROM new_nodal
                            )
                        ) WHERE rn = 1
                        ORDER BY interval_start, resource_id;
                    """)

                temp_target = target_file.with_suffix(".tmp.parquet")
                escaped_temp = temp_target.as_posix().replace("'", "''")
                conn.execute(f"""
                    COPY combined TO '{escaped_temp}' (FORMAT PARQUET, COMPRESSION ZSTD);
                """)
                temp_target.replace(target_file)
                written_paths.append(target_file)
            finally:
                conn.close()

            # Optional R2 Cloud Sync
            self._sync_to_r2_if_configured(target_file)

        return written_paths

    def _sync_to_r2_if_configured(self, file_path: Path) -> None:
        """Uploads archived Parquet file to Cloudflare R2 if credentials are provided."""
        r2_endpoint = os.environ.get("R2_ENDPOINT_URL")
        r2_key = os.environ.get("R2_ACCESS_KEY_ID")
        r2_secret = os.environ.get("R2_SECRET_ACCESS_KEY")
        r2_bucket = os.environ.get("R2_BUCKET_NAME")

        if r2_endpoint and r2_key and r2_secret and r2_bucket:
            try:
                import importlib
                import logging

                boto3 = importlib.import_module("boto3")
                botocore_config = importlib.import_module("botocore.config")
                Config = getattr(botocore_config, "Config")

                s3 = boto3.client(
                    "s3",
                    endpoint_url=r2_endpoint,
                    aws_access_key_id=r2_key,
                    aws_secret_access_key=r2_secret,
                    config=Config(signature_version="s3v4"),
                )
                rel_path = file_path.relative_to(self.archive_dir)
                s3.upload_file(str(file_path), r2_bucket, str(rel_path))
                print(f"  [R2] Synced {rel_path} to R2 bucket '{r2_bucket}'.")
            except Exception as e:
                import logging

                logging.getLogger(__name__).error(
                    f"R2 upload failed for {file_path.name}: {e}"
                )
                raise RuntimeError(f"R2 upload failed for {file_path.name}: {e}") from e
