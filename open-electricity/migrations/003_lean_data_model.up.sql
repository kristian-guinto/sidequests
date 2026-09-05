-- Migration 003 (Up): Lean Data Model & USD Normalization
-- Drops network_interval and network_daily
-- Refactors energy_interval: adds price_dollar, drops interval_duration_mins, emissions_tco2, currency
-- Refactors energy_daily: adds vwap_price_dollar, twap_price_dollar, drops emissions_tco2, currency
-- Creates exchange_rates reference table

-- 1. Create exchange_rates reference table
CREATE TABLE IF NOT EXISTS exchange_rates (
    date         DATE NOT NULL,
    currency     VARCHAR NOT NULL,
    rate_to_usd  DOUBLE NOT NULL,
    PRIMARY KEY (date, currency)
);

-- Seed default baseline exchange rates
INSERT INTO exchange_rates (date, currency, rate_to_usd)
SELECT d::DATE, 'PHP', 57.0 FROM generate_series(DATE '2020-01-01', DATE '2030-12-31', INTERVAL '1 day') t(d)
ON CONFLICT DO NOTHING;

INSERT INTO exchange_rates (date, currency, rate_to_usd)
SELECT d::DATE, 'SGD', 1.34 FROM generate_series(DATE '2020-01-01', DATE '2030-12-31', INTERVAL '1 day') t(d)
ON CONFLICT DO NOTHING;

INSERT INTO exchange_rates (date, currency, rate_to_usd)
SELECT d::DATE, 'MYR', 4.45 FROM generate_series(DATE '2020-01-01', DATE '2030-12-31', INTERVAL '1 day') t(d)
ON CONFLICT DO NOTHING;

-- 2. Refactor energy_interval
CREATE TABLE energy_interval_v3 (
    country_code    VARCHAR NOT NULL,
    interval_start  TIMESTAMPTZ NOT NULL,
    region          VARCHAR NOT NULL,
    fuel_tech       VARCHAR NOT NULL,
    generation_mw   DOUBLE NOT NULL DEFAULT 0.0,
    energy_mwh      DOUBLE NOT NULL DEFAULT 0.0,
    price_local     DOUBLE,
    price_dollar    DOUBLE,
    PRIMARY KEY (country_code, interval_start, region, fuel_tech)
);

INSERT INTO energy_interval_v3
SELECT
    e.country_code,
    e.interval_start,
    e.region,
    e.fuel_tech,
    e.generation_mw,
    e.energy_mwh,
    e.price_local,
    CASE
        WHEN e.price_local IS NOT NULL THEN
            round(e.price_local / COALESCE(
                (SELECT rate_to_usd FROM exchange_rates fx WHERE fx.date = e.interval_start::DATE AND fx.currency = CASE e.country_code WHEN 'PH' THEN 'PHP' WHEN 'SG' THEN 'SGD' WHEN 'MY' THEN 'MYR' ELSE 'USD' END LIMIT 1),
                CASE e.country_code WHEN 'PH' THEN 57.0 WHEN 'SG' THEN 1.34 WHEN 'MY' THEN 4.45 ELSE 1.0 END
            ), 2)
        ELSE NULL
    END AS price_dollar
FROM energy_interval e;

DROP VIEW IF EXISTS energy_dispatch_5m;
DROP TABLE energy_interval;
ALTER TABLE energy_interval_v3 RENAME TO energy_interval;

CREATE OR REPLACE VIEW energy_dispatch_5m AS
SELECT
    country_code,
    strftime(interval_start, '%Y-%m-%dT%H:%M:00+08:00') AS timestamp,
    region,
    fuel_tech,
    generation_mw,
    price_local,
    CASE country_code WHEN 'PH' THEN 'PHP' WHEN 'SG' THEN 'SGD' WHEN 'MY' THEN 'MYR' ELSE 'USD' END AS currency
FROM energy_interval;

-- 3. Refactor energy_daily
CREATE TABLE energy_daily_v3 (
    country_code       VARCHAR NOT NULL,
    date               DATE NOT NULL,
    region             VARCHAR NOT NULL,
    fuel_tech          VARCHAR NOT NULL,
    energy_mwh         DOUBLE NOT NULL DEFAULT 0.0,
    avg_generation_mw  DOUBLE NOT NULL DEFAULT 0.0,
    peak_generation_mw DOUBLE NOT NULL DEFAULT 0.0,
    vwap_price_local   DOUBLE,
    twap_price_local   DOUBLE,
    vwap_price_dollar  DOUBLE,
    twap_price_dollar  DOUBLE,
    PRIMARY KEY (country_code, date, region, fuel_tech)
);

INSERT INTO energy_daily_v3
SELECT
    d.country_code,
    d.date,
    d.region,
    d.fuel_tech,
    d.energy_mwh,
    d.avg_generation_mw,
    d.peak_generation_mw,
    d.vwap_price_local,
    d.twap_price_local,
    CASE
        WHEN d.vwap_price_local IS NOT NULL THEN
            round(d.vwap_price_local / COALESCE(
                (SELECT rate_to_usd FROM exchange_rates fx WHERE fx.date = d.date AND fx.currency = CASE d.country_code WHEN 'PH' THEN 'PHP' WHEN 'SG' THEN 'SGD' WHEN 'MY' THEN 'MYR' ELSE 'USD' END LIMIT 1),
                CASE d.country_code WHEN 'PH' THEN 57.0 WHEN 'SG' THEN 1.34 WHEN 'MY' THEN 4.45 ELSE 1.0 END
            ), 2)
        ELSE NULL
    END AS vwap_price_dollar,
    CASE
        WHEN d.twap_price_local IS NOT NULL THEN
            round(d.twap_price_local / COALESCE(
                (SELECT rate_to_usd FROM exchange_rates fx WHERE fx.date = d.date AND fx.currency = CASE d.country_code WHEN 'PH' THEN 'PHP' WHEN 'SG' THEN 'SGD' WHEN 'MY' THEN 'MYR' ELSE 'USD' END LIMIT 1),
                CASE d.country_code WHEN 'PH' THEN 57.0 WHEN 'SG' THEN 1.34 WHEN 'MY' THEN 4.45 ELSE 1.0 END
            ), 2)
        ELSE NULL
    END AS twap_price_dollar
FROM energy_daily d;

DROP VIEW IF EXISTS energy_daily_stats;
DROP TABLE energy_daily;
ALTER TABLE energy_daily_v3 RENAME TO energy_daily;

CREATE OR REPLACE VIEW energy_daily_stats AS
SELECT
    country_code,
    date::VARCHAR AS date,
    region,
    fuel_tech,
    energy_mwh,
    vwap_price_local AS avg_price_local,
    CASE country_code WHEN 'PH' THEN 'PHP' WHEN 'SG' THEN 'SGD' WHEN 'MY' THEN 'MYR' ELSE 'USD' END AS currency,
    peak_generation_mw AS peak_demand_mw,
    0.0 AS min_demand_mw,
    0.0 AS emissions_tco2
FROM energy_daily;

-- 4. Drop network tables and regional_summary_5m view
DROP VIEW IF EXISTS regional_summary_5m;
DROP TABLE IF EXISTS network_daily;
DROP TABLE IF EXISTS network_interval;
