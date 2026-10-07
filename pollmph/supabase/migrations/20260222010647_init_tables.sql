create table public.sentiments (
    id bigint generated always as identity primary key,
    proposition_id text, 
    concensus_values real, 
    attention_values real,
    rationale_concensus text, 
    rationale_attention text,
    data_quality real,
    date_generated date
);