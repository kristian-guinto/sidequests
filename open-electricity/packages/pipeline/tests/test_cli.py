"""Unit tests for pipeline Typer & Rich CLI."""

from unittest.mock import patch, MagicMock
from typer.testing import CliRunner
from pipeline.cli import app
from pipeline.models import IngestRunReport

runner = CliRunner()


def test_app_entrypoint_in_ingest():
    """Verify that ingest module provides a callable app entry point."""
    from pipeline.ingest import app as ingest_app

    assert callable(ingest_app)


def test_cli_help():
    """Verify top-level CLI help lists all primary subcommands."""
    result = runner.invoke(app, ["--help"])
    assert result.exit_code == 0
    assert "OpenElectricity Data Ingestion & ETL Pipeline" in result.stdout
    assert "latest" in result.stdout
    assert "backfill" in result.stdout
    assert "sync-facilities" in result.stdout
    assert "inspect" in result.stdout


def test_cli_no_args_shows_help():
    """Verify invoking without arguments displays help by default."""
    result = runner.invoke(app, [])
    assert result.exit_code == 2
    assert "Usage:" in result.stdout or "Usage:" in result.output
    assert "latest" in result.stdout


def test_cli_subcommand_helps():
    """Verify help messages for each subcommand."""
    for cmd in ["latest", "backfill", "sync-facilities", "inspect"]:
        res = runner.invoke(app, [cmd, "--help"])
        assert res.exit_code == 0, f"Failed on {cmd} --help: {res.stdout}"
        assert "--target" in res.stdout
        assert "--db-path" in res.stdout


def test_backfill_missing_required_args():
    """Verify backfill fails cleanly when required dates are missing."""
    result = runner.invoke(app, ["backfill"])
    assert result.exit_code != 0
    assert (
        "Missing option '--start-date'" in result.output
        or "Missing option '-s'" in result.output
    )


def test_invalid_country_code():
    """Verify error on unsupported country code."""
    result = runner.invoke(app, ["latest", "--country", "XX"])
    assert result.exit_code != 0
    assert "Unsupported country code: XX" in result.output


def test_latest_command_execution():
    """Verify latest command runs pipeline lifecycle and prints summary table."""
    mock_report = IngestRunReport(
        country_code="PH",
        facilities_synced=10,
        intervals_synced=100,
        daily_rollups_updated=True,
    )
    with (
        patch("pipeline.cli.Database") as mock_db_cls,
        patch(
            "pipeline.cli.run_country_pipeline", return_value=mock_report
        ) as mock_run,
    ):
        mock_db = MagicMock()
        mock_db_cls.return_value = mock_db

        result = runner.invoke(
            app, ["latest", "--country", "PH", "--days", "1", "--target", "local"]
        )
        assert result.exit_code == 0
        assert mock_run.called
        assert "OpenElectricity 'latest' Sync Summary" in result.stdout
        assert "PH" in result.stdout
        assert "+100" in result.stdout
        mock_db.close.assert_called_once()


def test_sync_facilities_command():
    """Verify sync-facilities command fetches and upserts facilities."""
    with patch("pipeline.cli.Database") as mock_db_cls:
        mock_db = MagicMock()
        mock_db.upsert_facilities.return_value = 42
        mock_db_cls.return_value = mock_db

        result = runner.invoke(app, ["sync-facilities", "--country", "SG"])
        assert result.exit_code == 0
        assert "Facilities catalog sync complete" in result.stdout
        mock_db.close.assert_called_once()


def test_backfill_invalid_date_format():
    """Verify backfill validates date format."""
    result = runner.invoke(
        app,
        [
            "backfill",
            "--start-date",
            "not-a-date",
            "--end-date",
            "2026-01-01",
        ],
    )
    assert result.exit_code != 0
    assert "YYYY-MM-DD" in result.output


def test_inspect_command_dispatch():
    """Verify inspect command dispatches to db.inspect_database."""
    with patch("pipeline.cli.Database") as mock_db_cls:
        mock_db = MagicMock()
        mock_db_cls.return_value = mock_db

        result = runner.invoke(
            app, ["inspect", "--country", "PH", "--table", "facilities", "--limit", "5"]
        )
        assert result.exit_code == 0
        mock_db.inspect_database.assert_called_once_with(
            country_code="PH",
            table="facilities",
            region=None,
            limit=5,
        )
        mock_db.close.assert_called_once()
