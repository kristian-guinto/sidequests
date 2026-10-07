-- Performance indexes for faster dashboard queries

-- Index for the main dashboard query (proposition_id + date_generated)
-- This speeds up queries filtering by proposition_id and sorting by date
CREATE INDEX IF NOT EXISTS idx_sentiments_dashboard 
ON sentiments(proposition_id, date_generated DESC);

-- Index for archived filter on propositions table
-- This speeds up queries filtering non-archived propositions
CREATE INDEX IF NOT EXISTS idx_propositions_archived 
ON propositions(is_archived);

-- Composite index for efficient filtering and selecting specific columns
-- This covers queries that filter by proposition_id, date, and select consensus/attention values
CREATE INDEX IF NOT EXISTS idx_sentiments_composite 
ON sentiments(proposition_id, date_generated DESC, consensus_value, attention_value);
