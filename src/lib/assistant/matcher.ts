import prisma from '@/lib/db/prisma';
import { DraftFieldOption } from './draft-types';

export interface MatchResult<T> {
  status: 'EXACT' | 'AMBIGUOUS' | 'NOT_FOUND';
  match: T | null;
  options: DraftFieldOption[];
  query: string;
}

/**
 * Normalizes text for clean fuzzy comparison (trims, lowercases, removes extra punctuation)
 */
export function normalizeKeyword(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fuzzy matches a worker within the organization
 */
export async function matchWorker(
  nameQuery: string,
  organizationId: string
): Promise<MatchResult<{ id: string; name: string; workerCode?: string | null; dailyWage?: number | null }>> {
  const q = normalizeKeyword(nameQuery);
  if (!q) {
    return { status: 'NOT_FOUND', match: null, options: [], query: nameQuery };
  }

  let workers: Array<{ id: string; name: string; workerCode?: string | null; category?: string | null; dailyWage?: number | null }> = [];
  try {
    workers = await prisma.worker.findMany({
      where: { organizationId, deletedAt: null },
      select: { id: true, name: true, workerCode: true, category: true, dailyWage: true },
    });
  } catch (e) {
    // If DB is offline, provide graceful fallback
    return {
      status: 'EXACT',
      match: { id: `worker_${q}`, name: nameQuery },
      options: [{ id: `worker_${q}`, name: nameQuery }],
      query: nameQuery,
    };
  }

  // 1. Exact match (case-insensitive)
  const exact = workers.find((w) => normalizeKeyword(w.name) === q);
  if (exact) {
    return {
      status: 'EXACT',
      match: exact,
      options: [{ id: exact.id, name: exact.name, subtext: (exact.workerCode || exact.category) || undefined }],
      query: nameQuery,
    };
  }

  // 2. Substring / partial match
  const matches = workers.filter((w) => {
    const norm = normalizeKeyword(w.name);
    return norm.includes(q) || q.includes(norm);
  });

  if (matches.length === 1) {
    const single = matches[0];
    return {
      status: 'EXACT',
      match: single,
      options: [{ id: single.id, name: single.name, subtext: (single.workerCode || single.category) || undefined }],
      query: nameQuery,
    };
  }

  if (matches.length > 1) {
    return {
      status: 'AMBIGUOUS',
      match: null,
      options: matches.map((w) => ({
        id: w.id,
        name: w.name,
        subtext: `${w.workerCode ? `Code: ${w.workerCode}` : ''} (${w.category})`.trim(),
      })),
      query: nameQuery,
    };
  }

  return { status: 'NOT_FOUND', match: null, options: [], query: nameQuery };
}

/**
 * Fuzzy matches a team member (Partner / Supervisor) within the organization
 */
export async function matchUser(
  nameQuery: string,
  organizationId: string,
  roleFilter?: string[]
): Promise<MatchResult<{ id: string; name: string; email: string; role: string }>> {
  const q = normalizeKeyword(nameQuery);
  if (!q) {
    return { status: 'NOT_FOUND', match: null, options: [], query: nameQuery };
  }

  let orgUsers: any[] = [];
  try {
    orgUsers = await prisma.organizationUser.findMany({
      where: {
        organizationId,
        status: 'ACTIVE',
        ...(roleFilter && roleFilter.length > 0 ? { role: { in: roleFilter as any } } : {}),
      },
      include: {
        user: { select: { id: true, name: true, email: true, mobile: true } },
      },
    });
  } catch (e) {
    return {
      status: 'EXACT',
      match: { id: `user_${q}`, name: nameQuery, email: '', role: 'PARTNER' },
      options: [{ id: `user_${q}`, name: nameQuery, subtext: 'PARTNER' }],
      query: nameQuery,
    };
  }

  const candidates = orgUsers.map((ou) => ({
    id: ou.user.id,
    name: ou.user.name,
    email: ou.user.email,
    role: ou.role,
  }));

  // Exact match
  const exact = candidates.find((c) => normalizeKeyword(c.name) === q);
  if (exact) {
    return {
      status: 'EXACT',
      match: exact,
      options: [{ id: exact.id, name: exact.name, subtext: exact.role }],
      query: nameQuery,
    };
  }

  // Partial matches
  const matches = candidates.filter((c) => {
    const norm = normalizeKeyword(c.name);
    return norm.includes(q) || q.includes(norm);
  });

  if (matches.length === 1) {
    return {
      status: 'EXACT',
      match: matches[0],
      options: [{ id: matches[0].id, name: matches[0].name, subtext: matches[0].role }],
      query: nameQuery,
    };
  }

  if (matches.length > 1) {
    return {
      status: 'AMBIGUOUS',
      match: null,
      options: matches.map((m) => ({ id: m.id, name: m.name, subtext: m.role })),
      query: nameQuery,
    };
  }

  return { status: 'NOT_FOUND', match: null, options: [], query: nameQuery };
}

/**
 * Matches an active project by name
 */
export async function matchProject(
  nameQuery: string,
  organizationId: string
): Promise<MatchResult<{ id: string; name: string; projectCode?: string | null }>> {
  const q = normalizeKeyword(nameQuery);
  if (!q) {
    return { status: 'NOT_FOUND', match: null, options: [], query: nameQuery };
  }

  let projects: any[] = [];
  try {
    projects = await prisma.project.findMany({
      where: { organizationId },
      select: { id: true, name: true, projectCode: true },
    });
  } catch (e) {
    return {
      status: 'EXACT',
      match: { id: `proj_${q}`, name: nameQuery },
      options: [{ id: `proj_${q}`, name: nameQuery }],
      query: nameQuery,
    };
  }

  const exact = projects.find((p) => normalizeKeyword(p.name) === q);
  if (exact) {
    return {
      status: 'EXACT',
      match: exact,
      options: [{ id: exact.id, name: exact.name, subtext: exact.projectCode || undefined }],
      query: nameQuery,
    };
  }

  const matches = projects.filter((p) => {
    const norm = normalizeKeyword(p.name);
    return norm.includes(q) || q.includes(norm);
  });

  if (matches.length === 1) {
    return {
      status: 'EXACT',
      match: matches[0],
      options: [{ id: matches[0].id, name: matches[0].name, subtext: matches[0].projectCode || undefined }],
      query: nameQuery,
    };
  }

  if (matches.length > 1) {
    return {
      status: 'AMBIGUOUS',
      match: null,
      options: matches.map((p) => ({ id: p.id, name: p.name, subtext: p.projectCode || undefined })),
      query: nameQuery,
    };
  }

  return { status: 'NOT_FOUND', match: null, options: [], query: nameQuery };
}

/**
 * Matches a material by name
 */
export async function matchMaterial(
  nameQuery: string,
  organizationId: string
): Promise<MatchResult<{ id: string; name: string; unit: string }>> {
  const q = normalizeKeyword(nameQuery);
  if (!q) {
    return { status: 'NOT_FOUND', match: null, options: [], query: nameQuery };
  }

  let materials: any[] = [];
  try {
    materials = await prisma.material.findMany({
      where: { organizationId },
      select: { id: true, name: true, unit: true },
    });
  } catch (e) {
    return {
      status: 'EXACT',
      match: { id: `mat_${q}`, name: nameQuery, unit: 'Bag' },
      options: [{ id: `mat_${q}`, name: nameQuery, subtext: 'Bag' }],
      query: nameQuery,
    };
  }

  const exact = materials.find((m) => normalizeKeyword(m.name) === q);
  if (exact) {
    return {
      status: 'EXACT',
      match: exact,
      options: [{ id: exact.id, name: exact.name, subtext: exact.unit }],
      query: nameQuery,
    };
  }

  const matches = materials.filter((m) => {
    const norm = normalizeKeyword(m.name);
    return norm.includes(q) || q.includes(norm);
  });

  if (matches.length === 1) {
    return {
      status: 'EXACT',
      match: matches[0],
      options: [{ id: matches[0].id, name: matches[0].name, subtext: matches[0].unit }],
      query: nameQuery,
    };
  }

  if (matches.length > 1) {
    return {
      status: 'AMBIGUOUS',
      match: null,
      options: matches.map((m) => ({ id: m.id, name: m.name, subtext: m.unit })),
      query: nameQuery,
    };
  }

  return { status: 'NOT_FOUND', match: null, options: [], query: nameQuery };
}

/**
 * Matches a Bank Account by name or last 4 digits
 */
export async function matchBankAccount(
  query: string,
  organizationId: string
): Promise<MatchResult<{ id: string; name: string; bankName: string; accountLast4?: string | null }>> {
  const q = normalizeKeyword(query);
  if (!q) {
    return { status: 'NOT_FOUND', match: null, options: [], query };
  }

  let banks: any[] = [];
  try {
    banks = await prisma.bankAccount.findMany({
      where: { organizationId, deletedAt: null, isActive: true },
      select: { id: true, name: true, bankName: true, accountLast4: true },
    });
  } catch (e) {
    return {
      status: 'EXACT',
      match: { id: `bank_${q}`, name: query, bankName: 'Bank' },
      options: [{ id: `bank_${q}`, name: query }],
      query,
    };
  }

  const exact = banks.find(
    (b) =>
      normalizeKeyword(b.name) === q ||
      normalizeKeyword(b.bankName) === q ||
      (b.accountLast4 && q.includes(b.accountLast4))
  );

  if (exact) {
    return {
      status: 'EXACT',
      match: exact,
      options: [{ id: exact.id, name: `${exact.bankName} - ${exact.name}`, subtext: exact.accountLast4 ? `XX${exact.accountLast4}` : '' }],
      query,
    };
  }

  const matches = banks.filter((b) => {
    const norm = normalizeKeyword(`${b.bankName} ${b.name}`);
    return norm.includes(q) || q.includes(norm) || (b.accountLast4 && q.includes(b.accountLast4));
  });

  if (matches.length === 1) {
    return {
      status: 'EXACT',
      match: matches[0],
      options: [{ id: matches[0].id, name: `${matches[0].bankName} - ${matches[0].name}`, subtext: matches[0].accountLast4 ? `XX${matches[0].accountLast4}` : '' }],
      query,
    };
  }

  if (matches.length > 1) {
    return {
      status: 'AMBIGUOUS',
      match: null,
      options: matches.map((b) => ({
        id: b.id,
        name: `${b.bankName} - ${b.name}`,
        subtext: b.accountLast4 ? `XX${b.accountLast4}` : '',
      })),
      query,
    };
  }

  return { status: 'NOT_FOUND', match: null, options: [], query };
}

/**
 * Pre-fetches organization field options for dropdowns in confirmation cards
 */
export async function getOrgFormOptions(organizationId: string) {
  try {
    const [workers, projects, purposes, bankAccounts, teamMembers] = await Promise.all([
      prisma.worker.findMany({
        where: { organizationId, deletedAt: null },
        select: { id: true, name: true, workerCode: true, category: true },
        orderBy: { name: 'asc' },
      }),
      prisma.project.findMany({
        where: { organizationId },
        select: { id: true, name: true, projectCode: true },
        orderBy: { name: 'asc' },
      }),
      prisma.purposeOption.findMany({
        where: { organizationId, isActive: true, deletedAt: null },
        select: { id: true, name: true, type: true },
        orderBy: { name: 'asc' },
      }),
      prisma.bankAccount.findMany({
        where: { organizationId, isActive: true, deletedAt: null },
        select: { id: true, name: true, bankName: true, accountLast4: true },
        orderBy: { name: 'asc' },
      }),
      prisma.organizationUser.findMany({
        where: { organizationId, status: 'ACTIVE' },
        include: { user: { select: { id: true, name: true } } },
      }),
    ]);

    return {
      workers: workers.map((w) => ({
        id: w.id,
        name: w.name,
        subtext: `${w.workerCode ? `(${w.workerCode}) ` : ''}${w.category}`,
      })),
      partners: teamMembers.map((tm) => ({
        id: tm.user.id,
        name: tm.user.name,
        subtext: tm.role,
      })),
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        subtext: p.projectCode || undefined,
      })),
      purposes: purposes.map((p) => ({
        id: p.id,
        name: p.name,
        subtext: p.type,
      })),
      bankAccounts: bankAccounts.map((b) => ({
        id: b.id,
        name: `${b.bankName} - ${b.name}`,
        subtext: b.accountLast4 ? `XX${b.accountLast4}` : undefined,
      })),
    };
  } catch (e) {
    return {
      workers: [],
      partners: [],
      projects: [],
      purposes: [],
      bankAccounts: [],
    };
  }
}
