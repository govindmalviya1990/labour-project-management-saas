import rawPatternsBank from './question-patterns-bank.json';

export type QuestionCategory =
  | 'ATTENDANCE'
  | 'LABOUR_WAGES'
  | 'PARTNER_WALLET'
  | 'EXPENSES'
  | 'SUPPLIERS'
  | 'MATERIALS_STOCK'
  | 'PROJECTS_CLIENTS'
  | 'DAY_CLOSING'
  | 'ACTION_DRAFTS'
  | 'SYSTEM_GUIDES';

export interface QuestionPattern {
  id: string;
  category: QuestionCategory;
  intent: string;
  question: string;
  variations: string[];
  keywords: string[];
  description: string;
  isActionDraft?: boolean;
}

export const QUESTION_CATEGORIES: { id: QuestionCategory; label: string; icon: string; description: string }[] = [
  { id: 'ATTENDANCE', label: 'Attendance & Hajiri', icon: '📋', description: 'Daily attendance, present/absent count, half-days, overtime shifts' },
  { id: 'LABOUR_WAGES', label: 'Labour Wages & Khata', icon: '👷', description: 'Worker khata, pending wages, daily rate, advance recovery, piece-rate' },
  { id: 'PARTNER_WALLET', label: 'Partner Cash & Wallets', icon: '🤝', description: 'Partner cash in hand, wallet balance, bank transfers, team cash' },
  { id: 'EXPENSES', label: 'Site & Daily Expenses', icon: '💰', description: 'Daily site kharcha, petrol, diesel, chay-nasta, mess, machine repairs' },
  { id: 'SUPPLIERS', label: 'Suppliers & Purchases', icon: '📦', description: 'Supplier ledger, pending bills, purchase entries, GST rates, supplier advance' },
  { id: 'MATERIALS_STOCK', label: 'Materials & Stock', icon: '🏗️', description: 'Chemicals, cement, Dr Fixit, APP membrane, godown stock, consumption' },
  { id: 'PROJECTS_CLIENTS', label: 'Projects & Clients', icon: '🏢', description: 'Project costing, client receipts, pending bills, contract values, profit' },
  { id: 'DAY_CLOSING', label: 'Day Closing & Banking', icon: '🔒', description: 'Cash verification, daily closing status, bank accounts, liquid money' },
  { id: 'ACTION_DRAFTS', label: '1-Click Action Drafts', icon: '⚡', description: 'Instant draft creation for expenses, advances, purchases, attendance' },
  { id: 'SYSTEM_GUIDES', label: 'How-To Guides & Help', icon: '💡', description: 'App usage, step-by-step instructions, bill creation, settings' },
];

export const QUESTION_PATTERNS_BANK: QuestionPattern[] = rawPatternsBank as QuestionPattern[];

export function searchQuestionPatterns(
  query: string,
  limit: number = 20
): QuestionPattern[] {
  const q = query.trim().toLowerCase();
  if (!q) return QUESTION_PATTERNS_BANK.slice(0, limit);

  const matched = QUESTION_PATTERNS_BANK.filter((p) => {
    if (p.question.toLowerCase().includes(q)) return true;
    if (p.category.toLowerCase().includes(q)) return true;
    if (p.keywords.some((k) => k.toLowerCase().includes(q) || q.includes(k.toLowerCase()))) return true;
    if (p.variations.some((v) => v.toLowerCase().includes(q))) return true;
    return false;
  });

  return matched.slice(0, limit);
}

export function getQuestionsByCategory(category?: QuestionCategory): QuestionPattern[] {
  if (!category) return QUESTION_PATTERNS_BANK;
  return QUESTION_PATTERNS_BANK.filter((p) => p.category === category);
}

export function getPatternBankStats() {
  const categoryCounts: Record<string, number> = {};
  for (const p of QUESTION_PATTERNS_BANK) {
    categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
  }
  return {
    totalPatterns: QUESTION_PATTERNS_BANK.length,
    totalVariations: QUESTION_PATTERNS_BANK.reduce((sum, p) => sum + p.variations.length, 0),
    categoryCounts,
  };
}
