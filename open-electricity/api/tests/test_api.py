"""Integration tests for OpenElectricity FastAPI Serverless API."""

import asyncio

import pytest
from fastapi import HTTPException, Response
from api.index import get_energy, get_health, get_pro_catalog, http_exception_handler


def test_api_health():
    resp = Response()
    health = get_health(response=resp)
    assert health["status"] == "healthy"
    assert "energy_interval" in health["tables"]
    assert "energy_daily" in health["tables"]
    assert "exchange_rates" in health["tables"]
    assert health["tables"]["energy_interval"] > 0
    assert "s-maxage=300" in resp.headers["Cache-Control"]
    assert "database" not in health  # Redacted for security
    # Second call returns from memory TTL cache
    health_cached = get_health(response=Response())
    assert health_cached == health


def test_api_get_energy_ranges_and_filters():
    # Test 1d (5m interval)
    res_1d = get_energy(
        response=Response(),
        country="PH",
        region="ALL",
        start_date="2026-09-06",
        end_date="2026-09-06",
        interval=None,
    )
    assert res_1d.range == "1d"
    assert res_1d.interval == "5m"
    assert len(res_1d.points) > 100
    assert res_1d.summary.totalGenerationGWh > 0
    assert res_1d.summary.avgPriceUSD is not None and res_1d.summary.avgPriceUSD > 0
    assert res_1d.points[0].priceDollar is not None
    # 1D view has raw spot price without distribution bands
    assert res_1d.points[0].priceMin is None
    assert res_1d.points[0].priceMedian is None

    # Test 30d (1d interval from energy_daily)
    res_30d = get_energy(
        response=Response(),
        country="PH",
        region="ALL",
        start_date="2026-08-08",
        end_date="2026-09-06",
        interval=None,
    )
    assert res_30d.range == "30d"
    assert res_30d.interval == "1d"
    assert len(res_30d.points) > 0
    assert res_30d.summary.avgPriceUSD is not None and res_30d.summary.avgPriceUSD > 0
    # 30D view has price distribution bands
    p30 = next(p for p in res_30d.points if p.hasData and p.priceMedian is not None)
    assert (
        p30.priceMin is not None
        and p30.priceP5 is not None
        and p30.priceMedian is not None
        and p30.priceP95 is not None
        and p30.priceMax is not None
    )
    assert (
        p30.priceMin <= p30.priceP5 <= p30.priceMedian <= p30.priceP95 <= p30.priceMax
    )

    # Test regional filter
    res_luzon = get_energy(
        response=Response(),
        country="PH",
        region="LUZON",
        start_date="2026-09-06",
        end_date="2026-09-06",
        interval=None,
    )
    assert res_luzon.region == "LUZON"
    assert res_luzon.summary.totalGenerationGWh <= res_1d.summary.totalGenerationGWh

    # Test country interval clamping (Singapore 5m -> 30m)
    res_sg = get_energy(
        response=Response(),
        country="SG",
        region="SINGAPORE",
        start_date="2026-09-06",
        end_date="2026-09-06",
        interval="5m",
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


def test_api_get_energy_not_found():
    with pytest.raises(HTTPException) as excinfo:
        get_energy(
            response=Response(),
            country="VN",
            start_date="2026-09-01",
            end_date="2026-09-06",
            interval="1d",
        )
    assert excinfo.value.status_code == 404


def test_api_requires_start_and_end_date():
    """Verify that start_date and end_date are required query parameters."""
    with pytest.raises(HTTPException) as exc1:
        get_energy(
            response=Response(),
            country="TH",
            start_date=None,
            end_date="2026-09-06",
        )
    assert exc1.value.status_code == 400
    assert "start_date" in exc1.value.detail

    with pytest.raises(HTTPException) as exc2:
        get_energy(
            response=Response(),
            country="TH",
            start_date="2026-09-06",
            end_date=None,
        )
    assert exc2.value.status_code == 400
    assert "end_date" in exc2.value.detail


def test_api_get_energy_explicit_date_range():
    """Verify explicit start_date and end_date queries return full timezone-aligned grid."""
    res_th = get_energy(
        response=Response(),
        country="TH",
        start_date="2026-09-08",
        end_date="2026-09-08",
        interval="5m",
    )
    assert res_th.country == "TH"
    assert res_th.interval == "5m"
    # Full day 24h * 12 slots/h = 288 slots
    assert len(res_th.points) == 288
    # Bangkok timezone +07:00
    assert res_th.points[0].timestamp == "2026-09-08T00:00:00+07:00"
    assert res_th.points[-1].timestamp == "2026-09-08T23:55:00+07:00"

    # Verify telemetry slots and future/missing slots
    data_points = [p for p in res_th.points if p.hasData]
    empty_points = [p for p in res_th.points if not p.hasData]
    assert len(data_points) > 0
    assert len(data_points) + len(empty_points) == 288
    if empty_points:
        assert empty_points[0].solar is None
        assert empty_points[0].totalGeneration is None
        assert empty_points[0].price is None
    assert data_points[0].totalGeneration is not None


def test_api_strict_interval_restrictions():
    """Verify HTTP 400 on invalid parameters and interval restrictions."""
    # 1. Invalid date format
    with pytest.raises(HTTPException) as exc1:
        get_energy(
            response=Response(),
            country="TH",
            start_date="invalid",
            end_date="2026-09-07",
        )
    assert exc1.value.status_code == 400

    # 2. start_date > end_date
    with pytest.raises(HTTPException) as exc2:
        get_energy(
            response=Response(),
            country="TH",
            start_date="2026-09-10",
            end_date="2026-09-07",
        )
    assert exc2.value.status_code == 400
    assert "must be on or before" in exc2.value.detail

    # 3. yearly query with 1d interval
    with pytest.raises(HTTPException) as exc3:
        get_energy(
            response=Response(),
            country="TH",
            start_date="2025-09-07",
            end_date="2026-09-07",
            interval="1d",
        )
    assert exc3.value.status_code == 400
    assert "minimum allowed interval is '1w'" in exc3.value.detail

    # 3b. 31-day monthly query with 1d interval succeeds
    res_31d = get_energy(
        response=Response(),
        country="TH",
        start_date="2026-08-01",
        end_date="2026-08-31",
        interval="1d",
    )
    assert res_31d.interval == "1d"
    assert len(res_31d.points) == 31

    # 4. span > 7 days with 5m interval
    with pytest.raises(HTTPException) as exc4:
        get_energy(
            response=Response(),
            country="TH",
            start_date="2026-08-25",
            end_date="2026-09-07",
            interval="5m",
        )
    assert exc4.value.status_code == 400
    assert "minimum allowed interval is '1d'" in exc4.value.detail

    # 5. span > 3 days with 5m interval
    with pytest.raises(HTTPException) as exc5:
        get_energy(
            response=Response(),
            country="TH",
            start_date="2026-09-01",
            end_date="2026-09-07",
            interval="5m",
        )
    assert exc5.value.status_code == 400
    assert "minimum allowed interval is '30m'" in exc5.value.detail


def test_api_intervals_1w_and_1m():
    """Verify that 1w and 1m intervals work for longer date spans."""
    res_1w = get_energy(
        response=Response(),
        country="TH",
        start_date="2026-06-01",
        end_date="2026-08-31",
        interval="1w",
    )
    assert res_1w.country == "TH"
    assert res_1w.interval == "1w"
    assert len(res_1w.points) > 0

    res_1m = get_energy(
        response=Response(),
        country="TH",
        start_date="2026-01-01",
        end_date="2026-08-31",
        interval="1m",
    )
    assert res_1m.country == "TH"
    assert res_1m.interval == "1m"
    assert len(res_1m.points) == 8  # Jan to Aug 2026 (8 calendar months)
    assert res_1m.points[0].timestamp == "2026-01"
    assert res_1m.points[-1].timestamp == "2026-08"


def test_api_tiered_cache_control_and_capture_prices():
    """Verify tiered Cache-Control headers and diurnal capture price/BESS spread metrics."""
    # 1. 1d range -> s-maxage=300
    resp_1d = Response()
    res_1d = get_energy(
        response=resp_1d,
        country="PH",
        start_date="2026-09-06",
        end_date="2026-09-06",
    )
    assert "s-maxage=300" in resp_1d.headers["Cache-Control"]
    assert "stale-while-revalidate=900" in resp_1d.headers["Cache-Control"]

    # Verify SummaryMetrics capture prices and BESS spread
    assert res_1d.summary.solarCapturePriceLocal is not None
    assert res_1d.summary.solarCapturePriceLocal > 0
    assert res_1d.summary.solarCaptureRatio is not None
    assert res_1d.summary.solarCaptureRatio > 0
    assert res_1d.summary.bessSpreadLocal is not None
    assert res_1d.summary.bessSpreadLocal > 0

    # Verify FuelBreakdownRow capture prices
    solar_row = next((r for r in res_1d.breakdown if r.fuelTech == "solar"), None)
    assert solar_row is not None
    assert solar_row.capturePriceLocal is not None
    assert solar_row.captureRatio is not None

    # 2. 30d range -> s-maxage=3600
    resp_30d = Response()
    res_30d = get_energy(
        response=resp_30d,
        country="PH",
        start_date="2026-08-08",
        end_date="2026-09-06",
    )
    assert res_30d.range == "30d"
    assert "s-maxage=3600" in resp_30d.headers["Cache-Control"]
    assert "stale-while-revalidate=86400" in resp_30d.headers["Cache-Control"]


def test_api_pro_catalog_endpoint():
    """Verify the /api/pro/catalog metadata endpoint returns the 3 commercial B2B packs."""
    resp = Response()
    catalog = get_pro_catalog(response=resp)
    assert "s-maxage=3600" in resp.headers["Cache-Control"]
    assert len(catalog.products) == 3

    product_ids = [p.id for p in catalog.products]
    assert "wesm-nodal-parquet" in product_ids
    assert "solar-bess-capture-pack" in product_ids
    assert "scope2-carbon-intensity-pack" in product_ids

    prices = {p.id: p.priceUSD for p in catalog.products}
    assert prices["wesm-nodal-parquet"] == 399
    assert prices["solar-bess-capture-pack"] == 149
    assert prices["scope2-carbon-intensity-pack"] == 99


def test_api_invalid_region_raises_400():
    """Verify invalid region raises HTTP 400 with allowed regions list before hitting DB."""
    with pytest.raises(HTTPException) as excinfo:
        get_energy(
            response=Response(),
            country="PH",
            region="INVALID_REGION",
            start_date="2026-09-06",
            end_date="2026-09-06",
        )
    assert excinfo.value.status_code == 400
    assert (
        "Unsupported region 'INVALID_REGION' for country 'PH'" in excinfo.value.detail
    )
    assert "Allowed: ALL, LUZON, VISAYAS, MINDANAO" in excinfo.value.detail


def test_api_out_of_bounds_dates_raise_400():
    """Verify historical date < 2020-01-01 or date span > 1100 days raises HTTP 400."""
    # 1. Historical date before 2020-01-01
    with pytest.raises(HTTPException) as exc1:
        get_energy(
            response=Response(),
            country="PH",
            start_date="1990-01-01",
            end_date="1990-01-02",
        )
    assert exc1.value.status_code == 400
    assert "minimum allowed date" in exc1.value.detail

    # 2. Span > 1100 days (~3 years)
    with pytest.raises(HTTPException) as exc2:
        get_energy(
            response=Response(),
            country="PH",
            start_date="2020-01-01",
            end_date="2024-01-01",
        )
    assert exc2.value.status_code == 400
    assert "exceeds maximum allowed span of 1100 days" in exc2.value.detail


def test_api_native_default_arguments():
    """Verify calling get_energy without passing interval works cleanly with native defaults."""
    res = get_energy(
        response=Response(),
        country="PH",
        start_date="2026-09-06",
        end_date="2026-09-06",
    )
    assert res.country == "PH"
    assert res.region == "ALL"
    assert res.interval == "5m"
    assert len(res.points) > 0


def test_api_http_exception_handler_cache_headers():
    """Verify exception handler attaches edge Cache-Control headers to 400 and 404 responses."""
    resp_400 = asyncio.run(
        http_exception_handler(
            None, HTTPException(status_code=400, detail="Invalid parameter")
        )
    )
    assert resp_400.status_code == 400
    assert resp_400.headers.get("Cache-Control") == "public, s-maxage=300"

    resp_404 = asyncio.run(
        http_exception_handler(None, HTTPException(status_code=404, detail="Not found"))
    )
    assert resp_404.status_code == 404
    assert resp_404.headers.get("Cache-Control") == "public, s-maxage=300"

    resp_500 = asyncio.run(
        http_exception_handler(
            None, HTTPException(status_code=500, detail="Internal server error")
        )
    )
    assert resp_500.status_code == 500
    assert "Cache-Control" not in resp_500.headers
