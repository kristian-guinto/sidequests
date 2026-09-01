import os
from pathlib import Path
import tomllib
from typing import Optional

import typer
from rich.console import Console
from rich.table import Table

from ducklembic.connection import DuckDB
from ducklembic.migrator import Migrator
from ducklembic.sync import Sync

app = typer.Typer(
    name="ducklembic",
    help="🦆 Ducklembic: Lightweight migrations, sync, and connection management for DuckDB + MotherDuck",
    add_completion=False,
)
sync_app = typer.Typer(
    help="Data sync and diff operations between local DuckDB and MotherDuck"
)
app.add_typer(sync_app, name="sync")

console = Console()


def find_config_path() -> Optional[Path]:
    """Finds ducklembic.toml in current or parent directories."""
    curr = Path.cwd()
    for p in [curr, *curr.parents]:
        cfg = p / "ducklembic.toml"
        if cfg.exists():
            return cfg
    return None


def load_config() -> dict:
    """Loads configuration from ducklembic.toml with fallback to defaults and env vars."""
    config = {
        "local_path": os.getenv("DUCKLEMBIC_LOCAL_PATH", "open_nem_ph.duckdb"),
        "motherduck_database": os.getenv("MOTHERDUCK_DATABASE", "open_electricity_db"),
        "migrations_dir": os.getenv("DUCKLEMBIC_MIGRATIONS_DIR", "pipeline/migrations"),
    }

    cfg_file = find_config_path()
    if cfg_file and cfg_file.exists():
        try:
            with open(cfg_file, "rb") as f:
                data = tomllib.load(f)
            if "database" in data:
                db_data = data["database"]
                if "local_path" in db_data:
                    # Resolve relative to config file location
                    p = Path(db_data["local_path"])
                    if not p.is_absolute():
                        config["local_path"] = str(cfg_file.parent / p)
                    else:
                        config["local_path"] = str(p)
                if "motherduck_database" in db_data:
                    config["motherduck_database"] = db_data["motherduck_database"]
            if "migrations" in data:
                m_data = data["migrations"]
                if "directory" in m_data:
                    p = Path(m_data["directory"])
                    if not p.is_absolute():
                        config["migrations_dir"] = str(cfg_file.parent / p)
                    else:
                        config["migrations_dir"] = str(p)
        except Exception as e:
            console.print(f"[yellow]⚠️ Failed to parse ducklembic.toml: {e}[/yellow]")

    return config


def get_db(mode: str = "local") -> DuckDB:
    cfg = load_config()
    return DuckDB(
        local_path=cfg["local_path"],
        motherduck_token=os.getenv("MOTHERDUCK_TOKEN"),
        motherduck_database=cfg["motherduck_database"],
        mode=mode,
    )


def get_migrator(db: Optional[DuckDB] = None) -> Migrator:
    cfg = load_config()
    if db is None:
        db = get_db(mode="auto")
    return Migrator(db=db, migrations_dir=cfg["migrations_dir"])


@app.command()
def configure():
    """Guided setup to create or update ducklembic.toml."""
    console.print("\n[bold cyan]🦆 Ducklembic Configuration Wizard[/bold cyan]\n")

    curr_cfg = load_config()
    local_path = typer.prompt(
        "Local DuckDB path",
        default=curr_cfg["local_path"],
    )
    md_db = typer.prompt(
        "MotherDuck database name",
        default=curr_cfg["motherduck_database"],
    )
    mig_dir = typer.prompt(
        "Migrations directory",
        default=curr_cfg["migrations_dir"],
    )

    toml_content = f"""# Ducklembic Configuration File
[database]
local_path = "{local_path}"
motherduck_database = "{md_db}"

[migrations]
directory = "{mig_dir}"
"""
    target = Path.cwd() / "ducklembic.toml"
    target.write_text(toml_content, encoding="utf-8")

    console.print(f"\n[green]✓ Saved configuration to {target.name}[/green]")
    console.print(
        "\n[dim]💡 Note: Keep sensitive tokens like MOTHERDUCK_TOKEN in your environment or .env file.[/dim]\n"
    )


