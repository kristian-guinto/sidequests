-- Migration 005 Up: Add capture price, LWAP, and demand columns to interval and daily tables

ALTER TABLE energy_interval ADD COLUMN IF NOT EXISTS capture_price_local DOUBLE;
ALTER TABLE energy_interval ADD COLUMN IF NOT EXISTS capture_price_dollar DOUBLE;

ALTER TABLE energy_daily ADD COLUMN IF NOT EXISTS capture_price_local DOUBLE;
ALTER TABLE energy_daily ADD COLUMN IF NOT EXISTS capture_price_dollar DOUBLE;

ALTER TABLE prices_interval ADD COLUMN IF NOT EXISTS lwap_local DOUBLE;
ALTER TABLE prices_interval ADD COLUMN IF NOT EXISTS lwap_dollar DOUBLE;
ALTER TABLE prices_interval ADD COLUMN IF NOT EXISTS demand_mw DOUBLE;

ALTER TABLE prices_daily ADD COLUMN IF NOT EXISTS lwap_price_local DOUBLE;
ALTER TABLE prices_daily ADD COLUMN IF NOT EXISTS lwap_price_dollar DOUBLE;
ALTER TABLE prices_daily ADD COLUMN IF NOT EXISTS avg_demand_mw DOUBLE;
ALTER TABLE prices_daily ADD COLUMN IF NOT EXISTS peak_demand_mw DOUBLE;
