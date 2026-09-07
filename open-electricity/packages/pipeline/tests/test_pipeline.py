"""Unit and integration tests for packages/pipeline."""

from pathlib import Path
from datetime import datetime, timezone, timedelta
import pytest
import duckdb
from ducklembic import Migrator, DuckDB as DucklembicDB
from pipeline.config import BASE_DIR
from pipeline.models import (
    FacilityRecord,
    EnergyIntervalRecord,
)
from pipeline.schema import validate_database_schema, SchemaMismatchError
from pipeline.generator_registry import GeneratorRegistry
from pipeline.parsers.iemop import IEMOPParser
from pipeline.providers.sg_emc import SingaporeEMCProvider
from pipeline.providers.my_singlebuyer import MalaysiaSingleBuyerProvider
from pipeline.db import Database

MIGRATIONS_DIR = BASE_DIR / "migrations"


def test_models():
    fac = FacilityRecord(
        country_code="PH",
        resource_id="01TEST_G01",
        facility_name="Test Plant",
        region="LUZON",
        fuel_tech="solar",
        capacity_mw=100.0,
        is_renewable=True,
    )
    assert fac.country_code == "PH"
    assert fac.is_renewable is True

    interval = EnergyIntervalRecord(
        country_code="PH",
        interval_start=datetime(2026, 3, 1, 0, 0, tzinfo=timezone(timedelta(hours=8))),
        region="LUZON",
        fuel_tech="solar",
        generation_mw=50.0,
        energy_mwh=4.1667,
        price_local=57.0,
    )
    assert interval.generation_mw == 50.0
    assert interval.price_local == 57.0


def test_schema_validation_failure_on_empty_db():
    conn = duckdb.connect(":memory:")
    with pytest.raises(SchemaMismatchError) as excinfo:
        validate_database_schema(conn)
    assert "Missing required base table" in str(excinfo.value)
    assert "Run: 'uv run ducklembic migrate'" in str(excinfo.value)


def test_multi_country_facility_classifiers():
    from pipeline.facility_registry import FacilityRegistry
    from pipeline.classifiers import (
        PhilippinesFacilityClassifier,
        SingaporeFacilityClassifier,
        MalaysiaFacilityClassifier,
        get_classifier_for_country,
    )

    # Factory returns correct type
    assert isinstance(get_classifier_for_country("PH"), PhilippinesFacilityClassifier)
    assert isinstance(get_classifier_for_country("SG"), SingaporeFacilityClassifier)
    assert isinstance(get_classifier_for_country("MY"), MalaysiaFacilityClassifier)

    # 1. Philippines Classifier
    ph_c = PhilippinesFacilityClassifier()
    assert ph_c.classify("01ARAYSOL_G01", "CLUZ").fuel_tech == "solar"
    assert ph_c.classify("01ARAYSOL_G01", "CLUZ").region == "LUZON"
    assert ph_c.classify("01STARITA_G01", "LUZON").fuel_tech == "gas"
    assert ph_c.classify("01UNKNOWN_XYZ", "CLUZ").fuel_tech == "unclassified"

    # 2. Singapore Classifier
    sg_c = SingaporeFacilityClassifier()
    assert sg_c.classify("SG_TUAS_CCGT").fuel_tech == "gas"
    assert sg_c.classify("SG_TUAS_CCGT").region == "SINGAPORE"
    assert sg_c.classify("SG_TENGEH_SOLAR").fuel_tech == "solar"
    assert sg_c.classify("SG_UNKNOWN_PLANT").fuel_tech == "unclassified"

    # 3. Malaysia Classifier
    my_c = MalaysiaFacilityClassifier()
    assert my_c.classify("MY_JIMAH_EAST", "PEN").fuel_tech == "coal"
    assert my_c.classify("MY_JIMAH_EAST", "PEN").region == "PENINSULAR"
    assert my_c.classify("MY_BAKUN_HYDRO", "PEN").region == "SARAWAK"
    assert my_c.classify("MY_BAKUN_HYDRO", "PEN").fuel_tech == "hydro"
    assert my_c.classify("MY_UNKNOWN_UNIT", "SBH").fuel_tech == "unclassified"

    # 4. FacilityRegistry delegates properly per country
    sg_registry = FacilityRegistry(country_code="SG")
    resolved_sg = sg_registry.resolve("SG_TUAS_CCGT")
    assert resolved_sg.country_code == "SG"
    assert resolved_sg.fuel_tech == "gas"
    assert resolved_sg.region == "SINGAPORE"
    assert resolved_sg.status == "ACTIVE"

    my_registry = FacilityRegistry(country_code="MY")
    resolved_my = my_registry.resolve("MY_UNKNOWN_PLANT", "PEN")
    assert resolved_my.country_code == "MY"
    assert resolved_my.fuel_tech == "unclassified"
    assert resolved_my.status == "UNCLASSIFIED"


