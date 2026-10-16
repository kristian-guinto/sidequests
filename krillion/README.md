# Krillion PH (`krillion.guinto.org`)

Philippine Trench edition of the daily reverse-rarity word-association and trivia dive game.

## Gameplay Mechanics
- **7 Prompts per Day** (50% relatable Filipino culture/everyday life, 50% universal prompts calibrated to Filipino familiarity).
- **25 Seconds per Prompt**: Obvious answers barely sink you; rare, obscure, or deep-cut answers take you down to the **Emden Deep** floor (`-7,000m` / `700 pts` max).
- **6 Rarity Tiers**:
  - `Plankton` (`10 pts` / `-100m`) 🫧
  - `Too Clever` (`15 pts` / `-150m`) 🤡
  - `Schooler` (`30 pts` / `-300m`) 🐟
  - `Rare` (`60 pts` / `-600m`) 🦑
  - `Deep Cut` (`85 pts` / `-850m`) 🏮
  - `One in a Krillion` (`100 pts` / `-1,000m`) 🌟

## Architecture & Database (Neon Postgres)
- **Frontend & API**: Next.js 14 App Router (`src/app/`), Tailwind CSS, Taglish-aware fuzzy Levenshtein matcher (`src/lib/matcher.ts`).
- **Database**: Lakebase Postgres on **Neon** (`@neondatabase/serverless`) via [`DatabaseRepository`](src/lib/repository/database.ts), with automatic fallback to [`LocalRepository`](src/lib/repository/local.ts) (`src/data/prompts/`).
- **Seeded Dataset**: 14 full Daily Dives (98 prompts, 3,608 curated canonical answers, plus thousands of Tagalog/English/Taglish aliases and quips).

## Development

```bash
npm install
npm run dev
```

### Re-seeding Neon Postgres
```bash
npx tsx scripts/seed-neon.ts
```

### Running Tests
```bash
npm test -- --run
```
