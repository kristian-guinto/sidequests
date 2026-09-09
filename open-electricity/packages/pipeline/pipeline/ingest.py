"""Runner and execution engine for OpenElectricity data ingestion pipeline."""

from datetime import date, timedelta
from typing import Optional, List
from rich.console import Console
from rich.panel import Panel

from pipeline.db import Database
from pipeline.models import IngestRunReport, EnergyIntervalRecord
from pipeline.fx import sync_exchange_rates, COUNTRY_TO_CURRENCY
from pipeline.providers.base import BaseProvider
from pipeline.providers import PROVIDERS

console = Console()


def run_country_pipeline(
    provider: BaseProvider,
    db: Database,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    days: int = 2,
    sync_facilities_flag: bool = True,
    max_files: Optional[int] = None,
) -> IngestRunReport:
    """Executes the standard 4-step pipeline lifecycle for a single market provider."""
    country = provider.country_code
    date_range = f"{start_date or f'Past {days} days'} -> {end_date or 'Today'}"
    console.print(
        Panel(
            f"[bold yellow]OpenNEM-SEA:[/bold yellow] Country: [bold cyan]{country}[/bold cyan] Pipeline\n"
            f"[dim]Date Range:[/dim] {date_range}",
            border_style="cyan",
            expand=False,
        )
    )

    fac_count = 0
    if sync_facilities_flag:
        console.print(
            f"\n[bold blue][1/4][/bold blue] Syncing Generator Catalog ({country})..."
        )
        facilities = provider.fetch_facilities(conn=db.conn)
        fac_count = db.upsert_facilities(facilities, country_code=country)
        console.print(f"  [green]✓[/green] Synced {fac_count} facilities.")
    else:
        console.print(
            f"\n[bold blue][1/4][/bold blue] [dim]Skipping Generator Catalog Sync ({country}).[/dim]"
        )

    console.print(
        "\n[bold blue][2/4][/bold blue] Verifying Exchange Rates (USD Reference)..."
    )
    curr = COUNTRY_TO_CURRENCY.get(country, "PHP")
    s_d = start_date or (date.today() - timedelta(days=days))
    e_d = end_date or date.today()
    existing_cnt_row = db.conn.execute(
        "SELECT count(*) FROM exchange_rates WHERE currency = ? AND date >= ?::DATE AND date <= ?::DATE",
        [curr, s_d, e_d],
    ).fetchone()
    existing_cnt = existing_cnt_row[0] if existing_cnt_row else 0

    if existing_cnt == 0:
        console.print(
            f"  [yellow]Missing FX rates for {curr} ({s_d} -> {e_d}). Fetching online...[/yellow]"
        )
        try:
            synced_fx = sync_exchange_rates(db, start_date=s_d, end_date=e_d)
            console.print(f"  [green]✓[/green] Synced {synced_fx} FX rate records.")
        except Exception as e:
            prev_row = db.conn.execute(
                "SELECT rate_to_usd FROM exchange_rates WHERE currency = ? ORDER BY date DESC LIMIT 1",
                [curr],
            ).fetchone()
            if prev_row and prev_row[0] is not None and prev_row[0] > 0:
                console.print(
                    f"  [yellow]⚠️ Online FX sync unavailable ({e}), using last known rate for {curr} ({prev_row[0]}).[/yellow]"
                )
            else:
                raise
    else:
        console.print(
            f"  [green]✓[/green] Verified {existing_cnt} existing FX rate records for {curr}."
        )

    console.print(
        f"\n[bold blue][3/4][/bold blue] Ingesting Energy Intervals & Spot Prices ({country})..."
    )
    batched_intervals_count = 0

    def on_batch_handler(batch: List[EnergyIntervalRecord]) -> None:
        nonlocal batched_intervals_count
        count = db.upsert_energy_interval(batch, country_code=country)
        batched_intervals_count += count

    intervals = provider.fetch_energy_intervals(
        start_date=start_date,
        end_date=end_date,
        days=days,
        conn=db.conn,
        max_files=max_files,
        on_batch=on_batch_handler,
    )

    if batched_intervals_count > 0:
        synced_intervals = batched_intervals_count
    else:
        synced_intervals = db.upsert_energy_interval(intervals, country_code=country)

    console.print(
        f"  [green]✓[/green] Synced {synced_intervals} interval records into energy_interval."
    )

    console.print(
        f"\n[bold blue][4/4][/bold blue] Populating energy_daily Rollups ({country})..."
    )
    db.populate_energy_daily(country, start_date=start_date, end_date=end_date)
    console.print("  [green]✓[/green] Populated daily rollup records in energy_daily.")

    return IngestRunReport(
        country_code=country,
        facilities_synced=fac_count,
        intervals_synced=synced_intervals,
        daily_rollups_updated=True,
    )


def resolve_countries(country_arg: str) -> List[str]:
    """Resolves target country codes from CLI argument."""
    c = country_arg.upper()
    if c == "ALL":
        return list(PROVIDERS.keys())
    if c in PROVIDERS:
        return [c]
    valid_opts = ", ".join(["ALL"] + sorted(PROVIDERS.keys()))
    raise ValueError(
        f"Unsupported country code: {country_arg}. Choose from: {valid_opts}."
    )


def app() -> None:
    """CLI entrypoint proxying to pipeline.cli:app."""
    from pipeline.cli import app as cli_app

    cli_app()


__all__ = ["app", "run_country_pipeline", "resolve_countries", "PROVIDERS"]

if __name__ == "__main__":
    app()
