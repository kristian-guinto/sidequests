import { getRepository } from '@/lib/repository';
import { ClientPromptItem } from '@/lib/types';
import { DailyDivePage } from '@/components/game/DailyDivePage';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const repo = getRepository();
  const dive = await repo.getDailyDive();

  // Strip answers to prevent client cheating
  const safePrompts: ClientPromptItem[] = dive.prompts.map((p) => ({
    id: p.id,
    text: p.text,
    category: p.category,
    hint: p.hint,
  }));

  return (
    <DailyDivePage
      dayNumber={dive.dayNumber}
      dateStr={dive.date}
      title={dive.title}
      prompts={safePrompts}
    />
  );
}
