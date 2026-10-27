import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { TIERS, TierId, DailyDive } from '../src/lib/types';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL or DATABASE_URL_UNPOOLED is missing!');
  process.exit(1);
}

const sql = neon(connectionString);

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: npx tsx scripts/insert-daily.ts <path-to-json>');
    process.exit(1);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  let data: DailyDive;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.error('Invalid JSON file:', err);
    process.exit(1);
  }

  if (!data.dayNumber || !data.date || !Array.isArray(data.prompts) || data.prompts.length !== 7) {
    console.error('Validation failed: dive must have dayNumber, date, and exactly 7 prompts.');
    process.exit(1);
  }

  console.log(`🌊 Inserting Daily Dive #${data.dayNumber} (${data.date}: "${data.title}")...`);

  // 1. Insert/update dive
  await sql`
    INSERT INTO krillion_daily_dives (day_number, dive_date, title, created_at)
    VALUES (${data.dayNumber}, ${data.date}::date, ${data.title || `Day ${data.dayNumber}`}, NOW())
    ON CONFLICT (day_number) DO UPDATE
    SET dive_date = EXCLUDED.dive_date,
        title = EXCLUDED.title;
  `;
  console.log(`✅ Daily dive row upserted.`);

  // 2. Insert prompts
  for (let i = 0; i < data.prompts.length; i++) {
    const p = data.prompts[i];
    const promptId = p.id || `day${data.dayNumber}-p${i + 1}`;
    await sql`
      INSERT INTO krillion_prompts (id, day_number, round_order, prompt_text, category, hint, created_at)
      VALUES (${promptId}, ${data.dayNumber}, ${i + 1}, ${p.text}, ${p.category}, ${p.hint || null}, NOW())
      ON CONFLICT (id) DO UPDATE
      SET round_order = EXCLUDED.round_order,
          prompt_text = EXCLUDED.prompt_text,
          category = EXCLUDED.category,
          hint = EXCLUDED.hint;
    `;

    // 3. Insert answers
    const answersData = p.answers.map((a) => {
      const tier = a.tier as TierId;
      const score = (TIERS as any)[tier]?.score || 10;
      return {
        prompt_id: promptId,
        answer: a.answer.trim(),
        aliases: a.aliases || [],
        tier,
        score,
        quip: a.quip || null,
      };
    });

    if (answersData.length > 0) {
      await sql`
        INSERT INTO krillion_answers (prompt_id, answer, aliases, tier, score, quip)
        SELECT x.prompt_id, x.answer, x.aliases, x.tier, x.score, x.quip
        FROM jsonb_to_recordset(${JSON.stringify(answersData)}::jsonb) AS x(
          prompt_id text,
          answer text,
          aliases jsonb,
          tier text,
          score int,
          quip text
        )
        ON CONFLICT (prompt_id, answer) DO UPDATE
        SET aliases = EXCLUDED.aliases,
            tier = EXCLUDED.tier,
            score = EXCLUDED.score,
            quip = EXCLUDED.quip;
      `;
    }
  }

  // 4. Seed 25 baseline completions so the distribution curve is immediately populated
  const sampleScores = [
    60, 110, 140, 150, // Plankton
    180, 210, 230, 240, 250, // Schooler
    270, 290, 310, 330, 340, 350, // Rare
    370, 390, 410, 430, 440, // Deep Cut
    470, 510, 560, 620, // Krillion
  ];

  const completionsData = sampleScores.map((score, idx) => ({
    dive_date: data.date,
    day_number: data.dayNumber,
    player_id: `seed_bot_${idx + 1}`,
    score,
    answers: [],
  }));

  await sql`
    INSERT INTO krillion_completions (dive_date, day_number, player_id, score, answers, created_at)
    SELECT x.dive_date::date, x.day_number, x.player_id, x.score, x.answers, NOW()
    FROM jsonb_to_recordset(${JSON.stringify(completionsData)}::jsonb) AS x(
      dive_date text,
      day_number int,
      player_id text,
      score int,
      answers jsonb
    )
    ON CONFLICT (dive_date, player_id) DO NOTHING;
  `;

  console.log(`🎉 Successfully loaded Day #${data.dayNumber} into Neon Postgres!`);
}

main().catch((err) => {
  console.error('Failed to insert daily dive:', err);
  process.exit(1);
});
