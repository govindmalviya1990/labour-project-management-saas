import { ToolExecutionContext } from './types';
import { executeTool } from './tools';
import { KNOWLEDGE_BASE, KnowledgeDoc } from './knowledge-base';
import { formatINR } from '@/lib/calculations';

export interface RuleBasedResult {
  matched: boolean;
  content: string;
  card?: {
    type: 'SUMMARY' | 'PARTNERS' | 'EXPENSES' | 'KNOWLEDGE' | 'WARNING';
    title: string;
    data?: any;
    linkUrl?: string;
    linkLabel?: string;
  };
}

/**
 * Parses relative Indian/Colloquial dates in Asia/Kolkata timezone
 */
export function parseRelativeDate(text: string): { startDate?: string; endDate?: string; label: string } {
  const lower = text.toLowerCase();
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Today
  if (lower.includes('aaj') || lower.includes('today') || lower.includes('આજ')) {
    return { startDate: todayStr, endDate: todayStr, label: 'Aaj (Today)' };
  }

  // Yesterday
  if (lower.includes('kal') || lower.includes('yesterday') || lower.includes('ગઈકાલે')) {
    const yest = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yestStr = yest.toISOString().split('T')[0];
    return { startDate: yestStr, endDate: yestStr, label: 'Kal (Yesterday)' };
  }

  // This week (is hafta)
  if (lower.includes('is hafta') || lower.includes('this week') || lower.includes('આ અઠવાડિયે') || lower.includes('is hafte')) {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const startOfWeek = new Date(now.setDate(diff));
    return {
      startDate: startOfWeek.toISOString().split('T')[0],
      endDate: todayStr,
      label: 'Is Hafte (This Week)',
    };
  }

  // This month (is mahine)
  if (lower.includes('is mahine') || lower.includes('this month') || lower.includes('આ મહિને') || lower.includes('is mahina')) {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    return { startDate: startOfMonth, endDate: todayStr, label: 'Is Mahine (This Month)' };
  }

  // Last month (pichle mahine)
  if (lower.includes('pichle mahine') || lower.includes('last month') || lower.includes('ગયા મહિને') || lower.includes('pichla mahina')) {
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
    return { startDate: startOfLastMonth, endDate: endOfLastMonth, label: 'Pichle Mahine (Last Month)' };
  }

  // "1 se 15 tarikh" or "1 to 15"
  const rangeMatch = lower.match(/(\d{1,2})\s*(?:se|to|-)\s*(\d{1,2})\s*(?:tarikh|date)?/);
  if (rangeMatch) {
    const d1 = parseInt(rangeMatch[1], 10);
    const d2 = parseInt(rangeMatch[2], 10);
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const start = `${year}-${month}-${String(d1).padStart(2, '0')}`;
    const end = `${year}-${month}-${String(d2).padStart(2, '0')}`;
    return { startDate: start, endDate: end, label: `${d1} se ${d2} tarikh` };
  }

  return { label: 'Today' };
}

/**
 * Detect language script
 */
function detectLanguage(text: string): 'GUJARATI' | 'HINDI' | 'HINGLISH_EN' {
  if (/[\u0A80-\u0AFF]/.test(text)) return 'GUJARATI';
  if (/[\u0900-\u097F]/.test(text)) return 'HINDI';
  return 'HINGLISH_EN';
}

/**
 * Fast Rule-Based Matcher: zero API cost, instantaneous answers, complete safety
 */
