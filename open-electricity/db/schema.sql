-- ==========================================================
-- OpenNEM Philippines (OpenElectricity PH) Database Schema
-- Supabase / PostgreSQL Migration Script
-- ==========================================================

-- 1. Facilities / Power Plants Registry
CREATE TABLE IF NOT EXISTS facilities (
    resource_id TEXT PRIMARY KEY,
    facility_name TEXT NOT NULL,
    region TEXT NOT NULL, -- 'LUZON', 'VISAYAS', 'MINDANAO'
    fuel_tech TEXT NOT NULL, -- 'solar', 'wind', 'hydro', 'geothermal', 'biomass', 'gas', 'coal', 'oil', 'battery'
    capacity_mw NUMERIC(10, 2) DEFAULT 0.0,
    is_renewable BOOLEAN GENERATED ALWAYS AS (fuel_tech IN ('solar', 'wind', 'hydro', 'geothermal', 'biomass')) STORED,
    emissions_factor NUMERIC(6, 4) DEFAULT 0.0, -- tCO2 / MWh
    status TEXT DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_facilities_region_fuel ON facilities (region, fuel_tech);

-- 2. 5-Minute Unit-level Fuel Mix Dispatch & LMP Prices
CREATE TABLE IF NOT EXISTS energy_dispatch_5m (
    timestamp TIMESTAMPTZ NOT NULL,
    region TEXT NOT NULL, -- 'ALL', 'LUZON', 'VISAYAS', 'MINDANAO'
    fuel_tech TEXT NOT NULL, -- 'solar', 'wind', 'hydro', 'geothermal', 'biomass', 'gas', 'coal', 'oil', 'battery'
    generation_mw NUMERIC(10, 2) NOT NULL DEFAULT 0,
    price_php_mwh NUMERIC(10, 2),
    PRIMARY KEY (timestamp, region, fuel_tech)
);

CREATE INDEX IF NOT EXISTS idx_dispatch_time_region ON energy_dispatch_5m (timestamp DESC, region);
CREATE INDEX IF NOT EXISTS idx_dispatch_region_fuel ON energy_dispatch_5m (region, fuel_tech);

-- 3. 5-Minute Regional System Balance (Demand, Losses, Interconnectors)
CREATE TABLE IF NOT EXISTS regional_summary_5m (
    timestamp TIMESTAMPTZ NOT NULL,
    region TEXT NOT NULL, -- 'LUZON', 'VISAYAS', 'MINDANAO', 'ALL'
    demand_mw NUMERIC(10, 2) NOT NULL DEFAULT 0,
    generation_mw NUMERIC(10, 2) NOT NULL DEFAULT 0,
    losses_mw NUMERIC(10, 2) NOT NULL DEFAULT 0,
    import_mw NUMERIC(10, 2) NOT NULL DEFAULT 0,
    export_mw NUMERIC(10, 2) NOT NULL DEFAULT 0,
    net_interconnector_mw NUMERIC(10, 2) NOT NULL DEFAULT 0,
    price_php_mwh NUMERIC(10, 2),
    renewables_pct NUMERIC(5, 2),
    PRIMARY KEY (timestamp, region)
);

CREATE INDEX IF NOT EXISTS idx_regional_time_region ON regional_summary_5m (timestamp DESC, region);

-- 4. Daily Aggregated Energy & Emissions Rollup (for fast 30D / 1Y range queries)
CREATE TABLE IF NOT EXISTS energy_daily_stats (
    date DATE NOT NULL,
    region TEXT NOT NULL,
    fuel_tech TEXT NOT NULL,
    energy_mwh NUMERIC(12, 2) NOT NULL DEFAULT 0,
    avg_price_php_mwh NUMERIC(10, 2),
    peak_demand_mw NUMERIC(10, 2),
    min_demand_mw NUMERIC(10, 2),
    emissions_tco2 NUMERIC(12, 2) DEFAULT 0,
    PRIMARY KEY (date, region, fuel_tech)
);

CREATE INDEX IF NOT EXISTS idx_daily_date_region ON energy_daily_stats (date DESC, region);

-- Enable Row Level Security (RLS) & Public Read Access
ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE energy_dispatch_5m ENABLE ROW LEVEL SECURITY;
ALTER TABLE regional_summary_5m ENABLE ROW LEVEL SECURITY;
ALTER TABLE energy_daily_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read-only access to facilities" ON facilities FOR SELECT USING (true);
CREATE POLICY "Allow public read-only access to energy_dispatch_5m" ON energy_dispatch_5m FOR SELECT USING (true);
CREATE POLICY "Allow public read-only access to regional_summary_5m" ON regional_summary_5m FOR SELECT USING (true);
CREATE POLICY "Allow public read-only access to energy_daily_stats" ON energy_daily_stats FOR SELECT USING (true);

