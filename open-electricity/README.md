# OpenNEM Philippines (OpenElectricity PH)

An open-source electricity market tracker and power system analytics platform for the **Philippines Wholesale Electricity Spot Market (WESM)**, inspired by [OpenNEM / OpenElectricity Australia](https://explore.openelectricity.org.au/).

![Dashboard Preview](https://raw.githubusercontent.com/opennem/opennem/master/docs/img/screenshot.png)

---

## ⚡ Overview

OpenNEM-PH tracks the electricity transition in the Philippines by ingesting and visualizing official market and dispatch data published by **IEMOP (Independent Electricity Market Operator of the Philippines)**:

- 📊 **Generation Fuel Mix**: 5-minute and hourly interval stacked area charts across **Solar**, **Wind**, **Hydro**, **Geothermal**, **Biomass**, **Natural Gas**, **Black Coal**, **Oil / Diesel**, and **Battery Storage (BESS)**.
- 📈 **Wholesale Spot Prices**: 5-minute Locational Marginal Prices (LMP) and Market Clearing Prices across the grid.
- ⚡ **Macro Grid Demand & Losses**: Real-time system load, transmission losses, and net flows.
- 🔌 **Interconnector Flows**: Physical transfers across the **Luzon–Visayas HVDC** and **Mindanao–Visayas Interconnection Project (MVIP)** submarine links.
- 🌿 **Emissions & Renewables Tracking**: Carbon intensity (gCO₂/kWh) and renewable energy penetration percentage.
- 🏝️ **Regional Breakdown**: Philippines Total (NEM), Luzon, Visayas, and Mindanao grids.

---

## 🏗️ Architecture

```
open-electricity/
├── .github/
│   └── workflows/
│       └── daily_pipeline.yml      # Automated daily GitHub Actions cron (uv run ingest)
├── api/
│   ├── index.py                    # FastAPI Backend (Vercel Serverless Function)
│   └── requirements.txt            # FastAPI Python dependencies
├── pipeline/                       # Python data ingestion & ETL engine (uv)
│   ├── config.py                   # Configuration & constants
│   ├── iemop_client.py             # IEMOP AJAX downloader & ZIP/CSV unpacker
│   ├── generator_registry.py       # Generator fuel tech mapper & heuristic resolver
│   ├── data_processor.py           # 5-minute dispatch & regional aggregator
│   ├── db.py                       # DuckDB & MotherDuck storage layer
│   ├── sync_motherduck.py          # Local DuckDB to MotherDuck Cloud sync
│   ├── ingest.py                   # CLI tool for daily sync & backfills
│   └── data/
│       └── generators_master.json  # Comprehensive Philippine power plant catalog
├── src/                            # Next.js 14 Frontend
│   ├── app/                        # Next.js App Router (Dashboard)
│   ├── components/                 # Charts, KPI cards, Fuel table, Interconnectors
│   └── lib/                        # Types, color palette, mock generator
├── package.json                    # Frontend dependencies & scripts
├── next.config.mjs                 # Next.js rewrites configuration
├── tailwind.config.ts              # Tailwind CSS configuration
├── open_nem_ph.duckdb              # Embedded OLAP DuckDB database (local)
├── vercel.json                     # Vercel deployment routing configuration
├── pyproject.toml                  # Python package configuration
└── README.md
```

---

## 🚀 Quick Start

### 1. Ingestion Pipeline (`uv`)

We use [`uv`](https://docs.astral.sh/uv/) for Python package management:

```bash
# Sync dependencies
uv sync

# Run daily sync (fetches latest IEMOP files)
uv run ingest --mode daily

# Run historical backfill for custom date range
uv run ingest --mode backfill --start-date 2026-08-01 --end-date 2026-08-31

# Sync local DuckDB data to MotherDuck Cloud
uv run ingest sync-cloud

# Inspect database tables, row counts, and data samples
uv run ingest inspect
uv run ingest inspect --table dispatch --region LUZON --limit 10
uv run ingest inspect --table facilities --limit 10
uv run ingest inspect --table regional --limit 10
uv run ingest inspect --table daily --limit 10
```

> **Note**: For local development, the backend automatically connects to `open_nem_ph.duckdb`. When `MOTHERDUCK_TOKEN` is configured in `.env`, it seamlessly connects to MotherDuck Cloud (`md:open_electricity_db`).

---

### 2. Running Locally (FastAPI + Next.js)

**Terminal 1: FastAPI Backend**
```bash
# Start the Python FastAPI server on port 8000
uv run uvicorn api.index:app --port 8000 --reload
```
Interactive API documentation will be available at [`http://localhost:8000/api/docs`](http://localhost:8000/api/docs).

**Terminal 2: Next.js Frontend**
```bash
# Install frontend dependencies
npm install

# Start Next.js dev server on port 3000 (proxies /api requests to FastAPI)
npm run dev
```

Visit [`http://localhost:3000`](http://localhost:3000) to view the live dashboard!

---

## 🗄️ Database Setup (DuckDB & MotherDuck)

- **Local Development**: Runs out of the box using embedded [DuckDB](https://duckdb.org/) (`open_nem_ph.duckdb`). No database server installation required.
- **Cloud Deployment (MotherDuck)**:
  1. Create a database token on [MotherDuck](https://motherduck.com/).
  2. Set your environment variable in `.env` (and Vercel / GitHub Actions secrets):
     ```env
     MOTHERDUCK_TOKEN=your-motherduck-token-here
     MOTHERDUCK_DATABASE=open_electricity_db
     ```
  3. Run `uv run ingest sync-cloud` to sync your local DuckDB data directly to MotherDuck!

---

## 🤖 Daily Automated Pipeline (GitHub Actions)

The repository includes a GitHub Action in [`.github/workflows/daily_pipeline.yml`](.github/workflows/daily_pipeline.yml):
- **Schedule**: Automatically runs daily at `01:00 UTC` (`09:00 AM PHT`), right after IEMOP completes daily data publishing.
- **MotherDuck Sync**: Automatically writes to MotherDuck Cloud using the `MOTHERDUCK_TOKEN` secret.
- **Manual Trigger**: Can be triggered anytime with custom date inputs under GitHub's **Actions** tab (`workflow_dispatch`).
- **Secrets Needed**: Add `MOTHERDUCK_TOKEN` under **Settings > Secrets and variables > Actions**.

---

## 🌐 Deploy to Vercel

1. Import this repository into [Vercel](https://vercel.com).
2. **Settings**:
   - **Framework Preset**: `Next.js` (detected automatically)
   - **Root Directory**: `./` (leave default)
   - **Build Command** & **Output Directory**: Leave default (no custom commands needed)
3. **Environment Variables** (under **Settings → Environment Variables**):
   - `MOTHERDUCK_TOKEN`: Your MotherDuck Service Token
   - `MOTHERDUCK_DATABASE`: `open_electricity_db`
4. Deploy! Vercel will automatically build the Next.js React frontend and deploy the FastAPI serverless function at `/api/*`.

---

## 📄 License & Data Attribution

- Inspired by the [OpenNEM project](https://explore.openelectricity.org.au/).
- Philippine market data provided by [IEMOP (Independent Electricity Market Operator of the Philippines)](https://www.iemop.ph/).
- Open source under the MIT License.

