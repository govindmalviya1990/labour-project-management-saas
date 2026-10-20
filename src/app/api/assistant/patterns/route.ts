import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { learningEngine } from '@/lib/ai/learning-engine';
import { QUESTION_CATEGORIES, QuestionCategory } from '@/lib/ai/question-patterns';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || !session.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const category = (searchParams.get('category') as QuestionCategory) || undefined;
    const limit = parseInt(searchParams.get('limit') || '30', 10);

    const stats = learningEngine.getStats();
    const searchResults = learningEngine.search(query, category, limit);

    return NextResponse.json({
      stats,
      categories: QUESTION_CATEGORIES,
      patterns: searchResults,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Assistant patterns GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch question patterns' }, { status: 500 });
  }
}
