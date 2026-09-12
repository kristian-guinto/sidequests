# Plan: 2028 PH Presidential Poll Tracker (E2E)

Add a new, independent data pipeline for tracking multiple 2028 Philippine presidential
polls (Pulse Asia, SWS, OCTA, etc.) and combine them into a single "who's winning" chart
on the pollmph main dashboard. Kept deliberately simple per decisions below: manual/curated
JSON ingestion (no LLM parsing of numbers), a flat `polls` + `poll_results` schema, and a
bar (latest) / line (trend) toggle chart.

**Decisions**
- Ingestion: manual/curated JSON files, following the exact pattern of `pollmph/propositions_json/*.json` + `pollmph add`.
- Data source for now: mock/placeholder polls (clearly labeled), real data can be swapped in later via the same JSON format.
- Schema: simplified — `polls` (one row per poll release) + `poll_results` (one row per candidate per poll). No `poll_questions`/`candidates` tables.
- Candidate naming: no normalization table; JSON authors must use consistent `candidate_name` strings across polls (e.g. always "Bongbong Marcos", not "BBM").
- Chart: latest-snapshot bar chart (poll-of-polls average across most recent poll per survey org) with a toggle to a historical trend line chart (one line per candidate, raw poll points, colored/tooltipped by survey org).
- Explicitly excluded: LLM-based article parsing, weighted/statistical aggregation, candidate normalization, any public write API (ingestion stays CLI-only via service-role backend, consistent with existing propositions flow).

## Phase 1 — Database (Supabase migration)

1. New migration `supabase/migrations/<timestamp>_add_presidential_polls.sql`:
   - `polls` table: `poll_id` (text, PK), `survey_org` (text, not null), `poll_date` (date, not null), `sample_size` (int, nullable), `margin_of_error` (real, nullable), `source_url` (text, nullable), `notes` (text, nullable).
   - `poll_results` table: `id` (bigserial, PK), `poll_id` (text, FK → `polls.poll_id` ON DELETE CASCADE), `candidate_name` (text, not null), `vote_percentage` (real, not null).
   - Indexes: `idx_poll_results_poll_id` on `poll_results(poll_id)`; `idx_polls_date` on `polls(poll_date desc)`.
   - RLS: enable RLS on both tables + `create policy "Enable read access for all users" ... for select to anon using (true);` — exact pattern copied from `supabase/migrations/20260222120000_enable_public_read_rls.sql`.

## Phase 2 — Python backend (depends on Phase 1 schema, can be coded in parallel)

2. `pollmph/models.py`: add `PollModel` (`poll_id`, `survey_org`, `poll_date: date`, `sample_size: int | None`, `margin_of_error: float | None`, `source_url: str | None`, `notes: str | None`) and `PollResultModel` (`poll_id`, `candidate_name`, `vote_percentage: float`). Follow existing `PropositionModel`/`SentimentModel` style (pydantic `BaseModel`, `Field` defaults).
3. `pollmph/db.py`: add `create_poll(sb_client, poll: PollModel)` and `create_poll_results(sb_client, poll_id, results: list[PollResultModel])` (bulk insert), plus `read_polls(sb_client, ...)` / `read_poll_results(sb_client, poll_id)` for symmetry — mirror the try/except + print + `.execute()` pattern of `create_proposition`/`create_sentiment`.
4. `pollmph/cli.py`: add `add_poll` command mirroring `add` — reads a JSON file shaped like:
   ```
   { "poll_id", "survey_org", "poll_date", "sample_size", "margin_of_error", "source_url", "notes",
     "results": [{"candidate_name", "vote_percentage"}, ...] }
   ```
   Validates with `PollModel`/`PollResultModel`, inserts poll then bulk-inserts results via the new db.py helpers.
5. New folder `pollmph/polls_json/` with 3–4 **clearly-labeled mock** poll JSON files spanning 2-3 survey orgs and a few dates, using **consistent candidate_name strings** across files (e.g. "Bongbong Marcos", "Sara Duterte", "Leni Robredo", "Isko Moreno", "Undecided") so the frontend can combine them.

## Phase 3 — Frontend (depends on Phase 1 schema; independent of Phase 2 code, just needs seed data present to test)

6. New component `frontend/src/components/PresidentialPollChart.jsx`:
   - Fetch via `supabase.from('polls').select('poll_id, survey_org, poll_date, sample_size, margin_of_error, poll_results(candidate_name, vote_percentage)').order('poll_date')` (embedded FK select — one round trip, no manual join), mirroring the fetch style in `frontend/src/components/PulseDashboard.jsx`.
   - Derive **latest snapshot**: take the newest poll per `survey_org`, average `vote_percentage` per `candidate_name` across those orgs → sorted bar chart (recharts `BarChart`), plus a small headline like "`{leader}` leads with `{pct}`%".
   - Derive **trend view**: pivot raw poll_results by `poll_date` (one row per date, one key per candidate) → recharts `LineChart`, one `<Line>` per candidate from a fixed color palette, custom tooltip showing survey org + sample size (reuse tooltip pattern from `PulseDashboard`/`PropositionDetail`).
   - Toggle between the two views using the existing `Button` component (outline/default variant pair), state `viewMode` ('latest' | 'trend').
   - Wrap in existing `Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardContent` primitives from `src/components/ui/`; follow existing dark-mode color conventions (emerald/rose accents) and `ResponsiveContainer` + `isAnimationActive={false}` pattern.
7. `frontend/src/components/PulseDashboard.jsx`: import and render `<PresidentialPollChart />` inside the `max-w-7xl` container, directly under the header and above the existing propositions grid.

## Verification

1. Apply migration locally (`supabase db reset` or `supabase migration up`, per project's existing workflow) and confirm `polls`/`poll_results` tables + RLS policies exist.
2. Run `uv run pollmph add-poll --file pollmph/polls_json/<file>.json` for each mock file; confirm rows via a `select` in Supabase Studio or a quick `read_polls`/`read_poll_results` call.
3. `get_errors` on all newly created/edited Python and JSX files.
4. Run the frontend dev server, load the main page, confirm: bar chart renders latest averaged snapshot, toggle switches to trend line chart with correct candidate lines/colors, tooltips show survey org, layout is responsive and dark-mode correct.
5. Confirm frontend reads succeed using only the anon key (no service-role key) — validates RLS policy correctness.

**Relevant files**
- `supabase/migrations/<new>.sql` — new tables + RLS (new file)
- `pollmph/models.py` — add `PollModel`, `PollResultModel`
- `pollmph/db.py` — add `create_poll`, `create_poll_results`, `read_polls`, `read_poll_results`
- `pollmph/cli.py` — add `add_poll` command (mirrors `add`)
- `pollmph/polls_json/*.json` — new mock seed data (new files)
- `frontend/src/components/PresidentialPollChart.jsx` — new chart component
- `frontend/src/components/PulseDashboard.jsx` — mount new component