@app.command()
def new(
    name: str = typer.Argument(..., help="Short name/description for the migration"),
):
    """Scaffolds a new pair of .up.sql and .down.sql migration files."""
    migrator = get_migrator()
    up_path, down_path = migrator.create_migration(name)
    console.print(f"[green]✓ Created forward migration:[/green] {up_path}")
    console.print(f"[green]✓ Created rollback migration:[/green] {down_path}")


def resolve_mode(mode: str, cloud: bool) -> str:
    if cloud:
        return "motherduck"
    return mode.lower()


@app.command()
def status(
    mode: str = typer.Option(
        "local",
        "--mode",
        "-m",
        help="Target database mode: 'local', 'motherduck', or 'auto'",
    ),
    cloud: bool = typer.Option(
        False, "--cloud", "--motherduck", help="Target MotherDuck Cloud directly"
    ),
):
    """Displays applied and pending migrations."""
    target_mode = resolve_mode(mode, cloud)
    db = get_db(mode=target_mode)
    migrator = get_migrator(db)
    st = migrator.status()

    console.print(f"\n[bold]Backend:[/bold] {db.backend} ({db.conn_str})")
    console.print(f"[bold]Migrations Directory:[/bold] {migrator.migrations_dir}\n")

    table = Table(
        title="Ducklembic Migration Status",
        show_header=True,
        header_style="bold magenta",
    )
    table.add_column("Version", style="cyan", width=10)
    table.add_column("Name", style="white")
    table.add_column("Status", width=12)
    table.add_column("Applied At", width=22)
    table.add_column("Duration", width=10)

    applied_map = {a.version: a for a in st.applied}
    all_files = migrator.get_migration_files()

    for f in all_files:
        if f.version in applied_map:
            rec = applied_map[f.version]
            applied_str = (
                rec.applied_at.strftime("%Y-%m-%d %H:%M:%S")
                if isinstance(rec.applied_at, object)
                and hasattr(rec.applied_at, "strftime")
                else str(rec.applied_at)
            )
            table.add_row(
                f.version,
                f.name,
                "[green]Applied[/green]",
                applied_str,
                f"{rec.duration_ms} ms",
            )
        else:
            table.add_row(
                f.version,
                f.name,
                "[yellow]Pending[/yellow]",
                "—",
                "—",
            )

    console.print(table)
    console.print(
        f"\n[bold]Applied:[/bold] {len(st.applied)} | [bold]Pending:[/bold] {len(st.pending)}\n"
    )


@app.command()
def migrate(
    target: Optional[str] = typer.Option(
        None, "--target", "-t", help="Target migration version (inclusive)"
    ),
    mode: str = typer.Option(
        "local",
        "--mode",
        "-m",
        help="Target database mode: 'local', 'motherduck', or 'auto'",
    ),
    cloud: bool = typer.Option(
        False, "--cloud", "--motherduck", help="Target MotherDuck Cloud directly"
    ),
):
    """Applies all pending migrations (or up to target version)."""
    target_mode = resolve_mode(mode, cloud)
    db = get_db(mode=target_mode)
    migrator = get_migrator(db)

    console.print(
        f"\n[bold cyan]Applying migrations to {db.backend} ({db.conn_str})...[/bold cyan]\n"
    )
    applied = migrator.migrate(target=target)

    if not applied:
        console.print(
            "[green]✓ Database is already up to date. No pending migrations.[/green]\n"
        )
        return

    table = Table(
        title="Applied Migrations", show_header=True, header_style="bold green"
    )
    table.add_column("Version", style="cyan", width=10)
    table.add_column("Name", style="white")
    table.add_column("Duration", width=12)

    for rec in applied:
        table.add_row(rec.version, rec.name, f"{rec.duration_ms} ms")

    console.print(table)
    console.print(
        f"\n[green]✓ Successfully applied {len(applied)} migration(s)![/green]\n"
    )


