"""Unit and integration tests for packages/pipeline."""

from pathlib import Path
from datetime import datetime, date, timezone, timedelta
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
from pipeline.parsers.emc import EMCParser
from pipeline.parsers.singlebuyer import SingleBuyerParser
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
        ThailandFacilityClassifier,
        get_classifier_for_country,
    )

    # Factory returns correct type
    assert isinstance(get_classifier_for_country("PH"), PhilippinesFacilityClassifier)
    assert isinstance(get_classifier_for_country("SG"), SingaporeFacilityClassifier)
    assert isinstance(get_classifier_for_country("MY"), MalaysiaFacilityClassifier)
    assert isinstance(get_classifier_for_country("TH"), ThailandFacilityClassifier)

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

    # 4. Thailand Classifier
    th_c = ThailandFacilityClassifier()
    assert th_c.classify("TH_MAE_MOH", "NORTH").fuel_tech == "coal"
    assert th_c.classify("TH_MAE_MOH", "NORTH").region == "NORTH"
    assert th_c.classify("TH_BANG_PAKONG", "CENTRAL").fuel_tech == "gas"
    assert th_c.classify("TH_BHUMIBOL_HYDRO").fuel_tech == "hydro"
    assert th_c.classify("TH_UNKNOWN_PLANT").fuel_tech == "unclassified"

    # 5. FacilityRegistry delegates properly per country
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

    th_registry = FacilityRegistry(country_code="TH")
    resolved_th = th_registry.resolve("TH_MAE_MOH", "NORTH")
    assert resolved_th.country_code == "TH"
    assert resolved_th.fuel_tech == "coal"
    assert resolved_th.region == "NORTH"


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


def test_emc_parser():
    parser = EMCParser()

    # 1. Registered facilities CSV
    fac_csv = (
        '"Facility Name","Facility Code","Registered Capacity (MW)","Generation Type","Effective Date"\n'
        '"Tuas Power Station Unit 1","TUAS1",600.0,"CCGT","2002-01-01"\n'
        '"Sembcorp Floating Solar","SOLAR1",60.0,"IGS","2021-06-01"\n'
        '"Tuas South Incineration","WTE1",40.0,"ST","2010-01-01"\n'
        '"Lao-SG Interconnector","IMPORT1",100.0,"IMPORT","2022-01-01"\n'
        '"Jurong ESS","ESS1",200.0,"ESS","2023-01-01"\n'
    )
    facs = parser.parse_registered_facilities(fac_csv)
    assert len(facs) == 5
    fuel_by_id = {f.resource_id: f.fuel_tech for f in facs}
    assert fuel_by_id["SG_TUAS1"] == "gas"
    assert fuel_by_id["SG_SOLAR1"] == "solar"
    assert fuel_by_id["SG_WTE1"] == "biomass"
    assert fuel_by_id["SG_IMPORT1"] == "hydro"
    assert fuel_by_id["SG_ESS1"] == "battery"
    assert facs[0].country_code == "SG"
    assert facs[0].region == "SINGAPORE"

    # 2. USEP & Demand CSV
    usep_csv = (
        '"INFORMATION TYPE","DATE","PERIOD","USEP ($/MWh)","DEMAND (MW)"\n'
        '"USEP","01 Mar 2026",1,125.50,6200.0\n'
        '"USEP","01 Mar 2026",2,118.20,6100.0\n'
    )
    usep_data = parser.parse_usep_demand(usep_csv)
    assert len(usep_data) == 2
    dt1 = datetime(2026, 3, 1, 0, 0, tzinfo=timezone(timedelta(hours=8)))
    assert dt1 in usep_data
    assert usep_data[dt1]["usep"] == 125.50
    assert usep_data[dt1]["demand"] == 6200.0

    # 3. Metered Generation CSV
    mg_csv = (
        '"INFORMATION TYPE","DATE","PERIOD","CCGT/COGEN/TRIGEN","GT","ST","IMPORT","IGS","ESS"\n'
        '"MG","01 Mar 2026",1,5800.0,0.0,120.0,90.0,0.0,10.0\n'
    )
    price_map = {dt1: 125.50}
    mg_records = parser.parse_metered_generation(mg_csv, price_map=price_map)
    assert len(mg_records) > 0
    fuels = {r.fuel_tech: r.generation_mw for r in mg_records}
    assert fuels["gas"] == 5800.0
    assert fuels["biomass"] == 120.0
    assert fuels["hydro"] == 90.0
    assert fuels["battery"] == 10.0
    assert mg_records[0].price_local == 125.50
    assert mg_records[0].energy_mwh == round(mg_records[0].generation_mw * 0.5, 4)

    # 4. Real-time 48-period CSV
    rt_csv = (
        '"PERIOD","PROGNOSTIC DEMAND (MW)","USEP ($/MWh)"\n'
        "1,6000.0,130.0\n"
        "2,5900.0,128.0\n"
    )
    rt_records = parser.parse_realtime(rt_csv)
    assert len(rt_records) > 0
    assert all(r.country_code == "SG" for r in rt_records)


