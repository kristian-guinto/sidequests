---
name: add-country
description: >-
  Comprehensive guide and runbook for onboarding a new country into OpenElectricity.
  Use this skill whenever the user asks to add, integrate, onboard, or track a new country,
  national electricity grid, or market data provider (e.g. Vietnam, Indonesia, Japan, Taiwan).
---

# Onboarding a New Country into OpenElectricity

This skill provides the end-to-end, standardized runbook for adding a new country and its national electricity grid to the OpenElectricity platform.

Integrating a country requires coordinating across the ETL pipeline, database storage layer, backend API, frontend dashboard, and automated GitHub Actions workflows.

---

## Quick Reference Templates

*   **[Invariants Checklist](./references/invariants_checklist.md)**: Mandatory rules and domain invariants sign-off before committing.
*   **[Facility Classifier Template](./references/classifier_template.py)**: Boilerplate for fuel technology mapping and region classification.
*   **[Market Provider Template](./references/provider_template.py)**: Boilerplate for time-series extraction, DuckDB streaming, and timezone handling.

---

## 7-Phase Onboarding Runbook

### Phase 1: Research & Market Feasibility

Before writing code, establish the core characteristics of the country's electricity system:

1.  **Grid Operator / Market Operator**: Identify the authoritative entity publishing dispatch data (e.g., IEMOP in PH, EMC in SG, Single Buyer in MY, EGAT in TH, EVN in VN, PLN in ID).
2.  **Market Structure**:
    *   *Competitive Wholesale Spot Market* (e.g., WESM, USEP, SMP): Generates interval clearing prices. Set `hasSpotMarket: true`.
    *   *Single Buyer / Regulated Tariff* (e.g., EGAT ESB, PLN, EVN): Generates no wholesale spot clearing price. Set `hasSpotMarket: false` and set spot prices to `None`. Do **not** inject synthetic tariffs.
3.  **Data Cadence & Resolution**:
    *   Standard interval resolution: `5m` (e.g., PH, TH), `30m` (e.g., SG, MY), or `1h`.
4.  **Timezone & Currency**:
    *   IANA Timezone (e.g., `Asia/Bangkok`, `Asia/Jakarta`, `Asia/Ho_Chi_Minh`, `Asia/Tokyo`).
    *   ISO-4217 Currency Code (e.g., `THB`, `VND`, `IDR`, `JPY`, `PHP`, `SGD`, `MYR`) and currency symbol.

---

### Phase 2: Ingestion & Pipeline Implementation

All pipeline code lives in `packages/pipeline/pipeline/`.

#### 1. Implement Facility Classifier
Create `packages/pipeline/pipeline/classifiers/<cc>_<source>.py` (or adapt [classifier_template.py](./references/classifier_template.py)):
*   Subclass `BaseFacilityClassifier` from `pipeline.classifiers.base`.
*   Implement `classify(self, resource_id: str, raw_region: str = "") -> ClassifiedUnit`.
*   Map to canonical fuel techs: `solar`, `wind`, `hydro`, `geothermal`, `biomass`, `gas`, `coal`, `oil`, `battery`, `unclassified`.
*   **CRITICAL**: Strictly avoid "blanket peaker" fallbacks. Unidentified plants must resolve to `unclassified`, not `oil`/`distillate`.

#### 2. Implement Market Provider
Create `packages/pipeline/pipeline/providers/<cc>_<source>.py` (or adapt [provider_template.py](./references/provider_template.py)):
*   Subclass `BaseProvider` from `pipeline.providers.base`.
*   Implement `fetch_facilities(self, conn=None) -> List[FacilityRecord]`.
*   Implement `fetch_energy_intervals(self, start_date=None, end_date=None, days=2, conn=None, on_batch=None, **kwargs) -> List[EnergyIntervalRecord]`.
*   Ensure all timestamps are formatted as ISO 8601 with local timezone offset (e.g. `2026-09-12T00:00:00+07:00`).

#### 3. Register Provider in Pipeline
*   Add the provider class to `packages/pipeline/pipeline/providers/__init__.py`:
    ```python
    from pipeline.providers.<cc>_<source> import <Country>Provider

    PROVIDERS = {
        ...,
        "<CC>": <Country>Provider,
    }
    ```

