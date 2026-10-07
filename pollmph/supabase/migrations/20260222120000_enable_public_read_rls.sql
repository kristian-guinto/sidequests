-- Enable RLS on propositions table
alter table "propositions" enable row level security;

-- Policy to allow anonymous users (public) to SELECT (read) propositions
create policy "Enable read access for all users"
on "propositions"
for select
to anon
using (true);

-- Enable RLS on sentiments table
alter table "sentiments" enable row level security;

-- Policy to allow anonymous users (public) to SELECT (read) sentiments
create policy "Enable read access for all users"
on "sentiments"
for select
to anon
using (true);
