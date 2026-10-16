import { NextResponse } from 'next/server';
import { getRepository } from '@/lib/repository';
import { getNextManilaMidnight } from '@/lib/date';
import { ClientPromptItem } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const repo = getRepository();
    const dive = await repo.getDailyDive();

    // Strip answers from prompts
    const safePrompts: ClientPromptItem[] = dive.prompts.map((p) => ({
      id: p.id,
      text: p.text,
      category: p.category,
      hint: p.hint,
    }));

    return NextResponse.json({
      date: dive.date,
      dayNumber: dive.dayNumber,
      title: dive.title,
      resetsAt: getNextManilaMidnight(),
      prompts: safePrompts,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch today dive' },
      { status: 500 }
    );
  }
}
