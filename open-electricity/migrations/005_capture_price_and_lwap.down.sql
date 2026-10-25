-- Migration 005 Down: Drop capture price, LWAP, and demand columns

ALTER TABLE energy_interval DROP COLUMN IF EXISTS capture_price_local;
ALTER TABLE energy_interval DROP COLUMN IF EXISTS capture_price_dollar;

ALTER TABLE energy_daily DROP COLUMN IF EXISTS capture_price_local;
ALTER TABLE energy_daily DROP COLUMN IF EXISTS capture_price_dollar;

ALTER TABLE prices_interval DROP COLUMN IF EXISTS lwap_local;
ALTER TABLE prices_interval DROP COLUMN IF EXISTS lwap_dollar;
ALTER TABLE prices_interval DROP COLUMN IF EXISTS demand_mw;

ALTER TABLE prices_daily DROP COLUMN IF EXISTS lwap_price_local;
ALTER TABLE prices_daily DROP COLUMN IF EXISTS lwap_price_dollar;
ALTER TABLE prices_daily DROP COLUMN IF EXISTS avg_demand_mw;
ALTER TABLE prices_daily DROP COLUMN IF EXISTS peak_demand_mw;
