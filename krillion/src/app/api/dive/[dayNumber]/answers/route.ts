import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/repository';
import { GroupedAnswersPrompt, TierGroupedAnswers } from '@/lib/types';

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

    const promptsWithGroupedAnswers: GroupedAnswersPrompt[] = dive.prompts.map((p) => {
      const tiers: TierGroupedAnswers = {
        plankton: [],
        tooclever: [],
        schooler: [],
        rare: [],
        deepcut: [],
        krillion: [],
      };

      for (const ans of p.answers) {
        if (ans.tier in tiers) {
          tiers[ans.tier].push(ans);
        }
      }

      return {
        id: p.id,
        text: p.text,
        category: p.category,
        hint: p.hint,
        tiers,
        totalAnswersCount: p.answers.length,
      };
    });

    return NextResponse.json({
      dayNumber: dive.dayNumber,
      date: dive.date,
      title: dive.title,
      prompts: promptsWithGroupedAnswers,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch dive answers' },
      { status: 500 }
    );
  }
}