def test_singlebuyer_parser():
    parser = SingleBuyerParser()

    # 1. GSO Power Stations
    gso_plants = [
        {"Name": "Jimah East Power", "Fuel": "Coal", "Capacity (MW)": 2000.0},
        {"Name": "Edra Melaka", "Fuel": "Gas", "Capacity (MW)": 2242.0},
        {"Name": "Bakun Hydro", "Fuel": "Water", "Capacity (MW)": 2400.0},
        {"Name": "Kuala Langat Solar", "Fuel": "Solar", "Capacity (MW)": 50.0},
    ]
    facs = parser.parse_power_stations(gso_plants)
    assert len(facs) == 4
    fuel_by_id = {f.resource_id: f.fuel_tech for f in facs}
    assert fuel_by_id["MY_JIMAH_EAST_POWER"] == "coal"
    assert fuel_by_id["MY_EDRA_MELAKA"] == "gas"
    assert fuel_by_id["MY_BAKUN_HYDRO"] == "hydro"
    assert fuel_by_id["MY_KUALA_LANGAT_SOLAR"] == "solar"
    assert facs[0].country_code == "MY"
    assert facs[0].region == "PENINSULAR"

    # 2. Single Buyer SMP Prices
    smp_json = {
        "meta": {
            "data": {
                "forecast": [
                    {"t": "2026-09-01 00:00", "v": 0.220},
                    {"t": "2026-09-01 00:30", "v": 0.215},
                ],
                "actual": [
                    {"t": "2026-09-01 00:00", "v": 0.245},
                ],
            }
        }
    }
    smp_lookup = parser.parse_smp_prices(smp_json)
    assert len(smp_lookup) == 2
    dt1 = datetime(2026, 9, 1, 0, 0, tzinfo=timezone(timedelta(hours=8)))
    dt2 = datetime(2026, 9, 1, 0, 30, tzinfo=timezone(timedelta(hours=8)))
    # Settled actual overrides forecast: 0.245 * 1000 = 245.0 RM/MWh
    assert smp_lookup[dt1] == 245.0
    # Forecast used when actual missing: 0.215 * 1000 = 215.0 RM/MWh
    assert smp_lookup[dt2] == 215.0

    # 3. Single Buyer Day Generation Mix
    gen_mix_json = {
        "series": {
            "coal": {"data": [{"t": "2026-09-01 00:00", "v": 8500.0}]},
            "gas": {"data": [{"t": "2026-09-01 00:00", "v": 7200.0}]},
            "solar": {"data": [{"t": "2026-09-01 00:00", "v": 0.0}]},
            "hydro": {"data": [{"t": "2026-09-01 00:00", "v": 1500.0}]},
            "others": {"data": [{"t": "2026-09-01 00:00", "v": 200.0}]},
        }
    }
    records = parser.parse_day_generation_mix(gen_mix_json, smp_lookup=smp_lookup)
    assert len(records) == 5
    fuel_gen = {r.fuel_tech: r.generation_mw for r in records}
    assert fuel_gen["coal"] == 8500.0
    assert fuel_gen["gas"] == 7200.0
    assert fuel_gen["hydro"] == 1500.0
    assert fuel_gen["biomass"] == 200.0
    assert records[0].price_local == 245.0
    assert records[0].energy_mwh == round(records[0].generation_mw * 0.5, 4)

    # 4. GSO Real-time 10-minute dispatch
    gso_rows = [
        {
            "DT": "2026-09-01T00:10:00",
            "Coal": 8200.0,
            "Gas": 6900.0,
            "Hydro": 1400.0,
            "Solar": 0.0,
            "CoGen": 150.0,
            "Oil": 0.0,
        }
    ]
    gso_records = parser.parse_gso_current_gen(gso_rows, smp_lookup=smp_lookup)
    assert len(gso_records) == 6
    gso_fuel_gen = {r.fuel_tech: r.generation_mw for r in gso_records}
    assert gso_fuel_gen["coal"] == 8200.0
    assert gso_fuel_gen["biomass"] == 150.0
    # 10 minutes: MWh = MW * (10/60)
    assert gso_records[0].energy_mwh == round(
        gso_records[0].generation_mw * (10.0 / 60.0), 4
    )


