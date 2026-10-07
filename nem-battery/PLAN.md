# nem-battery: Package Design Plan

## Overview

A lightweight Python package for fetching and processing AEMO NEM data focused on
utility-scale battery storage. Designed to power a real-time dashboard showing battery
operation (MW charge/discharge, state of charge) and revenue (energy + FCAS markets).

---

## Data Source Reality

AEMO publishes **no REST API**. All public data is served as ZIP files from NEMWeb:

```
https://www.nemweb.com.au/Reports/Current/{ReportDir}/
https://www.nemweb.com.au/Reports/Archive/{ReportDir}/
```

Files are in **MMS format**: pipe-delimited CSV with row-type prefixes:
- `C` – comment/header metadata
- `I` – column names for the table that follows
- `D` – data rows
- `END` – end of file

A single ZIP can contain multiple logical tables identified by `I` rows.

---

## Key Data Feeds

| Feed | Directory | Cadence | Tables Used |
|------|-----------|---------|-------------|
| Real-time dispatch | `DispatchIS_Reports/` | 5 min | `DISPATCH_UNIT_SOLUTION`, `DISPATCH_PRICE` |
| Actual SCADA MW | `Dispatch_SCADA/` | 5 min | `DISPATCH_UNIT_SCADA` |
| 30-min settlement prices | `TradingIS_Reports/` | 30 min | `TRADING_PRICE` |
| Next-day full day dispatch | `Next_Day_Dispatch/` | Daily (~4 AM) | `DISPATCH_UNIT_SOLUTION`, `DISPATCH_PRICE` |
| Daily FCAS VWA prices | `Vwa_Fcas_Prices/` | Daily (~4 AM) | `DISPATCHREGIONSUM` variant |
| Daily archive (historical) | `Archive/DispatchIS_Reports/` | Daily | same as DispatchIS |

**Filename patterns:**
```
PUBLIC_DISPATCHIS_YYYYMMDDHHMM_NNNNNNNNNNNNNNNN.zip    # 5-min dispatch
PUBLIC_DISPATCHSCADA_YYYYMMDDHHMM_NNNNNNNNNNNNNNNNNNN.zip
PUBLIC_TRADINGIS_YYYYMMDDHHMM_NNNNNNNNNNNNNNNN.zip
PUBLIC_NEXT_DAY_DISPATCH_YYYYMMDD_NNNNNNNNNNNNNNN.zip
PUBLIC_VWAFCASPRICES_YYYYMMDD0000_YYYYMMDDHHMMSS.zip
PUBLIC_DISPATCHIS_YYYYMMDD.zip                         # daily archive
```

---

## Battery Specifics

Each physical battery has **two DUIDs**:
- **Generator DUID** (e.g. `HPRG1`) — discharge direction; earns energy revenue
- **Load DUID** (e.g. `HPRL1`) — charge direction; pays energy cost

Revenue per 5-minute interval:
```
energy_revenue  = discharge_MW × RRP × (5/60)      # $/interval
energy_cost     = charge_MW    × RRP × (5/60)       # $/interval
fcas_revenue    = Σ(enabled_MW[svc] × price[svc] × (5/60))  # 8 FCAS services
net_revenue     = energy_revenue - energy_cost + fcas_revenue
```

FCAS services: `RAISE6SEC`, `RAISE60SEC`, `RAISE5MIN`, `RAISEREG`,
               `LOWER6SEC`, `LOWER60SEC`, `LOWER5MIN`, `LOWERREG`

Prices for all 9 markets (energy + 8 FCAS) are in `DISPATCH_PRICE` per region per interval.

---

## Package Architecture

```
nem_battery/
├── __init__.py               # Public API re-exports
│
├── _client.py                # Low-level HTTP: fetch ZIP bytes, list directory
├── _parser.py                # MMS ZIP → dict of {table_name: list[dict]}
│
├── reports/
│   ├── __init__.py
│   ├── dispatch.py           # DispatchIS: prices + unit solutions (5-min)
│   ├── scada.py              # Dispatch SCADA: actual MW (5-min)
│   ├── trading.py            # TradingIS: 30-min settlement prices
│   └── nextday.py            # Next Day Dispatch: full-day historical
│
├── battery.py                # Battery registry (DUID pairs) + revenue calc
├── stream.py                 # Real-time async polling engine
└── types.py                  # Typed dataclasses for all result objects
```

### Module Responsibilities

#### `_client.py`
- `async fetch_zip(url) -> bytes` — HTTP GET with retries and timeout
- `async list_directory(url) -> list[str]` — parse NEMWeb HTML directory listing to get filenames
- `latest_url(directory_url) -> str` — return URL of most-recent file in a directory
- Respects NEMWeb's CDN; no authentication required

#### `_parser.py`
- `parse_mms_zip(zip_bytes, tables) -> dict[str, list[dict]]`
  - Accepts a list of table names to extract (avoids parsing unused tables)
  - Handles multi-table MMS files; identifies tables by `I` row content
  - Returns raw dicts keyed by column name from the `I` row
- Pure function, no IO — easy to test

#### `reports/dispatch.py`
```python
async def fetch_dispatch_interval(
    settlement_date: datetime | None = None  # None = latest
) -> DispatchInterval
```
Returns a `DispatchInterval` with:
- `prices`: dict[region, RegionPrices] — energy RRP + 8 FCAS prices
- `unit_solutions`: list[UnitSolution] — per-DUID dispatch targets + FCAS enablement

#### `reports/scada.py`
```python
async def fetch_scada(settlement_date: datetime | None = None) -> list[ScadaReading]
```
Returns actual metered MW per DUID.

