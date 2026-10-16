import { NextResponse } from 'next/server';
import { getRepository } from '@/lib/repository';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const repo = getRepository();
    const dives = await repo.getAllDives();

    const archiveList = dives.map((d) => ({
      dayNumber: d.dayNumber,
      date: d.date,
      title: d.title || `Day #${d.dayNumber} Dive`,
      promptCount: d.prompts.length,
    }));

    return NextResponse.json({
      dives: archiveList,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch archive' },
      { status: 500 }
    );
  }
}
