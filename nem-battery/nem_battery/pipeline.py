"""
MotherDuck (DuckDB cloud) pipeline for NEM battery data.

Database targets
----------------
Targets are named connection profiles stored in ``pyproject.toml``::

    [tool.nem-battery.targets.local]
    url = "nem_battery.db"

    [tool.nem-battery.targets.remote]
    url = "md:nem_battery"

Two built-in fallback targets are always available even without config:

=========  ===================
Target     Default URL
=========  ===================
local      ``nem_battery.db``
remote     ``md:nem_battery``
=========  ===================

For MotherDuck targets (``md:`` scheme) set the ``MOTHERDUCK_TOKEN``
environment variable; it is appended to the URL automatically.

Schema
------
dispatch_prices          One row per (settlement_date, region).
                         Raw AEMO clearing prices for all eight FCAS services
                         plus the energy RRP.

battery_revenue_interval One row per (settlement_date, battery_key).
                         5-minute revenue from ``calculate_revenue()`` for
                         every battery in KNOWN_BATTERIES.

battery_revenue_daily    One row per (date, battery_key).
                         Full-day aggregated revenue from
                         ``calculate_daily_revenue()``; populated by the
                         nightly ingest job.

Idempotency
-----------
All INSERT statements use ``ON CONFLICT DO NOTHING``.  Re-running the
same interval or day is safe and leaves existing rows untouched.  The
pipeline can therefore be triggered from an unreliable cron (e.g. GitHub
Actions with variable scheduling jitter) without producing duplicates.
"""

from __future__ import annotations

import os
import tomllib
from datetime import date, timedelta
from pathlib import Path
from typing import TYPE_CHECKING

from dotenv import load_dotenv

from nem_battery.battery import KNOWN_BATTERIES, calculate_daily_revenue, calculate_revenue
from nem_battery.reports.dispatch import fetch_dispatch_interval
from nem_battery.reports.nextday import fetch_next_day_dispatch
from nem_battery.types import DispatchDay, DispatchInterval

if TYPE_CHECKING:
    import duckdb as _duckdb_mod

load_dotenv()

# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

_CREATE_PRICES = """
CREATE TABLE IF NOT EXISTS dispatch_prices (
    settlement_date TIMESTAMP NOT NULL,
    region          VARCHAR   NOT NULL,
    rrp             DOUBLE,
    raise6sec       DOUBLE,
    raise60sec      DOUBLE,
    raise5min       DOUBLE,
    raisereg        DOUBLE,
    lower6sec       DOUBLE,
    lower60sec      DOUBLE,
    lower5min       DOUBLE,
    lowerreg        DOUBLE,
    PRIMARY KEY (settlement_date, region)
)
"""

_INSERT_PRICES = """
INSERT INTO dispatch_prices VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT DO NOTHING
"""

_CREATE_INTERVAL = """
CREATE TABLE IF NOT EXISTS battery_revenue_interval (
    settlement_date TIMESTAMP NOT NULL,
    battery_key     VARCHAR   NOT NULL,
    battery_name    VARCHAR   NOT NULL,
    region          VARCHAR   NOT NULL,
    discharge_mw    DOUBLE,
    charge_mw       DOUBLE,
    rrp             DOUBLE,
    energy_revenue  DOUBLE,
    energy_cost     DOUBLE,
    total_fcas      DOUBLE,
    net             DOUBLE,
    raise6sec       DOUBLE,
    raise60sec      DOUBLE,
    raise5min       DOUBLE,
    raisereg        DOUBLE,
    lower6sec       DOUBLE,
    lower60sec      DOUBLE,
    lower5min       DOUBLE,
    lowerreg        DOUBLE,
    PRIMARY KEY (settlement_date, battery_key)
)
"""

_CREATE_DAILY = """
CREATE TABLE IF NOT EXISTS battery_revenue_daily (
    date                 DATE    NOT NULL,
    battery_key          VARCHAR NOT NULL,
    battery_name         VARCHAR NOT NULL,
    region               VARCHAR NOT NULL,
    interval_count       INTEGER,
    total_energy_revenue DOUBLE,
    total_energy_cost    DOUBLE,
    net_energy           DOUBLE,
    total_fcas_revenue   DOUBLE,
    net                  DOUBLE,
    raise6sec            DOUBLE,
    raise60sec           DOUBLE,
    raise5min            DOUBLE,
    raisereg             DOUBLE,
    lower6sec            DOUBLE,
    lower60sec           DOUBLE,
    lower5min            DOUBLE,
    lowerreg             DOUBLE,
    PRIMARY KEY (date, battery_key)
)
"""

