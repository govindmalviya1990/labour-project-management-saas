import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission, normalizeRole } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const DEFAULT_SYSTEM_TRANSFER_REASONS = [
  'Site Daily Expenses & Petty Cash',
  'Worker Advance',
  'Salary Payout',
  'Partner Drawing',
  'Internal Settlement',
  'Other',
];

const DEFAULT_EXPENSE_SUGGESTIONS = [
  'Chay-Nasta',
  'Lunch',
  'Dinner',
  'Labour Food',
  'Petrol',
  'Travel',
];

function sanitizeName(name: string): string {
  if (!name) return '';
  // Strip any HTML/script tags and trim whitespace
  return name.replace(/<[^>]*>?/gm, '').trim();
}

export async function GET(req: Request) {
  try {
    const auth = await checkRolePermission([
      'OWNER',
      'MANAGER',
      'PARTNER',
      'SITE_SUPERVISOR',
      'SUPERVISOR',
      'ACCOUNTANT',
    ]);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;

    const { searchParams } = new URL(req.url);
    const typeParam = searchParams.get('type')?.toUpperCase(); // 'TRANSFER' or 'EXPENSE'
    const includeDeleted = searchParams.get('includeDeleted') === 'true';

    // Auto-seed default transfer reasons if empty
    if (!typeParam || typeParam === 'TRANSFER') {
      const transferCount = await prisma.purposeOption.count({
        where: { organizationId: orgId, type: 'TRANSFER' },
      });
      if (transferCount === 0) {
        await prisma.purposeOption.createMany({
          data: DEFAULT_SYSTEM_TRANSFER_REASONS.map((name) => ({
            organizationId: orgId,
            name,
            type: 'TRANSFER',
            isSystem: true,
            isActive: true,
          })),
        });
      }
    }

    // Auto-seed default expense reasons if empty
    if (!typeParam || typeParam === 'EXPENSE') {
      const expenseCount = await prisma.purposeOption.count({
        where: { organizationId: orgId, type: 'EXPENSE' },
      });
      if (expenseCount === 0) {
        await prisma.purposeOption.createMany({
          data: DEFAULT_EXPENSE_SUGGESTIONS.map((name) => ({
            organizationId: orgId,
            name,
            type: 'EXPENSE',
            isSystem: false,
            isActive: true,
          })),
        });
      }
    }

    const where: any = {
      organizationId: orgId,
    };

    if (!includeDeleted) {
      where.deletedAt = null;
      where.isActive = true;
    }

    if (typeParam === 'TRANSFER' || typeParam === 'EXPENSE') {
      where.type = typeParam;
    }

    const reasons = await prisma.purposeOption.findMany({
      where,
      orderBy: [
        { isSystem: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    return NextResponse.json({ reasons });
  } catch (error: any) {
    console.error('Error fetching reasons:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch reasons' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    // OWNER, PARTNER, MANAGER, ACCOUNTANT, SITE_SUPERVISOR can all create custom reasons
    const auth = await checkRolePermission([
      'OWNER',
      'MANAGER',
      'PARTNER',
      'SITE_SUPERVISOR',
      'SUPERVISOR',
      'ACCOUNTANT',
    ]);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;

    const body = await req.json();
    const { name, type = 'TRANSFER' } = body;

    const sanitized = sanitizeName(name);

    // Validation: 2 to 50 characters
    if (!sanitized || sanitized.length < 2 || sanitized.length > 50) {
      return NextResponse.json(
        { error: 'Reason name must be between 2 and 50 characters' },
        { status: 400 }
      );
    }

    const normalizedType = type.toUpperCase();
    if (!['TRANSFER', 'EXPENSE'].includes(normalizedType)) {
      return NextResponse.json(
        { error: 'Type must be either TRANSFER or EXPENSE' },
        { status: 400 }
      );
    }

    // Case-insensitive duplicate check within organization and type (excluding soft-deleted)
    const existingReasons = await prisma.purposeOption.findMany({
      where: {
        organizationId: orgId,
        type: normalizedType,
        deletedAt: null,
      },
    });

    const isDuplicate = existingReasons.some(
      (r) => r.name.toLowerCase() === sanitized.toLowerCase()
    );

    if (isDuplicate) {
      return NextResponse.json(
        { error: `Reason "${sanitized}" already exists` },
        { status: 400 }
      );
    }

    const created = await prisma.purposeOption.create({
      data: {
        organizationId: orgId,
        name: sanitized,
        type: normalizedType,
        isSystem: false,
        isActive: true,
        createdById: session.userId,
      },
    });

    return NextResponse.json({ reason: created }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating reason:', error);
    return NextResponse.json({ error: error.message || 'Failed to create reason' }, { status: 500 });
  }
}
