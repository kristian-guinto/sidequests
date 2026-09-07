"""Dedicated Typer & Rich CLI application for OpenElectricity pipeline."""

from datetime import datetime, date, timedelta
from typing import Optional, List
import typer
from rich.console import Console
from rich.table import Table

from pipeline.config import DUCKDB_PATH
from pipeline.db import Database
from pipeline.models import IngestRunReport
from pipeline.ingest import PROVIDERS, resolve_countries, run_country_pipeline
from pipeline.fx import (
    sync_exchange_rates,
    REGISTERED_CURRENCIES,
    ExchangeRateSyncError,
)

app = typer.Typer(
    name="ingest",
    help="⚡ OpenElectricity Data Ingestion & ETL Pipeline",
    add_completion=False,
    no_args_is_help=True,
)
console = Console()


@app.command("latest")
def latest(
    country: str = typer.Option(
        "ALL",
        "--country",
        "-c",
        help="Target country (PH, SG, MY, TH, ALL). Default: ALL",
    ),
    days: int = typer.Option(
        2, "--days", "-d", help="Number of past days to ingest (default: 2)"
    ),
    target: str = typer.Option(
        "local", "--target", "-t", help="Target database ('local' or 'motherduck')"
    ),
    db_path: Optional[str] = typer.Option(
        None, "--db-path", help="Path to local DuckDB file"
    ),
) -> None:
    """Ingest latest market data across active countries."""
    try:
        countries = resolve_countries(country)
    except ValueError as e:
        console.print(f"[bold red]Error:[/bold red] {e}")
        raise typer.BadParameter(str(e)) from e

    local_path = db_path or DUCKDB_PATH
    db = Database(target=target, local_path=local_path)

    try:
        today = date.today()
        start_d = today - timedelta(days=days)
        end_d = today

        reports: List[IngestRunReport] = []
        for c in countries:
            prov_cls = PROVIDERS[c]
            provider = prov_cls(conn=db.conn) if c == "PH" else prov_cls()
            report = run_country_pipeline(
                provider=provider,
                db=db,
                start_date=start_d,
                end_date=end_d,
                days=days,
                sync_facilities_flag=True,
            )
            reports.append(report)

        table = Table(
            title="OpenElectricity 'latest' Sync Summary", border_style="green"
        )
        table.add_column("Country", style="bold cyan", justify="center")
        table.add_column("Facilities Synced", justify="right")
        table.add_column("Intervals Synced", justify="right")
        table.add_column("Daily Rollup", justify="center")
        table.add_column("Status", style="bold green", justify="center")

        for r in reports:
            table.add_row(
                r.country_code,
                str(r.facilities_synced),
                f"+{r.intervals_synced}",
                "✓" if r.daily_rollups_updated else "-",
                "SUCCESS",
            )
        console.print()
        console.print(table)
        console.print(
            "[bold green]✓ OpenElectricity 'latest' Sync Complete![/bold green]\n"
        )
    finally:
        db.close()


@app.command("backfill")
def backfill(
    start_date: str = typer.Option(
        ..., "--start-date", "-s", help="Start date (YYYY-MM-DD)"
    ),
    end_date: str = typer.Option(..., "--end-date", "-e", help="End date (YYYY-MM-DD)"),
    country: str = typer.Option(
        "PH", "--country", "-c", help="Target country (PH, SG, MY, TH). Default: PH"
    ),
    target: str = typer.Option(
        "local", "--target", "-t", help="Target database ('local' or 'motherduck')"
    ),
    db_path: Optional[str] = typer.Option(
        None, "--db-path", help="Path to local DuckDB file"
    ),
    max_files: Optional[int] = typer.Option(
        None, "--max-files", help="Optional max files limit for testing"
    ),
    skip_facilities: bool = typer.Option(
        False, "--skip-facilities", help="Skip catalog sync"
    ),
) -> None:
    """Historical backfill for a custom date range."""
    try:
        start_d = datetime.strptime(start_date, "%Y-%m-%d").date()
        end_d = datetime.strptime(end_date, "%Y-%m-%d").date()
    except ValueError as e:
        console.print(
            f"[bold red]Error parsing date:[/bold red] {e}. Format must be YYYY-MM-DD."
        )
        raise typer.BadParameter("Dates must be in YYYY-MM-DD format") from e

    try:
        countries = resolve_countries(country)
    except ValueError as e:
        console.print(f"[bold red]Error:[/bold red] {e}")
        raise typer.BadParameter(str(e)) from e

    local_path = db_path or DUCKDB_PATH
    db = Database(target=target, local_path=local_path)
    try:
        for c in countries:
            prov_cls = PROVIDERS[c]
            provider = prov_cls(conn=db.conn) if c == "PH" else prov_cls()
            run_country_pipeline(
                provider=provider,
                db=db,
                start_date=start_d,
                end_date=end_d,
                sync_facilities_flag=not skip_facilities,
                max_files=max_files,
            )
        console.print(
            "\n[bold green]✓ OpenElectricity Backfill Complete![/bold green]\n"
        )
    finally:
        db.close()