_INSERT_INTERVAL = """
INSERT INTO battery_revenue_interval VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?, ?, ?
)
ON CONFLICT DO NOTHING
"""

_INSERT_DAILY = """
INSERT INTO battery_revenue_daily VALUES (
    ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?, ?, ?
)
ON CONFLICT DO NOTHING
"""


# ---------------------------------------------------------------------------
# Target configuration
# ---------------------------------------------------------------------------

_BUILTIN_TARGETS: dict[str, str] = {
    "local": "nem_battery.db",
    "remote": "md:nem_battery",
}


def _find_pyproject() -> Path | None:
    """Return the first pyproject.toml found by walking up from CWD."""
    for parent in (Path.cwd(), *Path.cwd().parents):
        candidate = parent / "pyproject.toml"
        if candidate.exists():
            return candidate
    return None


def load_targets() -> dict[str, str]:
    """Load named database target URLs from pyproject.toml.

    Reads from the first ``pyproject.toml`` found by walking up from CWD.
    Expected format::

        [tool.nem-battery.targets.local]
        url = "nem_battery.db"

        [tool.nem-battery.targets.remote]
        url = "md:nem_battery"

    Returns:
        Mapping of target name → connection URL. Empty dict if no config
        section is found.
    """
    path = _find_pyproject()
    if path is None:
        return {}
    with open(path, "rb") as f:
        data = tomllib.load(f)
    raw = data.get("tool", {}).get("nem-battery", {}).get("targets", {})
    return {name: str(cfg["url"]) for name, cfg in raw.items() if "url" in cfg}


# ---------------------------------------------------------------------------
# Connection
# ---------------------------------------------------------------------------


def connect(url: str) -> _duckdb_mod.DuckDBPyConnection:
    """Open a DuckDB / MotherDuck connection to an explicit URL.

    For named targets defined in pyproject.toml prefer :func:`connect_target`.

    Args:
        url: DuckDB connection string, e.g. ``"nem_battery.db"``,
             ``":memory:"``, or ``"md:nem_battery"``.

    Raises:
        ImportError: if ``duckdb`` is not installed.
    """
    try:
        import duckdb
    except ImportError as exc:
        raise ImportError(
            "duckdb is required for the pipeline. "
            "Install it with: pip install 'nem-battery[pipeline]'"
        ) from exc
    return duckdb.connect(url)


def connect_target(target: str = "local") -> _duckdb_mod.DuckDBPyConnection:
    """Connect to a named database target.

    Target URLs are read from ``[tool.nem-battery.targets.*]`` in
    ``pyproject.toml``.  Two built-in targets are always available when
    no config is found: ``local`` (``nem_battery.db``) and ``remote``
    (``md:nem_battery``).

    For MotherDuck URLs (``md:``), the ``MOTHERDUCK_TOKEN`` environment
    variable is appended automatically when set and not already present
    in the URL.

    Args:
        target: Target name as defined in pyproject.toml (e.g. ``"local"``,
                ``"remote"``).

    Raises:
        ValueError:   If the target name is not found.
        ImportError:  If ``duckdb`` is not installed.
    """
    targets = load_targets()
    if target in targets:
        url = targets[target]
    elif target in _BUILTIN_TARGETS:
        url = _BUILTIN_TARGETS[target]
    else:
        known = ", ".join(f"'{t}'" for t in sorted(targets)) or "none configured"
        raise ValueError(f"Unknown target '{target}'. Targets in pyproject.toml: {known}")

    # Append MOTHERDUCK_TOKEN when connecting to MotherDuck without an
    # explicit token already in the URL.
    if url.startswith("md:") and "motherduck_token" not in url:
        token = os.environ.get("MOTHERDUCK_TOKEN")
        if token:
            sep = "&" if "?" in url else "?"
            url = f"{url}{sep}motherduck_token={token}"

    return connect(url)


def ensure_schema(conn: _duckdb_mod.DuckDBPyConnection) -> None:
    """Create pipeline tables if they don't exist (idempotent)."""
    conn.execute(_CREATE_PRICES)
    conn.execute(_CREATE_INTERVAL)
    conn.execute(_CREATE_DAILY)


