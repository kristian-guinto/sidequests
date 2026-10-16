import { notFound } from 'next/navigation';
import { getRepository } from '@/lib/repository';
import { ClientPromptItem } from '@/lib/types';
import { DailyDivePage } from '@/components/game/DailyDivePage';

export const dynamic = 'force-dynamic';

interface ArchivePlayPageProps {
  params: {
    dayNumber: string;
  };
}

export default async function ArchivePlayPage({ params }: ArchivePlayPageProps) {
  const dayNumber = parseInt(params.dayNumber, 10);
  if (isNaN(dayNumber) || dayNumber <= 0) {
    notFound();
  }

  const repo = getRepository();
  const dive = await repo.getDiveByDayNumber(dayNumber);

  if (!dive) {
    notFound();
  }

  // Strip answers
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
