import duckdb
from pathlib import Path
from pipeline.config import (
    DUCKDB_PATH,
    MOTHERDUCK_TOKEN,
    MOTHERDUCK_DATABASE,
)


def sync_local_to_motherduck():
    """
    Syncs all local DuckDB tables (open_nem_ph.duckdb) directly into MotherDuck Cloud.
    """
    print(
        "================================================================================"
    )
    print("  OpenElectricity: Local DuckDB -> MotherDuck Cloud Sync")
    print(
        "================================================================================"
    )

    if not DUCKDB_PATH.exists():
        print(f"❌ Local DuckDB file not found at: {DUCKDB_PATH}")
        return False

    if not MOTHERDUCK_TOKEN:
        print("❌ MOTHERDUCK_TOKEN environment variable is not set in .env.")
        return False

    md_conn_str = f"md:{MOTHERDUCK_DATABASE}"
    print(f"✓ Source: Local DuckDB ({DUCKDB_PATH.name})")
    print(f"✓ Target: MotherDuck Cloud ({md_conn_str})")

    try:
        md_conn = duckdb.connect(
            md_conn_str, config={"motherduck_token": MOTHERDUCK_TOKEN}
        )
        print("✓ Connected to MotherDuck Cloud.")

        # Attach local DuckDB
        print("\n[1/3] Attaching local DuckDB database...")
        md_conn.execute(f"ATTACH '{DUCKDB_PATH}' AS local_db (READ_ONLY);")
        print("  ✓ Local database attached.")

        tables = [
            "facilities",
            "energy_dispatch_5m",
            "regional_summary_5m",
            "energy_daily_stats",
        ]

        # Sync Tables
        print("\n[2/3] Syncing tables into MotherDuck...")
        for tbl in tables:
            print(f"  -> Syncing {tbl}...")
            md_conn.execute(
                f"CREATE TABLE IF NOT EXISTS {tbl} AS SELECT * FROM local_db.{tbl} WHERE 1=0;"
            )
            md_conn.execute(
                f"INSERT OR REPLACE INTO {tbl} SELECT * FROM local_db.{tbl};"
            )
            count = md_conn.execute(f"SELECT COUNT(*) FROM {tbl};").fetchone()[0]
            print(f"     ✓ {tbl}: {count} total rows in MotherDuck.")

        # Validation
        print("\n[3/3] Data Validation Report...")
        print("=" * 80)
        print(
            f"  {'Table Name':<25} | {'Local DuckDB Rows':<18} | {'MotherDuck Rows':<18} | {'Status'}"
        )
        print("  " + "-" * 76)

        all_match = True
        for tbl in tables:
            local_cnt = md_conn.execute(
                f"SELECT COUNT(*) FROM local_db.{tbl}"
            ).fetchone()[0]
            md_cnt = md_conn.execute(f"SELECT COUNT(*) FROM {tbl}").fetchone()[0]
            status = (
                "✅ MATCH" if local_cnt == md_cnt else f"⚠️ DIFF ({local_cnt - md_cnt})"
            )
            if local_cnt != md_cnt:
                all_match = False
            print(f"  {tbl:<25} | {local_cnt:<18} | {md_cnt:<18} | {status}")

        print("=" * 80)
        md_conn.execute("DETACH local_db;")
        md_conn.close()

        if all_match:
            print("\n🎉 MotherDuck Cloud sync completed with 100% data fidelity!\n")
        else:
            print("\n⚠️ Sync completed with row differences. Check logs above.\n")

        return all_match
    except Exception as e:
        print(f"\n❌ MotherDuck sync failed: {e}")
        return False


if __name__ == "__main__":
    sync_local_to_motherduck()
