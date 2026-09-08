-- Migration 004 Down: Restore prices on energy_interval and energy_daily, drop dedicated price tables

-- 1. Re-add price columns to energy_interval
ALTER TABLE energy_interval ADD COLUMN price_local DOUBLE;
ALTER TABLE energy_interval ADD COLUMN price_dollar DOUBLE;

UPDATE energy_interval e
SET price_local = p.price_local,
    price_dollar = p.price_dollar
FROM prices_interval p
WHERE e.country_code = p.country_code
  AND e.interval_start = p.interval_start
  AND e.region = p.region;

-- 2. Re-add price columns to energy_daily
ALTER TABLE energy_daily ADD COLUMN vwap_price_local DOUBLE;
ALTER TABLE energy_daily ADD COLUMN twap_price_local DOUBLE;
ALTER TABLE energy_daily ADD COLUMN vwap_price_dollar DOUBLE;
ALTER TABLE energy_daily ADD COLUMN twap_price_dollar DOUBLE;

UPDATE energy_daily d
SET vwap_price_local = p.vwap_price_local,
    twap_price_local = p.twap_price_local,
    vwap_price_dollar = p.vwap_price_dollar,
    twap_price_dollar = p.twap_price_dollar
FROM prices_daily p
WHERE d.country_code = p.country_code
  AND d.date = p.date
  AND d.region = p.region;

-- 3. Restore views to direct column references
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

-- 4. Drop dedicated price tables
DROP TABLE IF EXISTS prices_interval;
DROP TABLE IF EXISTS prices_daily;

