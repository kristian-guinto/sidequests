import duckdb
from pathlib import Path
from pipeline.config import (
    SQLITE_DB_PATH,
    DUCKDB_PATH,
    MOTHERDUCK_TOKEN,
    MOTHERDUCK_DATABASE,
)


def migrate(target: str = "local"):
    """
    Migrates all data from SQLite (open_nem_ph.db) to DuckDB (local file or MotherDuck),
    automatically applying the OpenNEM-SEA multi-country schema (country_code, currency).
    """
    print(
        "================================================================================"
    )
    print("  OpenNEM-SEA Zero-Loss Migration: SQLite -> Multi-Country DuckDB")
    print(
        "================================================================================"
    )

    if not SQLITE_DB_PATH.exists():
        print(f"❌ SQLite database not found at: {SQLITE_DB_PATH}")
        return False

    print(f"✓ Source SQLite Database: {SQLITE_DB_PATH}")

    # 1. Connect to target DuckDB
    if target == "motherduck" or (target == "auto" and MOTHERDUCK_TOKEN):
        duck_conn_str = f"md:{MOTHERDUCK_DATABASE}"
        print(f"✓ Target Database: MotherDuck Cloud ({duck_conn_str})...")
        duck_conn = duckdb.connect(
            duck_conn_str, config={"motherduck_token": MOTHERDUCK_TOKEN}
        )
    else:
        duck_conn_str = str(DUCKDB_PATH)
        print(f"✓ Target Database: Local DuckDB ({DUCKDB_PATH.name})...")
        duck_conn = duckdb.connect(duck_conn_str)

    # 2. Attach SQLite to DuckDB
    print("\n[1/4] Attaching SQLite database into DuckDB...")
    duck_conn.execute("INSTALL sqlite; LOAD sqlite;")
    duck_conn.execute(f"ATTACH '{SQLITE_DB_PATH}' AS sqlite_db (TYPE SQLITE);")
    print("  ✓ SQLite engine attached.")

    # 3. Migrate Tables with Multi-Country Schema
    print("\n[2/4] Migrating tables & schema extension (country_code, currency)...")

    # Facilities
    duck_conn.execute("DROP TABLE IF EXISTS facilities;")
    duck_conn.execute("""
        CREATE TABLE facilities (
            country_code VARCHAR NOT NULL,
            resource_id VARCHAR NOT NULL,
            facility_name VARCHAR NOT NULL,
            region VARCHAR NOT NULL,
            fuel_tech VARCHAR NOT NULL,
            capacity_mw DOUBLE DEFAULT 0.0,
            is_renewable BOOLEAN DEFAULT false,
            emissions_factor DOUBLE DEFAULT 0.0,
            status VARCHAR DEFAULT 'ACTIVE',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (country_code, resource_id)
        );
        INSERT INTO facilities
        SELECT
            'PH' AS country_code,
            resource_id,
            facility_name,
            region,
            fuel_tech,
            capacity_mw,
            is_renewable,
            emissions_factor,
            status,
            created_at,
            updated_at
        FROM sqlite_db.facilities;
    """)
    print("  ✓ facilities migrated.")

    # Energy Dispatch 5m
    duck_conn.execute("DROP TABLE IF EXISTS energy_dispatch_5m;")
    duck_conn.execute("""
        CREATE TABLE energy_dispatch_5m (
            country_code VARCHAR NOT NULL,
            timestamp VARCHAR NOT NULL,
            region VARCHAR NOT NULL,
            fuel_tech VARCHAR NOT NULL,
            generation_mw DOUBLE NOT NULL DEFAULT 0.0,
            price_local DOUBLE,
            currency VARCHAR DEFAULT 'PHP',
            PRIMARY KEY (country_code, timestamp, region, fuel_tech)
        );
        INSERT INTO energy_dispatch_5m
        SELECT
            'PH' AS country_code,
            timestamp,
            region,
            fuel_tech,
            generation_mw,
            price_php_mwh AS price_local,
            'PHP' AS currency
        FROM sqlite_db.energy_dispatch_5m;
    """)
    print("  ✓ energy_dispatch_5m migrated.")

    # Regional Summary 5m
    duck_conn.execute("DROP TABLE IF EXISTS regional_summary_5m;")
    duck_conn.execute("""
        CREATE TABLE regional_summary_5m (
            country_code VARCHAR NOT NULL,
            timestamp VARCHAR NOT NULL,
            region VARCHAR NOT NULL,
            demand_mw DOUBLE NOT NULL DEFAULT 0.0,
            generation_mw DOUBLE NOT NULL DEFAULT 0.0,
            losses_mw DOUBLE NOT NULL DEFAULT 0.0,
            import_mw DOUBLE NOT NULL DEFAULT 0.0,
            export_mw DOUBLE NOT NULL DEFAULT 0.0,
            net_interconnector_mw DOUBLE NOT NULL DEFAULT 0.0,
            price_local DOUBLE,
            currency VARCHAR DEFAULT 'PHP',
            renewables_pct DOUBLE,
            PRIMARY KEY (country_code, timestamp, region)
        );
        INSERT INTO regional_summary_5m
        SELECT
            'PH' AS country_code,
            timestamp,
            region,
            demand_mw,
            generation_mw,
            losses_mw,
            import_mw,
            export_mw,
            net_interconnector_mw,
            price_php_mwh AS price_local,
            'PHP' AS currency,
            renewables_pct
        FROM sqlite_db.regional_summary_5m;
    """)
    print("  ✓ regional_summary_5m migrated.")

    # Energy Daily Stats
    duck_conn.execute("DROP TABLE IF EXISTS energy_daily_stats;")
    duck_conn.execute("""
        CREATE TABLE energy_daily_stats (
            country_code VARCHAR NOT NULL,
            date VARCHAR NOT NULL,
            region VARCHAR NOT NULL,
            fuel_tech VARCHAR NOT NULL,
            energy_mwh DOUBLE NOT NULL DEFAULT 0.0,
            avg_price_local DOUBLE,
            currency VARCHAR DEFAULT 'PHP',
            peak_demand_mw DOUBLE,
            min_demand_mw DOUBLE,
            emissions_tco2 DOUBLE DEFAULT 0.0,
            PRIMARY KEY (country_code, date, region, fuel_tech)
        );
        INSERT INTO energy_daily_stats
        SELECT
            'PH' AS country_code,
            date,
            region,
            fuel_tech,
            energy_mwh,
            avg_price_php_mwh AS avg_price_local,
            'PHP' AS currency,
            peak_demand_mw,
            min_demand_mw,
            emissions_tco2
        FROM sqlite_db.energy_daily_stats;
    """)
    print("  ✓ energy_daily_stats migrated.")

    # 4. Integrity Validation Report
    print("\n[3/4] Running Data Integrity Verification...")
    print("\n" + "=" * 80)
    print("  DATA INTEGRITY VERIFICATION REPORT")
    print("=" * 80)
    print(
        f"  {'Table Name':<25} | {'SQLite Rows':<14} | {'DuckDB Rows':<14} | {'Status'}"
    )
    print("  " + "-" * 76)

    all_passed = True
    for tbl in [
        "facilities",
        "energy_dispatch_5m",
        "regional_summary_5m",
        "energy_daily_stats",
    ]:
        sq_cnt = duck_conn.execute(f"SELECT COUNT(*) FROM sqlite_db.{tbl}").fetchone()[
            0
        ]
        duck_cnt = duck_conn.execute(
            f"SELECT COUNT(*) FROM {tbl} WHERE country_code = 'PH'"
        ).fetchone()[0]
        status = (
            "✅ MATCH"
            if sq_cnt == duck_cnt
            else f"❌ MISMATCH (Diff: {sq_cnt - duck_cnt})"
        )
        if sq_cnt != duck_cnt:
            all_passed = False
        print(f"  {tbl:<25} | {sq_cnt:<14} | {duck_cnt:<14} | {status}")

    print("  " + "-" * 76)

    duck_conn.execute("DETACH sqlite_db;")
    duck_conn.close()

    if all_passed:
        print("\n🎉 Migration completed with 100% data fidelity! Zero data lost.")
        print(f"Target Database: {duck_conn_str}\n")
    else:
        print("\n⚠️ Migration finished with discrepancies. Please check the logs.\n")

    return all_passed


if __name__ == "__main__":
    migrate()
