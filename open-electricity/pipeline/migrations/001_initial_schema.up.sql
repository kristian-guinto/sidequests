-- Migration: 001_initial_schema
-- Created: 2026-09-02

CREATE TABLE IF NOT EXISTS facilities (
    country_code VARCHAR NOT NULL DEFAULT 'PH',
    resource_id VARCHAR NOT NULL,
    facility_name VARCHAR NOT NULL,
    region VARCHAR NOT NULL,
    fuel_tech VARCHAR NOT NULL,
    capacity_mw DOUBLE DEFAULT 0.0,
    is_renewable BOOLEAN DEFAULT false,
    emissions_factor DOUBLE DEFAULT 0.0,
    status VARCHAR DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (country_code, resource_id)
);

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

