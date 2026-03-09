alter table public.weekly_summaries enable row level security;

-- Enable RLS on propositions table
alter table "weekly_summaries" enable row level security;

-- Policy to allow anonymous users (public) to SELECT (read) weekly summaries
create policy "Enable read access for all users"
on "weekly_summaries"
for select
to anon
using (true);