from pathlib import Path
from fastapi import Response
from pipeline.generator_registry import GeneratorRegistry
from pipeline.config import BASE_DIR, COUNTRIES_CONFIG
from pipeline.db import Database
from api.index import get_energy


def test_generator_registry_loads():
    registry = GeneratorRegistry()
    facilities = registry.get_all_facilities()
    assert len(facilities) > 0


def test_config_defaults():
    assert BASE_DIR.exists()
    assert "PH" in COUNTRIES_CONFIG
    assert "SG" in COUNTRIES_CONFIG
    assert "MY" in COUNTRIES_CONFIG


def test_database_tiered_upsert_and_rollups(tmp_path: Path):
    test_db_path = tmp_path / "test_pipeline.duckdb"
    db = Database(run_migrations=True, local_path=test_db_path)

    # 1. Upsert energy_interval records
    energy_records = [
        {
            "timestamp": "2026-03-01 00:00:00+00",
            "interval_duration_mins": 5,
            "region": "LUZON",
            "fuel_tech": "solar",
            "generation_mw": 100.0,
            "price_local": 50.0,
        },
        {
            "timestamp": "2026-03-01 00:05:00+00",
            "interval_duration_mins": 5,
            "region": "LUZON",
            "fuel_tech": "solar",
            "generation_mw": 200.0,
            "price_local": 60.0,
        },
    ]
    upserted_e = db.upsert_energy_interval(energy_records, country_code="PH")
    assert upserted_e == 2

    # 2. Upsert network_interval records
    network_records = [
        {
            "timestamp": "2026-03-01 00:00:00+00",
            "interval_duration_mins": 5,
            "region": "LUZON",
            "demand_mw": 500.0,
            "generation_mw": 100.0,
            "price_local": 50.0,
            "renewables_pct": 20.0,
        },
        {
            "timestamp": "2026-03-01 00:05:00+00",
            "interval_duration_mins": 5,
            "region": "LUZON",
            "demand_mw": 600.0,
            "generation_mw": 200.0,
            "price_local": 60.0,
            "renewables_pct": 30.0,
        },
    ]
    upserted_n = db.upsert_network_interval(network_records, country_code="PH")
    assert upserted_n == 2

    # 3. Check compatibility views
    disp_rows = db.conn.execute(
        "SELECT count(*) FROM energy_dispatch_5m"
    ).fetchone()[0]
    assert disp_rows == 2

    reg_rows = db.conn.execute(
        "SELECT count(*) FROM regional_summary_5m"
    ).fetchone()[0]
    assert reg_rows == 2

    # 4. Compute daily rollups
    rollup_res = db.compute_daily_rollups(
        country_code="PH", start_date="2026-03-01", end_date="2026-03-01"
    )
    assert rollup_res["status"] == "success"

    # Verify energy_daily rollup calculations
    e_daily = db.conn.execute(
        "SELECT energy_mwh, avg_generation_mw, peak_generation_mw, vwap_price_local FROM energy_daily WHERE date = '2026-03-01' AND region = 'LUZON'"
    ).fetchone()
    assert e_daily is not None
    # 100 MW * 5/60 = 8.3333 MWh; 200 MW * 5/60 = 16.6667 MWh; sum = 25.0 MWh
    assert round(e_daily[0], 1) == 25.0
    assert e_daily[1] == 150.0  # avg generation
    assert e_daily[2] == 200.0  # peak generation
    assert e_daily[3] > 0.0  # vwap price

    # Verify network_daily rollup calculations
    n_daily = db.conn.execute(
        "SELECT avg_demand_mw, peak_demand_mw, min_demand_mw, renewables_pct FROM network_daily WHERE date = '2026-03-01' AND region = 'LUZON'"
    ).fetchone()
    assert n_daily is not None
    assert n_daily[0] == 550.0  # avg demand
    assert n_daily[1] == 600.0  # peak demand
    assert n_daily[2] == 500.0  # min demand
    assert n_daily[3] == 25.0  # avg renewables pct

    # Check compatibility view energy_daily_stats
    daily_stats_rows = db.conn.execute(
        "SELECT count(*) FROM energy_daily_stats"
    ).fetchone()[0]
    assert daily_stats_rows == 1

    db.close()


def test_api_get_energy_ranges_and_filters():
    # Test 1d (5m interval)
    res_1d = get_energy(
        response=Response(), country="PH", region="ALL", range="1d", interval=None
    )
    assert res_1d.range == "1d"
    assert res_1d.interval == "5m"
    assert len(res_1d.points) > 100
    assert res_1d.summary.totalGenerationGWh > 0

    # Test 30d (1d interval from energy_daily)
    res_30d = get_energy(
        response=Response(), country="PH", region="ALL", range="30d", interval=None
    )
    assert res_30d.range == "30d"
    assert res_30d.interval == "1d"
    assert len(res_30d.points) > 0

    # Test regional filter
    res_luzon = get_energy(
        response=Response(), country="PH", region="LUZON", range="1d", interval=None
    )
    assert res_luzon.region == "LUZON"
    assert res_luzon.summary.totalGenerationGWh <= res_1d.summary.totalGenerationGWh