def test_iemop_parser():
    registry = GeneratorRegistry()
    parser = IEMOPParser(registry)

    csv_data = [
        "TIME_INTERVAL,RESOURCE_NAME,RESOURCE_TYPE,REGION_NAME,SCHED_MW,LMP",
        "03/01/2026 00:05:00 AM,01ARAYSOL_G01,G,CLUZ,50.0,2500.0",
        "03/01/2026 00:05:00 AM,01BURGOS_W01,G,CLUZ,30.0,2500.0",
        "03/01/2026 00:05:00 AM,LOAD_NODE_1,L,CLUZ,100.0,2500.0",  # Load should be skipped
    ]
    records = parser.parse_rtd_dispatch(csv_data)
    # Expect 2 regional records (solar, wind) + 2 'ALL' records (solar, wind) = 4 records
    assert len(records) == 4

    solar_records = [
        r for r in records if r.fuel_tech == "solar" and r.region == "LUZON"
    ]
    assert len(solar_records) == 1
    assert solar_records[0].generation_mw == 50.0
    assert solar_records[0].energy_mwh == round(50.0 * (5.0 / 60.0), 4)
    assert solar_records[0].price_local == 2500.0


def test_providers_return_dataclasses():
    sg = SingaporeEMCProvider()
    sg_facs = sg.fetch_facilities()
    assert len(sg_facs) > 0
    assert isinstance(sg_facs[0], FacilityRecord)
    assert sg_facs[0].country_code == "SG"

    sg_intervals = sg.fetch_energy_intervals(days=1)
    assert len(sg_intervals) > 0
    assert isinstance(sg_intervals[0], EnergyIntervalRecord)
    assert sg_intervals[0].country_code == "SG"

    my = MalaysiaSingleBuyerProvider()
    my_facs = my.fetch_facilities()
    assert len(my_facs) > 0
    assert isinstance(my_facs[0], FacilityRecord)

    my_intervals = my.fetch_energy_intervals(days=1)
    assert len(my_intervals) > 0
    assert isinstance(my_intervals[0], EnergyIntervalRecord)


def test_database_tiered_upsert_and_populate_energy_daily(tmp_path: Path):
    test_db_path = tmp_path / "test_pipeline.duckdb"

    # 1. Run migrations using ducklembic to initialize schema
    duck_inst = DucklembicDB(local_path=test_db_path, mode="local")
    migrator = Migrator(duck_inst, migrations_dir=MIGRATIONS_DIR)
    migrator.init()
    migrator.migrate()
    duck_inst.close()

    # 2. Open Database with schema validation
    db = Database(target="local", local_path=test_db_path, validate_schema=True)

    # 3. Upsert facilities
    fac_record = FacilityRecord(
        country_code="PH",
        resource_id="01ARAYSOL_G01",
        facility_name="Arayat Solar",
        region="LUZON",
        fuel_tech="solar",
        capacity_mw=100.0,
        is_renewable=True,
    )
    upserted_fac = db.upsert_facilities([fac_record], country_code="PH")
    assert upserted_fac == 1

    # 4. Upsert energy_interval records
    start_time_1 = datetime(2026, 3, 1, 0, 0, tzinfo=timezone(timedelta(hours=8)))
    start_time_2 = datetime(2026, 3, 1, 0, 5, tzinfo=timezone(timedelta(hours=8)))
    energy_records = [
        EnergyIntervalRecord(
            country_code="PH",
            interval_start=start_time_1,
            region="LUZON",
            fuel_tech="solar",
            generation_mw=100.0,
            energy_mwh=8.3333,
            price_local=57.0,
        ),
        EnergyIntervalRecord(
            country_code="PH",
            interval_start=start_time_2,
            region="LUZON",
            fuel_tech="solar",
            generation_mw=200.0,
            energy_mwh=16.6667,
            price_local=114.0,
        ),
    ]
    upserted_e = db.upsert_energy_interval(energy_records, country_code="PH")
    assert upserted_e == 2

    # Verify price_dollar conversion in energy_interval (57 PHP / 57.0 = $1.00 USD)
    e_row = db.conn.execute(
        "SELECT price_local, price_dollar FROM energy_interval WHERE interval_start = ?::TIMESTAMPTZ",
        [start_time_1],
    ).fetchone()
    assert e_row is not None
    assert e_row[0] == 57.0
    assert e_row[1] == 1.0

    # 5. Populate energy_daily rollups
    rollup_res = db.populate_energy_daily(
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
    db.close()


def test_fx_rates_no_fallback():
    from pipeline.fx import get_fx_rate, ExchangeRateNotFoundError

    # USD always returns 1.0 without DB lookup
    assert get_fx_rate("2026-03-01", "USD") == 1.0

    # Non-USD currency requires a database connection
    with pytest.raises(ValueError):
        get_fx_rate("2026-03-01", "PHP", conn=None)

    conn = duckdb.connect(":memory:")
    conn.execute(
        "CREATE TABLE exchange_rates (date DATE, currency VARCHAR, rate_to_usd DOUBLE, PRIMARY KEY (date, currency))"
    )

    # When date/currency is missing, must raise ExchangeRateNotFoundError (NO default fallbacks)
    with pytest.raises(ExchangeRateNotFoundError) as excinfo:
        get_fx_rate("2026-03-01", "PHP", conn=conn)
    assert "Exchange rate to USD not found" in str(excinfo.value)
    assert "No default fallback rates" in str(excinfo.value)

    # When date/currency is present, returns the exact stored rate
    conn.execute("INSERT INTO exchange_rates VALUES ('2026-03-01', 'PHP', 58.25)")
    assert get_fx_rate("2026-03-01", "PHP", conn=conn) == 58.25
