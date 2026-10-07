"""
nem-battery CLI — inspect live and historical NEM battery data.

Commands
--------
  list                List known batteries and their DUIDs
  prices              Current spot prices across all NEM regions
  latest              Latest 5-minute interval for a battery
  daily DATE          Full-day revenue summary for a battery
  stream              Live stream of dispatch intervals for a battery
"""

from __future__ import annotations

import asyncio
from datetime import date, datetime, timedelta
from typing import Annotated

import typer

from nem_battery import (
    KNOWN_BATTERIES,
    calculate_daily_revenue,
    calculate_revenue,
    fetch_dispatch_interval,
    fetch_next_day_dispatch,
    stream_dispatch,
)
from nem_battery.battery import Battery
from nem_battery._types import FCAS_SERVICES, DailyRevenue, IntervalRevenue

app = typer.Typer(
    name="nem-battery",
    help="Inspect live and historical NEM battery data from AEMO NEMWeb.",
    no_args_is_help=True,
    add_completion=False,
    epilog="""\
examples:
  nem-battery list
  nem-battery prices
  nem-battery latest --battery hornsdale
  nem-battery daily 2026-03-16 --battery victorian_big_battery
  nem-battery stream --battery wallgrove --scada

  # pipeline (requires: pip install 'nem-battery[pipeline]')
  nem-battery ingest-interval                   # -> local target
  nem-battery ingest-interval --target remote   # -> remote target
  nem-battery ingest-daily                      # yesterday -> local
  nem-battery ingest-daily 2026-03-16 -t remote
  nem-battery backfill 2026-01-01 2026-03-15
  nem-battery db                                # inspect local DB
  nem-battery db --target remote --tail 20 --battery hornsdale""",
)

# ---------------------------------------------------------------------------
# Formatting helpers
# ---------------------------------------------------------------------------


def _hr(char: str = "─", width: int = 60) -> str:
    return char * width


