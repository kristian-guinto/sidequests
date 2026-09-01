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
open-nem-ph/
├── .github/
│   └── workflows/
│       └── daily_pipeline.yml      # Automated daily GitHub Actions cron (uv run ingest)
├── db/
│   └── schema.sql                  # Supabase / PostgreSQL schema & RLS policies
├── pipeline/                       # Python data ingestion engine (uv)
│   ├── config.py                   # Configuration & constants
│   ├── iemop_client.py             # IEMOP AJAX downloader & ZIP/CSV unpacker
│   ├── generator_registry.py       # Generator fuel tech mapper & heuristic resolver
│   ├── data_processor.py           # 5-minute dispatch & regional aggregator
│   ├── db.py                       # Supabase client & local SQLite fallback
│   ├── ingest.py                   # CLI tool for daily sync & backfills
│   └── data/
│       └── generators_master.json  # Comprehensive Philippine power plant catalog
├── web/                            # Next.js 14 + Tailwind + ECharts frontend (Vercel)
│   ├── src/
│   │   ├── app/                    # Next.js App Router (Dashboard & API routes)
│   │   ├── components/             # Charts, KPI cards, Fuel table, Interconnectors
│   │   └── lib/                    # Types, color palette, mock generator
│   ├── package.json
│   └── tailwind.config.ts
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

# Inspect database tables, row counts, and data samples
uv run ingest inspect
uv run ingest inspect --table dispatch --region LUZON --limit 10
uv run ingest inspect --table facilities --limit 10
uv run ingest inspect --table regional --limit 10
uv run ingest inspect --table daily --limit 10
```

> **Note**: If `SUPABASE_URL` and `SUPABASE_KEY` are not configured in `.env`, the pipeline automatically saves to a local SQLite database (`open_nem_ph.db`).

---

### 2. Frontend Dashboard (Next.js + Vercel)

```bash
cd web

# Install frontend dependencies
pnpm install

# Start local development server
pnpm dev
```

Visit [`http://localhost:3000`](http://localhost:3000) to explore the tracker!

---

## 🗄️ Database Setup (Supabase)

1. Create a project at [Supabase](https://supabase.com/).
2. Navigate to the **SQL Editor** and run the SQL migration script:
   [`db/schema.sql`](file:///home/ian/open-nem-ph/db/schema.sql)
3. Copy your project URL and service role / anon keys into `.env`:
   ```env
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_KEY=your-supabase-key
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-key
   ```

---

## 🤖 Daily Automated Pipeline (GitHub Actions)

The repository includes a GitHub Action in [`.github/workflows/daily_pipeline.yml`](file:///home/ian/open-nem-ph/.github/workflows/daily_pipeline.yml):
- **Schedule**: Automatically runs daily at `01:00 UTC` (`09:00 AM PHT`), right after IEMOP completes daily data publishing.
- **Manual Trigger**: Can be triggered anytime with custom date inputs under GitHub's **Actions** tab (`workflow_dispatch`).
- **Secrets Needed**: Add `SUPABASE_URL` and `SUPABASE_KEY` under **Settings > Secrets and variables > Actions**.

---

## 🌐 Deploy to Vercel

1. Import this repository into [Vercel](https://vercel.com).
2. Set the **Root Directory** to `web`.
3. Add the environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy!

---

## 📄 License & Data Attribution

- Inspired by the [OpenNEM project](https://explore.openelectricity.org.au/).
- Philippine market data provided by [IEMOP (Independent Electricity Market Operator of the Philippines)](https://www.iemop.ph/).
- Open source under the MIT License.

