"""Philippines Wholesale Electricity Spot Market (WESM) / IEMOP provider."""

from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from typing import Any, Callable, Dict, List, Optional, Tuple
from pipeline.generator_registry import GeneratorRegistry
from pipeline.iemop_client import IEMOPClient
from pipeline.models import EnergyIntervalRecord, FacilityRecord, PriceIntervalRecord
from pipeline.parsers.iemop import IEMOPParser
from pipeline.providers.base import BaseProvider


class PhilippinesIEMOPProvider(BaseProvider):
    """Data provider for Philippines IEMOP / WESM."""

    def __init__(self, conn: Optional[Any] = None):
        super().__init__("PH")
        self.client = IEMOPClient()
        self.registry = GeneratorRegistry(conn=conn, country_code="PH")
        self.parser = IEMOPParser(self.registry)

    def fetch_facilities(self, conn: Optional[Any] = None) -> List[FacilityRecord]:
        """Fetches registered power plant catalog from database or current registry cache."""
        if conn is not None:
            self.registry.load_from_database(conn)
        return self.registry.get_all_facilities()

    def fetch_energy_intervals(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        days: int = 2,
        conn: Optional[Any] = None,
        max_files: Optional[int] = None,
        on_batch: Optional[Callable[[List[EnergyIntervalRecord]], None]] = None,
        batch_size: int = 24,
        max_workers: int = 6,
        **kwargs: Any,
    ) -> List[EnergyIntervalRecord]:
        """Downloads RTD dispatch archives from IEMOP and parses into EnergyIntervalRecord and PriceIntervalRecord objects."""
        if conn is not None:
            self.registry.load_from_database(conn)

        s_date = start_date or (date.today() - timedelta(days=days))
        e_date = end_date or date.today()

        disp_files = self.client.get_rtd_dispatch_files(s_date, e_date, sort="asc")
        total_files = len(disp_files)

        if total_files == 0:
            print(
                f"  ⚠️ No dispatch archive files found on IEMOP for {s_date} -> {e_date}."
            )
            print(
                "     Note: IEMOP RTD Prices & Schedules endpoint typically retains ~90 rolling days of market data."
            )
            return []

        if max_files:
            disp_files = disp_files[:max_files]
            total_files = len(disp_files)

        print(
            f"  Found {len(disp_files)} dispatch archive files (Processing {total_files})."
        )

        all_records: List[EnergyIntervalRecord] = []
        total_synced = 0
        global_idx = 0

        from pipeline.db import Database

        db_instance = (
            Database(conn=conn, validate_schema=False) if conn is not None else None
        )

        def _download_and_parse(
            f_info: Dict[str, Any],
        ) -> Tuple[List[EnergyIntervalRecord], List[PriceIntervalRecord]]:
            csv_lines = self.client.download_rtd_dispatch_csv(f_info["file_id"])
            return self.parser.parse_rtd_dispatch(csv_lines)

        for chunk_start in range(0, total_files, batch_size):
            chunk = disp_files[chunk_start : chunk_start + batch_size]
            batch_records: List[EnergyIntervalRecord] = []
            batch_prices: List[PriceIntervalRecord] = []

            with ThreadPoolExecutor(
                max_workers=min(max_workers, len(chunk))
            ) as executor:
                future_map = {
                    executor.submit(_download_and_parse, f_info): f_info
                    for f_info in chunk
                }
                for future, f_info in future_map.items():
                    global_idx += 1
                    pct = (global_idx / total_files) * 100
                    filename = f_info.get("filename", "")
                    print(
                        f"  -> [{global_idx}/{total_files}] ({pct:4.1f}%) Unpacking {filename}..."
                    )
                    try:
                        records, price_records = future.result()
                        batch_records.extend(records)
                        batch_prices.extend(price_records)
                    except Exception as e:
                        print(f"    ⚠️ Failed to process {filename}: {e}")

            all_records.extend(batch_records)

            if on_batch and batch_records:
                on_batch(batch_records)
                total_synced += len(batch_records)
                print(
                    f"     [Saved batch: +{len(batch_records)} interval records (Total: {total_synced})]"
                )

            if db_instance is not None and batch_prices:
                db_instance.upsert_price_intervals(
                    batch_prices, country_code=self.country_code
                )

        return all_records
