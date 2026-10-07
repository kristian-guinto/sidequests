"""Unit tests for pipeline Typer & Rich CLI."""

from datetime import date, timedelta
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
    assert "sync-exchange-rates" in result.stdout
    assert "inspect" in result.stdout


def test_cli_no_args_shows_help():
    """Verify invoking without arguments displays help by default."""
    result = runner.invoke(app, [])
    assert result.exit_code == 2
    assert "Usage:" in result.stdout or "Usage:" in result.output
    assert "latest" in result.stdout


def test_cli_subcommand_helps():
    """Verify help messages for each subcommand."""
    for cmd in [
        "latest",
        "backfill",
        "sync-facilities",
        "sync-exchange-rates",
        "inspect",
    ]:
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


def test_latest_resumes_from_db_checkpoint():
    """Verify latest command queries checkpoint and resumes when within max_stale_days."""
    today = date.today()
    checkpoint_date = today - timedelta(days=1)
    mock_report = IngestRunReport(
        country_code="PH",
        facilities_synced=10,
        intervals_synced=288,
        daily_rollups_updated=True,
    )
    with (
        patch("pipeline.cli.Database") as mock_db_cls,
        patch(
            "pipeline.cli.run_country_pipeline", return_value=mock_report
        ) as mock_run,
    ):
        mock_db = MagicMock()
        mock_db.get_latest_interval_date.return_value = checkpoint_date
        mock_db_cls.return_value = mock_db

        result = runner.invoke(app, ["latest", "--country", "PH", "--target", "local"])
        assert result.exit_code == 0
        assert mock_run.called
        call_kwargs = mock_run.call_args.kwargs
        assert call_kwargs["start_date"] == checkpoint_date
        assert call_kwargs["end_date"] == today
        assert "Resuming PH from checkpoint" in result.stdout
        assert "SUCCESS" in result.stdout


def test_latest_skips_stale_country():
    """Verify latest command skips countries where latest data is > max_stale_days old."""
    today = date.today()
    stale_date = today - timedelta(days=5)
    with (
        patch("pipeline.cli.Database") as mock_db_cls,
        patch("pipeline.cli.run_country_pipeline") as mock_run,
    ):
        mock_db = MagicMock()
        mock_db.get_latest_interval_date.return_value = stale_date
        mock_db_cls.return_value = mock_db

        result = runner.invoke(
            app,
            [
                "latest",
                "--country",
                "PH",
                "--max-stale-days",
                "3",
                "--target",
                "local",
            ],
        )
        assert result.exit_code == 0
        assert not mock_run.called
        assert "Skipping PH" in result.stdout
        assert "exceeds" in result.stdout
        assert "SKIPPED" in result.stdout


def test_latest_force_days_overrides_checkpoint():
    """Verify --force-days ignores database checkpoint and uses specified days."""
    today = date.today()
    stale_date = today - timedelta(days=10)
    mock_report = IngestRunReport(
        country_code="PH",
        facilities_synced=5,
        intervals_synced=50,
        daily_rollups_updated=True,
    )
    with (
        patch("pipeline.cli.Database") as mock_db_cls,
        patch(
            "pipeline.cli.run_country_pipeline", return_value=mock_report
        ) as mock_run,
    ):
        mock_db = MagicMock()
        mock_db.get_latest_interval_date.return_value = stale_date
        mock_db_cls.return_value = mock_db

        result = runner.invoke(
            app,
            [
                "latest",
                "--country",
                "PH",
                "--days",
                "2",
                "--force-days",
                "--target",
                "local",
            ],
        )
        assert result.exit_code == 0
        assert mock_run.called
        call_kwargs = mock_run.call_args.kwargs
        assert call_kwargs["start_date"] == today - timedelta(days=2)
        assert "Forcing PH ingestion" in result.stdout
        assert "SUCCESS" in result.stdout


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


