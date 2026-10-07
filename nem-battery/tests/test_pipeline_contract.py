"""Tests for the data contract between battery_revenue_interval and battery_revenue_daily.

Verifies:
  1. ingest_interval + ingest_daily_summary produce a daily row whose totals match
     the sum of interval rows.
  2. The midnight interval (settlement_date = trading_day+1 00:00:00) is attributed
     to the correct trading day by the getIntervalsForDay range query.
  3. recompute_daily_from_intervals produces the same totals as ingest_daily_summary.
  4. force=True idempotency: calling ingest_daily_summary twice with force=True
     leaves exactly one row with stable values.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from math import isclose

import duckdb
import pytest

from nem_battery._types import (
    DispatchDay,
    DispatchInterval,
    RegionPrices,
    UnitSolution,
)
from nem_battery.battery import Battery, KNOWN_BATTERIES
from nem_battery.pipeline import (
    ensure_schema,
    ingest_daily_summary,
    ingest_interval,
    recompute_daily_from_intervals,
)

_TEST_KEY = "test_battery"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _region_prices(dt: datetime, rrp: float = 100.0) -> RegionPrices:
    return RegionPrices(
        region="SA1",
        settlement_date=dt,
        rrp=rrp,
        raise6sec=5.0,
        raise60sec=3.0,
        raise5min=2.0,
        raisereg=10.0,
        lower6sec=4.0,
        lower60sec=2.0,
        lower5min=1.5,
        lowerreg=8.0,
        raise1sec=1.0,
        lower1sec=1.0,
    )


def _unit_solution(duid: str, dt: datetime) -> UnitSolution:
    return UnitSolution(
        duid=duid,
        settlement_date=dt,
        total_cleared=50.0,
        raise6sec=10.0,
        raise60sec=0.0,
        raise5min=0.0,
        raisereg=0.0,
        lower6sec=0.0,
        lower60sec=0.0,
        lower5min=0.0,
        lowerreg=5.0,
        raise1sec=0.0,
        lower1sec=0.0,
    )


def _build_trading_day(trading_day: date, battery_duid: str) -> DispatchDay:
    """288 intervals from 00:05 through 00:00 next calendar day."""
    start = datetime(trading_day.year, trading_day.month, trading_day.day, 0, 5)
    intervals = []
    for i in range(288):
        dt = start + timedelta(minutes=5 * i)
        intervals.append(
            DispatchInterval(
                settlement_date=dt,
                prices={"SA1": _region_prices(dt, rrp=100.0 + i)},
                unit_solutions={battery_duid: _unit_solution(battery_duid, dt)},
            )
        )
    return DispatchDay(date=trading_day, intervals=intervals)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def test_battery() -> Battery:
    return Battery(
        name="Test Battery",
        region="SA1",
        generator_duid="TESTB1",
        load_duid=None,
        mw_capacity=100.0,
        mwh_capacity=200.0,
    )


@pytest.fixture
def registered_battery(test_battery: Battery, monkeypatch: pytest.MonkeyPatch) -> Battery:
    """Register test_battery in KNOWN_BATTERIES for the duration of the test."""
    monkeypatch.setitem(KNOWN_BATTERIES, _TEST_KEY, test_battery)
    return test_battery


@pytest.fixture
def mem_conn() -> duckdb.DuckDBPyConnection:
    conn = duckdb.connect(":memory:")
    ensure_schema(conn)
    return conn


# ---------------------------------------------------------------------------
# Test 1: interval sum == daily row
# ---------------------------------------------------------------------------


def test_daily_row_totals_match_interval_sum(
    mem_conn: duckdb.DuckDBPyConnection,
    registered_battery: Battery,
) -> None:
    trading_day = date(2026, 3, 15)
    dispatch_day = _build_trading_day(trading_day, registered_battery.generator_duid)

    for interval in dispatch_day.intervals:
        ingest_interval(mem_conn, interval, battery_keys={_TEST_KEY})
    ingest_daily_summary(mem_conn, dispatch_day, battery_keys={_TEST_KEY})

    iv_row = mem_conn.execute(
        """
        SELECT COUNT(*), SUM(net), SUM(energy_revenue - energy_cost), SUM(total_fcas)
        FROM battery_revenue_interval
        WHERE battery_key = ?
          AND settlement_date > ?::DATE
          AND settlement_date <= (?::DATE + INTERVAL '1 day')
        """,
        [_TEST_KEY, trading_day, trading_day],
    ).fetchone()
    iv_count, iv_net, iv_net_energy, iv_fcas = iv_row

    d_row = mem_conn.execute(
        """
        SELECT interval_count, net, net_energy, total_fcas_revenue
        FROM battery_revenue_daily
        WHERE battery_key = ? AND date = ?
        """,
        [_TEST_KEY, trading_day],
    ).fetchone()
    assert d_row is not None, "Daily row must exist after ingest_daily_summary"
    d_count, d_net, d_net_energy, d_fcas = d_row

    assert iv_count == 288
    assert d_count == 288
    assert isclose(iv_net, d_net, rel_tol=1e-9), f"net: iv={iv_net} d={d_net}"
    assert isclose(iv_net_energy, d_net_energy, rel_tol=1e-9)
    assert isclose(iv_fcas, d_fcas, rel_tol=1e-9)


# ---------------------------------------------------------------------------
# Test 2: midnight interval attributed to the correct trading day
# ---------------------------------------------------------------------------


def test_midnight_interval_attributed_to_trading_day(
    mem_conn: duckdb.DuckDBPyConnection,
    registered_battery: Battery,
) -> None:
    trading_day = date(2026, 3, 15)
    midnight_dt = datetime(2026, 3, 16, 0, 0, 0)  # settlement_date = day+1 00:00:00

    ingest_interval(
        mem_conn,
        DispatchInterval(
            settlement_date=midnight_dt,
            prices={"SA1": _region_prices(midnight_dt)},
            unit_solutions={
                registered_battery.generator_duid: _unit_solution(
                    registered_battery.generator_duid, midnight_dt
                )
            },
        ),
        battery_keys={_TEST_KEY},
    )

    # getIntervalsForDay range (settlement_date > date AND <= date+1 day)
    count_in_day = mem_conn.execute(
        """
        SELECT COUNT(*)
        FROM battery_revenue_interval
        WHERE battery_key = ?
          AND settlement_date > ?::DATE
          AND settlement_date <= (?::DATE + INTERVAL '1 day')
        """,
        [_TEST_KEY, trading_day, trading_day],
    ).fetchone()[0]
    assert count_in_day == 1, "Midnight interval must be included in its trading day"

    # getAvailableDates attribution: (settlement_date - 5 min)::DATE
    attributed = mem_conn.execute(
        """
        SELECT DISTINCT (settlement_date - INTERVAL '5 minutes')::DATE
        FROM battery_revenue_interval
        WHERE battery_key = ?
        """,
        [_TEST_KEY],
    ).fetchone()[0]
    assert attributed == trading_day, f"Expected {trading_day}, got {attributed}"

    # Must NOT bleed into the next day's window
    count_next = mem_conn.execute(
        """
        SELECT COUNT(*)
        FROM battery_revenue_interval
        WHERE battery_key = ?
          AND settlement_date > (?::DATE + INTERVAL '1 day')
          AND settlement_date <= (?::DATE + INTERVAL '2 days')
        """,
        [_TEST_KEY, trading_day, trading_day],
    ).fetchone()[0]
    assert count_next == 0


# ---------------------------------------------------------------------------
# Test 3: recompute_daily_from_intervals matches ingest_daily_summary
# ---------------------------------------------------------------------------


def test_recompute_daily_matches_ingest_daily_summary(
    mem_conn: duckdb.DuckDBPyConnection,
    registered_battery: Battery,
) -> None:
    trading_day = date(2026, 3, 15)
    dispatch_day = _build_trading_day(trading_day, registered_battery.generator_duid)

    for interval in dispatch_day.intervals:
        ingest_interval(mem_conn, interval, battery_keys={_TEST_KEY})
    ingest_daily_summary(mem_conn, dispatch_day, battery_keys={_TEST_KEY})

    (orig_net,) = mem_conn.execute(
        "SELECT net FROM battery_revenue_daily WHERE battery_key = ? AND date = ?",
        [_TEST_KEY, trading_day],
    ).fetchone()

    # Corrupt the daily row to confirm recompute fixes it
    mem_conn.execute(
        "UPDATE battery_revenue_daily SET net = 0.0 WHERE battery_key = ? AND date = ?",
        [_TEST_KEY, trading_day],
    )

    recompute_daily_from_intervals(mem_conn, trading_day, trading_day, battery_keys={_TEST_KEY})

    (recomputed,) = mem_conn.execute(
        "SELECT net FROM battery_revenue_daily WHERE battery_key = ? AND date = ?",
        [_TEST_KEY, trading_day],
    ).fetchone()
    assert isclose(orig_net, recomputed, rel_tol=1e-9), f"recomputed={recomputed} orig={orig_net}"


# ---------------------------------------------------------------------------
# Test 4: force=True idempotency
# ---------------------------------------------------------------------------


def test_ingest_daily_force_is_idempotent(
    mem_conn: duckdb.DuckDBPyConnection,
    registered_battery: Battery,
) -> None:
    trading_day = date(2026, 3, 15)
    dispatch_day = _build_trading_day(trading_day, registered_battery.generator_duid)

    for interval in dispatch_day.intervals:
        ingest_interval(mem_conn, interval, battery_keys={_TEST_KEY})

    ingest_daily_summary(mem_conn, dispatch_day, battery_keys={_TEST_KEY}, force=True)
    (net_first,) = mem_conn.execute(
        "SELECT net FROM battery_revenue_daily WHERE battery_key = ? AND date = ?",
        [_TEST_KEY, trading_day],
    ).fetchone()

    ingest_daily_summary(mem_conn, dispatch_day, battery_keys={_TEST_KEY}, force=True)
    rows = mem_conn.execute(
        "SELECT net FROM battery_revenue_daily WHERE battery_key = ? AND date = ?",
        [_TEST_KEY, trading_day],
    ).fetchall()

    assert len(rows) == 1, f"Expected 1 row, got {len(rows)}"
    assert isclose(rows[0][0], net_first, rel_tol=1e-9)
