# Country Onboarding Invariants Checklist

Before submitting or committing a new country integration, verify compliance against each invariant below:

## 1. Market Design & Spot Price Model
- [ ] **Market Type Identified**: Verified whether the market is a competitive wholesale spot electricity market (e.g., PH WESM, SG EMC, MY SMP) or an Enhanced Single Buyer / Regulated Tariff regime (e.g., TH EGAT, VN EVN, ID PLN).
- [ ] **No Synthetic Spot Prices**: If Single Buyer / regulated tariffs, spot prices in `EnergyIntervalRecord` must be `None` (not synthetic or benchmark prices).
- [ ] **Frontend Metadata**: `hasSpotMarket` set to `true` (spot market) or `false` (single buyer / regulated) in `src/lib/types.ts` with explanatory `spotMarketNote`.

## 2. Fuel Classification & Technology Mapping
- [ ] **Canonical Fuel Taxonomy**: Every plant maps strictly to one of:
  `solar`, `wind`, `hydro`, `geothermal`, `biomass`, `gas`, `coal`, `oil`, `battery`, `unclassified`.
- [ ] **No Blanket Peaker Fallback**: Do not classify unclassified thermal units as `oil` / `distillate`. Oil/diesel must be reserved only for genuine peaking plants and power barges (~1-2% grid capacity).
- [ ] **Canonical Stacking Order Preserved**: Verify stacked area charts follow:
  `Coal` $\rightarrow$ `Distillate` $\rightarrow$ `Gas` $\rightarrow$ `Biomass` $\rightarrow$ `Geothermal` $\rightarrow$ `Battery` $\rightarrow$ `Hydro` $\rightarrow$ `Wind` $\rightarrow$ `Solar`.

## 3. Timezone & Datetime Continuity
- [ ] **Local Timestamp Format**: All interval timestamps stored with explicit local timezone offset (e.g., `+07:00` for Bangkok/Jakarta/Hanoi, `+08:00` for Manila/Singapore/Kuala Lumpur).
- [ ] **Zero-`pytz` Invariant**: No `import pytz` anywhere in `api/` or `packages/pipeline/`. Use standard library `zoneinfo.ZoneInfo` or `datetime.timezone`.
- [ ] **SQL Cutoff Formatting**: SQL range queries format timestamps directly in DuckDB SQL using local timezone offsets.

## 4. FX & Currency Normalization
- [ ] **ISO-4217 Currency Code**: Mapped in `pipeline/fx.py` under `COUNTRY_TO_CURRENCY`.
- [ ] **USD Reference Rates**: Currency rates tested and confirmed fetchable from Frankfurter/ECB FX feed.

## 5. Pipeline Ingestion & Checkpointing
- [ ] **DB Checkpoint Resume**: Provider checks `db.get_latest_interval_date(country_code)` to avoid redundant downloads.
- [ ] **Batch Streaming**: Uses `on_batch` callback in `fetch_energy_intervals()` for bulk DuckDB ingestion rather than row-by-row inserts.
- [ ] **Stale Feed Protection**: Ingestion handles gaps exceeding 3 days appropriately.

## 6. Full-Stack Surface Registration
- [ ] Registered in `pipeline/providers/__init__.py` (`PROVIDERS` dict).
- [ ] Registered in `pipeline/cli.py` (`country` CLI option choices).
- [ ] Registered in `api/index.py` (`COUNTRIES_METADATA`).
- [ ] Registered in `src/lib/types.ts` (`CountryCode` union & `COUNTRIES_METADATA`).
- [ ] Added to `.github/workflows/daily_pipeline.yml` (workflow_dispatch inputs).

