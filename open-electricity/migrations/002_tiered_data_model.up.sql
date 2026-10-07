-- Migration: 002_tiered_data_model
-- Created: 2026-09-05

-- 1. Create energy_interval table (flexible for 5m, 30m, etc.)
CREATE TABLE IF NOT EXISTS energy_interval (
    country_code           VARCHAR NOT NULL,
    interval_start         TIMESTAMPTZ NOT NULL,
    interval_duration_mins SMALLINT NOT NULL DEFAULT 5,
    region                 VARCHAR NOT NULL,
    fuel_tech              VARCHAR NOT NULL,
    generation_mw          DOUBLE NOT NULL DEFAULT 0.0,
    energy_mwh             DOUBLE NOT NULL DEFAULT 0.0,
    emissions_tco2         DOUBLE DEFAULT 0.0,
    price_local            DOUBLE,
    currency               VARCHAR DEFAULT 'PHP',
    PRIMARY KEY (country_code, interval_start, region, fuel_tech)
);

-- 2. Create network_interval table
CREATE TABLE IF NOT EXISTS network_interval (
    country_code           VARCHAR NOT NULL,
    interval_start         TIMESTAMPTZ NOT NULL,
    interval_duration_mins SMALLINT NOT NULL DEFAULT 5,
    region                 VARCHAR NOT NULL,
    demand_mw              DOUBLE NOT NULL DEFAULT 0.0,
    generation_mw          DOUBLE NOT NULL DEFAULT 0.0,
    losses_mw              DOUBLE NOT NULL DEFAULT 0.0,
    import_mw              DOUBLE NOT NULL DEFAULT 0.0,
    export_mw              DOUBLE NOT NULL DEFAULT 0.0,
    net_interconnector_mw  DOUBLE NOT NULL DEFAULT 0.0,
    price_local            DOUBLE,
    currency               VARCHAR DEFAULT 'PHP',
    renewables_pct         DOUBLE,
    PRIMARY KEY (country_code, interval_start, region)
);

-- 3. Create energy_daily table
CREATE TABLE IF NOT EXISTS energy_daily (
    country_code        VARCHAR NOT NULL,
    date                DATE NOT NULL,
    region              VARCHAR NOT NULL,
    fuel_tech           VARCHAR NOT NULL,
    energy_mwh          DOUBLE NOT NULL DEFAULT 0.0,
    avg_generation_mw   DOUBLE NOT NULL DEFAULT 0.0,
    peak_generation_mw  DOUBLE NOT NULL DEFAULT 0.0,
    emissions_tco2      DOUBLE DEFAULT 0.0,
    vwap_price_local    DOUBLE,
    twap_price_local    DOUBLE,
    currency            VARCHAR DEFAULT 'PHP',
    PRIMARY KEY (country_code, date, region, fuel_tech)
);

-- 4. Create network_daily table
CREATE TABLE IF NOT EXISTS network_daily (
    country_code           VARCHAR NOT NULL,
    date                   DATE NOT NULL,
    region                 VARCHAR NOT NULL,
    demand_mwh             DOUBLE DEFAULT 0.0,
    avg_demand_mw          DOUBLE DEFAULT 0.0,
    peak_demand_mw         DOUBLE DEFAULT 0.0,
    min_demand_mw          DOUBLE DEFAULT 0.0,
    generation_mwh         DOUBLE DEFAULT 0.0,
    renewables_pct         DOUBLE,
    net_interconnector_mwh DOUBLE DEFAULT 0.0,
    vwap_price_local       DOUBLE,
    currency               VARCHAR DEFAULT 'PHP',
    PRIMARY KEY (country_code, date, region)
);

-- 5. Migrate existing data from energy_dispatch_5m into energy_interval
INSERT OR IGNORE INTO energy_interval (
    country_code,
    interval_start,
    interval_duration_mins,
    region,
    fuel_tech,
    generation_mw,
    energy_mwh,
    emissions_tco2,
    price_local,
    currency
)
SELECT
    country_code,
    COALESCE(TRY_CAST(timestamp AS TIMESTAMPTZ), TRY_STRPTIME(timestamp, '%m/%d/%Y')::TIMESTAMPTZ) AS interval_start,
    5 AS interval_duration_mins,
    region,
    fuel_tech,
    generation_mw,
    round(generation_mw * (5.0 / 60.0), 4) AS energy_mwh,
    round(generation_mw * (5.0 / 60.0) * CASE 
        WHEN fuel_tech = 'coal' THEN 0.90
        WHEN fuel_tech = 'gas' THEN 0.38
        WHEN fuel_tech = 'oil' THEN 0.75
        WHEN fuel_tech = 'biomass' THEN 0.02
        WHEN fuel_tech = 'geothermal' THEN 0.05
        ELSE 0.0
    END, 4) AS emissions_tco2,
    price_local,
    currency
