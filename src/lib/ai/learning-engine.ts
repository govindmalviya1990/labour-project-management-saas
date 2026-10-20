import fs from 'fs';
import path from 'path';
import {
  QUESTION_PATTERNS_BANK,
  QUESTION_CATEGORIES,
  QuestionCategory,
  QuestionPattern,
} from './question-patterns';
import { KNOWLEDGE_BASE } from './knowledge-base';
import { executeTool } from './tools';
import { ToolExecutionContext } from './types';
import { formatToolDataToAnswer, getDefaultCardForTool } from './assistant-engine';

export interface LearnedPatternItem {
  id: string;
  rawQuery: string;
  normalizedQuery: string;
  intent: string;
  category: QuestionCategory;
  source: 'GEMINI' | 'RULE' | 'DATA_ENGINE' | 'LEARNED_PATTERN';
  toolsCalled?: string[];
  tokens: string[];
  frequency: number;
  successCount: number;
  failureCount: number;
  confidence: number;
  language: 'hinglish' | 'gujarati' | 'hindi' | 'english';
  firstAskedAt: string;
  lastAskedAt: string;
}

export interface LearnedPatternsStore {
  version: string;
  updatedAt: string;
  queryStats: {
    totalQueries: number;
    successfulQueries: number;
    failedQueries: number;
    learnedPatternsCount: number;
  };
  patterns: LearnedPatternItem[];
}

export interface PatternMatchResult {
  patternId: string;
  question: string;
  intent: string;
  category: QuestionCategory;
  confidence: number;
  matchType: 'EXACT' | 'VARIATION' | 'TOKEN_SIMILARITY' | 'FUZZY_KEYWORD' | 'LEARNED_EXACT' | 'LEARNED_SIMILARITY';
  isLearned?: boolean;
}

// Stopwords in Hinglish / Hindi / Gujarati / English that do not add semantic intent
const COMMON_STOPWORDS = new Set([
  'hai', 'hain', 'ho', 'tha', 'thi', 'the', 'ka', 'ki', 'ke', 'ko', 'se', 'me', 'mein', 'par',
  'kya', 'kitna', 'kitni', 'kitne', 'kaun', 'kisko', 'kisne', 'kaha', 'kab', 'kaise', 'batao',
  'dikhao', 'chahiye', 'karo', 'karein', 'do', 'de', 'diya', 'diye', 'liye', 'aur', 'tatha',
  'is', 'are', 'was', 'were', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'and',
  'show', 'tell', 'get', 'give', 'how', 'much', 'many', 'what', 'who', 'whom', 'where', 'when',
  'છે', 'હતો', 'હતી', 'હતા', 'નો', 'ની', 'નું', 'ના', 'ને', 'માં', 'પર', 'કેટલા', 'કેટલું',
  'કોણ', 'બતાવો', 'આપો', 'કરો', 'અને'
]);