def test_mocked_provider_clients():
    from unittest.mock import MagicMock
    from pipeline.emc_client import EMCClient
    from pipeline.singlebuyer_client import SingleBuyerClient

    mock_emc = MagicMock(spec=EMCClient)
    mock_emc.download_facilities_csv.return_value = (
        '"Facility Name","Facility Code","Registered Capacity (MW)","Generation Type","Effective Date"\n'
        '"Tuas Power 1","TUAS1",600.0,"CCGT","2002-01-01"\n'
    )
    mock_emc.download_usep_demand_csv.return_value = (
        '"INFORMATION TYPE","DATE","PERIOD","USEP ($/MWh)","DEMAND (MW)"\n'
        '"USEP","01 Mar 2026",1,120.0,6000.0\n'
    )
    mock_emc.download_metered_generation_csv.return_value = (
        '"INFORMATION TYPE","DATE","PERIOD","CCGT/COGEN/TRIGEN","GT","ST","IMPORT","IGS","ESS"\n'
        '"MG","01 Mar 2026",1,5500.0,0.0,100.0,80.0,0.0,0.0\n'
    )
    sg_provider = SingaporeEMCProvider(client=mock_emc)
    facs = sg_provider.fetch_facilities()
    assert len(facs) == 1
    assert facs[0].resource_id == "SG_TUAS1"
    sg_intervals = sg_provider.fetch_energy_intervals(
        start_date=datetime(2026, 3, 1).date(),
        end_date=datetime(2026, 3, 1).date(),
    )
    assert len(sg_intervals) > 0
    assert isinstance(sg_intervals[0], EnergyIntervalRecord)
    assert sg_intervals[0].country_code == "SG"

    mock_sb = MagicMock(spec=SingleBuyerClient)
    mock_sb.get_power_stations.return_value = [
        {"Name": "Manjung 4", "Fuel": "Coal", "Capacity (MW)": 1000.0}
    ]
    mock_sb.get_smp_prices.return_value = {
        "meta": {"data": {"actual": [{"t": "2026-09-01 00:00", "v": 0.250}]}}
    }
    mock_sb.get_day_generation_mix.return_value = {
        "series": {"coal": {"data": [{"t": "2026-09-01 00:00", "v": 8000.0}]}}
    }
    my_provider = MalaysiaSingleBuyerProvider(client=mock_sb)
    my_facs = my_provider.fetch_facilities()
    assert len(my_facs) == 1
    assert my_facs[0].resource_id == "MY_MANJUNG_4"
    intervals = my_provider.fetch_energy_intervals(
        start_date=datetime(2026, 9, 1).date(),
        end_date=datetime(2026, 9, 1).date(),
    )
    assert len(intervals) == 1
    assert intervals[0].generation_mw == 8000.0
    assert intervals[0].price_local == 250.0


def test_providers_return_dataclasses():
    sg = SingaporeEMCProvider()
    sg_facs = sg.fetch_facilities()
    assert len(sg_facs) > 0
    assert isinstance(sg_facs[0], FacilityRecord)
    assert sg_facs[0].country_code == "SG"

    my = MalaysiaSingleBuyerProvider()
    my_facs = my.fetch_facilities()
    assert len(my_facs) > 0
    assert isinstance(my_facs[0], FacilityRecord)
    assert my_facs[0].country_code == "MY"


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


def test_iemop_client_extract_csv_from_bytes():
    import zipfile
    import io
    from pipeline.iemop_client import IEMOPClient

    # 1. Test zip file extraction
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("test.csv", "COL1,COL2\nVAL1,VAL2\n")
    zip_bytes = buf.getvalue()

    lines = IEMOPClient.extract_csv_from_bytes(zip_bytes)
    assert len(lines) == 2
    assert lines[0] == "COL1,COL2"
    assert lines[1] == "VAL1,VAL2"

    # 2. Test raw CSV fallback (BadZipFile)
    raw_csv = b"COL1,COL2\nRAW1,RAW2\n"
    raw_lines = IEMOPClient.extract_csv_from_bytes(raw_csv)
    assert len(raw_lines) == 2
    assert raw_lines[0] == "COL1,COL2"
    assert raw_lines[1] == "RAW1,RAW2"


