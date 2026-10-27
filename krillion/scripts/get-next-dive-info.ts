import { getRepository } from '../src/lib/repository';

async function main() {
  const repo = getRepository();
  const all = await repo.getAllDives();
  const sorted = all.sort((a, b) => b.dayNumber - a.dayNumber);

  if (sorted.length === 0) {
    console.log(JSON.stringify({ nextDayNumber: 1, nextDate: '2026-10-16', recentTitles: [] }));
    return;
  }

  const latest = sorted[0];
  const nextDayNumber = latest.dayNumber + 1;

  // Add 1 day
  const [y, m, d] = latest.date.split('-').map(Number);
  const nextDateObj = new Date(Date.UTC(y, m - 1, d + 1));
  const nextDate = nextDateObj.toISOString().split('T')[0];

  const recentTitles = sorted.slice(0, 5).map((dive) => dive.title);
  const recentPromptTexts = sorted.slice(0, 3).flatMap((dive) => dive.prompts.map((p) => p.text));

  console.log(
    JSON.stringify({
      latestDayNumber: latest.dayNumber,
      latestDate: latest.date,
      nextDayNumber,
      nextDate,
      recentTitles,
      recentPromptTexts: recentPromptTexts.slice(0, 10),
    })
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
