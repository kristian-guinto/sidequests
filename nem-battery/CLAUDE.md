# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install with dev dependencies (editable)
uv pip install -e ".[dev]"

# Lint
uv run ruff check nem_battery/

# Auto-fix lint
uv run ruff check --fix nem_battery/

# Run tests
uv run pytest

# Run a single test file
uv run pytest tests/test_parser.py

# CLI (after install)
uv run nem-battery list
uv run nem-battery prices
uv run nem-battery latest --battery victorian_big_battery
uv run nem-battery daily 2026-03-15 --battery victorian_big_battery
uv run nem-battery stream --battery hornsdale --scada
```

## Architecture

### Data source reality

AEMO publishes **no REST API**. All data is ZIP files from `https://www.nemweb.com.au/Reports/`. Files use the **MMS format**: pipe-delimited CSV with row-type prefixes (`I` = column headers, `D` = data rows). All directory URLs **must end with a trailing slash** or NEMWeb returns a 301 redirect.

The key data split discovered from live inspection (not documentation):

| Source | Contains | Used for |
|--------|----------|---------|
| `Current/DispatchIS_Reports/` | `PRICE` + `UNIT_SOLUTION` | Real-time (5-min) |
| `Current/Next_Day_Dispatch/` | `UNIT_SOLUTION` only — **no prices** | Historical unit data |
| `Archive/DispatchIS_Reports/PUBLIC_DISPATCHIS_YYYYMMDD.zip` | `PRICE` only (inner ZIPs) — **no unit solutions** | Historical prices |

`fetch_next_day_dispatch()` therefore fetches **both** sources concurrently and joins on `SETTLEMENTDATE`.

### Module responsibilities

- **`_parser.py`** — pure MMS ZIP parser, no IO. Accepts `tables: set[str] | None` to extract only needed tables. Returns `dict[table_name, list[dict]]`. All business logic should call this rather than parsing MMS directly.
- **`_client.py`** — thin `httpx` wrapper. Exposes `fetch_zip()`, `list_directory()`, `fetch_latest_zip()`. All functions accept an optional shared `httpx.AsyncClient` for connection reuse in the streaming path. `_CLIENT_DEFAULTS` dict used by both `_client.py` and `stream.py` to ensure consistent settings (`follow_redirects=True` is required).
- **`reports/dispatch.py`** — real-time DispatchIS; exports private helpers `_build_prices()`, `_build_unit_solutions()`, `_extract_settlement_date()` that are reused by `nextday.py`.
- **`reports/nextday.py`** — historical days; fetches two sources concurrently with `asyncio.gather()` and joins on settlement date string (cheaper than parsing datetimes as keys).
- **`battery.py`** — `Battery` dataclass + `KNOWN_BATTERIES` registry + revenue functions. Revenue calculation is the domain core.
- **`stream.py`** — polls `DispatchIS_Reports/` directory listing every N seconds; only downloads a ZIP when the latest filename changes. Exponential backoff on HTTP errors.

### Battery registration model

Modern NEM batteries (post ~2022) use a **single bidirectional DUID** (`load_duid=None`). `TOTALCLEARED > 0` = discharging (energy revenue), `TOTALCLEARED < 0` = charging (energy cost). `Battery.bidirectional` property controls the branch in `calculate_revenue()`.

Revenue formula per 5-minute interval:
```
energy_revenue = max(total_cleared, 0) × RRP × (5/60)
energy_cost    = max(-total_cleared, 0) × RRP × (5/60)  # can be negative at negative prices
net            = energy_revenue − energy_cost + Σ(fcas_mw[svc] × fcas_price[svc] × 5/60)
```

`energy_cost` can be **negative** when the battery charges during negative-price periods (earning money by absorbing surplus). The CLI distinguishes this as "Charge income" vs "Charge cost" in output.

### Known DUIDs (verified from live DISPATCH_UNIT_SOLUTION, March 2026)

All batteries in `KNOWN_BATTERIES` are bidirectional single-DUID units:

| Key | DUID | Region |
|-----|------|--------|
| `hornsdale` | `HPR1` | SA1 |
| `victorian_big_battery` | `VBB1` | VIC1 |
| `wallgrove` | `WALGRV1` | NSW1 |
| `lake_bonney` | `LKBONNY1` | SA1 |
| `gannawarra` | `GANNB1` | VIC1 |
| `dalrymple_north` | `DALNTH1` | SA1 |
| `wandoan` | `WANDB1` | QLD1 |

DUIDs change when batteries are re-registered. Always cross-check against live `DISPATCH_UNIT_SOLUTION` data if results look wrong.

### FCAS market names

The 8 FCAS services (constant `FCAS_SERVICES` in `types.py`): `RAISE6SEC`, `RAISE60SEC`, `RAISE5MIN`, `RAISEREG`, `LOWER6SEC`, `LOWER60SEC`, `LOWER5MIN`, `LOWERREG`. The column names in `DISPATCH_PRICE` are these names suffixed with `RRP` (e.g. `RAISE6SECRRP`). The column names in `DISPATCH_UNIT_SOLUTION` are the bare service names (e.g. `RAISE6SEC`).

### Python gotchas

- `max(-0.0, 0.0)` returns `-0.0` in CPython. In `calculate_revenue()` we add `+ 0.0` after `max()` to normalise negative zero before formatting.
- All async entry points use `asyncio.run()` at the CLI layer; internal async functions accept an optional `client` parameter so the streaming engine can reuse one connection pool.
