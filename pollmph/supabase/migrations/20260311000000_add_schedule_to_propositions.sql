ALTER TABLE public.propositions
    ADD COLUMN IF NOT EXISTS next_run_date date DEFAULT NULL;

COMMENT ON COLUMN public.propositions.next_run_date IS
    'NULL = always run. Updated by pipeline after each run based on today''s attention score.';
