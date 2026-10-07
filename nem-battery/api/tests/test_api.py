"""Unit and integration tests for NEM Battery FastAPI Serverless API."""

import os
from pathlib import Path
import pytest
from fastapi import HTTPException, Response

# Ensure tests point to local DB if available
LOCAL_DB = Path(__file__).resolve().parents[2] / "nem_battery.db"
if not LOCAL_DB.exists():
    PARENT_DB = Path(__file__).resolve().parents[3] / "nem_battery.db"
    if PARENT_DB.exists():
        os.environ["DATABASE_URL"] = str(PARENT_DB)

from api.index import (
    KNOWN_BATTERIES,
    get_batteries_metadata,
    get_battery_stats,
    get_battery_summaries,
    get_cluster_summaries,
    get_daily_revenue,
    get_health,
    get_intervals,
    get_latest_intervals,
    get_monthly_revenue,
    get_oracle_comparison,
    get_root,
    get_strategy_embeddings,
)


def test_api_root():
    root = get_root()
    assert root["status"] == "online"
    assert root["documentation"] == "/api/docs"


def test_api_health():
    res = Response()
    health = get_health(res)
    assert health["status"] == "healthy"
    assert "battery_revenue_daily" in health["tables"]
    assert "battery_revenue_interval" in health["tables"]


def test_batteries_metadata():
    meta = get_batteries_metadata()
    assert "hornsdale" in meta
    assert meta["hornsdale"]["region"] == "SA1"
    assert meta["hornsdale"]["mw"] == 150.0


def test_battery_summaries():
    summaries = get_battery_summaries()
    assert len(summaries) == len(KNOWN_BATTERIES)
    keys = {s["battery_key"] for s in summaries}
    assert "hornsdale" in keys
    assert "victorian_big_battery" in keys


def test_daily_revenue():
    rows = get_daily_revenue("hornsdale", days="5")
    assert isinstance(rows, list)
    if rows:
        assert len(rows) <= 5
        assert "net" in rows[0]
        assert "date" in rows[0]


def test_intervals_and_available_dates():
    dates = get_intervals("hornsdale")
    assert isinstance(dates, list)
    if dates:
        assert len(dates) > 0
        sample_date = dates[0]
        intervals = get_intervals("hornsdale", date=sample_date)
        assert isinstance(intervals, list)
        assert len(intervals) > 0
        assert "settlement_date" in intervals[0]


def test_intervals_invalid_date_format():
    with pytest.raises(HTTPException) as exc:
        get_intervals("hornsdale", date="2026/03/19")
    assert exc.value.status_code == 400


def test_monthly_revenue():
    rows = get_monthly_revenue("hornsdale", months="3")
    assert isinstance(rows, list)
    if rows:
        assert len(rows) <= 3
        assert "month" in rows[0]
        assert "net" in rows[0]


def test_battery_stats():
    stats = get_battery_stats("hornsdale")
    assert stats["battery_key"] == "hornsdale"
    assert "total_revenue" in stats
    assert "best_day_revenue" in stats


def test_oracle_comparison():
    rows = get_oracle_comparison("hornsdale", days="5")
    assert isinstance(rows, list)
    if rows:
        assert len(rows) <= 5
        assert "actual" in rows[0]
        assert "oracle" in rows[0]


def test_oracle_unknown_battery():
    with pytest.raises(HTTPException) as exc:
        get_oracle_comparison("non_existent_battery", days="5")
    assert exc.value.status_code == 404


def test_strategy_points():
    points = get_strategy_embeddings()
    assert isinstance(points, list)
    if points:
        p = points[0]
        assert "id" in p
        assert "battery_key" in p
        assert "x" in p
        assert "y" in p
        assert "cluster_id" in p


def test_cluster_summaries():
    clusters = get_cluster_summaries()
    assert isinstance(clusters, list)
    if clusters:
        c = clusters[0]
        assert "cluster_id" in c
        assert "state_reversal_count" in c
