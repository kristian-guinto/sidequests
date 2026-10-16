import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { ALL_DIVES } from '../src/data/prompts';
import { TIERS, TierId } from '../src/lib/types';

dotenv.config();

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL or DATABASE_URL_UNPOOLED is missing!');
  process.exit(1);
}

const validConnStr: string = connectionString;
const sql = neon(validConnStr);

async function seed() {
  console.log('🌊 Starting Krillion PH Neon database seed...');
  console.log(`Host: ${validConnStr.split('@')[1]}`);

  // 1. Prepare and seed Dives
  console.log(`\n📅 Seeding ${ALL_DIVES.length} daily dives...`);
  const divesData = ALL_DIVES.map((d) => ({
    day_number: d.dayNumber,
    dive_date: d.date,
    title: d.title || `Day ${d.dayNumber}`,
  }));

  await sql`
    INSERT INTO krillion_daily_dives (day_number, dive_date, title, created_at)
    SELECT x.day_number, x.dive_date::date, x.title, NOW()
    FROM jsonb_to_recordset(${JSON.stringify(divesData)}::jsonb) AS x(
      day_number int,
      dive_date text,
      title text
    )
    ON CONFLICT (day_number) DO UPDATE
    SET dive_date = EXCLUDED.dive_date,
        title = EXCLUDED.title;
  `;
  console.log(`✅ ${divesData.length} daily dives upserted.`);

  // 2. Prepare and seed Prompts
  console.log('\n📝 Seeding prompts...');
  const promptsData: Array<{
    id: string;
    day_number: number;
    round_order: number;
    prompt_text: string;
    category: string;
    hint: string | null;
  }> = [];

  for (const dive of ALL_DIVES) {
    for (let i = 0; i < dive.prompts.length; i++) {
      const p = dive.prompts[i];
      promptsData.push({
        id: p.id,
        day_number: dive.dayNumber,
        round_order: i + 1,
        prompt_text: p.text,
        category: p.category,
        hint: p.hint || null,
      });
    }
  }

  await sql`
    INSERT INTO krillion_prompts (id, day_number, round_order, prompt_text, category, hint, created_at)
    SELECT x.id, x.day_number, x.round_order, x.prompt_text, x.category, x.hint, NOW()
    FROM jsonb_to_recordset(${JSON.stringify(promptsData)}::jsonb) AS x(
      id text,
      day_number int,
      round_order int,
      prompt_text text,
      category text,
      hint text
    )
    ON CONFLICT (id) DO UPDATE
    SET day_number = EXCLUDED.day_number,
        round_order = EXCLUDED.round_order,
        prompt_text = EXCLUDED.prompt_text,
        category = EXCLUDED.category,
        hint = EXCLUDED.hint;
  `;
  console.log(`✅ ${promptsData.length} prompts upserted.`);

  // 3. Prepare and seed Answers
  console.log('\n🎯 Seeding answers in fast chunks...');
  await sql`TRUNCATE TABLE krillion_answers RESTART IDENTITY CASCADE;`;

  const answersMap = new Map<string, {
    prompt_id: string;
    answer: string;
    aliases: string[];
    tier: string;
    score: number;
    quip: string | null;
  }>();

  for (const dive of ALL_DIVES) {
    for (const prompt of dive.prompts) {
      for (const ans of prompt.answers) {
        const cleanAnswer = ans.answer.trim();
        const key = `${prompt.id}:::${cleanAnswer.toLowerCase()}`;
        if (!answersMap.has(key)) {
          answersMap.set(key, {
            prompt_id: prompt.id,
            answer: cleanAnswer,
            aliases: ans.aliases || [],
            tier: ans.tier,
            score: TIERS[ans.tier]?.score || 10,
            quip: ans.quip || null,
          });
        }
      }
    }
  }

  const answersData = Array.from(answersMap.values());

  // Chunk by 500 rows
  const chunkSize = 500;
  for (let i = 0; i < answersData.length; i += chunkSize) {
    const chunk = answersData.slice(i, i + chunkSize);
    await sql`
      INSERT INTO krillion_answers (prompt_id, answer, aliases, tier, score, quip)
      SELECT x.prompt_id, x.answer, x.aliases, x.tier, x.score, x.quip
      FROM jsonb_to_recordset(${JSON.stringify(chunk)}::jsonb) AS x(
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
    process.stdout.write(`  Inserted ${Math.min(i + chunkSize, answersData.length)} / ${answersData.length} answers...\r`);
  }
  console.log(`\n✅ ${answersData.length} answers seeded into krillion_answers.`);

  // 4. Seed Synthetic Completions for Days 1 to 14
  console.log('\n🤖 Seeding synthetic player completions...');
  const scoreTemplates = [
    70, 95, 110, 130, // Plankton (0-150)
    160, 175, 190, 205, 220, 235, 245, // Schooler (151-250)
    260, 275, 290, 310, 325, 340, // Rare (251-350)
    360, 375, 395, 415, 435, // Deep Cut (351-449)
    480, 530, 620, // One in a Krillion (450-700)
  ];

  const completionsData: Array<{
    dive_date: string;
    day_number: number;
    player_id: string;
    score: number;
    answers: any[];
  }> = [];

  for (const dive of ALL_DIVES) {
    for (let pIdx = 0; pIdx < scoreTemplates.length; pIdx++) {
      const playerId = `seed-bot-${pIdx + 1}`;
      const score = scoreTemplates[pIdx];

      const dummyAnswers = dive.prompts.map((pr) => ({
        promptId: pr.id,
        answer: 'Seed Answer',
        score: Math.round(score / dive.prompts.length),
        tier: (score > 400 ? 'krillion' : score > 250 ? 'rare' : 'schooler') as TierId,
      }));

      completionsData.push({
        dive_date: dive.date,
        day_number: dive.dayNumber,
        player_id: playerId,
        score,
        answers: dummyAnswers,
      });
    }
  }

  // Chunk completions by 100
  for (let i = 0; i < completionsData.length; i += 100) {
    const chunk = completionsData.slice(i, i + 100);
    await sql`
      INSERT INTO krillion_completions (dive_date, day_number, player_id, score, answers, created_at)
      SELECT x.dive_date::date, x.day_number, x.player_id, x.score, x.answers, NOW()
      FROM jsonb_to_recordset(${JSON.stringify(chunk)}::jsonb) AS x(
        dive_date text,
        day_number int,
        player_id text,
        score int,
        answers jsonb
      )
      ON CONFLICT (dive_date, player_id) DO UPDATE
      SET score = EXCLUDED.score,
          answers = EXCLUDED.answers;
    `;
  }
  console.log(`✅ ${completionsData.length} synthetic completions seeded.`);

  // 5. Verification & Summary
  const [dRes, pRes, aRes, cRes] = await Promise.all([
    sql`SELECT count(*) FROM krillion_daily_dives`,
    sql`SELECT count(*) FROM krillion_prompts`,
    sql`SELECT count(*) FROM krillion_answers`,
    sql`SELECT count(*) FROM krillion_completions`,
  ]);

  console.log('\n📊 Verified Row Counts in Neon:');
  console.log(`- krillion_daily_dives: ${dRes[0].count} (Expected 14)`);
  console.log(`- krillion_prompts:      ${pRes[0].count} (Expected 98)`);
  console.log(`- krillion_answers:      ${aRes[0].count} (Expected 3500+)`);
  console.log(`- krillion_completions:  ${cRes[0].count} (Expected 350)`);
  console.log('\n🎉 Neon seed completed successfully!');
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
