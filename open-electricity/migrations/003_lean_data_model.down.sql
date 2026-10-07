-- Migration 003 (Down): Rollback Lean Data Model to Tiered Model
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

CREATE TABLE IF NOT EXISTS network_daily (
    country_code           VARCHAR NOT NULL,
    date                   DATE NOT NULL,
    region                 VARCHAR NOT NULL,
    demand_mwh             DOUBLE DEFAULT 0.0,
    avg_demand_mw          DOUBLE DEFAULT 0.0,
    peak_demand_mw         DOUBLE DEFAULT 0.0,
    min_demand_mw          DOUBLE DEFAULT 0.0,
    generation_mwh         DOUBLE DEFAULT 0.0,
    renewables_pct         DOUBLE DEFAULT 0.0,
    net_interconnector_mwh DOUBLE DEFAULT 0.0,
    vwap_price_local       DOUBLE,
    currency               VARCHAR DEFAULT 'PHP',
    PRIMARY KEY (country_code, date, region)
);

CREATE OR REPLACE VIEW regional_summary_5m AS
SELECT
    country_code,
    strftime(interval_start, '%Y-%m-%dT%H:%M:00+08:00') AS timestamp,
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

CREATE TABLE energy_interval_v2 (
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

INSERT INTO energy_interval_v2
SELECT
    country_code,
    interval_start,
    5 AS interval_duration_mins,
    region,
    fuel_tech,
    generation_mw,
    energy_mwh,
    0.0 AS emissions_tco2,
    price_local,
    CASE country_code WHEN 'PH' THEN 'PHP' WHEN 'SG' THEN 'SGD' WHEN 'MY' THEN 'MYR' ELSE 'USD' END AS currency
FROM energy_interval;

DROP VIEW IF EXISTS energy_dispatch_5m;
DROP TABLE energy_interval;
ALTER TABLE energy_interval_v2 RENAME TO energy_interval;

CREATE OR REPLACE VIEW energy_dispatch_5m AS
SELECT country_code, strftime(interval_start, '%Y-%m-%dT%H:%M:00+08:00') AS timestamp, region, fuel_tech, generation_mw, price_local, currency
FROM energy_interval;

CREATE TABLE energy_daily_v2 (
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

INSERT INTO energy_daily_v2
SELECT
    country_code,
    date,
    region,
    fuel_tech,
    energy_mwh,
    avg_generation_mw,
    peak_generation_mw,
    0.0 AS emissions_tco2,
    vwap_price_local,
    twap_price_local,
    CASE country_code WHEN 'PH' THEN 'PHP' WHEN 'SG' THEN 'SGD' WHEN 'MY' THEN 'MYR' ELSE 'USD' END AS currency
FROM energy_daily;

DROP VIEW IF EXISTS energy_daily_stats;
DROP TABLE energy_daily;
ALTER TABLE energy_daily_v2 RENAME TO energy_daily;

CREATE OR REPLACE VIEW energy_daily_stats AS
SELECT
    d.country_code,
    d.date::VARCHAR AS date,
    d.region,
    d.fuel_tech,
    d.energy_mwh,
    d.vwap_price_local AS avg_price_local,
    d.currency,
    d.peak_generation_mw AS peak_demand_mw,
    COALESCE(n.min_demand_mw, 0.0) AS min_demand_mw,
    d.emissions_tco2
FROM energy_daily d
LEFT JOIN network_daily n ON d.country_code = n.country_code AND d.date = n.date AND d.region = n.region;

DROP TABLE IF EXISTS exchange_rates;