def test_ph_iemop_provider_batch_streaming():
    from unittest.mock import MagicMock
    from pipeline.providers.ph_iemop import PhilippinesIEMOPProvider
    from pipeline.iemop_client import IEMOPClient

    mock_client = MagicMock(spec=IEMOPClient)
    mock_client.get_rtd_dispatch_files.return_value = [
        {"file_id": "id1", "filename": "RTD_1.zip"},
        {"file_id": "id2", "filename": "RTD_2.zip"},
    ]
    sample_csv = [
        "TIME_INTERVAL,RESOURCE_NAME,RESOURCE_TYPE,REGION_NAME,SCHED_MW,LMP",
        "03/01/2026 00:05:00 AM,01ARAYSOL_G01,G,CLUZ,50.0,2500.0",
    ]
    mock_client.download_rtd_dispatch_csv.return_value = sample_csv

    provider = PhilippinesIEMOPProvider()
    provider.client = mock_client

    batches = []

    def on_batch(records):
        batches.append(records)

    result = provider.fetch_energy_intervals(
        start_date=datetime(2026, 3, 1).date(),
        end_date=datetime(2026, 3, 1).date(),
        batch_size=1,
        on_batch=on_batch,
    )

    # 2 files with batch_size=1 -> 2 on_batch calls
    assert len(batches) == 2
    assert len(result) == 4  # 2 regional + 2 ALL records per file -> 4 total


def test_ph_iemop_provider_empty_files_warning(capsys):
    from unittest.mock import MagicMock
    from pipeline.providers.ph_iemop import PhilippinesIEMOPProvider
    from pipeline.iemop_client import IEMOPClient

    mock_client = MagicMock(spec=IEMOPClient)
    mock_client.get_rtd_dispatch_files.return_value = []

    provider = PhilippinesIEMOPProvider()
    provider.client = mock_client

    result = provider.fetch_energy_intervals(
        start_date=datetime(2024, 1, 1).date(),
        end_date=datetime(2024, 1, 31).date(),
    )
    assert result == []
    captured = capsys.readouterr()
    assert "No dispatch archive files found" in captured.out
    assert "90 rolling days" in captured.out


def test_thailand_egat_provider():
    from unittest.mock import MagicMock
    from pipeline.providers.th_egat import ThailandEGATProvider
    from pipeline.egat_client import EGATClient

    mock_client = MagicMock(spec=EGATClient)
    mock_client.get_actual_generation.return_value = {
        "id": "1800142",
        "day": "06-09-2026",
        "list": [
            [0, 28000.0, 28.5],
            [60, 28050.0, 28.5],
            [1800, 28200.0, 28.4],
            [3600, 29000.0, 28.3],
            [43200, 32000.0, 32.0],  # 12:00 noon (solar active)
        ],
    }

    provider = ThailandEGATProvider(client=mock_client)
    facs = provider.fetch_facilities()
    assert len(facs) >= 20
    assert any(f.resource_id == "TH_MAE_MOH" for f in facs)
    assert any(f.resource_id == "TH_BANG_PAKONG" for f in facs)

    # Test fuel decomposition
    noon_alloc = provider._calculate_fuel_allocation(
        total_mw=32000.0, hour=12, minute=0
    )
    assert noon_alloc["solar"] > 2000.0
    assert noon_alloc["coal"] > 0.0
    assert noon_alloc["gas"] > 0.0
    assert noon_alloc["hydro"] > 0.0

    midnight_alloc = provider._calculate_fuel_allocation(
        total_mw=25000.0, hour=0, minute=0
    )
    assert midnight_alloc["solar"] == 0.0

    # Test interval fetching
    target_d = date(2026, 9, 6)
    intervals = provider.fetch_energy_intervals(
        start_date=target_d,
        end_date=target_d,
    )
    assert len(intervals) > 0
    assert all(r.country_code == "TH" for r in intervals)
    assert all(r.region == "THAILAND" for r in intervals)
