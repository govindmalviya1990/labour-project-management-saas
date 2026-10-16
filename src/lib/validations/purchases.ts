import { z } from 'zod';

export const purchaseItemInputSchema = z.object({
  materialId: z.string().optional().nullable(),
  materialName: z.string().min(1, 'Material name is required'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unit: z.string().min(1, 'Unit is required'),
  rate: z.number().min(0, 'Rate cannot be negative'),
  amount: z.number().min(0, 'Amount cannot be negative'),
});

export const createPurchaseBillSchema = z.object({
  supplierId: z.string().min(1, 'Please select a supplier'),
  billDate: z.string().or(z.date()),
  billNumber: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  siteId: z.string().optional().nullable(),
  vehicleNumber: z.string().optional().nullable(),
  receivedBy: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  attachmentUrl: z.string().optional().nullable(),
  subtotal: z.number().min(0).default(0),
  gstAmount: z.number().min(0).default(0),
  transportCharges: z.number().min(0).default(0),
  discount: z.number().min(0).default(0),
  totalAmount: z.number().positive('Total amount must be greater than 0'),
  items: z.array(purchaseItemInputSchema).min(1, 'At least one item is required in the bill'),
  // Optional "Pay Now" at time of bill creation
  payNow: z
    .object({
      amount: z.number().positive('Payment amount must be greater than 0'),
      sourceType: z.enum(['PARTNER', 'BANK']),
      sourceId: z.string().min(1, 'Please select a source account'),
      method: z.string().default('CASH'),
      reference: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
});

export const updatePurchaseBillSchema = z.object({
  billDate: z.string().or(z.date()).optional(),
  billNumber: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  siteId: z.string().optional().nullable(),
  vehicleNumber: z.string().optional().nullable(),
  receivedBy: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  attachmentUrl: z.string().optional().nullable(),
  subtotal: z.number().min(0).optional(),
  gstAmount: z.number().min(0).optional(),
  transportCharges: z.number().min(0).optional(),
  discount: z.number().min(0).optional(),
  totalAmount: z.number().positive().optional(),
  items: z.array(purchaseItemInputSchema).min(1).optional(),
  editReason: z.string().optional().nullable(),
});

export const createSupplierPaymentSchema = z.object({
  supplierId: z.string().min(1, 'Please select a supplier'),
  billId: z.string().optional().nullable(), // null = on account / advance
  date: z.string().or(z.date()),
  amount: z.number().positive('Payment amount must be greater than 0'),
  method: z.string().default('CASH'),
  sourceType: z.enum(['PARTNER', 'BANK']),
  sourceId: z.string().min(1, 'Please select paying partner wallet or bank account'),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  siteId: z.string().optional().nullable(),
});

export const bulkSupplierPaymentItemSchema = z.object({
  supplierId: z.string().min(1, 'Supplier is required'),
  billId: z.string().optional().nullable(),
  amount: z.number().positive('Amount must be positive'),
  notes: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  siteId: z.string().optional().nullable(),
});

export const bulkSupplierPaymentSchema = z.object({
  sourceType: z.enum(['PARTNER', 'BANK']),
  sourceId: z.string().min(1, 'Please select source account'),
  method: z.string().default('CASH'),
  date: z.string().or(z.date()),
  items: z.array(bulkSupplierPaymentItemSchema).min(1, 'Please add at least one supplier payment to the queue'),
});

export const updateSupplierPaymentSchema = z.object({
  date: z.string().or(z.date()).optional(),
  amount: z.number().positive('Payment amount must be greater than 0').optional(),
  method: z.string().optional(),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  siteId: z.string().optional().nullable(),
  editReason: z.string().optional().nullable(),
});

export const createPurchaseReturnSchema = z.object({
  supplierId: z.string().min(1, 'Please select a supplier'),
  billId: z.string().optional().nullable(),
  returnDate: z.string().or(z.date()),
  amount: z.number().positive('Return amount must be greater than 0'),
  itemsJson: z.string().optional().nullable(),
  reason: z.string().min(1, 'Reason for return is required'),
});

export const createSupplierWithOpeningBalanceSchema = z.object({
  name: z.string().min(1, 'Supplier company / person name is required'),
  contactPerson: z.string().optional().nullable(),
  mobile: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  gstNumber: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  openingBalance: z.number().default(0), // + means we owe supplier, - means advance with supplier
  openingBalanceDate: z.string().or(z.date()).optional().nullable(),
  openingBalanceNote: z.string().optional().nullable(),
});
