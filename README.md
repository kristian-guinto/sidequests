# sidequests

Monorepo for my side projects.

| Project | What it is |
| --- | --- |
| [`open-electricity/`](open-electricity) | Electricity data pipeline + dashboard (OpenElectricity → MotherDuck, Next.js frontend) |
| [`pollmph/`](pollmph) | Philippine political sentiment pipeline (Supabase + Gemini) with a frontend |
| [`nem-battery/`](nem-battery) | Australian NEM battery dispatch ingestion and analysis (MotherDuck) |

## Layout

Each project is self-contained (own `pyproject.toml` / `package.json`, lockfile, and README). `cd` into a project
directory to work on it.

CI workflows live in [`.github/workflows/`](.github/workflows) (GitHub only reads them from the repo root). They are
prefixed with the project name and run with `working-directory` set to that project.

## History

Each project's full git history was imported with `git filter-repo --to-subdirectory-filter`, so
`git log -- <project>/` and `git blame` still work.

To add a new project: create a new top-level directory and, if it needs CI, add a `<project>-*.yml` workflow with
`defaults.run.working-directory: <project>`.