@app.command()
def rollback(
    steps: int = typer.Option(
        1, "--steps", "-s", help="Number of migrations to rollback"
    ),
    mode: str = typer.Option(
        "local",
        "--mode",
        "-m",
        help="Target database mode: 'local', 'motherduck', or 'auto'",
    ),
    cloud: bool = typer.Option(
        False, "--cloud", "--motherduck", help="Target MotherDuck Cloud directly"
    ),
):
    """Rolls back the last N applied migrations."""
    target_mode = resolve_mode(mode, cloud)
    db = get_db(mode=target_mode)
    migrator = get_migrator(db)

    console.print(
        f"\n[bold yellow]Rolling back {steps} migration(s) on {db.backend}...[/bold yellow]\n"
    )
    try:
        rolled_back = migrator.rollback(steps=steps)
    except Exception as e:
        console.print(f"[bold red]❌ Rollback failed:[/bold red] {e}\n")
        raise typer.Exit(code=1)

    if not rolled_back:
        console.print("[dim]No applied migrations to rollback.[/dim]\n")
        return

    for rec in rolled_back:
        console.print(f"  [yellow]← Rolled back:[/yellow] {rec.version}_{rec.name}")

    console.print(
        f"\n[green]✓ Successfully rolled back {len(rolled_back)} migration(s)![/green]\n"
    )


@app.command()
def validate(
    mode: str = typer.Option(
        "local",
        "--mode",
        "-m",
        help="Target database mode: 'local', 'motherduck', or 'auto'",
    ),
    cloud: bool = typer.Option(
        False, "--cloud", "--motherduck", help="Target MotherDuck Cloud directly"
    ),
):
    """Validates applied migrations against disk checksums."""
    target_mode = resolve_mode(mode, cloud)
    db = get_db(mode=target_mode)
    migrator = get_migrator(db)
    errors = migrator.validate()

    if errors:
        console.print("\n[bold red]❌ Migration Validation Errors:[/bold red]")
        for err in errors:
            console.print(f"  • [red]{err}[/red]")
        console.print()
        raise typer.Exit(code=1)
    else:
        console.print(
            "\n[green]✓ All applied migrations match disk files and checksums.[/green]\n"
        )


@sync_app.command("diff")
def sync_diff():
    """Compares row counts between local DuckDB and MotherDuck."""
    cfg = load_config()
    token = os.getenv("MOTHERDUCK_TOKEN")
    if not token:
        console.print(
            "[bold red]❌ MOTHERDUCK_TOKEN is required for sync diff.[/bold red]"
        )
        raise typer.Exit(code=1)

    local_db = DuckDB(local_path=cfg["local_path"], mode="local")
    remote_db = DuckDB(
        motherduck_token=token,
        motherduck_database=cfg["motherduck_database"],
        mode="motherduck",
    )

    sync_engine = Sync(local=local_db, remote=remote_db)
    report = sync_engine.diff()

    table = Table(
        title="Data Diff (Local vs MotherDuck)",
        show_header=True,
        header_style="bold cyan",
    )
    table.add_column("Table Name", style="white")
    table.add_column("Local Rows", justify="right", width=15)
    table.add_column("MotherDuck Rows", justify="right", width=18)
    table.add_column("Status", width=15)

    for row in report.tables:
        if row.status == "match":
            st_str = "[green]✅ MATCH[/green]"
        elif row.status == "diff":
            st_str = f"[yellow]⚠️ DIFF ({row.source_rows - row.target_rows:+d})[/yellow]"
        else:
            st_str = f"[red]❌ {row.error or 'ERROR'}[/red]"

        table.add_row(
            row.table,
            str(row.source_rows) if row.source_rows >= 0 else "—",
            str(row.target_rows) if row.target_rows >= 0 else "—",
            st_str,
        )

    console.print()
    console.print(table)
    console.print()


