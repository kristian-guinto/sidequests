import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/repository';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { promptId, rawAnswer } = body || {};

    if (!promptId || typeof promptId !== 'string') {
      return NextResponse.json(
        { error: 'promptId is required' },
        { status: 400 }
      );
    }

    const repo = getRepository();
    const result = await repo.evaluateSubmission(promptId, String(rawAnswer || ''));

    return NextResponse.json({
      matched: result.matched,
      tier: result.tier,
      score: result.score,
      canonicalAnswer: result.canonicalAnswer,
      quip: result.quip,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to evaluate answer' },
      { status: 500 }
    );
  }
}
