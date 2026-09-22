import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireOrg } from '@/lib/auth/session';
import { calculateMaterialStock } from '@/lib/calculations';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;

    // 1. Fetch saved notifications
    const savedNotifications = await prisma.notification.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // 2. Generate Real-time System Alerts
    const dynamicAlerts: any[] = [];

    // Check low stock materials
    const materials = await prisma.material.findMany({
      where: { organizationId: orgId, deletedAt: null },
      include: {
        receipts: { where: { deletedAt: null }, select: { quantity: true } },
        usages: { where: { deletedAt: null }, select: { quantity: true } },
      },
    });

    materials.forEach((m) => {
      const rec = m.receipts.reduce((sum, r) => sum + r.quantity, 0);
      const used = m.usages.reduce((sum, u) => sum + u.quantity, 0);
      const stock = calculateMaterialStock({
        openingStock: m.openingStock,
        totalReceived: rec,
        totalUsed: used,
        minimumStock: m.minimumStock,
        purchaseRate: m.purchaseRate,
      });

      if (stock.isLowStock) {
        dynamicAlerts.push({
          id: `dyn-low-stock-${m.id}`,
          type: 'LOW_STOCK',
          title: `Low Stock: ${m.name}`,
          message: `Current stock of ${stock.remainingStock} ${m.unit} is at or below the safety threshold of ${m.minimumStock} ${m.unit}.`,
          link: '/materials',
          isRead: false,
          createdAt: new Date(),
        });
      }
    });

    // Check over-budget projects
    const projects = await prisma.project.findMany({
      where: { organizationId: orgId, deletedAt: null, status: 'RUNNING' },
      include: {
        attendance: { select: { wageForDay: true } },
        materialReceipts: { where: { deletedAt: null }, select: { totalCost: true } },
        expenses: { where: { deletedAt: null }, select: { amount: true } },
      },
    });

    projects.forEach((p) => {
      const labour = p.attendance.reduce((sum, a) => sum + (a.wageForDay || 0), 0);
      const mat = p.materialReceipts.reduce((sum, m) => sum + (m.totalCost || 0), 0);
      const exp = p.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      const totalCost = labour + mat + exp;

      const estBudget = p.estimatedTotalCost || (p.estimatedLabourCost + p.estimatedMaterialCost + p.estimatedOtherExpense);
      if (estBudget > 0 && totalCost > estBudget) {
        dynamicAlerts.push({
          id: `dyn-budget-${p.id}`,
          type: 'BUDGET_EXCEEDED',
          title: `Budget Exceeded: ${p.name}`,
          message: `Project spend of ₹${totalCost.toLocaleString('en-IN')} has exceeded estimated budget of ₹${estBudget.toLocaleString('en-IN')}.`,
          link: `/projects/${p.id}`,
          isRead: false,
          createdAt: new Date(),
        });
      }
    });

    const allNotifications = [...dynamicAlerts, ...savedNotifications];
    const unreadCount = allNotifications.filter((n) => !n.isRead).length;

    return NextResponse.json({
      notifications: allNotifications,
      unreadCount,
    });
  } catch (error: any) {
    console.error('Notifications GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve notifications' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;

    const body = await req.json();
    const { id, markAllAsRead } = body;

    if (markAllAsRead) {
      await prisma.notification.updateMany({
        where: { organizationId: orgId, isRead: false },
        data: { isRead: true },
      });
      return NextResponse.json({ success: true, message: 'All notifications marked as read' });
    }

    if (id && !id.startsWith('dyn-')) {
      await prisma.notification.update({
        where: { id },
        data: { isRead: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Notifications PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;

    const body = await req.json();
    const { type, title, message, link } = body;

    if (!title || !message) {
      return NextResponse.json({ error: 'Title and message are required' }, { status: 400 });
    }

    const notification = await prisma.notification.create({
      data: {
        organizationId: orgId,
        type: type || 'GENERAL',
        title,
        message,
        link: link || null,
      },
    });

    return NextResponse.json({ success: true, notification });
  } catch (error: any) {
    console.error('Notification POST error:', error);
    return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 });
  }
}
