import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/repository';
import { ClientPromptItem } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { dayNumber: string } }
) {
  try {
    const dayNumber = parseInt(params.dayNumber, 10);
    if (isNaN(dayNumber) || dayNumber <= 0) {
      return NextResponse.json(
        { error: 'Valid dayNumber is required' },
        { status: 400 }
      );
    }

    const repo = getRepository();
    const dive = await repo.getDiveByDayNumber(dayNumber);

    if (!dive) {
      return NextResponse.json(
        { error: `Dive for Day #${dayNumber} not found` },
        { status: 404 }
      );
    }

    const safePrompts: ClientPromptItem[] = dive.prompts.map((p) => ({
      id: p.id,
      text: p.text,
      category: p.category,
      hint: p.hint,
    }));

    return NextResponse.json({
      dayNumber: dive.dayNumber,
      date: dive.date,
      title: dive.title || `Day #${dive.dayNumber} Dive`,
      prompts: safePrompts,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch dive' },
      { status: 500 }
    );
  }
}
