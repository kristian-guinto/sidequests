-- Migration Rollback: 002_tiered_data_model
-- Created: 2026-09-05

-- 1. Drop compatibility views
DROP VIEW IF EXISTS energy_dispatch_5m;
DROP VIEW IF EXISTS regional_summary_5m;
DROP VIEW IF EXISTS energy_daily_stats;

-- 2. Recreate legacy tables
CREATE TABLE IF NOT EXISTS energy_dispatch_5m (
    country_code VARCHAR NOT NULL DEFAULT 'PH',
    timestamp VARCHAR NOT NULL,
    region VARCHAR NOT NULL,
    fuel_tech VARCHAR NOT NULL,
    generation_mw DOUBLE NOT NULL DEFAULT 0.0,
    price_local DOUBLE,
    currency VARCHAR DEFAULT 'PHP',
    PRIMARY KEY (country_code, timestamp, region, fuel_tech)
);

CREATE TABLE IF NOT EXISTS regional_summary_5m (
    country_code VARCHAR NOT NULL DEFAULT 'PH',
    timestamp VARCHAR NOT NULL,
    region VARCHAR NOT NULL,
    demand_mw DOUBLE NOT NULL DEFAULT 0.0,
    generation_mw DOUBLE NOT NULL DEFAULT 0.0,
    losses_mw DOUBLE NOT NULL DEFAULT 0.0,
    import_mw DOUBLE NOT NULL DEFAULT 0.0,
    export_mw DOUBLE NOT NULL DEFAULT 0.0,
    net_interconnector_mw DOUBLE NOT NULL DEFAULT 0.0,
    price_local DOUBLE,
    currency VARCHAR DEFAULT 'PHP',
    renewables_pct DOUBLE,
    PRIMARY KEY (country_code, timestamp, region)
);

CREATE TABLE IF NOT EXISTS energy_daily_stats (
    country_code VARCHAR NOT NULL DEFAULT 'PH',
    date VARCHAR NOT NULL,
    region VARCHAR NOT NULL,
    fuel_tech VARCHAR NOT NULL,
    energy_mwh DOUBLE NOT NULL DEFAULT 0.0,
    avg_price_local DOUBLE,
    currency VARCHAR DEFAULT 'PHP',
    peak_demand_mw DOUBLE,
    min_demand_mw DOUBLE,
    emissions_tco2 DOUBLE DEFAULT 0.0,
    PRIMARY KEY (country_code, date, region, fuel_tech)
);

-- 3. Restore data from new tables back into legacy tables
INSERT OR IGNORE INTO energy_dispatch_5m
SELECT country_code, interval_start::VARCHAR, region, fuel_tech, generation_mw, price_local, currency
FROM energy_interval;

INSERT OR IGNORE INTO regional_summary_5m
SELECT country_code, interval_start::VARCHAR, region, demand_mw, generation_mw, losses_mw, import_mw, export_mw, net_interconnector_mw, price_local, currency, renewables_pct
FROM network_interval;

INSERT OR IGNORE INTO energy_daily_stats
SELECT country_code, date::VARCHAR, region, fuel_tech, energy_mwh, vwap_price_local, currency, peak_generation_mw, 0.0, emissions_tco2
FROM energy_daily;

-- 4. Drop tiered tables
DROP TABLE IF EXISTS energy_interval;
DROP TABLE IF EXISTS network_interval;
DROP TABLE IF EXISTS energy_daily;
DROP TABLE IF EXISTS network_daily;