@sync_app.command("push")
def sync_push(
    yes: bool = typer.Option(False, "--yes", "-y", help="Skip confirmation prompt"),
    dry_run: bool = typer.Option(
        False, "--dry-run", help="Preview push operation without modifying remote"
    ),
    strategy: str = typer.Option(
        "replace", "--strategy", help="Sync strategy: 'replace' or 'append'"
    ),
):
    """Pushes local DuckDB tables to MotherDuck Cloud (Destructive)."""
    cfg = load_config()
    token = os.getenv("MOTHERDUCK_TOKEN")
    if not token:
        console.print(
            "[bold red]❌ MOTHERDUCK_TOKEN is required for sync push.[/bold red]"
        )
        raise typer.Exit(code=1)

    local_db = DuckDB(local_path=cfg["local_path"], mode="local")
    remote_db = DuckDB(
        motherduck_token=token,
        motherduck_database=cfg["motherduck_database"],
        mode="motherduck",
    )

    sync_engine = Sync(local=local_db, remote=remote_db)

    if dry_run:
        console.print("[cyan]🔍 Running sync push preview (dry-run)...[/cyan]")
        report = sync_engine.push(confirm=False, dry_run=True)
        sync_diff()
        return

    if not yes:
        console.print(
            "\n[bold yellow]⚠️ WARNING: Sync Push will overwrite tables in MotherDuck Cloud with local data.[/bold yellow]"
        )
        confirm = typer.confirm("Are you sure you want to proceed?")
        if not confirm:
            console.print("[dim]Operation cancelled.[/dim]\n")
            return
    else:
        confirm = True

    console.print(
        "\n[bold cyan]🚀 Pushing local DuckDB tables to MotherDuck Cloud...[/bold cyan]\n"
    )
    try:
        report = sync_engine.push(confirm=confirm, strategy=strategy)
    except Exception as e:
        console.print(f"[bold red]❌ Push failed:[/bold red] {e}\n")
        raise typer.Exit(code=1)

    table = Table(title="Push Summary", show_header=True, header_style="bold green")
    table.add_column("Table Name", style="white")
    table.add_column("Source Rows", justify="right", width=15)
    table.add_column("Target Rows", justify="right", width=15)
    table.add_column("Status", width=12)
    table.add_column("Duration", width=10)

    for row in report.tables:
        table.add_row(
            row.table,
            str(row.source_rows),
            str(row.target_rows),
            f"[{'green' if row.status == 'synced' else 'red'}]{row.status}[/]",
            f"{row.duration_ms} ms",
        )

    console.print(table)
    console.print(
        f"\n[green]✓ Sync completed in {report.total_duration_ms} ms with 100% data fidelity![/green]\n"
    )


@sync_app.command("pull")
def sync_pull(
    strategy: str = typer.Option(
        "replace", "--strategy", help="Sync strategy: 'replace' or 'append'"
    ),
):
    """Pulls tables from MotherDuck Cloud to local DuckDB."""
    cfg = load_config()
    token = os.getenv("MOTHERDUCK_TOKEN")
    if not token:
        console.print(
            "[bold red]❌ MOTHERDUCK_TOKEN is required for sync pull.[/bold red]"
        )
        raise typer.Exit(code=1)

    local_db = DuckDB(local_path=cfg["local_path"], mode="local")
    remote_db = DuckDB(
        motherduck_token=token,
        motherduck_database=cfg["motherduck_database"],
        mode="motherduck",
    )

    sync_engine = Sync(local=local_db, remote=remote_db)

    console.print(
        "\n[bold cyan]📥 Pulling tables from MotherDuck Cloud to local DuckDB...[/bold cyan]\n"
    )
    try:
        report = sync_engine.pull(strategy=strategy)
    except Exception as e:
        console.print(f"[bold red]❌ Pull failed:[/bold red] {e}\n")
        raise typer.Exit(code=1)

    table = Table(title="Pull Summary", show_header=True, header_style="bold green")
    table.add_column("Table Name", style="white")
    table.add_column("Source Rows", justify="right", width=15)
    table.add_column("Target Rows", justify="right", width=15)
    table.add_column("Status", width=12)
    table.add_column("Duration", width=10)

    for row in report.tables:
        table.add_row(
            row.table,
            str(row.source_rows),
            str(row.target_rows),
            f"[{'green' if row.status == 'synced' else 'red'}]{row.status}[/]",
            f"{row.duration_ms} ms",
        )

    console.print(table)
    console.print(
        f"\n[green]✓ Pull completed in {report.total_duration_ms} ms![/green]\n"
    )


if __name__ == "__main__":
    app()