#### 4. Register Currency & FX
*   Add country currency mapping to `packages/pipeline/pipeline/fx.py`:
    ```python
    COUNTRY_TO_CURRENCY: Dict[str, str] = {
        ...,
        "<CC>": "<CURRENCY_CODE>",
    }
    ```

---

### Phase 3: Enforce Domain Invariants

Review [.agents/rules/opennem-rules.md](file:///home/ian/open-electricity/.agents/rules/opennem-rules.md) and [invariants_checklist.md](./references/invariants_checklist.md):

*   **Zero-`pytz` Rule**: Never import `pytz` in `api/` or `packages/pipeline/`. Always use standard library `zoneinfo.ZoneInfo` or `datetime.timezone`.
*   **Checkpoint Resume**: Ingestion commands must query `db.get_latest_interval_date(country_code)` to avoid redundant downloads.
*   **Bulk Stream Uploads**: Use the `on_batch` callback for streaming inserts into DuckDB.
*   **Canonical Fuel Order**:
    $$\text{Coal} \rightarrow \text{Distillate} \rightarrow \text{Gas} \rightarrow \text{Biomass} \rightarrow \text{Geothermal} \rightarrow \text{Battery} \rightarrow \text{Hydro} \rightarrow \text{Wind} \rightarrow \text{Solar}$$

---

### Phase 4: Backend API Integration

Update `api/index.py`:

1.  Add the country definition to `COUNTRIES_METADATA`:
    ```python
    "<CC>": {
        "name": "<Country Name>",
        "currencySymbol": "<SYMBOL>",
        "currencyCode": "<CURRENCY>",
        "defaultRegion": "<DEFAULT_REGION>",
        "minInterval": "<5m|30m|1h>",
        "timezone": "<IANA_TIMEZONE>",
        "tzOffset": "<+OFFSET>",
    },
    ```
2.  Verify DuckDB queries in `api/index.py` correctly format query timestamps using local timezone offsets:
    ```sql
    strftime({time_expr} AT TIME ZONE '{tz_name}', '%Y-%m-%dT%H:%M:00{tz_offset}')
    ```

---

### Phase 5: Frontend UI Configuration

Update Next.js dashboard components in `src/`:

1.  **Types & Metadata** (`src/lib/types.ts`):
    *   Add `<CC>` to `CountryCode` type union.
    *   Add entry to `COUNTRIES_METADATA`:
        ```typescript
        <CC>: {
          code: "<CC>",
          name: "<Country Name>",
          flag: "<FLAG_EMOJI>",
          currencyCode: "<CURRENCY>",
          currencySymbol: "<SYMBOL>",
          defaultRegion: "<DEFAULT_REGION>",
          hasLivePipeline: true,
          hasSpotMarket: false, // true if wholesale spot market
          spotMarketNote: "...", // if single buyer / regulated tariffs
          gridOperator: "<OPERATOR>",
          regions: [
            { id: "<DEFAULT_REGION>", label: "<Label>" },
          ],
        },
        ```
2.  **Regional Benchmark Strip** (`src/components/RegionalBenchmarkStrip.tsx`):
    *   Add `<CC>` to `LIVE_COUNTRIES` array when live pipeline data is active.
3.  **Waffle Card & Header**:
    *   Ensure the country card and header navigation dropdown display the flag, name, and regional selections correctly.

---

### Phase 6: CLI & CI/CD Automation

1.  **CLI Entry Points** (`packages/pipeline/pipeline/cli.py`):
    *   Add `<CC>` to the `--country` argument help text and choices in `latest`, `backfill`, and `sync-facilities` commands.
2.  **GitHub Actions Workflow** (`.github/workflows/daily_pipeline.yml`):
    *   Add `<CC>` to the `country` dropdown options under `workflow_dispatch`.

---

### Phase 7: Verification & Test Suite

Always execute the following verification pipeline before finalizing:

```bash
# 1. Run pipeline unit tests
uv run pytest packages/pipeline/tests/

# 2. Run test ingestion for the new country (past 2 days)
uv run ingest latest --country <CC> --days 2 --target local

# 3. Inspect the stored DuckDB tables
uv run ingest inspect --country <CC> --table all --limit 5

# 4. Check API endpoint locally
uv run uvicorn api.index:app --port 8000 &
curl "http://localhost:8000/api/network?country=<CC>"
curl "http://localhost:8000/api/data?country=<CC>&range=1d"

# 5. Verify Frontend builds cleanly
npm run lint
npm run build
```