@app.command("sync-facilities")
def sync_facilities(
    country: str = typer.Option(
        "ALL",
        "--country",
        "-c",
        help="Target country (PH, SG, MY, TH, ALL). Default: ALL",
    ),
    target: str = typer.Option(
        "local", "--target", "-t", help="Target database ('local' or 'motherduck')"
    ),
    db_path: Optional[str] = typer.Option(
        None, "--db-path", help="Path to local DuckDB file"
    ),
) -> None:
    """Synchronize generator facility catalog."""
    try:
        countries = resolve_countries(country)
    except ValueError as e:
        console.print(f"[bold red]Error:[/bold red] {e}")
        raise typer.BadParameter(str(e)) from e

    local_path = db_path or DUCKDB_PATH
    db = Database(target=target, local_path=local_path)
    try:
        for c in countries:
            prov_cls = PROVIDERS[c]
            provider = prov_cls(conn=db.conn) if c == "PH" else prov_cls()
            facs = provider.fetch_facilities(conn=db.conn)
            count = db.upsert_facilities(facs, country_code=c)
            console.print(
                f"  [green]✓[/green] Synced {count} facilities for [cyan]{c}[/cyan]."
            )
        console.print(
            "\n[bold green]✓ Facilities catalog sync complete.[/bold green]\n"
        )
    finally:
        db.close()


@app.command("sync-exchange-rates")
@app.command("sync-fx")
def sync_exchange_rates_command(
    start_arg: Optional[str] = typer.Argument(
        None, help="Start date (YYYY-MM-DD)", metavar="[START_DATE]"
    ),
    end_arg: Optional[str] = typer.Argument(
        None, help="End date (YYYY-MM-DD)", metavar="[END_DATE]"
    ),
    start_date: Optional[str] = typer.Option(
        None,
        "--start-date",
        "-s",
        help="Start date (YYYY-MM-DD). Defaults to 30 days ago.",
    ),
    end_date: Optional[str] = typer.Option(
        None, "--end-date", "-e", help="End date (YYYY-MM-DD). Defaults to today."
    ),
    currency: str = typer.Option(
        "ALL",
        "--currency",
        "-c",
        help="Target currency or ALL registered currencies (PHP, SGD, MYR, THB, IDR, VND). Default: ALL",
    ),
    target: str = typer.Option(
        "local", "--target", "-t", help="Target database ('local' or 'motherduck')"
    ),
    db_path: Optional[str] = typer.Option(
        None, "--db-path", help="Path to local DuckDB file"
    ),
) -> None:
    """Synchronize foreign exchange rates for registered currencies against USD between dates."""
    s_input = start_date or start_arg
    e_input = end_date or end_arg

    try:
        start_d = (
            datetime.strptime(s_input, "%Y-%m-%d").date()
            if s_input
            else date.today() - timedelta(days=30)
        )
        end_d = (
            datetime.strptime(e_input, "%Y-%m-%d").date() if e_input else date.today()
        )
    except ValueError as e:
        console.print(
            f"[bold red]Error parsing date:[/bold red] {e}. Format must be YYYY-MM-DD."
        )
        raise typer.BadParameter("Dates must be in YYYY-MM-DD format") from e

    if start_d > end_d:
        msg = f"start-date ({start_d}) must be on or before end-date ({end_d})"
        console.print(f"[bold red]Error:[/bold red] {msg}")
        raise typer.BadParameter(msg)

    curr_choice = currency.strip().upper()
    if curr_choice == "ALL":
        target_currs = REGISTERED_CURRENCIES
    else:
        specified = [c.strip() for c in curr_choice.split(",") if c.strip()]
        for c in specified:
            if c not in REGISTERED_CURRENCIES:
                msg = f"Unsupported currency '{c}'. Registered currencies: {', '.join(REGISTERED_CURRENCIES)}"
                console.print(f"[bold red]Error:[/bold red] {msg}")
                raise typer.BadParameter(msg)
        target_currs = specified

    local_path = db_path or DUCKDB_PATH
    db = Database(target=target, local_path=local_path)
    try:
        console.print(
            f"Syncing FX rates ({start_d} -> {end_d}) for currencies: [cyan]{', '.join(target_currs)}[/cyan]..."
        )
        count = sync_exchange_rates(
            db=db,
            start_date=start_d,
            end_date=end_d,
            currencies=target_currs,
        )
        console.print(f"  [green]✓[/green] Synced {count} exchange rate records.")
        console.print("\n[bold green]✓ Exchange rates sync complete.[/bold green]\n")
    except ExchangeRateSyncError as e:
        console.print(f"[bold red]Sync Error:[/bold red] {e}")
        raise typer.Exit(code=1) from e
    finally:
        db.close()


@app.command("inspect")
def inspect(
    country: str = typer.Option(
        "ALL", "--country", "-c", help="Filter by country (default: ALL)"
    ),
    table: Optional[str] = typer.Option(
        None,
        "--table",
        help="Table name to inspect (facilities, energy_interval, energy_daily, exchange_rates, all)",
    ),
    region: Optional[str] = typer.Option(None, "--region", help="Filter by region"),
    limit: int = typer.Option(
        15, "--limit", "-l", help="Number of records to display (default: 15)"
    ),
    target: str = typer.Option(
        "local", "--target", "-t", help="Target database ('local' or 'motherduck')"
    ),
    db_path: Optional[str] = typer.Option(
        None, "--db-path", help="Path to local DuckDB file"
    ),
) -> None:
    """Inspect database tables and sample rows."""
    local_path = db_path or DUCKDB_PATH
    db = Database(target=target, local_path=local_path)
    try:
        db.inspect_database(
            country_code=country,
            table=table,
            region=region,
            limit=limit,
        )
    finally:
        db.close()


if __name__ == "__main__":
    app()
