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
            "price_local": 57.0,
        },
        {
            "timestamp": "2026-03-01 00:05:00+00",
            "interval_duration_mins": 5,
            "region": "LUZON",
            "fuel_tech": "solar",
            "generation_mw": 200.0,
            "price_local": 114.0,
        },
    ]
    upserted_e = db.upsert_energy_interval(energy_records, country_code="PH")
    assert upserted_e == 2

    # Verify price_dollar conversion in energy_interval (57 PHP / 57.0 = $1.00 USD)
    e_row = db.conn.execute(
        "SELECT price_local, price_dollar FROM energy_interval WHERE interval_start = '2026-03-01 00:00:00+00'"
    ).fetchone()
    assert e_row[0] == 57.0
    assert e_row[1] == 1.0

    # 2. Check compatibility views
    disp_rows = db.conn.execute("SELECT count(*) FROM energy_dispatch_5m").fetchone()[0]
    assert disp_rows == 2

    # 3. Compute daily rollups
    rollup_res = db.compute_daily_rollups(
        country_code="PH", start_date="2026-03-01", end_date="2026-03-01"
    )
    assert rollup_res["status"] == "success"

    # Verify energy_daily rollup calculations with VWAP and USD prices
    e_daily = db.conn.execute(
        """SELECT energy_mwh, avg_generation_mw, peak_generation_mw,
                  vwap_price_local, twap_price_local, vwap_price_dollar, twap_price_dollar
           FROM energy_daily WHERE date = '2026-03-01' AND region = 'LUZON'"""
    ).fetchone()
    assert e_daily is not None
    assert round(e_daily[0], 1) == 25.0
    assert e_daily[1] == 150.0  # avg generation
    assert e_daily[2] == 200.0  # peak generation
    assert e_daily[3] > 0.0  # vwap local
    assert e_daily[5] > 0.0  # vwap dollar

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
    assert res_1d.summary.avgPriceUSD is not None and res_1d.summary.avgPriceUSD > 0
    assert res_1d.points[0].priceDollar is not None

    # Test 30d (1d interval from energy_daily)
    res_30d = get_energy(
        response=Response(), country="PH", region="ALL", range="30d", interval=None
    )
    assert res_30d.range == "30d"
    assert res_30d.interval == "1d"
    assert len(res_30d.points) > 0
    assert res_30d.summary.avgPriceUSD is not None and res_30d.summary.avgPriceUSD > 0

    # Test regional filter
    res_luzon = get_energy(
        response=Response(), country="PH", region="LUZON", range="1d", interval=None
    )
    assert res_luzon.region == "LUZON"
    assert res_luzon.summary.totalGenerationGWh <= res_1d.summary.totalGenerationGWh

    # Test country interval clamping (Singapore 5m -> 30m)
    res_sg = get_energy(
        response=Response(), country="SG", region="SINGAPORE", range="1d", interval="5m"
    )
    assert res_sg.country == "SG"
    assert res_sg.interval == "30m"
    assert len(res_sg.points) > 0

    # Verify lean response model: no demand, no interconnectors, updated summary fields
    assert not hasattr(res_1d, "interconnectors")
    assert not hasattr(res_1d.points[0], "demand")
    assert res_1d.summary.avgPriceLocal > 0
    assert res_1d.summary.peakGenerationMW > 0
    assert not hasattr(res_1d.summary, "minDemandMW")


def test_api_health():
    from api.index import get_health

    health = get_health(response=Response())
    assert health["status"] == "healthy"
    assert "energy_interval" in health["tables"]
    assert "energy_daily" in health["tables"]
    assert "exchange_rates" in health["tables"]
    assert health["tables"]["energy_interval"] > 0


def test_api_get_energy_not_found():
    import pytest
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as excinfo:
        get_energy(response=Response(), country="VN", range="7d")
    assert excinfo.value.status_code == 404