def _fmt_dt(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d %H:%M")


def _fmt_mw(mw: float) -> str:
    return f"{mw:7.1f} MW"


def _fmt_dollar(amount: float, width: int = 10) -> str:
    return f"${amount:{width - 1},.2f}"


def _fmt_dollar_mwh(price: float) -> str:
    return f"${price:9.2f}/MWh"


def _print_interval_revenue(rev: IntervalRevenue, prices_rrp: float) -> None:
    print(f"  Settlement:    {_fmt_dt(rev.settlement_date)}")
    print(f"  RRP:           {_fmt_dollar_mwh(prices_rrp)}")
    print(f"  Discharge:     {_fmt_mw(rev.discharge_mw)}")
    print(f"  Charge:        {_fmt_mw(rev.charge_mw)}")
    print(_hr())
    print(f"  Energy revenue:{_fmt_dollar(rev.energy_revenue)}")
    _print_charge_line(rev.energy_cost)
    print(f"  FCAS total:    {_fmt_dollar(rev.total_fcas)}")
    for svc in FCAS_SERVICES:
        svc_amount = rev.fcas_revenue.get(svc, 0.0)
        if svc_amount != 0.0:
            print(f"    {svc:<12}  {_fmt_dollar(svc_amount)}")
    print(_hr())
    sign = "+" if rev.net >= 0 else ""
    print(f"  Net:           {sign}{_fmt_dollar(rev.net)}")


def _print_charge_line(energy_cost: float) -> None:
    """Print energy_cost with correct sign label.

    energy_cost > 0: battery paid to charge (normal, positive-price period)
    energy_cost < 0: battery earned by charging (negative-price period)
    """
    if energy_cost > 0:
        print(f"  Charge cost:  -{_fmt_dollar(energy_cost)}")
    elif energy_cost < 0:
        print(f"  Charge income: {_fmt_dollar(-energy_cost)}")
    else:
        print(f"  Charge cost:   {_fmt_dollar(0.0)}")


def _print_daily_revenue(rev: DailyRevenue) -> None:
    n = len(rev.intervals)
    print(f"  Date:          {rev.date}")
    print(f"  Intervals:     {n} × 5-min")
    print(_hr())
    print(f"  Energy revenue:{_fmt_dollar(rev.total_energy_revenue)}")
    _print_charge_line(rev.total_energy_cost)
    print(f"  Net energy:    {_fmt_dollar(rev.net_energy)}")
    print(f"  FCAS total:    {_fmt_dollar(rev.total_fcas_revenue)}")
    print(_hr())
    print(f"  Daily net:     {_fmt_dollar(rev.total)}")
    print()

    # Top 5 intervals by net revenue
    if rev.intervals:
        top = sorted(rev.intervals, key=lambda i: i.net, reverse=True)[:5]
        print("  Top 5 intervals by net revenue:")
        for i in top:
            print(f"    {_fmt_dt(i.settlement_date)}  net={_fmt_dollar(i.net, 9)}")


# ---------------------------------------------------------------------------
# Command handlers
# ---------------------------------------------------------------------------


@app.command("list")
def cmd_list() -> None:
    """List all known batteries and their registered DUIDs."""
    fmt = "  {:<22}  {:<5}  {:<12}  {:<12}  {:>6}  {:>7}"
    header = fmt.format("Name", "Rgn", "Gen DUID", "Load DUID", "MW", "MWh")
    print(_hr())
    print(header)
    print(_hr())
    for key, b in KNOWN_BATTERIES.items():
        load = b.load_duid or "—"
        mw = f"{b.mw_capacity:.0f}" if b.mw_capacity else "—"
        mwh = f"{b.mwh_capacity:.0f}" if b.mwh_capacity else "—"
        print(fmt.format(b.name, b.region, b.generator_duid, load, mw, mwh))
        print(f"    key: {key}")
    print(_hr())
    print(f"  {len(KNOWN_BATTERIES)} batteries listed.")


async def _cmd_prices_async() -> None:
    print("Fetching latest dispatch prices…")
    interval = await fetch_dispatch_interval()
    print(f"\nDispatch interval: {_fmt_dt(interval.settlement_date)}")
    print(_hr())
    fmt = "  {:<6}  {:>12}  {:>12}  {:>12}  {:>12}"
    print(fmt.format("Region", "RRP", "RAISE6SEC", "LOWERREG", "RAISEREG"))
    print(_hr())
    for region in ("NSW1", "QLD1", "SA1", "TAS1", "VIC1"):
        if region not in interval.prices:
            continue
        p = interval.prices[region]
        print(
            fmt.format(
                region,
                f"${p.rrp:>9.2f}",
                f"${p.raise6sec:>9.2f}",
                f"${p.lowerreg:>9.2f}",
                f"${p.raisereg:>9.2f}",
            )
        )
    print(_hr())
    print("  Prices in $/MWh. Run again for next 5-min interval.")


@app.command("prices")
def cmd_prices() -> None:
    """Current spot prices across all NEM regions."""
    asyncio.run(_cmd_prices_async())


async def _cmd_latest_async(batteries: list[Battery]) -> None:
    label = "all batteries" if len(batteries) > 1 else batteries[0].name
    print(f"Fetching latest dispatch interval for {label}…")
    interval = await fetch_dispatch_interval()
    print(f"Dispatch interval: {_fmt_dt(interval.settlement_date)}\n")
    for battery in batteries:
        prices = interval.price(battery.region)
        rev = calculate_revenue(battery, interval)
        print(_hr("═"))
        print(f"  {battery.name}  ({battery.region})")
        print(_hr("═"))
        _print_interval_revenue(rev, prices.rrp)
        print()


@app.command("latest")
def cmd_latest(
    battery: Annotated[
        str | None,
        typer.Option(
            "--battery",
            "-b",
            metavar="KEY",
            help="Battery key (from `nem-battery list`). Default: hornsdale",
        ),
    ] = None,
    all_batteries: Annotated[
        bool,
        typer.Option("--all", "-a", help="Show all known batteries in one fetch"),
    ] = False,
) -> None:
    """Latest 5-minute interval for a battery."""
    if all_batteries:
        bats = list(KNOWN_BATTERIES.values())
    else:
        bats = [_resolve_battery(battery)]
    asyncio.run(_cmd_latest_async(bats))


async def _cmd_daily_async(batteries: list[Battery], day: date) -> None:
    label = "all batteries" if len(batteries) > 1 else batteries[0].name
    print(f"Fetching Next Day Dispatch for {day} ({label})…")
    dispatch_day = await fetch_next_day_dispatch(day)
    for battery in batteries:
        rev = calculate_daily_revenue(battery, dispatch_day)
        print(_hr("═"))
        print(f"  {battery.name}  ({battery.region})")
        print(_hr("═"))
        _print_daily_revenue(rev)


@app.command("daily")
def cmd_daily(
    date_str: Annotated[
        str,
        typer.Argument(metavar="DATE", help="Trading day in YYYY-MM-DD format"),
    ],
    battery: Annotated[
        str | None,
        typer.Option(
            "--battery",
            "-b",
            metavar="KEY",
            help="Battery key (from `nem-battery list`). Default: hornsdale",
        ),
    ] = None,
    all_batteries: Annotated[
        bool,
        typer.Option("--all", "-a", help="Show all known batteries in one fetch"),
    ] = False,
) -> None:
    """Full-day revenue summary for a battery."""
    try:
        day = date.fromisoformat(date_str)
    except ValueError:
        typer.echo(f"error: invalid date '{date_str}' — use YYYY-MM-DD", err=True)
        raise typer.Exit(code=1)
    if day >= date.today():
        typer.echo(
            "error: date must be in the past (next-day files are published ~4 AM AEST)",
            err=True,
        )
        raise typer.Exit(code=1)
    if all_batteries:
        bats = list(KNOWN_BATTERIES.values())
    else:
        bats = [_resolve_battery(battery)]
    asyncio.run(_cmd_daily_async(bats, day))


async def _cmd_stream_async(battery: Battery, include_scada: bool) -> None:
    print(f"Streaming live dispatch intervals for {battery.name}…")
    print("Press Ctrl+C to stop.\n")
    print(_hr())
    try:
        async for interval in stream_dispatch(poll_seconds=5.0, include_scada=include_scada):
            prices = interval.price(battery.region)
            rev = calculate_revenue(battery, interval)
            scada_line = ""
            if include_scada and battery.generator_duid in interval.scada:
                scada_mw = interval.scada[battery.generator_duid].scada_value
                scada_line = f"  scada={scada_mw:+.1f} MW"
            print(
                f"{_fmt_dt(interval.settlement_date)}"
                f"  RRP={_fmt_dollar_mwh(prices.rrp)}"
                f"  dis={_fmt_mw(rev.discharge_mw)}"
                f"  chg={_fmt_mw(rev.charge_mw)}"
                f"  net={_fmt_dollar(rev.net, 9)}"
                f"{scada_line}"
            )
    except KeyboardInterrupt:
        print("\nStream stopped.")


@app.command("stream")
def cmd_stream(
    battery: Annotated[
        str | None,
        typer.Option(
            "--battery",
            "-b",
            metavar="KEY",
            help="Battery key (from `nem-battery list`). Default: hornsdale",
        ),
    ] = None,
    scada: Annotated[
        bool,
        typer.Option("--scada", help="Also fetch Dispatch SCADA actual MW per interval"),
    ] = False,
) -> None:
    """Live stream of dispatch intervals for a battery."""
    bat = _resolve_battery(battery)
    asyncio.run(_cmd_stream_async(bat, scada))


# ---------------------------------------------------------------------------
# Pipeline command handlers
# ---------------------------------------------------------------------------

_TARGET_HELP = "Database target from pyproject.toml (default: local)"


@app.command("ingest-interval")
def cmd_ingest_interval(
    target: Annotated[
        str,
        typer.Option("--target", "-t", metavar="NAME", help=_TARGET_HELP),
    ] = "local",
) -> None:
    """Ingest latest 5-min interval into DB (pipeline)."""
    from nem_battery import pipeline

    asyncio.run(pipeline.run_ingest_interval(target))


@app.command("ingest-daily")
def cmd_ingest_daily(
    date_str: Annotated[
        str | None,
        typer.Argument(metavar="DATE", help="Trading day YYYY-MM-DD. Default: yesterday"),
    ] = None,
    target: Annotated[
        str,
        typer.Option("--target", "-t", metavar="NAME", help=_TARGET_HELP),
    ] = "local",
) -> None:
    """Ingest a full historical day into DB (pipeline).

    Always force-replaces existing interval rows with settled Next_Day_Dispatch
    values, correcting any preliminary data written by the 5-min live ingest.
    """
    from nem_battery import pipeline

    if date_str:
        try:
            day = date.fromisoformat(date_str)
        except ValueError:
            typer.echo(f"error: invalid date '{date_str}' — use YYYY-MM-DD", err=True)
            raise typer.Exit(code=1)
        if day >= date.today():
            typer.echo(
                "error: date must be in the past (next-day files are published ~4 AM AEST)",
                err=True,
            )
            raise typer.Exit(code=1)
    else:
        day = date.today() - timedelta(days=1)
        print(f"(no date specified, defaulting to yesterday: {day})")
    asyncio.run(pipeline.run_ingest_day(day, target, force=True))


@app.command("backfill")
def cmd_backfill(
    start: Annotated[str, typer.Argument(metavar="START", help="First trading day YYYY-MM-DD")],
    end: Annotated[
        str,
        typer.Argument(metavar="END", help="Last trading day YYYY-MM-DD (inclusive)"),
    ],
    target: Annotated[
        str,
        typer.Option("--target", "-t", metavar="NAME", help=_TARGET_HELP),
    ] = "local",
    battery: Annotated[
        list[str] | None,
        typer.Option(
            "--battery",
            "-b",
            metavar="KEY",
            help="Only process this battery (repeat for multiple). Default: all batteries.",
        ),
    ] = None,
    force: Annotated[
        bool,
        typer.Option(
            "--force",
            "-f",
            help="Delete and replace existing rows (upsert). Required to correct previously ingested data.",
        ),
    ] = False,
) -> None:
    """Ingest a date range into DB (pipeline)."""
    from nem_battery import pipeline

    try:
        start_date = date.fromisoformat(start)
        end_date = date.fromisoformat(end)
    except ValueError as exc:
        typer.echo(f"error: {exc}", err=True)
        raise typer.Exit(code=1)
    if start_date > end_date:
        typer.echo("error: START must not be after END", err=True)
        raise typer.Exit(code=1)
    if end_date >= date.today():
        typer.echo(
            "error: END must be in the past (next-day files are published ~4 AM AEST)",
            err=True,
        )
        raise typer.Exit(code=1)
    if battery:
        unknown = set(battery) - set(KNOWN_BATTERIES)
        if unknown:
            typer.echo(f"error: unknown battery keys: {', '.join(sorted(unknown))}", err=True)
            raise typer.Exit(code=1)
    battery_keys = set(battery) if battery else None
    asyncio.run(
        pipeline.run_backfill(start_date, end_date, target, battery_keys=battery_keys, force=force)
    )


@app.command("recompute-daily")
def cmd_recompute_daily(
    start: Annotated[str, typer.Argument(metavar="START", help="First trading day YYYY-MM-DD")],
    end: Annotated[
        str,
        typer.Argument(metavar="END", help="Last trading day YYYY-MM-DD (inclusive)"),
    ],
    target: Annotated[
        str,
        typer.Option("--target", "-t", metavar="NAME", help=_TARGET_HELP),
    ] = "local",
    battery: Annotated[
        list[str] | None,
        typer.Option(
            "--battery",
            "-b",
            metavar="KEY",
            help="Only process this battery (repeat for multiple). Default: all batteries.",
        ),
    ] = None,
) -> None:
    """Recompute battery_revenue_daily from stored interval rows (no network I/O).

    Aggregates battery_revenue_interval for the date range and writes the
    results to battery_revenue_daily, replacing any existing rows.  Use this
    after a backfill or when the daily table has drifted from the interval table
    due to config changes or partial-day writes.
    """
    from nem_battery import pipeline

    try:
        start_date = date.fromisoformat(start)
        end_date = date.fromisoformat(end)
    except ValueError as exc:
        typer.echo(f"error: {exc}", err=True)
        raise typer.Exit(code=1)
    if start_date > end_date:
        typer.echo("error: START must not be after END", err=True)
        raise typer.Exit(code=1)
    if battery:
        unknown = set(battery) - set(KNOWN_BATTERIES)
        if unknown:
            typer.echo(f"error: unknown battery keys: {', '.join(sorted(unknown))}", err=True)
            raise typer.Exit(code=1)
    battery_keys = set(battery) if battery else None
    asyncio.run(pipeline.run_recompute_daily(start_date, end_date, target, battery_keys))


def _db_label(target: str) -> str:
    """Return 'target → url' label, sourcing URL from pyproject.toml targets."""
    from nem_battery import pipeline

    targets = pipeline.load_targets()
    builtin = pipeline._BUILTIN_TARGETS
    if target in targets:
        url = targets[target]
        source = "pyproject.toml"
    elif target in builtin:
        url = builtin[target]
        source = "default"
    else:
        url = "unknown"
        source = "unknown"
    return f"{target}  →  {url}  ({source})"


@app.command("db")
def cmd_db(
    target: Annotated[
        str,
        typer.Option("--target", "-t", metavar="NAME", help=_TARGET_HELP),
    ] = "local",
    tail: Annotated[
        int,
        typer.Option(
            "--tail",
            metavar="N",
            help="Number of latest battery_revenue_interval rows to show (default: 10)",
        ),
    ] = 10,
    battery: Annotated[
        str | None,
        typer.Option(
            "--battery", "-b", metavar="KEY", help="Filter latest rows to one battery key"
        ),
    ] = None,
) -> None:
    """Inspect pipeline DB contents (row counts, date range, latest rows)."""
    try:
        import duckdb  # noqa: F401
    except ImportError:
        typer.echo(
            "error: duckdb is not installed. Run: pip install 'nem-battery[pipeline]'",
            err=True,
        )
        raise typer.Exit(code=1)

    from nem_battery import pipeline

    battery_key = battery.lower().replace("-", "_") if battery else None

    conn = pipeline.connect_target(target)

    # ---- connection label --------------------------------------------------
    print(_hr(width=80))
    print(f"  Target:   {_db_label(target)}")
    print(_hr(width=80))

    # ---- table stats -------------------------------------------------------
    fmt_stats = "  {:<28}  {:>10}  {:<17}  {:<17}"
    print(fmt_stats.format("Table", "Rows", "Earliest", "Latest"))
    print(_hr(width=80))
    for table in ("dispatch_prices", "battery_revenue_interval", "battery_revenue_daily"):
        try:
            row = conn.execute(
                f"SELECT COUNT(*), MIN(settlement_date), MAX(settlement_date)"  # noqa: S608
                f" FROM {table}"
            ).fetchone()
            count = f"{row[0]:,}" if row and row[0] else "0"
            earliest = _fmt_dt(row[1]) if row and row[1] else "—"
            latest = _fmt_dt(row[2]) if row and row[2] else "—"
        except Exception:  # noqa: BLE001
            count, earliest, latest = "—", "—", "—"
        print(fmt_stats.format(table, count, earliest, latest))

    # ---- latest rows -------------------------------------------------------
    print()
    header = f"  Latest {tail} rows — battery_revenue_interval"
    if battery_key:
        header += f"  (battery_key = '{battery_key}')"
    print(header)
    print(_hr(width=80))

    where = f"WHERE battery_key = '{battery_key}'" if battery_key else ""
    fmt_row = "  {:<17}  {:<22}  {:>9}  {:>7}  {:>7}  {:>11}"
    print(fmt_row.format("Settlement", "Battery key", "RRP", "Dis MW", "Chg MW", "Net"))
    print(_hr(width=80))

    try:
        rows = conn.execute(
            f"SELECT settlement_date, battery_key, rrp, discharge_mw, charge_mw, net"  # noqa: S608
            f" FROM battery_revenue_interval {where}"
            f" ORDER BY settlement_date DESC, battery_key LIMIT {tail}"
        ).fetchall()
    except Exception:  # noqa: BLE001
        rows = []
        print("  (table does not exist — run 'nem-battery ingest-interval' first)")

    if not rows:
        print("  (no rows)")
    else:
        for r in rows:
            net_val: float = r[5]
            if net_val < 0:
                net_str = f"-{_fmt_dollar(abs(net_val), 10)}"
            else:
                net_str = f"+{_fmt_dollar(net_val, 10)}"
            print(
                fmt_row.format(
                    _fmt_dt(r[0]),
                    r[1],
                    f"${r[2]:>7.2f}",
                    f"{r[3]:>7.1f}",
                    f"{r[4]:>7.1f}",
                    net_str,
                )
            )

    print(_hr(width=80))
    conn.close()


# ---------------------------------------------------------------------------
# Battery resolution
# ---------------------------------------------------------------------------


def _resolve_battery(key: str | None) -> Battery:
    if key is None:
        key = "hornsdale"
        print(f"(no --battery specified, defaulting to '{key}')")
    key = key.lower().replace("-", "_")
    if key not in KNOWN_BATTERIES:
        known = ", ".join(sorted(KNOWN_BATTERIES))
        typer.echo(f"error: unknown battery '{key}'. Known keys: {known}", err=True)
        raise typer.Exit(code=1)
    return KNOWN_BATTERIES[key]


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------


def main() -> None:
    try:
        app()
    except KeyboardInterrupt:
        print("\nInterrupted.")
        raise SystemExit(0)
    except ValueError as exc:
        typer.echo(f"error: {exc}", err=True)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
