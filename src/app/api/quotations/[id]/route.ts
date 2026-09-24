import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { checkRolePermission } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;
    const { id } = params;

    const quotation = await prisma.quotation.findFirst({
      where: {
        id,
        organizationId: orgId,
      },
      include: {
        items: {
          orderBy: { itemNumber: 'asc' },
        },
        project: {
          select: {
            id: true,
            name: true,
            projectCode: true,
            location: true,
            clientName: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            ownerName: true,
            mobile: true,
            email: true,
            address: true,
            city: true,
            state: true,
            gstNumber: true,
            currency: true,
          },
        },
      },
    });

    if (!quotation) {
      return NextResponse.json(
        { error: 'Quotation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      quotation,
    });
  } catch (error: any) {
    console.error('Error fetching quotation:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch quotation' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER', 'ACCOUNTANT']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;
    const { id } = params;

    const existing = await prisma.quotation.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Quotation not found' },
        { status: 404 }
      );
    }

    const body = await req.json();
    const {
      title,
      clientName,
      clientPhone,
      clientEmail,
      clientAddress,
      clientGst,
      projectId,
      status,
      templateType,
      formatLayout,
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

    // Recalculate item amounts and subtotal
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

    // Recalculate Discount
    const dVal = Math.max(0, Number(discountValue) || 0);
    let discountAmount = 0;
    if (discountType === 'PERCENT') {
      discountAmount = Math.round(((subtotal * dVal) / 100) * 100) / 100;
    } else {
      discountAmount = Math.min(subtotal, dVal);
    }

    const taxableAmount = Math.max(0, subtotal - discountAmount);
    const tRate = Math.max(0, Number(taxRate) || 0);
    const taxAmount = Math.round(((taxableAmount * tRate) / 100) * 100) / 100;
    const grandTotal = Math.round((taxableAmount + taxAmount) * 100) / 100;

    // Use transaction to delete existing items and insert new items
    const updatedQuotation = await prisma.$transaction(async (tx) => {
      await tx.quotationItem.deleteMany({
        where: { quotationId: id },
      });

      return tx.quotation.update({
        where: { id },
        data: {
          title: title || existing.title,
          clientName: clientName || existing.clientName,
          clientPhone: clientPhone !== undefined ? clientPhone : existing.clientPhone,
          clientEmail: clientEmail !== undefined ? clientEmail : existing.clientEmail,
          clientAddress: clientAddress !== undefined ? clientAddress : existing.clientAddress,
          clientGst: clientGst !== undefined ? clientGst : existing.clientGst,
          projectId: projectId !== undefined ? projectId : existing.projectId,
          status: status || existing.status,
          templateType: templateType || existing.templateType,
          formatLayout: formatLayout || existing.formatLayout,
          date: date ? new Date(date) : existing.date,
          validUntil: validUntil ? new Date(validUntil) : existing.validUntil,
          subtotal,
          discountType,
          discountValue: dVal,
          discountAmount,
          taxRate: tRate,
          taxAmount,
          grandTotal,
          termsAndConditions: termsAndConditions !== undefined ? termsAndConditions : existing.termsAndConditions,
          paymentTerms: paymentTerms !== undefined ? paymentTerms : existing.paymentTerms,
          notes: notes !== undefined ? notes : existing.notes,
          items: {
            create: computedItems,
          },
        },
        include: {
          items: {
            orderBy: { itemNumber: 'asc' },
          },
          project: {
            select: { id: true, name: true, projectCode: true },
          },
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Quotation updated successfully',
      quotation: updatedQuotation,
    });
  } catch (error: any) {
    console.error('Error updating quotation:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update quotation' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await checkRolePermission(['OWNER', 'MANAGER']);
    if (!auth.authorized) return auth.response;
    const session = auth.session;
    const orgId = session.organizationId;
    const { id } = params;

    const existing = await prisma.quotation.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Quotation not found' },
        { status: 404 }
      );
    }

    await prisma.quotation.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Quotation deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting quotation:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to delete quotation' },
      { status: 500 }
    );
  }
}
