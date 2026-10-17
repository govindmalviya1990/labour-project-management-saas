import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { defaultLlmProvider } from '@/lib/ai/gemini-adapter';
import { handleAssistantMessage } from '@/lib/ai/assistant-engine';
import { ToolExecutionContext } from '@/lib/ai/types';

export const dynamic = 'force-dynamic';

// Sliding-window in-memory rate limiter: max 25 requests per minute per user
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const userRate = rateLimitMap.get(userId);

  if (!userRate || now > userRate.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (userRate.count >= 25) {
    return false;
  }

  userRate.count++;
  return true;
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !session.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const org = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { assistantEnabled: true },
    });

    const isApiKeyConfigured = Boolean(process.env.GEMINI_API_KEY?.trim());
    let geminiStatus = 'NOT_CONFIGURED';
    let geminiError: string | null = null;

    if (isApiKeyConfigured && session.role === 'OWNER') {
      const pingRes = await defaultLlmProvider.generateResponse({
        messages: [{ role: 'user', content: 'Say OK' }],
        maxTokens: 5,
      });
      if (pingRes.content && !pingRes.isFallback) {
        geminiStatus = 'ACTIVE';
      } else {
        geminiStatus = 'ERROR';
        geminiError = pingRes.error || 'Failed to ping Gemini';
      }
    }

    return NextResponse.json({
      enabled: org?.assistantEnabled ?? true,
      mode: isApiKeyConfigured ? 'GEMINI' : 'SIMPLE',
      geminiStatus,
      geminiError,
      buildVersion: 'build-2026-v4',
      userRole: session.role,
    });
  } catch (error: any) {
    console.error('Assistant GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch assistant status' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || !session.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const org = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { assistantEnabled: true },
    });

    if (org?.assistantEnabled === false) {
      return NextResponse.json(
        { error: 'AI Assistant has been disabled by your administrator.' },
        { status: 403 }
      );
    }

    // Rate Limiting
    if (!checkRateLimit(session.userId)) {
      return NextResponse.json(
        { error: 'Bohat saari requests aayi hain. Kripya thoda ruk kar try karein.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { message, history = [] } = body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const ctx: ToolExecutionContext = {
      organizationId: session.organizationId,
      userId: session.userId,
      userName: session.name || 'User',
      userRole: session.role || 'PARTNER',
    };

    const result = await handleAssistantMessage(message, history, ctx);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Assistant POST error:', error);
    return NextResponse.json(
      { answer: 'Abhi jawab nahi de pa raha, dobara try karein.', error: 'Assistant processing error' },
      { status: 500 }
    );
  }
}
