import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireOrg } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const projectId = searchParams.get('projectId');

    const where: any = {
      organizationId: orgId,
    };

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (projectId && projectId !== 'ALL') {
      where.projectId = projectId;
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { quotationNumber: { contains: q, mode: 'insensitive' } },
        { title: { contains: q, mode: 'insensitive' } },
        { clientName: { contains: q, mode: 'insensitive' } },
        { clientPhone: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [quotations, allOrgQuotations] = await Promise.all([
      prisma.quotation.findMany({
        where,
        include: {
          items: {
            orderBy: { itemNumber: 'asc' },
          },
          project: {
            select: { id: true, name: true, projectCode: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.quotation.findMany({
        where: { organizationId: orgId },
        select: { id: true, status: true, grandTotal: true },
      }),
    ]);

    // Calculate executive metrics
    let totalCount = allOrgQuotations.length;
    let totalValue = 0;
    let draftCount = 0;
    let draftValue = 0;
    let sentCount = 0;
    let sentValue = 0;
    let acceptedCount = 0;
    let acceptedValue = 0;
    let rejectedCount = 0;
    let rejectedValue = 0;

    for (const q of allOrgQuotations) {
      totalValue += q.grandTotal || 0;
      if (q.status === 'DRAFT') {
        draftCount++;
        draftValue += q.grandTotal || 0;
      } else if (q.status === 'SENT') {
        sentCount++;
        sentValue += q.grandTotal || 0;
      } else if (q.status === 'ACCEPTED') {
        acceptedCount++;
        acceptedValue += q.grandTotal || 0;
      } else if (q.status === 'REJECTED') {
        rejectedCount++;
        rejectedValue += q.grandTotal || 0;
      }
    }

    const conversionRate = totalCount > 0 ? Math.round((acceptedCount / totalCount) * 100) : 0;

    return NextResponse.json({
      success: true,
      quotations,
      stats: {
        totalCount,
        totalValue,
        draftCount,
        draftValue,
        sentCount,
        sentValue,
        acceptedCount,
        acceptedValue,
        rejectedCount,
        rejectedValue,
        conversionRate,
      },
    });
  } catch (error: any) {
    console.error('Error fetching quotations:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch quotations' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireOrg();
    const orgId = session.organizationId;

    const body = await req.json();
    const {
      title,
      clientName,
      clientPhone,
      clientEmail,
      clientAddress,
      clientGst,
      projectId,
      status = 'DRAFT',
      templateType = 'RESIDENTIAL_CONSTRUCTION',
      formatLayout = 'MODERN',
      date,
      validUntil,
      discountType = 'PERCENT',
      discountValue = 0,
      taxRate = 18,
      termsAndConditions,
      paymentTerms,
      notes,
      items = [],
    } = body;

    if (!title || !clientName) {
      return NextResponse.json(
        { error: 'Quotation title and client name are required' },
        { status: 400 }
      );
    }

    // Auto-generate sequential quotation number if not provided
    let quotationNumber = body.quotationNumber?.trim();
    if (!quotationNumber) {
      const count = await prisma.quotation.count({
        where: { organizationId: orgId },
      });
      const year = new Date().getFullYear();
      quotationNumber = `MWCS-QT-${year}-${String(count + 1).padStart(3, '0')}`;
    }

    // Check duplicate quotation number in org
    const existing = await prisma.quotation.findUnique({
      where: {
        organizationId_quotationNumber: {
          organizationId: orgId,
          quotationNumber,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Quotation number "${quotationNumber}" already exists. Please choose another.` },
        { status: 409 }
      );
    }

    // Compute Item Amounts and Subtotal
    let subtotal = 0;
    const computedItems = items.map((item: any, index: number) => {
      const qty = Math.max(0, Number(item.quantity) || 0);
      const rate = Math.max(0, Number(item.rate) || 0);
      const amount = Math.round(qty * rate * 100) / 100;
      subtotal += amount;
      return {
        itemNumber: index + 1,
        description: item.description?.trim() || 'Work Item',
        unit: item.unit?.trim() || 'nos',
        quantity: qty,
        rate: rate,
        amount: amount,
        notes: item.notes || null,
      };
    });

    subtotal = Math.round(subtotal * 100) / 100;

    // Compute Discount
    const dVal = Math.max(0, Number(discountValue) || 0);
    let discountAmount = 0;
    if (discountType === 'PERCENT') {
      discountAmount = Math.round(((subtotal * dVal) / 100) * 100) / 100;
    } else {
      discountAmount = Math.min(subtotal, dVal);
    }

    const taxableAmount = Math.max(0, subtotal - discountAmount);

    // Compute Tax (GST)
    const tRate = Math.max(0, Number(taxRate) || 0);
    const taxAmount = Math.round(((taxableAmount * tRate) / 100) * 100) / 100;

    // Grand Total
    const grandTotal = Math.round((taxableAmount + taxAmount) * 100) / 100;

    // Create in Database with nested items
    const quotation = await prisma.quotation.create({
      data: {
        organizationId: orgId,
        quotationNumber,
        title,
        clientName,
        clientPhone: clientPhone || null,
        clientEmail: clientEmail || null,
        clientAddress: clientAddress || null,
        clientGst: clientGst || null,
        projectId: projectId || null,
        status,
        templateType,
        formatLayout,
        date: date ? new Date(date) : new Date(),
        validUntil: validUntil ? new Date(validUntil) : null,
        subtotal,
        discountType,
        discountValue: dVal,
        discountAmount,
        taxRate: tRate,
        taxAmount,
        grandTotal,
        termsAndConditions: termsAndConditions || null,
        paymentTerms: paymentTerms || null,
        notes: notes || null,
        items: {
          create: computedItems,
        },
      },
      include: {
        items: true,
        project: {
          select: { id: true, name: true, projectCode: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Quotation created successfully',
      quotation,
    });
  } catch (error: any) {
    console.error('Error creating quotation:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create quotation' },
      { status: 500 }
    );
  }
}
