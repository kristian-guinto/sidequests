"""Integration tests for OpenElectricity FastAPI Serverless API."""

import pytest
from fastapi import Response, HTTPException
from api.index import get_energy, get_health


def test_api_health():
    health = get_health(response=Response())
    assert health["status"] == "healthy"
    assert "energy_interval" in health["tables"]
    assert "energy_daily" in health["tables"]
    assert "exchange_rates" in health["tables"]
    assert health["tables"]["energy_interval"] > 0


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
    assert len(empty_points) > 0
    assert len(data_points) + len(empty_points) == 288
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
