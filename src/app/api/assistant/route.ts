import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { defaultLlmProvider } from '@/lib/ai/gemini-adapter';
import { ALL_ASSISTANT_TOOL_DEFINITIONS, executeTool } from '@/lib/ai/tools';
import { matchRuleBased } from '@/lib/ai/rule-based';
import { ToolExecutionContext, LlmMessage } from '@/lib/ai/types';

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

    const trimmedMessage = message.trim();
    const lowerMessage = trimmedMessage.toLowerCase();

    const ctx: ToolExecutionContext = {
      organizationId: session.organizationId,
      userId: session.userId,
      userName: session.name || 'User',
      userRole: session.role || 'PARTNER',
    };

    // ---------------------------------------------------------
    // STEP 1: Safety Guardrails (Prevent destructive/wipe actions)
    // ---------------------------------------------------------
    if (
      lowerMessage.includes('delete all') ||
      lowerMessage.includes('saari entries delete') ||
      lowerMessage.includes('sab delete') ||
      lowerMessage.includes('wipe data') ||
      lowerMessage.includes('reset demo')
    ) {
      return NextResponse.json({
        answer: 'सुरक्षा नियम: AI Assistant से बल्क डेटा डिलीट या रीसेट करना अलाउड नहीं है। यह काम केवल Owner खुद Settings पेज पर जाकर पासवर्ड कन्फर्मेशन के साथ कर सकते हैं।',
        card: {
          type: 'WARNING',
          title: 'Action Not Allowed via Assistant',
          linkUrl: '/settings',
          linkLabel: 'Go to Settings',
        },
        source: 'GUARDRAIL',
      });
    }

    // ---------------------------------------------------------
    // STEP 2: Gemini LLM Call (PRIMARY SMART ENGINE like Claude/Gemini Flash)
    // ---------------------------------------------------------
    let llmError: string | null = null;
    if (process.env.GEMINI_API_KEY) {
      const systemInstruction = `You are the ultra-smart, deeply capable in-app AI Assistant for "Modern Way Civil Solutions" (Waterproofing, Construction & Civil Project Management SaaS in Ahmedabad).
You have the intelligence, conversational naturalness, and multilingual reasoning of Claude 3.5 Sonnet / Gemini 2.0 Flash.

User Name: ${ctx.userName}
Role: ${ctx.userRole}
Organization ID: ${ctx.organizationId}

CORE BEHAVIOR & RULES:
1. ALWAYS understand the user regardless of how they write or speak: Hindi, Hinglish, Gujarati, English, casual slang, typos, or voice transcriptions.
2. NEVER give a bare link to a page or tell the user "go to that page and do it yourself" unless they explicitly ask for a URL or page link.
3. DIRECT DATA PRESENTATION: When the user asks for numbers (expenses, partner cash in hand, wallet balance, worker khata, project status, material stock, client payment pending), ALWAYS call the appropriate tool, extract the live data, and answer with exact numbers and clear bullet points right in the chat.
4. ONE-CLICK ACTION DRAFTS: When the user mentions any action (e.g. "Ramesh ko 500 advance diya", "Petrol me 300 kharch hua", "Sharma ji se 50000 aaya", "10 bag cement kharida", "Mukesh ki attendance lagao"), IMMEDIATELY call the appropriate draft tool (draftFundTransfer, draftExpense, draftMoneyIn, draftGoodsPurchase, draftAttendance). This will show an interactive Confirmation Card right in the chat for them to verify and save.
5. CONVERSATIONAL SMARTNESS:
   - If the user asks general civil, waterproofing, business, or app usage questions, answer thoroughly, smartly, and practically like an expert senior consultant.
   - Speak in the same friendly language the user used (Hindi/Hinglish/Gujarati/English).
   - Use clean Markdown formatting (bold, bullet points, ₹ rupee format).
6. ROLE SCOPING:
   - If role is PARTNER: They can only view their own wallet and assigned sites.
   - If role is SITE_SUPERVISOR: They can view their assigned sites, attendance, and petty cash.
   - If role is OWNER: They can view all partner wallets, all sites, and full financials.`;

      const formattedMessages: LlmMessage[] = [
        ...history.slice(-6).map((h: any) => ({
          role: (h.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: String(h.content || ''),
        })),
        { role: 'user', content: trimmedMessage },
      ];

      const firstLlmResponse = await defaultLlmProvider.generateResponse({
        systemInstruction,
        messages: formattedMessages,
        tools: ALL_ASSISTANT_TOOL_DEFINITIONS,
        temperature: 0.2,
        maxTokens: 800,
      });

      // If Gemini requested a tool execution
      if (firstLlmResponse.functionCall) {
        const { name, arguments: args } = firstLlmResponse.functionCall;
        const toolOutput = await executeTool(name, args, ctx);

        // If the tool generated an interactive confirmation card
        if (toolOutput.card) {
          return NextResponse.json({
            answer: toolOutput.message || 'Draft taiyaar hai. Kripya verify karke Save karein.',
            card: toolOutput.card,
            source: 'GEMINI_TOOL',
          });
        }

        if (toolOutput.isAmbiguous) {
          return NextResponse.json({
            answer: toolOutput.message,
            options: toolOutput.options,
            field: toolOutput.field,
            source: 'GEMINI_TOOL',
          });
        }

        // Second turn: feed read-only query output back to Gemini
        const secondTurnMessages: LlmMessage[] = [
          ...formattedMessages,
          {
            role: 'assistant',
            content: '',
            functionCall: firstLlmResponse.functionCall,
          },
          {
            role: 'function',
            name,
            content: JSON.stringify(toolOutput),
          },
        ];

        const secondLlmResponse = await defaultLlmProvider.generateResponse({
          systemInstruction,
          messages: secondTurnMessages,
          temperature: 0.2,
          maxTokens: 800,
        });

        return NextResponse.json({
          answer: secondLlmResponse.content || 'Aapki query ka data nikal liya gaya hai.',
          toolCalled: name,
          toolData: toolOutput,
          card: toolOutput.card || (name === 'getPartnerWallets' ? { type: 'PARTNERS', title: 'Partners Live Cash Overview', data: toolOutput } : name === 'getExpenses' ? { type: 'EXPENSES', title: 'Expenses Breakdown', data: toolOutput } : undefined),
          source: 'GEMINI',
        });
      }

      if (firstLlmResponse.content && !firstLlmResponse.isFallback) {
        return NextResponse.json({
          answer: firstLlmResponse.content,
          source: 'GEMINI',
        });
      }

      if (firstLlmResponse.isFallback) {
        llmError = firstLlmResponse.error || 'Gemini returned fallback';
      }
    }

    // ---------------------------------------------------------
    // STEP 3: Fallback Layer (When API key is missing or API is offline)
    // ---------------------------------------------------------
    const ruleResult = await matchRuleBased(trimmedMessage, ctx);
    if (ruleResult.matched) {
      return NextResponse.json({
        answer: ruleResult.content,
        card: ruleResult.card,
        options: ruleResult.options,
        field: ruleResult.field,
        source: 'RULE_BASED',
      });
    }

    // Generic fallback if no rule matched and no LLM key
    return NextResponse.json({
      answer: 'Main aapke rozana ke hisaab me madad kar sakta hoon:\n• "Aaj ka kharch kitna hua?"\n• "Sabhi partners ka cash balance dikhao"\n• "Ramesh ko ₹500 diye petrol ke"\n• "Pending payment report dikhao"\n\n*(Full Claude/Gemini conversational AI chalane ke liye Gemini API Key configure karein).*',
      source: 'SIMPLE_MODE',
      ...(ctx.userRole === 'OWNER' && llmError ? { debugError: llmError } : {}),
    });
  } catch (error: any) {
    console.error('Assistant POST error:', error);
    return NextResponse.json(
      { answer: 'Abhi jawab nahi de pa raha, dobara try karein.', error: 'Assistant processing error' },
      { status: 500 }
    );
  }
}
