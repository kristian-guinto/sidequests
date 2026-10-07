# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install with all dev extras (editable)
uv pip install -e ".[dev,pipeline,ml,dataframe]"

# Lint
uv run ruff check nem_battery/

# Auto-fix lint
uv run ruff check --fix nem_battery/

# Type-check
uv run mypy nem_battery/

# Run tests
uv run pytest

# Run a single test file
uv run pytest tests/test_strategy_map.py

# CLI (after install)
uv run nem-battery list
uv run nem-battery prices
uv run nem-battery latest --battery victorian_big_battery
uv run nem-battery daily 2026-03-15 --battery victorian_big_battery
uv run nem-battery stream --battery hornsdale --scada

# ML strategy pipeline (requires [ml,dataframe,pipeline] extras)
python -m nem_battery.strategy_map --target local

# Frontend dev server
cd frontend && pnpm dev

# Frontend build (must use --webpack flag)
cd frontend && pnpm build
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
- **`types.py`** — frozen dataclasses: `RegionPrices`, `UnitSolution`, `ScadaReading`, `DispatchInterval`, `DispatchDay`, `IntervalRevenue`, `DailyRevenue`. `FCAS_SERVICES` tuple defined here.
- **`reports/dispatch.py`** — real-time DispatchIS; exports private helpers `_build_prices()`, `_build_unit_solutions()`, `_extract_settlement_date()` that are reused by `nextday.py`.
- **`reports/nextday.py`** — historical days; fetches two sources concurrently with `asyncio.gather()` and joins on settlement date string (cheaper than parsing datetimes as keys).
- **`reports/scada.py`** — fetches SCADA (physical MW) readings.
- **`reports/trading.py`** — fetches 30-minute trading interval prices.
- **`battery.py`** — `Battery` dataclass + `KNOWN_BATTERIES` registry (16 batteries) + revenue functions. Revenue calculation is the domain core.
- **`pipeline.py`** — DuckDB ingestion: `connect_target()`, `ingest_interval()`, `ingest_daily()`, `backfill()`. Reads target config from `pyproject.toml` `[tool.nem-battery.targets.*]`.
- **`stream.py`** — polls `DispatchIS_Reports/` directory listing every N seconds; only downloads a ZIP when the latest filename changes. Exponential backoff on HTTP errors.
- **`strategy_map.py`** — feature engineering + UMAP dimensionality reduction + clustering pipeline. Reads `battery_revenue_interval` from DuckDB, produces 22 features per battery-day, trains UMAP (2D + 3D) and KMeans/DBSCAN, writes to `battery_strategy_embedding`. Has its own `argparse` CLI (`python -m nem_battery.strategy_map`).

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

All batteries in `KNOWN_BATTERIES` are bidirectional single-DUID units. DUIDs change when batteries are re-registered — cross-check against live data if results look wrong.

| Key | DUID | Region |
|-----|------|--------|
| `hornsdale` | `HPR1` | SA1 |
| `victorian_big_battery` | `VBB1` | VIC1 |
| `wallgrove` | `WALGRV1` | NSW1 |
| `lake_bonney` | `LBB1` | SA1 |
| `gannawarra` | `GANNB1` | VIC1 |
| `dalrymple_north` | `DALNTH1` | SA1 |
| `wandoan` | `WANDB1` | QLD1 |
| `torrens_island` | `TIB1` | SA1 |
| `blyth` | `BLYTHB1` | SA1 |
| `templers` | `TEMPB1` | SA1 |
| `capital_battery` | `CAPBES1` | NSW1 |
| `rangebank` | `RANGEB1` | VIC1 |
| `hazelwood` | `HBESS1` | VIC1 |
| `koorangie` | `KESSB1` | VIC1 |
| `tarong` | `TARBESS1` | QLD1 |
| `western_downs` | `WDBESS1` | QLD1 |
| `greenbank` | `GREENB1` | QLD1 |

### FCAS market names

The 8 FCAS services (constant `FCAS_SERVICES` in `types.py`): `RAISE6SEC`, `RAISE60SEC`, `RAISE5MIN`, `RAISEREG`, `LOWER6SEC`, `LOWER60SEC`, `LOWER5MIN`, `LOWERREG`. The column names in `DISPATCH_PRICE` are these names suffixed with `RRP` (e.g. `RAISE6SECRRP`). The column names in `DISPATCH_UNIT_SOLUTION` are the bare service names (e.g. `RAISE6SEC`).

### Database / pipeline

Four DuckDB tables: `dispatch_prices`, `battery_revenue_interval`, `battery_revenue_daily`, `battery_strategy_embedding`. All INSERTs use `ON CONFLICT DO NOTHING` for idempotency. Target config in `pyproject.toml`:
- `[tool.nem-battery.targets.local]` → `nem_battery.db`
- `[tool.nem-battery.targets.remote]` → `md:nem_battery` (MotherDuck)

`duckdb` is pinned to `<1.5` for MotherDuck compatibility. If the local DB is locked, `strategy_map.py` falls back to opening a read-only copy in a tempfile.

GitHub Actions runs ingestion automatically: `.github/workflows/ingest-interval.yml` (5-min) and `ingest-daily.yml`.

### Strategy map feature engineering

`strategy_map.py` computes 22 features per `[battery_key, trading_day]` pair, grouped into: Revenue/Value Stacking, Operational Profile, Market Reactivity, and Temporal/NEM-Specific. NEM trading day boundary is **04:00 AEST** (`trading_day = (timestamp - 4h).date()`). Only complete days (288 intervals) are included. See `feature-engineer.md` for full feature definitions.

### Frontend

Stack: Next.js 16 (App Router), shadcn/ui + `@base-ui/react`, Tailwind CSS 4, Recharts, Three.js (`@react-three/fiber`). Package manager: `pnpm`. DuckDB reads via `@duckdb/node-api` in server-side API routes only — must be in `serverExternalPackages` in `next.config`. Three.js is used for 3D UMAP strategy cluster visualisation.

Env: `DATABASE_URL=../nem_battery.db` (local) or `DATABASE_URL=md:nem_battery` + `MOTHERDUCK_TOKEN` (prod). See `frontend/.env.local.example`.

### Python gotchas

- `max(-0.0, 0.0)` returns `-0.0` in CPython. In `calculate_revenue()` we add `+ 0.0` after `max()` to normalise negative zero before formatting.
- All async entry points use `asyncio.run()` at the CLI layer; internal async functions accept an optional `client` parameter so the streaming engine can reuse one connection pool.
- `asyncio_mode = "auto"` is set in `pyproject.toml` — no `@pytest.mark.asyncio` decorator needed on async tests.
- Type annotations use `str | None` not `Optional[str]` (ruff UP045).
