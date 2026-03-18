# nem-battery

A lightweight Python package for fetching and analysing AEMO NEM data focused on
utility-scale battery storage. Designed to power dashboards and data pipelines showing
battery operation and revenue across Australia's National Electricity Market.

## Overview

AEMO publishes no REST API. All public market data is served as ZIP archives from
[NEMWeb](https://www.nemweb.com.au/). This package handles the HTTP fetching, MMS
file parsing, and revenue calculations so you can focus on analysis and visualisation.

**What it does:**

- Fetches 5-minute dispatch results (prices + per-unit dispatch targets + FCAS enablement)
- Fetches actual metered MW from Dispatch SCADA
- Fetches 30-minute settlement prices
- Fetches full historical trading days from Next Day Dispatch or the daily archive
- Calculates per-interval and daily revenue for any battery (energy + all 8 FCAS markets)
- Streams real-time data with automatic backoff on HTTP errors
- Persists data to a DuckDB / MotherDuck database for dashboard backends

**Minimal dependencies:** only `httpx` is required for live fetching. The database
pipeline adds `duckdb`.

---

## Installation

```bash
pip install nem-battery
```

With the database pipeline (DuckDB / MotherDuck):

```bash
pip install "nem-battery[pipeline]"
```

With optional DataFrame support (polars):

```bash
pip install "nem-battery[dataframes]"
```

From source:

```bash
git clone https://github.com/youruser/nem-battery
cd nem-battery
pip install -e ".[dev]"
```

Requires Python 3.13+.

---

## Quick start

### Latest dispatch interval

```python
import asyncio
from nem_battery import fetch_dispatch_interval, KNOWN_BATTERIES, calculate_revenue

async def main():
    interval = await fetch_dispatch_interval()
    battery = KNOWN_BATTERIES["hornsdale"]
    rev = calculate_revenue(battery, interval)

    prices = interval.price(battery.region)
    print(f"Settlement:  {interval.settlement_date}")
    print(f"SA1 RRP:     ${prices.rrp:.2f}/MWh")
    print(f"Discharge:   {rev.discharge_mw:.1f} MW")
    print(f"Charge:      {rev.charge_mw:.1f} MW")
    print(f"Net revenue: ${rev.net:.2f}")

asyncio.run(main())
```

### Historical full-day revenue

```python
import asyncio
from datetime import date
from nem_battery import fetch_next_day_dispatch, calculate_daily_revenue, KNOWN_BATTERIES

async def main():
    battery = KNOWN_BATTERIES["victorian_big_battery"]
    day = await fetch_next_day_dispatch(date(2026, 3, 16))
    rev = calculate_daily_revenue(battery, day)

    print(f"VBB revenue for {rev.date}")
    print(f"  Total:        ${rev.total:,.0f}")
    print(f"  Net energy:   ${rev.net_energy:,.0f}")
    print(f"  FCAS total:   ${rev.total_fcas_revenue:,.0f}")

asyncio.run(main())
```

### Real-time streaming

```python
import asyncio
from nem_battery import stream_dispatch, KNOWN_BATTERIES, calculate_revenue

async def main():
    battery = KNOWN_BATTERIES["hornsdale"]
    async for interval in stream_dispatch():
        rev = calculate_revenue(battery, interval)
        print(f"{interval.settlement_date}  net=${rev.net:.2f}")

asyncio.run(main())
```

Or with a callback:

```python
from nem_battery import stream_dispatch_to, KNOWN_BATTERIES, calculate_revenue

battery = KNOWN_BATTERIES["hornsdale"]

async def on_interval(interval):
    rev = calculate_revenue(battery, interval)
    await dashboard.push_update(rev)   # your dashboard layer here

await stream_dispatch_to(on_interval, include_scada=True)
```

---

## Data sources

All data comes from [NEMWeb](https://www.nemweb.com.au). No API key or registration
is required.

| Feed | Update cadence | What it contains |
|------|---------------|-----------------|
| `DispatchIS_Reports/` | Every 5 min | Energy RRP + 8 FCAS prices per region; per-DUID dispatch targets + FCAS enablement |
| `Dispatch_SCADA/` | Every 5 min | Actual metered MW per DUID |
| `TradingIS_Reports/` | Every 30 min | 30-minute settlement prices (used for financial settlement) |
| `Next_Day_Dispatch/` | Daily ~4 AM AEST | Full prior trading day unit solutions (~13 months rolling) |
| `Archive/DispatchIS_Reports/` | Daily | Historical dispatch prices (daily bundle, ~13 months rolling) |

> **Historical data note:** `Next_Day_Dispatch/` contains unit solutions only (no prices).
> `Archive/DispatchIS_Reports/` contains prices only (no unit solutions). The
> `fetch_next_day_dispatch()` function fetches both concurrently and joins on
> settlement timestamp automatically.

### NEM settlement vs spot price

The NEM settles at the **trading interval price** (30-minute average of 6 dispatch
prices), not the 5-minute dispatch price. For operational dashboards use dispatch
prices; for accurate revenue accounting use `fetch_trading_prices()`.

### Battery registration model

Modern NEM batteries (post ~2022) use a **single bidirectional DUID**. A positive
`TOTALCLEARED` means discharging (earns energy revenue); a negative `TOTALCLEARED`
means charging (incurs energy cost, or earns money if the price is negative).
All batteries in `KNOWN_BATTERIES` use this model.

---

## API reference

### Fetching data

```python
from nem_battery import (
    fetch_dispatch_interval,   # latest 5-min interval (real-time)
    fetch_next_day_dispatch,   # full historical trading day
    fetch_scada,               # latest actual metered MW
    fetch_trading_prices,      # latest 30-min settlement prices
)
```

#### `fetch_dispatch_interval() -> DispatchInterval`

Fetches the most recently published 5-minute dispatch interval. Returns prices for all
five NEM regions and unit solutions for every dispatched DUID.

#### `fetch_next_day_dispatch(day: date) -> DispatchDay`

Fetches all 288 five-minute intervals for one historical trading day by combining
`Next_Day_Dispatch/` (unit solutions) and `Archive/DispatchIS_Reports/` (prices).
Up to ~13 months of history is available.

#### `fetch_scada() -> list[ScadaReading]`

Fetches actual metered MW from the latest Dispatch SCADA file. Useful for
operational monitoring and state-of-charge estimation.

#### `fetch_trading_prices() -> dict[str, TradingPrice]`

Fetches the latest 30-minute trading interval prices, keyed by region.

---

### Battery registry

```python
from nem_battery import KNOWN_BATTERIES, Battery

battery = KNOWN_BATTERIES["hornsdale"]
print(battery.name)            # "Hornsdale Power Reserve"
print(battery.region)          # "SA1"
print(battery.generator_duid)  # "HPR1"  (single bidirectional DUID)
print(battery.load_duid)       # None    (modern bidirectional registration)
print(battery.mw_capacity)     # 150.0
print(battery.mwh_capacity)    # 193.5
```

**Known batteries** (DUIDs verified from live `DISPATCH_UNIT_SOLUTION`, March 2026):

| Key | Name | Region | MW | MWh | DUID |
|-----|------|--------|----|-----|------|
| `hornsdale` | Hornsdale Power Reserve | SA1 | 150 | 193.5 | `HPR1` |
| `victorian_big_battery` | Victorian Big Battery | VIC1 | 300 | 450 | `VBB1` |
| `wallgrove` | Wallgrove BESS | NSW1 | 50 | 75 | `WALGRV1` |
| `lake_bonney` | Lake Bonney BESS | SA1 | 25 | 52 | `LKBONNY1` |
| `gannawarra` | Gannawarra ESS | VIC1 | 25 | 50 | `GANNB1` |
| `dalrymple_north` | Dalrymple North BESS | SA1 | 30 | 8 | `DALNTH1` |
| `wandoan` | Wandoan Power BESS | QLD1 | 100 | 150 | `WANDB1` |

> DUIDs change when batteries are re-registered. Always cross-check against live
> `DISPATCH_UNIT_SOLUTION` data if results look wrong.

#### Custom batteries

```python
from nem_battery import Battery, calculate_revenue

my_battery = Battery(
    name="My Battery",
    region="QLD1",
    generator_duid="MYBAT1",   # single bidirectional DUID
    mw_capacity=100.0,
    mwh_capacity=200.0,
)
rev = calculate_revenue(my_battery, interval)
```

---

### Revenue calculation

```python
from nem_battery import calculate_revenue, calculate_daily_revenue, FCAS_SERVICES

# Single interval
rev = calculate_revenue(battery, interval)
rev.net               # total net revenue for this interval ($)
rev.energy_revenue    # income from discharge ($)
rev.energy_cost       # cost of charging (negative when price is negative)
rev.total_fcas        # sum of all FCAS revenue ($)
rev.fcas_revenue      # dict[service, $] for all 8 FCAS markets
rev.discharge_mw      # dispatch target MW (discharge)
rev.charge_mw         # dispatch target MW (charge)

# Full day
daily = calculate_daily_revenue(battery, day)
daily.total                # net revenue across all intervals ($)
daily.total_energy_revenue
daily.total_energy_cost
daily.net_energy           # energy_revenue - energy_cost
daily.total_fcas_revenue
daily.intervals            # list[IntervalRevenue], all 288 intervals
```

Revenue formula per 5-minute interval:

```
energy_revenue = max(total_cleared, 0) × RRP × (5/60)
energy_cost    = max(-total_cleared, 0) × RRP × (5/60)
net            = energy_revenue − energy_cost + Σ(fcas_mw × fcas_price × 5/60)
```

`energy_cost` can be **negative** when the battery charges during negative-price
periods — the battery earns money by absorbing surplus generation.

**FCAS services** (`FCAS_SERVICES` constant):

| Service | Description |
|---------|-------------|
| `RAISE6SEC` | Raise contingency 6-second |
| `RAISE60SEC` | Raise contingency 60-second |
| `RAISE5MIN` | Raise contingency 5-minute |
| `RAISEREG` | Raise regulation |
| `LOWER6SEC` | Lower contingency 6-second |
| `LOWER60SEC` | Lower contingency 60-second |
| `LOWER5MIN` | Lower contingency 5-minute |
| `LOWERREG` | Lower regulation |

---

### Real-time streaming

```python
from nem_battery import stream_dispatch, stream_dispatch_to
```

#### `stream_dispatch(poll_seconds=5.0, include_scada=False)`

Async generator that yields a new `DispatchInterval` each time AEMO publishes one
(every ~5 minutes). Polls the NEMWeb directory listing every `poll_seconds` seconds;
only downloads the ZIP (~20 KB) when a new file appears.

- Handles transient HTTP errors with exponential backoff (capped at 120 s)
- Resumes automatically when connectivity returns
- `include_scada=True` fetches the Dispatch SCADA file as well and attaches
  readings to `interval.scada`

#### `stream_dispatch_to(callback, poll_seconds=5.0, include_scada=False)`

Runs forever, calling `callback(interval)` for each new interval. The callback
can be a plain function or an async function.

---

## Pipeline (DuckDB / MotherDuck)

The pipeline module writes dispatch data to a DuckDB database — either a local file
or [MotherDuck](https://motherduck.com) (DuckDB cloud). This is the recommended
approach for dashboards: run the pipeline on a cron schedule and query the database
from a frontend (e.g. a Vercel app querying MotherDuck directly).

### Schema

```
dispatch_prices    (settlement_date, region)       — raw AEMO clearing prices
battery_revenue    (settlement_date, battery_key)  — calculated revenue per battery
```

Both tables use `ON CONFLICT DO NOTHING` — re-running the same interval is always safe.

### Targets (pyproject.toml)

Named connection profiles are defined under `[tool.nem-battery.targets.*]` in
`pyproject.toml`. The starter config is included in this repo:

```toml
[tool.nem-battery.targets.local]
url = "nem_battery.db"          # DuckDB file in the working directory

[tool.nem-battery.targets.remote]
url = "md:nem_battery"          # MotherDuck cloud database
```

For MotherDuck targets set `MOTHERDUCK_TOKEN` in your environment or in a `.env`
file alongside `pyproject.toml` — the token is appended to the URL automatically:

```bash
# .env
MOTHERDUCK_TOKEN=your_token_here
```

Add more targets for staging, test databases, etc.:

```toml
[tool.nem-battery.targets.staging]
url = "md:nem_battery_staging"
```

### CLI commands

All pipeline commands accept `--target` / `-t` (default: `local`):

```bash
# Requires: pip install "nem-battery[pipeline]"

nem-battery ingest-interval                      # → local target
nem-battery ingest-interval --target remote      # → remote (MotherDuck)
nem-battery ingest-interval -t remote

nem-battery ingest-daily                         # yesterday → local
nem-battery ingest-daily 2026-03-16 -t remote    # specific day → remote
nem-battery backfill 2026-01-01 2026-03-15 -t remote

# Inspect DB contents
nem-battery db                                   # local, last 10 rows
nem-battery db --target remote                   # remote MotherDuck
nem-battery db -t remote --tail 20 --battery hornsdale
```

### Python API

```python
import asyncio
from nem_battery import pipeline

# Connect by target name (reads pyproject.toml)
conn = pipeline.connect_target("local")
pipeline.ensure_schema(conn)

# Ingest one interval
from nem_battery import fetch_dispatch_interval
interval = await fetch_dispatch_interval()
n_prices, n_revenue = pipeline.ingest_interval(conn, interval)
conn.close()

# Or use the high-level helpers (target defaults to "local")
await pipeline.run_ingest_interval()
await pipeline.run_ingest_interval(target="remote")

from datetime import date
await pipeline.run_ingest_day(date(2026, 3, 16), target="remote")
await pipeline.run_backfill(date(2026, 1, 1), date(2026, 3, 15), target="remote")
```

For direct URL connections (e.g. tests):

```python
conn = pipeline.connect(":memory:")
```

### GitHub Actions cron

The repository includes two ready-to-use workflow files:

**`.github/workflows/ingest-interval.yml`** — runs every 5 minutes, ingests the latest
dispatch interval. GitHub's scheduler has 1–10 min jitter; this is acceptable since
AEMO data itself only updates every 5 minutes and duplicate runs are no-ops.

**`.github/workflows/ingest-daily.yml`** — runs at 19:00 UTC (05:00 AEST) daily,
ingests the previous trading day's 288 intervals. Supports a `date` input for
`workflow_dispatch` to trigger ad-hoc backfills.

Add your MotherDuck service token to GitHub repo secrets as `MOTHERDUCK_TOKEN`, then
enable the workflows and change the default target to `remote`:

```yaml
- run: uv run nem-battery ingest-interval --target remote
```

```bash
# One-time historical backfill
nem-battery backfill 2025-03-01 2026-03-16 --target remote
```

---

## Command-line interface

```
nem-battery list                            list known batteries and DUIDs
nem-battery prices                          current spot prices (all regions)
nem-battery latest [--battery KEY]          latest interval for one battery
nem-battery daily DATE [--battery KEY]      daily revenue for one battery
nem-battery stream [--battery KEY]          live stream of intervals
nem-battery stream --scada                  stream with SCADA actual MW

# pipeline (requires pip install "nem-battery[pipeline]")
nem-battery ingest-interval [-t TARGET]     latest interval → DB
nem-battery ingest-daily [DATE] [-t TARGET] full day → DB (default: yesterday)
nem-battery backfill START END [-t TARGET]  date range → DB
nem-battery db [-t TARGET] [--tail N]       row counts, date range, latest rows
nem-battery db [-t TARGET] [--battery KEY]  filter output to one battery
```


See `nem-battery --help` or `nem-battery COMMAND --help` for full options.

---

## MMS file format

AEMO uses a pipe-delimited CSV format with row-type prefixes. If you need to parse
raw ZIP files directly:

```python
from nem_battery._parser import parse_mms_zip

with open("PUBLIC_DISPATCHIS_202603170845_0000000508035572.zip", "rb") as f:
    tables = parse_mms_zip(f.read(), tables={"PRICE", "UNIT_SOLUTION"})

prices = tables["PRICE"]        # list of dicts
solutions = tables["UNIT_SOLUTION"]
```

---

## Project structure

```
nem_battery/
├── __init__.py          # public API
├── types.py             # typed dataclasses
├── _parser.py           # MMS ZIP → dict-of-tables (pure, no IO)
├── _client.py           # HTTP helpers (fetch_zip, list_directory)
├── battery.py           # Battery dataclass + revenue functions
├── stream.py            # async polling engine
├── pipeline.py          # DuckDB / MotherDuck ingestion pipeline
└── reports/
    ├── dispatch.py      # DispatchIS (5-min prices + unit solutions)
    ├── scada.py         # Dispatch SCADA (actual metered MW)
    ├── trading.py       # TradingIS (30-min settlement prices)
    └── nextday.py       # Next Day Dispatch + archive price join

.github/workflows/
├── ingest-interval.yml  # cron: every 5 min
└── ingest-daily.yml     # cron: daily at 19:00 UTC
```

---

## Licence

MIT