# ---------------------------------------------------------------------------
# Row builders
# ---------------------------------------------------------------------------


def _price_rows(interval: DispatchInterval) -> list[tuple]:
    rows = []
    for region, p in interval.prices.items():
        rows.append(
            (
                interval.settlement_date,
                region,
                p.rrp,
                p.raise6sec,
                p.raise60sec,
                p.raise5min,
                p.raisereg,
                p.lower6sec,
                p.lower60sec,
                p.lower5min,
                p.lowerreg,
            )
        )
    return rows


def _revenue_interval_rows(
    interval: DispatchInterval,
    battery_keys: set[str] | None = None,
) -> list[tuple]:
    rows = []
    for key, battery in KNOWN_BATTERIES.items():
        if battery_keys is not None and key not in battery_keys:
            continue
        if battery.region not in interval.prices:
            continue
        rev = calculate_revenue(battery, interval)
        prices = interval.price(battery.region)
        fcas = rev.fcas_revenue
        rows.append(
            (
                interval.settlement_date,
                key,
                battery.name,
                battery.region,
                rev.discharge_mw,
                rev.charge_mw,
                prices.rrp,
                rev.energy_revenue,
                rev.energy_cost,
                rev.total_fcas,
                rev.net,
                fcas.get("RAISE6SEC", 0.0),
                fcas.get("RAISE60SEC", 0.0),
                fcas.get("RAISE5MIN", 0.0),
                fcas.get("RAISEREG", 0.0),
                fcas.get("LOWER6SEC", 0.0),
                fcas.get("LOWER60SEC", 0.0),
                fcas.get("LOWER5MIN", 0.0),
                fcas.get("LOWERREG", 0.0),
            )
        )
    return rows


def _revenue_daily_rows(
    dispatch_day: DispatchDay,
    battery_keys: set[str] | None = None,
) -> list[tuple]:
    rows = []
    for key, battery in KNOWN_BATTERIES.items():
        if battery_keys is not None and key not in battery_keys:
            continue
        rev = calculate_daily_revenue(battery, dispatch_day)
        fcas_by_svc = {
            svc: sum(i.fcas_revenue.get(svc, 0.0) for i in rev.intervals)
            for svc in (
                "RAISE6SEC",
                "RAISE60SEC",
                "RAISE5MIN",
                "RAISEREG",
                "LOWER6SEC",
                "LOWER60SEC",
                "LOWER5MIN",
                "LOWERREG",
            )
        }
        rows.append(
            (
                dispatch_day.date,
                key,
                battery.name,
                battery.region,
                len(rev.intervals),
                rev.total_energy_revenue,
                rev.total_energy_cost,
                rev.net_energy,
                rev.total_fcas_revenue,
                rev.total,
                fcas_by_svc["RAISE6SEC"],
                fcas_by_svc["RAISE60SEC"],
                fcas_by_svc["RAISE5MIN"],
                fcas_by_svc["RAISEREG"],
                fcas_by_svc["LOWER6SEC"],
                fcas_by_svc["LOWER60SEC"],
                fcas_by_svc["LOWER5MIN"],
                fcas_by_svc["LOWERREG"],
            )
        )
    return rows


# ---------------------------------------------------------------------------
# Ingest helpers
# ---------------------------------------------------------------------------


def ingest_interval(
    conn: _duckdb_mod.DuckDBPyConnection,
    interval: DispatchInterval,
    battery_keys: set[str] | None = None,
    force: bool = False,
) -> tuple[int, int]:
    """Insert one DispatchInterval into dispatch_prices and battery_revenue_interval.

    Args:
        battery_keys: If set, only process these battery keys.
        force:        If True, delete existing rows for the given batteries before
                      inserting so that updated revenue figures replace stale data.
                      When battery_keys is None and force is True, all batteries
                      for this settlement_date are replaced.

    Returns:
        (prices_attempted, revenue_attempted) row counts.
    """
    price_rows = _price_rows(interval)
    revenue_rows = _revenue_interval_rows(interval, battery_keys)
    if force and revenue_rows:
        keys_to_delete = battery_keys or set(KNOWN_BATTERIES)
        placeholders = ", ".join(["?"] * len(keys_to_delete))
        conn.execute(
            f"DELETE FROM battery_revenue_interval "
            f"WHERE settlement_date = ? AND battery_key IN ({placeholders})",
            [interval.settlement_date, *keys_to_delete],
        )
    if price_rows:
        conn.executemany(_INSERT_PRICES, price_rows)
    if revenue_rows:
        conn.executemany(_INSERT_INTERVAL, revenue_rows)
    return len(price_rows), len(revenue_rows)