export function normalizeQueryText(query: string): string {
  return query
    .toLowerCase()
    .replace(/[\?\!\,\.\'\"\(\)\:\;\-\_\/\\\[\]\{\}\*\+\#\@\$\%\^\&\=\<\>\~`।]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractMeaningfulTokens(query: string): string[] {
  const norm = normalizeQueryText(query);
  const words = norm.split(' ');
  return words.filter((w) => w.length > 1 && !COMMON_STOPWORDS.has(w));
}

export function detectLanguage(text: string): 'hinglish' | 'gujarati' | 'hindi' | 'english' {
  // Gujarati Unicode range: \u0A80-\u0AFF
  if (/[\u0A80-\u0AFF]/.test(text)) return 'gujarati';
  // Devanagari / Hindi Unicode range: \u0900-\u097F
  if (/[\u0900-\u097F]/.test(text)) return 'hindi';
  // Common pure English words
  const lower = text.toLowerCase();
  const englishWords = ['please', 'report', 'summary', 'balance', 'expenses', 'attendance', 'details', 'wages'];
  const matches = englishWords.filter((w) => lower.includes(w));
  if (matches.length >= 2) return 'english';
  return 'hinglish';
}

export function deduceCategoryFromIntent(intent: string): QuestionCategory {
  if (intent.startsWith('draft')) return 'ACTION_DRAFTS';
  if (intent.startsWith('knowledge_base')) return 'SYSTEM_GUIDES';

  switch (intent) {
    case 'getAttendance':
      return 'ATTENDANCE';
    case 'getWorkerKhata':
    case 'getWorkerAdvanceList':
    case 'getWorkerPaymentsList':
    case 'getPayrollSummary':
      return 'LABOUR_WAGES';
    case 'getPartnerWallets':
      return 'PARTNER_WALLET';
    case 'getCashBookSummary':
    case 'getMoneyPosition':
      return 'DAY_CLOSING';
    case 'getExpenses':
      return 'EXPENSES';
    case 'getSupplierBalances':
      return 'SUPPLIERS';
    case 'getMaterialStock':
      return 'MATERIALS_STOCK';
    case 'getProjectSummary':
    case 'getPendingPayments':
    case 'getDailyReport':
      return 'PROJECTS_CLIENTS';
    default:
      return 'SYSTEM_GUIDES';
  }
}

export class LearningEngine {
  private static instance: LearningEngine;
  private filePath: string;
  private store: LearnedPatternsStore;
  private tokenIndex: Map<string, Set<string>> = new Map(); // token -> patternIds
  private isDirty: boolean = false;
  private saveTimeout: NodeJS.Timeout | null = null;

  private constructor() {
    this.filePath = path.join(process.cwd(), 'data', 'assistant-learned-patterns.json');
    this.store = this.loadStore();
    this.rebuildTokenIndex();
  }

  public static getInstance(): LearningEngine {
    if (!LearningEngine.instance) {
      LearningEngine.instance = new LearningEngine();
    }
    return LearningEngine.instance;
  }

  private loadStore(): LearnedPatternsStore {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.patterns)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[LearningEngine] Could not read existing patterns file, initializing new store:', e);
    }

    return {
      version: '1.0',
      updatedAt: new Date().toISOString(),
      queryStats: {
        totalQueries: 0,
        successfulQueries: 0,
        failedQueries: 0,
        learnedPatternsCount: 0,
      },
      patterns: [],
    };
  }

  private saveStoreSync() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.store.updatedAt = new Date().toISOString();
      this.store.queryStats.learnedPatternsCount = this.store.patterns.length;
      fs.writeFileSync(this.filePath, JSON.stringify(this.store, null, 2), 'utf-8');
      this.isDirty = false;
    } catch (e) {
      console.error('[LearningEngine] Failed to save store:', e);
    }
  }

  private scheduleSave() {
    this.isDirty = true;
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.saveStoreSync();
      this.saveTimeout = null;
    }, 500);
  }

  private rebuildTokenIndex() {
    this.tokenIndex.clear();
    // Index pre-seeded 264 patterns
    for (const p of QUESTION_PATTERNS_BANK) {
      const allTexts = [p.question, ...p.variations, ...p.keywords];
      for (const t of allTexts) {
        for (const token of extractMeaningfulTokens(t)) {
          if (!this.tokenIndex.has(token)) {
            this.tokenIndex.set(token, new Set());
          }
          this.tokenIndex.get(token)!.add(p.id);
        }
      }
    }

    // Index learned patterns
    for (const lp of this.store.patterns) {
      for (const token of lp.tokens) {
        if (!this.tokenIndex.has(token)) {
          this.tokenIndex.set(token, new Set());
        }
        this.tokenIndex.get(token)!.add(lp.id);
      }
    }
  }

  /**
   * Automatically records and learns from a processed question.
   * Called on every assistant interaction.
   */
  public recordQuery(options: {
    rawQuery: string;
    intent?: string;
    category?: QuestionCategory;
    source: 'GEMINI' | 'RULE' | 'DATA_ENGINE' | 'LEARNED_PATTERN';
    toolsCalled?: string[];
    success?: boolean;
    userRole?: string;
  }): LearnedPatternItem | null {
    const raw = (options.rawQuery || '').trim();
    if (!raw || raw.length < 3) return null;

    const normalized = normalizeQueryText(raw);
    const tokens = extractMeaningfulTokens(raw);
    const intent = options.intent || (options.toolsCalled && options.toolsCalled[0]) || 'general_query';
    const category = options.category || deduceCategoryFromIntent(intent);
    const lang = detectLanguage(raw);
    const isSuccess = options.success !== false;

    // Update global query stats
    this.store.queryStats.totalQueries++;
    if (isSuccess) {
      this.store.queryStats.successfulQueries++;
    } else {
      this.store.queryStats.failedQueries++;
    }

    // Check if query is already recorded in learned patterns
    const existingIndex = this.store.patterns.findIndex(
      (p) => p.normalizedQuery === normalized || (p.tokens.length > 0 && p.tokens.join(' ') === tokens.join(' '))
    );

    let patternItem: LearnedPatternItem;

    if (existingIndex >= 0) {
      // Update existing pattern (increases confidence and usage strength)
      patternItem = this.store.patterns[existingIndex];
      patternItem.frequency++;
      if (isSuccess) {
        patternItem.successCount++;
      } else {
        patternItem.failureCount++;
      }
      patternItem.lastAskedAt = new Date().toISOString();
      if (intent && intent !== 'general_query') {
        patternItem.intent = intent;
        patternItem.category = category;
      }
      if (options.toolsCalled && options.toolsCalled.length > 0) {
        patternItem.toolsCalled = options.toolsCalled;
      }
      // Confidence grows with frequency and success ratio: baseline 0.8 + up to 0.2
      const successRatio = patternItem.successCount / Math.max(1, patternItem.frequency);
      patternItem.confidence = Math.min(1.0, 0.75 + Math.min(patternItem.frequency * 0.05, 0.15) + (successRatio * 0.1));
    } else {
      // Brand new pattern discovered!
      const newId = `learned_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      patternItem = {
        id: newId,
        rawQuery: raw,
        normalizedQuery: normalized,
        intent,
        category,
        source: options.source,
        toolsCalled: options.toolsCalled,
        tokens,
        frequency: 1,
        successCount: isSuccess ? 1 : 0,
        failureCount: isSuccess ? 0 : 1,
        confidence: isSuccess ? 0.82 : 0.50,
        language: lang,
        firstAskedAt: new Date().toISOString(),
        lastAskedAt: new Date().toISOString(),
      };

      this.store.patterns.push(patternItem);

      // Add to live token index
      for (const token of tokens) {
        if (!this.tokenIndex.has(token)) {
          this.tokenIndex.set(token, new Set());
        }
        this.tokenIndex.get(token)!.add(newId);
      }
    }

    this.scheduleSave();
    return patternItem;
  }

  /**
   * Finds the best matching pattern from pre-seeded 264 patterns bank AND learned patterns.
   */
  public findBestMatch(query: string, minConfidence: number = 0.60): PatternMatchResult | null {
    const norm = normalizeQueryText(query);
    if (!norm) return null;

    const queryTokens = extractMeaningfulTokens(query);
    if (queryTokens.length === 0) return null;

    // 1. Check EXACT match in learned patterns
    for (const lp of this.store.patterns) {
      if (lp.normalizedQuery === norm) {
        return {
          patternId: lp.id,
          question: lp.rawQuery,
          intent: lp.intent,
          category: lp.category,
          confidence: Math.max(0.95, lp.confidence),
          matchType: 'LEARNED_EXACT',
          isLearned: true,
        };
      }
    }

    // 2. Check EXACT match in pre-seeded 264 bank
    for (const p of QUESTION_PATTERNS_BANK) {
      if (normalizeQueryText(p.question) === norm) {
        return {
          patternId: p.id,
          question: p.question,
          intent: p.intent,
          category: p.category,
          confidence: 1.0,
          matchType: 'EXACT',
        };
      }
      for (const v of p.variations) {
        if (normalizeQueryText(v) === norm) {
          return {
            patternId: p.id,
            question: p.question,
            intent: p.intent,
            category: p.category,
            confidence: 0.98,
            matchType: 'VARIATION',
          };
        }
      }
    }

    // 3. Check Substring Inclusion in 264 Bank
    for (const p of QUESTION_PATTERNS_BANK) {
      const pNorm = normalizeQueryText(p.question);
      if (norm.length > 8 && (norm.includes(pNorm) || pNorm.includes(norm))) {
        return {
          patternId: p.id,
          question: p.question,
          intent: p.intent,
          category: p.category,
          confidence: 0.92,
          matchType: 'VARIATION',
        };
      }
      for (const v of p.variations) {
        const vNorm = normalizeQueryText(v);
        if (norm.length > 8 && (norm.includes(vNorm) || vNorm.includes(norm))) {
          return {
            patternId: p.id,
            question: p.question,
            intent: p.intent,
            category: p.category,
            confidence: 0.90,
            matchType: 'VARIATION',
          };
        }
      }
    }

    // 4. Token Overlap / Jaccard Similarity across Token Index
    let bestMatch: PatternMatchResult | null = null;
    let highestScore = 0;

    // Check candidate pattern IDs matching query tokens
    const candidateIds = new Set<string>();
    for (const t of queryTokens) {
      const ids = this.tokenIndex.get(t);
      if (ids) {
        ids.forEach((id) => candidateIds.add(id));
      }
    }

    for (const id of candidateIds) {
      // Is it a canonical pattern?
      const canonical = QUESTION_PATTERNS_BANK.find((p) => p.id === id);
      if (canonical) {
        const pTokens = extractMeaningfulTokens(`${canonical.question} ${canonical.keywords.join(' ')}`);
        const overlap = queryTokens.filter((qt) => pTokens.includes(qt)).length;
        const totalUnique = new Set([...queryTokens, ...pTokens]).size;
        const jaccard = totalUnique > 0 ? overlap / totalUnique : 0;
        const tokenCoverage = overlap / queryTokens.length;
        const score = (jaccard * 0.4) + (tokenCoverage * 0.6);

        if (score > highestScore && score >= minConfidence) {
          highestScore = score;
          bestMatch = {
            patternId: canonical.id,
            question: canonical.question,
            intent: canonical.intent,
            category: canonical.category,
            confidence: Math.min(0.95, score),
            matchType: 'TOKEN_SIMILARITY',
          };
        }
        continue;
      }

      // Is it a learned pattern?
      const learned = this.store.patterns.find((p) => p.id === id);
      if (learned) {
        const overlap = queryTokens.filter((qt) => learned.tokens.includes(qt)).length;
        const totalUnique = new Set([...queryTokens, ...learned.tokens]).size;
        const jaccard = totalUnique > 0 ? overlap / totalUnique : 0;
        const tokenCoverage = overlap / queryTokens.length;
        const score = (jaccard * 0.4) + (tokenCoverage * 0.6);

        if (score > highestScore && score >= minConfidence) {
          highestScore = score;
          bestMatch = {
            patternId: learned.id,
            question: learned.rawQuery,
            intent: learned.intent,
            category: learned.category,
            confidence: Math.min(0.95, score * (learned.confidence || 0.8)),
            matchType: 'LEARNED_SIMILARITY',
            isLearned: true,
          };
        }
      }
    }

    return bestMatch;
  }

  /**
   * Resolves a pattern directly against tools or knowledge base.
   * Allows answering without LLM latency or when Gemini is offline.
   */
  public async resolveDirectPattern(
    match: PatternMatchResult,
    ctx: ToolExecutionContext,
    rawQuery: string
  ): Promise<{ answer: string; card?: any; source: 'DATA_ENGINE' | 'RULE'; toolCalled?: string } | null> {
    const { intent } = match;

    // 1. Knowledge Base resolution
    if (intent.startsWith('knowledge_base:')) {
      const kbId = intent.replace('knowledge_base:', '');
      const doc = KNOWLEDGE_BASE.find((k) => k.id === kbId || k.id.includes(kbId) || kbId.includes(k.id));
      if (doc) {
        let answer = `📖 **${doc.title}**\n\n${doc.summary}\n\n**Kaise Karein (Steps):**\n`;
        doc.steps.forEach((s, idx) => {
          answer += `${idx + 1}. ${s}\n`;
        });
        return {
          answer,
          card: {
            type: 'KNOWLEDGE',
            title: doc.title,
            linkUrl: doc.pageUrl,
            linkLabel: `Open ${doc.pageName}`,
          },
          source: 'DATA_ENGINE',
          toolCalled: 'knowledgeBase',
        };
      }
    }

    // 2. Action Drafts resolution
    if (intent.startsWith('draft')) {
      try {
        const draftOutput = await executeTool(intent, {}, ctx);
        return {
          answer: draftOutput.message || 'Draft taiyaar hai. Kripya verify karke Save karein.',
          card: draftOutput.card,
          source: 'DATA_ENGINE',
          toolCalled: intent,
        };
      } catch (e: any) {
        return null;
      }
    }

    // 3. Read-Only Tools resolution
    try {
      const lower = rawQuery.toLowerCase();
      const args: any = {};

      // Smart argument extraction
      if (intent === 'getAttendance') {
        if (lower.includes('kal') || lower.includes('yesterday') || lower.includes('કાલ')) {
          const y = new Date();
          y.setDate(y.getDate() - 1);
          args.date = y.toISOString().split('T')[0];
        } else {
          args.date = new Date().toISOString().split('T')[0];
        }
      } else if (intent === 'getExpenses') {
        if (lower.includes('kal') || lower.includes('yesterday')) {
          args.period = 'yesterday';
        } else if (lower.includes('hafte') || lower.includes('week')) {
          args.period = 'week';
        } else if (lower.includes('mahine') || lower.includes('month')) {
          args.period = 'month';
        } else {
          args.period = 'today';
        }
        if (lower.includes('petrol')) args.category = 'Petrol/Diesel';
        else if (lower.includes('chay') || lower.includes('tea')) args.category = 'Chay/Nasta';
        else if (lower.includes('ration') || lower.includes('grocery')) args.category = 'Mess/Grocery';
      } else if (intent === 'getPayrollSummary') {
        if (lower.includes('pichhle mahine') || lower.includes('last month')) {
          args.period = 'last_month';
        } else {
          args.period = 'current_month';
        }
      }

      const output = await executeTool(intent, args, ctx);
      if (output && !output.error) {
        const formatted = formatToolDataToAnswer(intent, output, rawQuery);
        const card = getDefaultCardForTool(intent, output);
        return {
          answer: formatted,
          card,
          source: 'DATA_ENGINE',
          toolCalled: intent,
        };
      }
    } catch (e) {
      console.warn(`[LearningEngine] Error executing direct tool ${intent}:`, e);
    }

    return null;
  }

  /**
   * Returns aggregated statistics of the pattern bank & learning system.
   */
  public getStats() {
    const categoryCounts: Record<string, number> = {};
    for (const cat of QUESTION_CATEGORIES) {
      categoryCounts[cat.id] = 0;
    }

    for (const p of QUESTION_PATTERNS_BANK) {
      categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
    }

    for (const lp of this.store.patterns) {
      categoryCounts[lp.category] = (categoryCounts[lp.category] || 0) + 1;
    }

    // Top 10 most frequently asked queries
    const sortedLearned = [...this.store.patterns].sort((a, b) => b.frequency - a.frequency).slice(0, 10);

    return {
      totalPatterns: QUESTION_PATTERNS_BANK.length + this.store.patterns.length,
      preSeededPatterns: QUESTION_PATTERNS_BANK.length,
      preSeededVariations: QUESTION_PATTERNS_BANK.reduce((sum, p) => sum + p.variations.length, 0),
      learnedPatternsCount: this.store.patterns.length,
      totalQueries: this.store.queryStats.totalQueries,
      successfulQueries: this.store.queryStats.successfulQueries,
      failedQueries: this.store.queryStats.failedQueries,
      categoryCounts,
      topLearnedQuestions: sortedLearned.map((l) => ({
        query: l.rawQuery,
        frequency: l.frequency,
        category: l.category,
        confidence: l.confidence,
        lastAskedAt: l.lastAskedAt,
      })),
      categories: QUESTION_CATEGORIES,
    };
  }

  /**
   * Search catalog across both 264 pre-seeded patterns and learned patterns.
   */
  public search(query: string = '', category?: QuestionCategory, limit: number = 20) {
    const q = normalizeQueryText(query);
    const results: Array<{
      id: string;
      category: QuestionCategory;
      question: string;
      variations: string[];
      description: string;
      isLearned?: boolean;
      frequency?: number;
    }> = [];

    // Search pre-seeded patterns
    for (const p of QUESTION_PATTERNS_BANK) {
      if (category && p.category !== category) continue;
      if (!q) {
        results.push({
          id: p.id,
          category: p.category,
          question: p.question,
          variations: p.variations,
          description: p.description,
        });
      } else {
        const matched =
          p.question.toLowerCase().includes(q) ||
          p.variations.some((v) => v.toLowerCase().includes(q)) ||
          p.keywords.some((k) => k.toLowerCase().includes(q));
        if (matched) {
          results.push({
            id: p.id,
            category: p.category,
            question: p.question,
            variations: p.variations,
            description: p.description,
          });
        }
      }
      if (results.length >= limit) break;
    }

    // Search learned patterns
    for (const lp of this.store.patterns) {
      if (results.length >= limit) break;
      if (category && lp.category !== category) continue;
      if (!q || lp.normalizedQuery.includes(q) || lp.tokens.some((t) => t.includes(q))) {
        results.push({
          id: lp.id,
          category: lp.category,
          question: lp.rawQuery,
          variations: [],
          description: `User-learned query (Asked ${lp.frequency} times, ${Math.round(lp.confidence * 100)}% accuracy)`,
          isLearned: true,
          frequency: lp.frequency,
        });
      }
    }

    return results;
  }
}

export const learningEngine = LearningEngine.getInstance();
