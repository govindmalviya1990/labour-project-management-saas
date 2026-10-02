import { ToolExecutionContext } from './types';
import { executeTool } from './tools';
import { KNOWLEDGE_BASE, KnowledgeDoc } from './knowledge-base';
import { formatINR } from '@/lib/calculations';

export interface RuleBasedResult {
  matched: boolean;
  content: string;
  card?: {
    type: 'SUMMARY' | 'PARTNERS' | 'EXPENSES' | 'KNOWLEDGE' | 'WARNING' | 'CONFIRMATION';
    title: string;
    data?: any;
    draft?: any;
    linkUrl?: string;
    linkLabel?: string;
  };
  options?: any[];
  field?: string;
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

  // 1b. Guardrail: Role changes and Day Hisaab Lock/Unlock
  if (
    lower.includes('role change') ||
    lower.includes('role badal') ||
    lower.includes('hisaab lock') ||
    lower.includes('hisaab unlock') ||
    lower.includes('din lock') ||
    lower.includes('din unlock')
  ) {
    return {
      matched: true,
      content: 'सुरक्षा नियम: Role बदलना या दिन का हिसाब लॉक/અનલૉક करना चैटबॉट से अलाउड नहीं है। कृपया संबंधित पेज से मैन्युअली करें।',
      card: {
        type: 'WARNING',
        title: 'Action Not Allowed via Assistant',
        linkUrl: lower.includes('role') ? '/users' : '/cash-book',
        linkLabel: lower.includes('role') ? 'Manage Users' : 'Open Cash Book',
      },
    };
  }

  // =========================================================
  // DRAFT ENTRY PATTERNS (Draft-Only: Never Mutates Database)
  // =========================================================
  const targetDateStr = parseRelativeDate(lower).startDate || new Date().toISOString().split('T')[0];

  // 2a. Give Money Draft: "Ramesh ko 500 Dinner ke liye diye" / "Sonu ko 2000 advance diye"
  const transferMatch =
    raw.match(/(?:aaj\s+)?(.+?)\s+ko\s+(\d+(?:\.\d+)?)\s*(?:rupaye|rs|₹)?\s*(.*?)\s*(?:(?:ke\s+liye)|(?:for))?\s*(?:diye|aapya|bheje|paid|transfer|diyo)/i) ||
    raw.match(/(?:aaj\s+)?(.+?)\s+ko\s+(?:rupaye|rs|₹)?\s*(\d+(?:\.\d+)?)\s*(?:diye|aapya)/i);

  if (transferMatch) {
    const toName = transferMatch[1].trim();
    const amount = parseFloat(transferMatch[2]);
    let rawPurpose = transferMatch[3]?.trim().replace(/(?:ke\s+liye|for)$/i, '').trim();
    if (rawPurpose && rawPurpose.toLowerCase() === 'dinner') rawPurpose = 'Dinner';
    if (rawPurpose && rawPurpose.toLowerCase() === 'advance') rawPurpose = 'Worker Advance';
    if (rawPurpose && rawPurpose.toLowerCase() === 'petrol') rawPurpose = 'Petrol';
    if (rawPurpose && rawPurpose.toLowerCase().includes('chay')) rawPurpose = 'Chay-Nasta';
    const purpose = rawPurpose && rawPurpose.length > 1 ? rawPurpose : 'Site Daily Expenses & Petty Cash';

    const draftRes = await executeTool(
      'draftFundTransfer',
      { toName, amount, purpose, date: targetDateStr },
      ctx
    );

    if (draftRes.isAmbiguous) {
      return {
        matched: true,
        content: draftRes.message,
        options: draftRes.options,
        field: draftRes.field,
      };
    }

    if (draftRes.error) {
      return {
        matched: true,
        content: draftRes.error,
      };
    }

    if (draftRes.card) {
      return {
        matched: true,
        content: draftRes.message,
        card: draftRes.card,
      };
    }
  }

  // 2b. Goods Purchase Draft: "10 bag cement 3800 mein kharide"
  const goodsMatch = lower.match(
    /(\d+)\s*(bag|kg|ltr|drum|nos)?\s*([a-zA-Z0-9\s]+?)\s*(\d+(?:\.\d+)?)\s*(?:me|mein|rupaye|rs|₹)?\s*(?:kharide|kharida|purchase|liya)/i
  );
  if (goodsMatch) {
    const quantity = parseInt(goodsMatch[1], 10);
    const unit = goodsMatch[2] || 'Bag';
    const materialName = goodsMatch[3].trim();
    const totalAmount = parseFloat(goodsMatch[4]);

    const draftRes = await executeTool(
      'draftGoodsPurchase',
      { materialName, quantity, unit, totalAmount, date: targetDateStr },
      ctx
    );

    if (draftRes.card) {
      return {
        matched: true,
        content: draftRes.message,
        card: draftRes.card,
      };
    }
  }

