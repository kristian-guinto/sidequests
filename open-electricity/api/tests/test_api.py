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


def test_api_get_energy_not_found():
    with pytest.raises(HTTPException) as excinfo:
        get_energy(response=Response(), country="VN", range="7d")
    assert excinfo.value.status_code == 404