export async function matchRuleBased(
  query: string,
  ctx: ToolExecutionContext
): Promise<RuleBasedResult> {
  const raw = query.trim();
  const lower = raw.toLowerCase();
  const lang = detectLanguage(raw);

  // 1. Safety Guardrail: Prevent mass delete or destructive actions
  if (
    lower.includes('delete all') ||
    lower.includes('saari entries delete') ||
    lower.includes('sab delete') ||
    lower.includes('reset demo') ||
    lower.includes('wipe data') ||
    lower.includes('baddha delete') ||
    lower.includes('બધું ડિલીટ')
  ) {
    const refusal = lang === 'GUJARATI'
      ? 'સુરક્ષા નીતિ: આસિસ્ટન્ટ દ્વારા ડેટા ડિલીટ કે રીસેટ કરવાની પરવાનગી નથી. આ કામ માટે Owner મેન્યુઅલી Settings પેજ પર જઈને કન્ફર્મ કરી શકે છે.'
      : 'सुरक्षा नियम: AI Assistant से बल्क डेटा डिलीट या रीसेट करना अलाउड नहीं है। यह काम केवल Owner खुद Settings पेज पर जाकर पासवर्ड कन्फर्मेशन के साथ कर सकते हैं।';

    return {
      matched: true,
      content: refusal,
      card: {
        type: 'WARNING',
        title: 'Action Not Allowed via Assistant',
        linkUrl: '/settings',
        linkLabel: 'Go to Settings',
      },
    };
  }

  // 2. Knowledge Base Questions (How-to / Guide / Steps)
  const isInstructionQuery =
    lower.includes('kaise') ||
    lower.includes('how to') ||
    lower.includes('tarika') ||
    lower.includes('steps') ||
    lower.includes('guide') ||
    lower.includes('help') ||
    lower.includes('sikhao') ||
    lower.includes('કેવી રીતે') ||
    lower.includes('રીત');

  if (isInstructionQuery) {
    for (const doc of KNOWLEDGE_BASE) {
      const isKeywordMatch = doc.keywords.some((kw) => lower.includes(kw));
      if (isKeywordMatch) {
        let content = `**${doc.title}**\n\n${doc.summary}\n\n**Step-by-Step Tarika:**\n`;
        doc.steps.forEach((step, idx) => {
          content += `${idx + 1}. ${step}\n`;
        });

        return {
          matched: true,
          content,
          card: {
            type: 'KNOWLEDGE',
            title: doc.title,
            linkUrl: doc.pageUrl,
            linkLabel: `Go to ${doc.pageName}`,
          },
        };
      }
    }
  }

  // 3. Pattern: "Aaj ka kharch" / "Today's expense" / "ખર્ચ"
  if (
    lower.includes('kharch') ||
    lower.includes('expense') ||
    lower.includes('petrol') ||
    lower.includes('chay') ||
    lower.includes('ખર્ચ')
  ) {
    const dateRange = parseRelativeDate(lower);
    try {
      const expData = await executeTool('getExpenses', {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      }, ctx);

      const heading = lang === 'GUJARATI'
        ? `${dateRange.label} નો કુલ ખર્ચ: ${expData.formattedTotal}`
        : `${dateRange.label} का कुल खर्च: ${expData.formattedTotal} (${expData.count} एंट्रीज़)`;

      return {
        matched: true,
        content: `${heading}\n\nAap iski complete detailed list Cash Book ya Daily Expenses me dekh sakte hain.`,
        card: {
          type: 'EXPENSES',
          title: `${dateRange.label} Expenses`,
          data: expData,
          linkUrl: '/finance/expenses',
          linkLabel: 'View All Expenses',
        },
      };
    } catch (err: any) {
      return {
        matched: true,
        content: `Daily expenses dekhne ke liye Expenses page open karein.`,
        card: {
          type: 'EXPENSES',
          title: 'Daily Expenses',
          linkUrl: '/finance/expenses',
          linkLabel: 'Open Expenses',
        },
      };
    }
  }

  // 4. Pattern: "Partner-wise cash" / "Partner cash" / "Sabhi partner ka balance" / "પાર્ટનર કેશ"
  if (
    lower.includes('partner') ||
    lower.includes('partners') ||
    lower.includes('પાર્ટનર')
  ) {
    try {
      const partnerData = await executeTool('getPartnerWallets', {}, ctx);

      if (partnerData.error) {
        return {
          matched: true,
          content: partnerData.error,
        };
      }

      let text = lang === 'GUJARATI'
        ? 'પાર્ટનર્સ કેશ બેલેન્સ (હાથ પરની રકમ):'
        : 'Partners Live Cash in Hand (Wallet Balances):';

      (partnerData.partners || []).forEach((p: any) => {
        text += `\n• ${p.name}: ${p.formattedBalance || formatINR(p.balance || p.cashInHand)}`;
      });

      return {
        matched: true,
        content: text,
        card: {
          type: 'PARTNERS',
          title: 'Partners Cash Overview',
          data: partnerData,
          linkUrl: '/cash-book',
          linkLabel: 'Open Cash Book',
        },
      };
    } catch (err: any) {
      return {
        matched: true,
        content: 'Partners cash balance dekhne ke liye Cash Book open karein.',
        card: {
          type: 'PARTNERS',
          title: 'Cash Book Overview',
          linkUrl: '/cash-book',
          linkLabel: 'Open Cash Book',
        },
      };
    }
  }

  // 5. Pattern: "Pending payment" / "Baqi hisaab" / "બાકી પેમેન્ટ"
  if (
    lower.includes('pending payment') ||
    lower.includes('pending') ||
    lower.includes('baqi hisaab') ||
    lower.includes('baki payment') ||
    lower.includes('બાકી પેમેન્ટ') ||
    lower.includes('બાકી રકમ')
  ) {
    try {
      const pendingData = await executeTool('getPendingPayments', {}, ctx);

      const text = lang === 'GUJARATI'
        ? `ક્લાયન્ટ્સ પાસેથી કુલ બાકી રકમ (Pending Receivables): ${pendingData.formattedTotal} (${pendingData.projectsCount} પ્રોજેક્ટ્સ)`
        : `Clients se total pending receivable (Baqi paisa): ${pendingData.formattedTotal} (${pendingData.projectsCount} projects me baqi hai).`;

      return {
        matched: true,
        content: text,
        card: {
          type: 'SUMMARY',
          title: 'Pending Receivables',
          data: pendingData,
          linkUrl: '/reports',
          linkLabel: 'View Financial Report',
        },
      };
    } catch (err: any) {
      return {
        matched: true,
        content: 'Pending payment report dekhne ke liye Reports page open karein.',
        card: {
          type: 'SUMMARY',
          title: 'Pending Receivables',
          linkUrl: '/reports',
          linkLabel: 'View Reports',
        },
      };
    }
  }

  // 6. Pattern: "Din ka hisaab" / "Cash in hand" / "Closing cash" / "દિન નો હિસાબ"
  if (
    lower.includes('din ka hisaab') ||
    lower.includes('closing cash') ||
    lower.includes('cash in hand') ||
    lower.includes('aaj ka balance') ||
    lower.includes('દિન નો હિસાબ')
  ) {
    try {
      const cashData = await executeTool('getCashBookSummary', {}, ctx);

      const verifiedStatus = cashData.today?.isVerified
        ? '✅ Verified & Locked'
        : '⏳ Pending Verification';

      const text = lang === 'GUJARATI'
        ? `તમારું કેશ ઇન હેન્ડ (Cash in Hand): ${cashData.formattedCashInHand}\n• આજની આવક (IN): ${formatINR(cashData.today?.moneyIn)}\n• આજનો જાવક (OUT): ${formatINR(cashData.today?.moneyOut)}\n• સ્ટેટસ: ${verifiedStatus}`
        : `Aapka current Cash in Hand: ${cashData.formattedCashInHand}\n• Aaj Aaya (IN): ${formatINR(cashData.today?.moneyIn)}\n• Aaj Gaya (OUT): ${formatINR(cashData.today?.moneyOut)}\n• Din Ka Hisaab Status: ${verifiedStatus}`;

      return {
        matched: true,
        content: text,
        card: {
          type: 'SUMMARY',
          title: 'Din Ka Hisaab Status',
          data: cashData,
          linkUrl: '/cash-book',
          linkLabel: 'Open Cash Book',
        },
      };
    } catch (err: any) {
      return {
        matched: true,
        content: 'Din Ka Hisaab dekhne aur physical cash verify karne ke liye Cash Book par "Din Ka Hisaab" button use karein.',
        card: {
          type: 'SUMMARY',
          title: 'Din Ka Hisaab',
          linkUrl: '/cash-book',
          linkLabel: 'Open Cash Book',
        },
      };
    }
  }

  // 7. Pattern: "Stock" / "Dr Fixit" / "Chemical" / "માલ સ્ટોક"
  if (
    lower.includes('stock') ||
    lower.includes('material') ||
    lower.includes('dr fixit') ||
    lower.includes('chemical') ||
    lower.includes('માલ સ્ટોક')
  ) {
    try {
      const stockData = await executeTool('getMaterialStock', {}, ctx);

      let text = lang === 'GUJARATI'
        ? 'વોટરપ્રૂફિંગ મટિરિયલ્સ સ્ટોક (Aaya / Use / Bacha):'
        : 'Waterproofing Materials Stock Status:';

      (stockData.materials || []).slice(0, 5).forEach((m: any) => {
        text += `\n• ${m.name}: Bacha = ${m.bachaStock} ${m.unit} (Aaya: ${m.aayaInward}, Use: ${m.useHuaConsumed})`;
      });

      return {
        matched: true,
        content: text,
        card: {
          type: 'SUMMARY',
          title: 'Site Stock Status',
          data: stockData,
          linkUrl: '/materials',
          linkLabel: 'View Inventory',
        },
      };
    } catch (err: any) {
      return {
        matched: true,
        content: 'Material stock dekhne ke liye Materials page open karein.',
        card: {
          type: 'SUMMARY',
          title: 'Materials Inventory',
          linkUrl: '/materials',
          linkLabel: 'Open Materials',
        },
      };
    }
  }

  // 8. General Knowledge Base Fallback Match
  for (const doc of KNOWLEDGE_BASE) {
    const isKeywordMatch = doc.keywords.some((kw) => lower.includes(kw));
    if (isKeywordMatch) {
      let content = `**${doc.title}**\n\n${doc.summary}\n\n**Step-by-Step Tarika:**\n`;
      doc.steps.forEach((step, idx) => {
        content += `${idx + 1}. ${step}\n`;
      });

      return {
        matched: true,
        content,
        card: {
          type: 'KNOWLEDGE',
          title: doc.title,
          linkUrl: doc.pageUrl,
          linkLabel: `Go to ${doc.pageName}`,
        },
      };
    }
  }

  // No rule-based match found
  return { matched: false, content: '' };
}