def test_sync_exchange_rates_command():
    """Verify sync-exchange-rates executes and calls sync_exchange_rates."""
    from datetime import date
    from pipeline.fx import REGISTERED_CURRENCIES

    with (
        patch("pipeline.cli.Database") as mock_db_cls,
        patch("pipeline.cli.sync_exchange_rates", return_value=30) as mock_sync,
    ):
        mock_db = MagicMock()
        mock_db_cls.return_value = mock_db

        result = runner.invoke(
            app,
            [
                "sync-exchange-rates",
                "--start-date",
                "2026-01-01",
                "--end-date",
                "2026-01-05",
            ],
        )
        assert result.exit_code == 0
        assert "Synced 30 exchange rate records" in result.stdout
        assert "Exchange rates sync complete" in result.stdout
        mock_sync.assert_called_once_with(
            db=mock_db,
            start_date=date(2026, 1, 1),
            end_date=date(2026, 1, 5),
            currencies=REGISTERED_CURRENCIES,
        )
        mock_db.close.assert_called_once()


def test_sync_exchange_rates_positional_args():
    """Verify sync-exchange-rates accepts positional date arguments."""
    from datetime import date
    from pipeline.fx import REGISTERED_CURRENCIES

    with (
        patch("pipeline.cli.Database") as mock_db_cls,
        patch("pipeline.cli.sync_exchange_rates", return_value=12) as mock_sync,
    ):
        mock_db = MagicMock()
        mock_db_cls.return_value = mock_db

        result = runner.invoke(
            app,
            ["sync-exchange-rates", "2026-01-01", "2026-01-02"],
        )
        assert result.exit_code == 0
        mock_sync.assert_called_once_with(
            db=mock_db,
            start_date=date(2026, 1, 1),
            end_date=date(2026, 1, 2),
            currencies=REGISTERED_CURRENCIES,
        )


def test_sync_exchange_rates_currency_filter():
    """Verify sync-exchange-rates filters by specified currency."""
    from datetime import date

    with (
        patch("pipeline.cli.Database") as mock_db_cls,
        patch("pipeline.cli.sync_exchange_rates", return_value=5) as mock_sync,
    ):
        mock_db = MagicMock()
        mock_db_cls.return_value = mock_db

        result = runner.invoke(
            app,
            [
                "sync-exchange-rates",
                "-s",
                "2026-01-01",
                "-e",
                "2026-01-05",
                "-c",
                "PHP",
            ],
        )
        assert result.exit_code == 0
        mock_sync.assert_called_once_with(
            db=mock_db,
            start_date=date(2026, 1, 1),
            end_date=date(2026, 1, 5),
            currencies=["PHP"],
        )


def test_sync_exchange_rates_invalid_dates():
    """Verify error handling on invalid date formats and start > end."""
    # Invalid format
    res1 = runner.invoke(app, ["sync-exchange-rates", "-s", "invalid"])
    assert res1.exit_code != 0
    assert "YYYY-MM-DD" in res1.output

    # Start date after end date
    res2 = runner.invoke(
        app,
        [
            "sync-exchange-rates",
            "-s",
            "2026-02-01",
            "-e",
            "2026-01-01",
        ],
    )
    assert res2.exit_code != 0
    assert "must be on or before" in res2.output


def test_sync_exchange_rates_unsupported_currency():
    """Verify error when unsupported currency is provided."""
    res = runner.invoke(
        app,
        ["sync-exchange-rates", "-s", "2026-01-01", "-e", "2026-01-05", "-c", "XYZ"],
    )
    assert res.exit_code != 0
    assert "Unsupported currency 'XYZ'" in res.output


def test_sync_fx_alias():
    """Verify sync-fx alias works identically."""
    with (
        patch("pipeline.cli.Database") as mock_db_cls,
        patch("pipeline.cli.sync_exchange_rates", return_value=10),
    ):
        mock_db_cls.return_value = MagicMock()
        res = runner.invoke(app, ["sync-fx", "-s", "2026-01-01", "-e", "2026-01-02"])
        assert res.exit_code == 0
        assert "Exchange rates sync complete" in res.stdout
