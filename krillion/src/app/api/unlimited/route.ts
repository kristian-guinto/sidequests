import { NextRequest, NextResponse } from 'next/server';
import { getRepository } from '@/lib/repository';
import { ClientPromptItem } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const count = parseInt(searchParams.get('count') || '7', 10);
    const excludeParam = searchParams.get('exclude');
    const excludeIds = excludeParam ? excludeParam.split(',') : [];

    const repo = getRepository();
    const prompts = await repo.getUnlimitedPrompts(Math.min(count, 15), excludeIds);

    const safePrompts: ClientPromptItem[] = prompts.map((p) => ({
      id: p.id,
      text: p.text,
      category: p.category,
      hint: p.hint,
    }));

    return NextResponse.json({
      prompts: safePrompts,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch unlimited prompts' },
      { status: 500 }
    );
  }
}
