-- Migration 004: Separate prices into dedicated prices_interval and prices_daily tables
-- 1. Create prices_interval table
CREATE TABLE IF NOT EXISTS prices_interval (
    country_code   VARCHAR NOT NULL,
    interval_start TIMESTAMPTZ NOT NULL,
    region         VARCHAR NOT NULL,
    price_local    DOUBLE,
    price_dollar   DOUBLE,
    PRIMARY KEY (country_code, interval_start, region)
);

-- 2. Backfill prices_interval
-- For non-PH countries: distinct prices per interval
INSERT INTO prices_interval (country_code, interval_start, region, price_local, price_dollar)
SELECT DISTINCT country_code, interval_start, region, price_local, price_dollar
FROM energy_interval
WHERE country_code != 'PH' AND (price_local IS NOT NULL OR price_dollar IS NOT NULL)
ON CONFLICT (country_code, interval_start, region) DO NOTHING;

-- For PH: generation-weighted average LMP across all units in each interval
INSERT INTO prices_interval (country_code, interval_start, region, price_local, price_dollar)
SELECT
    country_code,
    interval_start,
    region,
    CASE
        WHEN sum(generation_mw) > 0 THEN round(sum(generation_mw * price_local) / sum(generation_mw), 2)
        ELSE round(avg(price_local), 2)
    END AS price_local,
    CASE
        WHEN sum(generation_mw) > 0 THEN round(sum(generation_mw * price_dollar) / sum(generation_mw), 2)
        ELSE round(avg(price_dollar), 2)
    END AS price_dollar
FROM energy_interval
WHERE country_code = 'PH' AND price_local IS NOT NULL
GROUP BY country_code, interval_start, region
ON CONFLICT (country_code, interval_start, region) DO NOTHING;

-- 3. Create prices_daily table
CREATE TABLE IF NOT EXISTS prices_daily (
    country_code         VARCHAR NOT NULL,
    date                 DATE NOT NULL,
    region               VARCHAR NOT NULL,
    vwap_price_local     DOUBLE,
    twap_price_local     DOUBLE,
    vwap_price_dollar    DOUBLE,
    twap_price_dollar    DOUBLE,
    price_min_local      DOUBLE,
    price_p5_local       DOUBLE,
    price_median_local   DOUBLE,
    price_p95_local      DOUBLE,
    price_max_local      DOUBLE,
    price_min_dollar     DOUBLE,
    price_p5_dollar      DOUBLE,
    price_median_dollar  DOUBLE,
    price_p95_dollar     DOUBLE,
    price_max_dollar     DOUBLE,
    PRIMARY KEY (country_code, date, region)
);

-- 4. Backfill prices_daily from prices_interval and energy_interval
INSERT INTO prices_daily (
    country_code, date, region,
    vwap_price_local, twap_price_local,
    vwap_price_dollar, twap_price_dollar,
    price_min_local, price_p5_local, price_median_local, price_p95_local, price_max_local,
    price_min_dollar, price_p5_dollar, price_median_dollar, price_p95_dollar, price_max_dollar
)
SELECT
    p.country_code,
    p.interval_start::DATE AS date,
    p.region,
    COALESCE(v.vwap_local, round(avg(p.price_local), 2)) AS vwap_price_local,
    round(avg(p.price_local), 2) AS twap_price_local,
    COALESCE(v.vwap_dollar, round(avg(p.price_dollar), 2)) AS vwap_price_dollar,
    round(avg(p.price_dollar), 2) AS twap_price_dollar,
    round(min(p.price_local), 2) AS price_min_local,
    round(quantile_cont(p.price_local, 0.05), 2) AS price_p5_local,
    round(median(p.price_local), 2) AS price_median_local,
    round(quantile_cont(p.price_local, 0.95), 2) AS price_p95_local,
    round(max(p.price_local), 2) AS price_max_local,
    round(min(p.price_dollar), 2) AS price_min_dollar,
    round(quantile_cont(p.price_dollar, 0.05), 2) AS price_p5_dollar,
    round(median(p.price_dollar), 2) AS price_median_dollar,
    round(quantile_cont(p.price_dollar, 0.95), 2) AS price_p95_dollar,
    round(max(p.price_dollar), 2) AS price_max_dollar
FROM prices_interval p
LEFT JOIN (
    SELECT
        e.country_code,
        e.interval_start::DATE AS date,
        e.region,
        round(sum(p2.price_local * e.energy_mwh) / NULLIF(sum(e.energy_mwh), 0), 2) AS vwap_local,
        round(sum(p2.price_dollar * e.energy_mwh) / NULLIF(sum(e.energy_mwh), 0), 2) AS vwap_dollar
    FROM energy_interval e
    JOIN prices_interval p2
      ON e.country_code = p2.country_code
     AND e.interval_start = p2.interval_start
     AND e.region = p2.region
    WHERE p2.price_local IS NOT NULL
    GROUP BY e.country_code, e.interval_start::DATE, e.region
) v ON p.country_code = v.country_code AND p.interval_start::DATE = v.date AND p.region = v.region
WHERE p.price_local IS NOT NULL
GROUP BY p.country_code, p.interval_start::DATE, p.region, v.vwap_local, v.vwap_dollar
ON CONFLICT (country_code, date, region) DO NOTHING;

-- 5. Drop price columns from energy_interval and energy_daily
DROP VIEW IF EXISTS energy_dispatch_5m;
DROP VIEW IF EXISTS energy_daily_stats;

ALTER TABLE energy_interval DROP COLUMN IF EXISTS price_local;
ALTER TABLE energy_interval DROP COLUMN IF EXISTS price_dollar;

ALTER TABLE energy_daily DROP COLUMN IF EXISTS vwap_price_local;
ALTER TABLE energy_daily DROP COLUMN IF EXISTS twap_price_local;
ALTER TABLE energy_daily DROP COLUMN IF EXISTS vwap_price_dollar;
ALTER TABLE energy_daily DROP COLUMN IF EXISTS twap_price_dollar;

-- 6. Recreate views joining with dedicated price tables
CREATE OR REPLACE VIEW energy_dispatch_5m AS
SELECT
    e.country_code,
    strftime(e.interval_start, '%Y-%m-%dT%H:%M:00+08:00') AS timestamp,
    e.region,
    e.fuel_tech,
    e.generation_mw,
    p.price_local,
    CASE e.country_code WHEN 'PH' THEN 'PHP' WHEN 'SG' THEN 'SGD' WHEN 'MY' THEN 'MYR' ELSE 'USD' END AS currency
FROM energy_interval e
LEFT JOIN prices_interval p
  ON e.country_code = p.country_code
 AND e.interval_start = p.interval_start
 AND e.region = p.region;

CREATE OR REPLACE VIEW energy_daily_stats AS
SELECT
    d.country_code,
    d.date::VARCHAR AS date,
    d.region,
    d.fuel_tech,
    d.energy_mwh,
    p.vwap_price_local AS avg_price_local,
    CASE d.country_code WHEN 'PH' THEN 'PHP' WHEN 'SG' THEN 'SGD' WHEN 'MY' THEN 'MYR' ELSE 'USD' END AS currency,
    d.peak_generation_mw AS peak_demand_mw,
    0.0 AS min_demand_mw,
    0.0 AS emissions_tco2
FROM energy_daily d
LEFT JOIN prices_daily p
  ON d.country_code = p.country_code
 AND d.date = p.date
 AND d.region = p.region;