FROM energy_dispatch_5m
WHERE COALESCE(TRY_CAST(timestamp AS TIMESTAMPTZ), TRY_STRPTIME(timestamp, '%m/%d/%Y')::TIMESTAMPTZ) IS NOT NULL;

-- 6. Migrate existing data from regional_summary_5m into network_interval
INSERT OR IGNORE INTO network_interval (
    country_code,
    interval_start,
    interval_duration_mins,
    region,
    demand_mw,
    generation_mw,
    losses_mw,
    import_mw,
    export_mw,
    net_interconnector_mw,
    price_local,
    currency,
    renewables_pct
)
SELECT
    country_code,
    COALESCE(TRY_CAST(timestamp AS TIMESTAMPTZ), TRY_STRPTIME(timestamp, '%m/%d/%Y')::TIMESTAMPTZ) AS interval_start,
    5 AS interval_duration_mins,
    region,
    demand_mw,
    generation_mw,
    losses_mw,
    import_mw,
    export_mw,
    net_interconnector_mw,
    price_local,
    currency,
    renewables_pct
FROM regional_summary_5m
WHERE COALESCE(TRY_CAST(timestamp AS TIMESTAMPTZ), TRY_STRPTIME(timestamp, '%m/%d/%Y')::TIMESTAMPTZ) IS NOT NULL;

-- 7. Migrate existing data from energy_daily_stats into energy_daily
INSERT OR IGNORE INTO energy_daily (
    country_code,
    date,
    region,
    fuel_tech,
    energy_mwh,
    avg_generation_mw,
    peak_generation_mw,
    emissions_tco2,
    vwap_price_local,
    twap_price_local,
    currency
)
SELECT
    country_code,
    COALESCE(TRY_CAST(date AS DATE), TRY_STRPTIME(date, '%m/%d/%Y')::DATE) AS date,
    region,
    fuel_tech,
    energy_mwh,
    round(energy_mwh / 24.0, 2) AS avg_generation_mw,
    COALESCE(peak_demand_mw, 0.0) AS peak_generation_mw,
    emissions_tco2,
    avg_price_local AS vwap_price_local,
    avg_price_local AS twap_price_local,
    currency
FROM energy_daily_stats
WHERE COALESCE(TRY_CAST(date AS DATE), TRY_STRPTIME(date, '%m/%d/%Y')::DATE) IS NOT NULL;

-- 8. Seed network_daily from network_interval
INSERT OR IGNORE INTO network_daily (
    country_code,
    date,
    region,
    demand_mwh,
    avg_demand_mw,
    peak_demand_mw,
    min_demand_mw,
    generation_mwh,
    renewables_pct,
    net_interconnector_mwh,
    vwap_price_local,
    currency
)
SELECT
    country_code,
    interval_start::DATE AS date,
    region,
    round(sum(demand_mw * (interval_duration_mins / 60.0)), 2) AS demand_mwh,
    round(avg(demand_mw), 2) AS avg_demand_mw,
    round(max(demand_mw), 2) AS peak_demand_mw,
    round(min(demand_mw), 2) AS min_demand_mw,
    round(sum(generation_mw * (interval_duration_mins / 60.0)), 2) AS generation_mwh,
    round(avg(renewables_pct), 2) AS renewables_pct,
    round(sum(net_interconnector_mw * (interval_duration_mins / 60.0)), 2) AS net_interconnector_mwh,
    round(avg(price_local), 2) AS vwap_price_local,
    max(currency) AS currency
FROM network_interval
GROUP BY country_code, interval_start::DATE, region;

-- 9. Drop legacy tables and create compatibility views
DROP TABLE IF EXISTS energy_dispatch_5m;
DROP TABLE IF EXISTS regional_summary_5m;
DROP TABLE IF EXISTS energy_daily_stats;

CREATE VIEW IF NOT EXISTS energy_dispatch_5m AS
SELECT
    country_code,
    interval_start::VARCHAR AS timestamp,
    region,
    fuel_tech,
    generation_mw,
    price_local,
    currency
FROM energy_interval;

CREATE VIEW IF NOT EXISTS regional_summary_5m AS
SELECT
    country_code,
    interval_start::VARCHAR AS timestamp,
    region,
    demand_mw,
    generation_mw,
    losses_mw,
    import_mw,
    export_mw,
    net_interconnector_mw,
    price_local,
    currency,
    renewables_pct
FROM network_interval;

CREATE VIEW IF NOT EXISTS energy_daily_stats AS
SELECT
    country_code,
    date::VARCHAR AS date,
    region,
    fuel_tech,
    energy_mwh,
    vwap_price_local AS avg_price_local,
    currency,
    peak_generation_mw AS peak_demand_mw,
    0.0 AS min_demand_mw,
    emissions_tco2
FROM energy_daily;
