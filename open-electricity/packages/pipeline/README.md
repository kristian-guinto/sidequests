# Pipeline

Data ingestion, ETL, and synchronization package for OpenElectricity.

## Features

- **Country Providers**: Data scrapers and parsers for Southeast Asia electricity markets (Philippines IEMOP/WESM, Singapore EMC, Malaysia Single Buyer).
- **Data Processor**: Standardizes regional summaries, fuel technology classifications, and dispatch outputs.
- **Database & Sync**: DuckDB storage with Ducklembic migrations and MotherDuck cloud sync capabilities.

## CLI Usage

Run the pipeline via `uv`:

```bash
# Run daily sync (defaults to PH)
uv run ingest --mode daily --days 2

# Run backfill
uv run ingest --mode backfill --start-date 2024-01-01 --end-date 2024-01-07

# Sync facilities catalog
uv run ingest --mode sync-facilities

# Migrate / sync to MotherDuck cloud
uv run ingest migrate
```

