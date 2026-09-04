-- Rollback Migration: 001_initial_schema
-- Created: 2026-09-02

DROP TABLE IF EXISTS energy_daily_stats;
DROP TABLE IF EXISTS regional_summary_5m;
DROP TABLE IF EXISTS energy_dispatch_5m;
DROP TABLE IF EXISTS facilities;