  // 2c. Daily Expense Draft: "Aaj chay-nasta 300 laga", "Petrol 400 kharch hua"
  const isQuestion = lower.includes('kitna') || lower.includes('how much') || lower.includes('dikhao') || lower.includes('ketlo') || lower.includes('ketla');
  if (!isQuestion) {
    const expMatch =
      lower.match(/(chay[-\s]?nasta|petrol|dinner|lunch|food|travel|grocery|auto|diesel|tea|snack)\s*(?:me|ka)?\s*(\d+(?:\.\d+)?)\s*(?:rupaye|rs|₹)?\s*(?:laga|kharch|hua|spent)?/i) ||
      lower.match(/(\d+(?:\.\d+)?)\s*(?:rupaye|rs|₹)?\s*(?:ka\s+)?(chay[-\s]?nasta|petrol|dinner|lunch|food|travel|grocery|auto|diesel|tea|snack)\s*(?:laga|kharch|hua|spent)?/i);

    if (expMatch) {
      let category = '';
      let amount = 0;
      if (isNaN(parseFloat(expMatch[1]))) {
        category = expMatch[1].trim();
        amount = parseFloat(expMatch[2]);
      } else {
        amount = parseFloat(expMatch[1]);
        category = expMatch[2].trim();
      }

      // Format category label nicely
      if (category.toLowerCase().includes('chay')) category = 'Chay-Nasta';
      else if (category.toLowerCase().includes('petrol')) category = 'Petrol';
      else if (category.toLowerCase().includes('dinner')) category = 'Dinner';
      else if (category.toLowerCase().includes('lunch')) category = 'Lunch';

      if (amount > 0) {
        const draftRes = await executeTool('draftExpense', { category, amount, date: targetDateStr }, ctx);
        if (draftRes.card) {
          return {
            matched: true,
            content: draftRes.message,
            card: draftRes.card,
          };
        }
      }
    }
  }

  // 2d. Attendance Draft: "Aaj Ramesh present, Suresh half day"
  if (
    (lower.includes('present') || lower.includes('half day') || lower.includes('absent')) &&
    (lower.includes('aaj') || lower.includes('attendance') || lower.includes('haziri') || lower.includes('હાજર'))
  ) {
    const chunks = lower.replace(/^(?:aaj\s+|today\s+)/i, '').split(/[,;\n]|(?:\s+aur\s+)|\sand\s/);
    const records: Array<{ workerName: string; status: 'PRESENT' | 'HALF_DAY' | 'ABSENT' }> = [];

    for (const chunk of chunks) {
      const trimmed = chunk.trim();
      if (!trimmed) continue;
      let status: 'PRESENT' | 'HALF_DAY' | 'ABSENT' = 'PRESENT';
      if (trimmed.includes('half day') || trimmed.includes('halfday')) status = 'HALF_DAY';
      else if (trimmed.includes('absent') || trimmed.includes('gain')) status = 'ABSENT';
      else if (trimmed.includes('present') || trimmed.includes('hajar') || trimmed.includes('હાજર')) status = 'PRESENT';

      const name = trimmed.replace(/\b(?:present|half day|halfday|absent|hajar|હાજર)\b/gi, '').trim();
      if (name && name.length >= 2) {
        records.push({ workerName: name, status });
      }
    }

    if (records.length > 0) {
      const draftRes = await executeTool('draftAttendance', { records, date: targetDateStr }, ctx);
      if (draftRes.card) {
        return {
          matched: true,
          content: draftRes.message,
          card: draftRes.card,
        };
      }
    }
  }

  // 2e. Bank Transfers: "Bank se 20000 cash nikala", "Cash 20000 bank me jama"
  const bankWithdrawMatch = lower.match(/(?:bank\s+se)\s*(?:rupaye|rs|₹)?\s*(\d+(?:\.\d+)?)\s*(?:cash)?\s*(?:nikal|withdr)/i) ||
    lower.match(/(\d+(?:\.\d+)?)\s*(?:cash)?\s*(?:bank\s+se\s+nikal)/i);
  if (bankWithdrawMatch) {
    const amount = parseFloat(bankWithdrawMatch[1]);
    if (amount > 0) {
      const draftRes = await executeTool('draftBankWithdrawal', { amount, date: targetDateStr }, ctx);
      if (draftRes.card) {
        return {
          matched: true,
          content: draftRes.message,
          card: draftRes.card,
        };
      }
    }
  }

  const bankDepositMatch = lower.match(/(?:cash\s+)?(\d+(?:\.\d+)?)\s*(?:rupaye|rs|₹)?\s*(?:bank\s+(?:me|mein)\s+jama)/i) ||
    lower.match(/(?:bank\s+(?:me|mein))\s*(\d+(?:\.\d+)?)\s*(?:jama|deposit)/i);
  if (bankDepositMatch) {
    const amount = parseFloat(bankDepositMatch[1]);
    if (amount > 0) {
      const draftRes = await executeTool('draftBankDeposit', { amount, date: targetDateStr }, ctx);
      if (draftRes.card) {
        return {
          matched: true,
          content: draftRes.message,
          card: draftRes.card,
        };
      }
    }
  }

  // 3. Knowledge Base Questions (How-to / Guide / Steps)
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