def ingest_daily_summary(
    conn: _duckdb_mod.DuckDBPyConnection,
    dispatch_day: DispatchDay,
    battery_keys: set[str] | None = None,
    force: bool = False,
) -> int:
    """Insert full-day aggregated revenue rows into battery_revenue_daily.

    Args:
        battery_keys: If set, only process these battery keys.
        force:        If True, delete existing rows for the given batteries before
                      inserting.

    Returns:
        Number of rows attempted.
    """
    rows = _revenue_daily_rows(dispatch_day, battery_keys)
    if force and rows:
        keys_to_delete = battery_keys or set(KNOWN_BATTERIES)
        placeholders = ", ".join(["?"] * len(keys_to_delete))
        conn.execute(
            f"DELETE FROM battery_revenue_daily "
            f"WHERE date = ? AND battery_key IN ({placeholders})",
            [dispatch_day.date, *keys_to_delete],
        )
    if rows:
        conn.executemany(_INSERT_DAILY, rows)
    return len(rows)


# ---------------------------------------------------------------------------
# High-level async entry points (used by CLI subcommands and GitHub Actions)
# ---------------------------------------------------------------------------


async def run_ingest_interval(target: str = "local") -> None:
    """Fetch the latest 5-minute dispatch interval and persist to DB.

    Intended for the every-5-minutes cron job.

    Args:
        target: Database target name from pyproject.toml (default: ``"local"``).
    """
    print("Fetching latest dispatch interval…")
    interval = await fetch_dispatch_interval()
    conn = connect_target(target)
    ensure_schema(conn)
    n_p, n_r = ingest_interval(conn, interval)
    conn.close()
    dt = interval.settlement_date.isoformat(sep=" ")
    print(f"Ingested {dt}  prices={n_p}  revenue_interval={n_r}")


async def run_ingest_day(
    day: date,
    target: str = "local",
    battery_keys: set[str] | None = None,
    force: bool = False,
) -> None:
    """Fetch a full historical trading day and persist all intervals plus daily summary.

    Populates both ``battery_revenue_interval`` (one row per 5-min interval
    per battery) and ``battery_revenue_daily`` (one aggregated row per battery).

    Args:
        day:          Historical trading day (must be at least yesterday AEST).
        target:       Database target name from pyproject.toml (default: ``"local"``).
        battery_keys: If set, only process these battery keys.
        force:        If True, delete and replace existing rows (upsert behaviour).
    """
    print(f"Fetching Next Day Dispatch for {day}…")
    dispatch_day = await fetch_next_day_dispatch(day)
    conn = connect_target(target)
    ensure_schema(conn)
    total_p = total_r = 0
    for interval in dispatch_day.intervals:
        n_p, n_r = ingest_interval(conn, interval, battery_keys=battery_keys, force=force)
        total_p += n_p
        total_r += n_r
    n_daily = ingest_daily_summary(conn, dispatch_day, battery_keys=battery_keys, force=force)
    conn.close()
    label = f" (batteries: {', '.join(sorted(battery_keys))})" if battery_keys else ""
    print(
        f"Ingested {day}{label}  intervals={len(dispatch_day.intervals)}  "
        f"prices={total_p}  revenue_interval={total_r}  revenue_daily={n_daily}"
    )


async def run_backfill(
    start: date,
    end: date,
    target: str = "local",
    battery_keys: set[str] | None = None,
    force: bool = False,
) -> None:
    """Ingest every trading day in [start, end] inclusive.

    Days that fail (e.g. data not yet published) are printed and skipped
    so the rest of the range still completes.

    Args:
        start:        First trading day to ingest.
        end:          Last trading day to ingest (inclusive).
        target:       Database target name from pyproject.toml (default: ``"local"``).
        battery_keys: If set, only process these battery keys.
        force:        If True, delete and replace existing rows (upsert behaviour).
    """
    day = start
    while day <= end:
        try:
            await run_ingest_day(day, target, battery_keys=battery_keys, force=force)
        except Exception as exc:  # noqa: BLE001
            print(f"  skip {day}: {exc}")
        day += timedelta(days=1)