#### `reports/nextday.py`
```python
async def fetch_next_day_dispatch(date: date) -> DispatchDay
```
Returns all 288 intervals (5-min × 24h) for a trading day.

#### `battery.py`
```python
@dataclass
class Battery:
    name: str               # Human-readable name e.g. "Hornsdale Power Reserve"
    region: str             # NEM region e.g. "SA1"
    generator_duid: str     # Discharge DUID
    load_duid: str | None   # Charge DUID (None if registration pending)

# Pre-populated registry of known Australian batteries
KNOWN_BATTERIES: dict[str, Battery] = { ... }

def calculate_revenue(battery: Battery, interval: DispatchInterval) -> IntervalRevenue
def calculate_daily_revenue(battery: Battery, day: DispatchDay) -> DailyRevenue
```

#### `stream.py`
```python
async def stream_dispatch(
    on_interval: Callable[[DispatchInterval], Awaitable[None]],
    poll_interval_seconds: float = 5.0,
    include_scada: bool = True,
) -> None
```
- Polls latest file in `DispatchIS_Reports/` and `Dispatch_SCADA/`
- Tracks last-seen filename to avoid re-processing
- Fires `on_interval` callback with each new interval
- Handles transient HTTP errors with exponential backoff
- Also exposes an `async_generator` variant for use with `async for`

#### `types.py`
Typed dataclasses (no external deps) for:
- `RegionPrices` — energy RRP + 8 FCAS prices for one region+interval
- `UnitSolution` — DUID, dispatch MW, FCAS enablement MW per service
- `ScadaReading` — DUID, actual metered MW
- `DispatchInterval` — settlement datetime, prices, unit solutions
- `DispatchDay` — list of `DispatchInterval`
- `IntervalRevenue` — breakdown of energy revenue/cost + FCAS per service
- `DailyRevenue` — aggregated daily revenue per battery

---

## Dependencies

Kept deliberately minimal:

| Package | Purpose | Note |
|---------|---------|------|
| `httpx[http2]` | Async HTTP client | Supports HTTP/2, timeout, retries |
| `polars` | DataFrame for batch/historical analysis | Optional; functions return raw dicts if not installed |
| `msgspec` | Fast zero-copy typed decoding | Optional; falls back to plain dataclasses |

**No pandas**, no heavy ML libraries. The dashboard layer (Plotly Dash, Streamlit, etc.)
is kept entirely separate from this package.

---

## Real-Time Strategy

NEMWeb publishes a new `DispatchIS` ZIP every 5 minutes. The approach:

```
1. On start: list directory → parse newest filename → extract timestamp T0
2. Every 5s: list directory → check if newest timestamp > T0
3. If new file: download + parse + emit callback → update T0
4. On HTTP error: exponential backoff (5s, 10s, 20s, 40s, cap 120s)
```

Directory listing is a single lightweight HTTP GET (~2 KB HTML). The ZIP download
only happens when a new file appears (~20 KB per interval). Total bandwidth: ~240 KB/min.

---

## Usage Examples

```python
# One-off: fetch the latest dispatch interval
from nem_battery import fetch_dispatch_interval, KNOWN_BATTERIES, calculate_revenue

interval = await fetch_dispatch_interval()
hpr = KNOWN_BATTERIES["hornsdale"]
rev = calculate_revenue(hpr, interval)
print(f"HPR net revenue this interval: ${rev.net:.2f}")

# Historical: fetch a full day
from nem_battery import fetch_next_day_dispatch, calculate_daily_revenue

day = await fetch_next_day_dispatch(date(2026, 3, 16))
daily = calculate_daily_revenue(hpr, day)
print(f"HPR daily revenue: ${daily.total:.0f}")

# Real-time streaming
from nem_battery import stream_dispatch

async def on_interval(interval):
    rev = calculate_revenue(hpr, interval)
    print(f"{interval.settlement_date}: ${rev.net:.2f}")

await stream_dispatch(on_interval)

# With async generator
async for interval in stream_dispatch_gen():
    rev = calculate_revenue(hpr, interval)
    dashboard.update(rev)
```

---

## Implementation Phases

### Phase 1 — Core parsing (no IO)
- `_parser.py`: MMS ZIP → typed dicts
- `types.py`: all dataclasses
- Unit tests with real ZIP fixtures

### Phase 2 — HTTP client + report fetchers
- `_client.py`: fetch + directory listing
- `reports/dispatch.py`, `reports/scada.py`
- Integration tests hitting NEMWeb

### Phase 3 — Battery revenue logic
- `battery.py`: DUID registry + revenue calculations
- Known batteries pre-populated (HPR, VBB, Waratah, etc.)

### Phase 4 — Historical data
- `reports/nextday.py`, `reports/trading.py`
- Archive fetching with date-range iteration

### Phase 5 — Real-time streaming
- `stream.py`: polling engine with backoff
- async generator + callback variants

### Phase 6 — Dashboard integration
- Separate package/sub-project
- Plotly Dash or Streamlit consuming this package's stream

---

## Project Configuration (pyproject.toml additions)

```toml
[project]
dependencies = [
    "httpx[http2]>=0.27",
]

[project.optional-dependencies]
dataframes = ["polars>=1.0"]
fast = ["msgspec>=0.18"]
dev = ["pytest>=8", "pytest-asyncio>=0.23", "respx>=0.21", "ruff>=0.4", "mypy>=1.10"]

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "ANN"]

[tool.mypy]
strict = true
```
