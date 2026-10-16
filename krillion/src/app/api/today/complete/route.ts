import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/repository';
import { CompletionPayload, TierId } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { date, playerId, score, answers, dayNumber } = body || {};

    const formattedAnswers = Array.isArray(answers)
      ? answers.map((a: any) => ({
          promptId: String(a.promptId),
          answer: String(a.rawAnswer || a.answer || ''),
          score: Number(a.score) || 0,
          tier: (a.tier as TierId) || 'miss',
        }))
      : [];

    const promptIds = formattedAnswers.map((a) => a.promptId);

    const payload: CompletionPayload = {
      dayNumber: Number(dayNumber) || 1,
      promptIds,
      userAnswers: formattedAnswers,
      totalScore: Number(score) || 0,
      completedAt: new Date().toISOString(),
    };

    const repo = getRepository();
    const stats = await repo.recordCompletion(payload);

    return NextResponse.json({
      ok: true,
      betterThan: stats.betterThan,
      dist: stats.dist,
      totalPlayers: stats.totalPlayers,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to record completion' },
      { status: 500 }
    );
  }
}
