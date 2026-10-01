import { z } from 'zod';

export const paymentTransactionTypeEnum = z.enum([
  'SALARY',
  'ADVANCE',
  'PAYMENT',
  'ADJUSTMENT',
]);

export const paymentMethodEnum = z.enum(['CASH', 'BANK', 'UPI', 'OTHER']);

export const allowanceTypeEnum = z.enum(['FOOD', 'TRAVEL', 'STAY', 'TRANSPORT', 'OTHER']);

export const expenseCategoryEnum = z.enum([
  'GOODS_PURCHASE',
  'CHAY_NASTA',
  'GROCERY_WORKER',
  'GROCERY_SELF',
  'FOOD',
  'TRAVEL_PETROL',
  'TRANSPORT',
  'LABOUR_FOOD',
  'EQUIPMENT_TOOLS',
  'RENT',
  'MOBILE_RECHARGE',
  'PERSONAL',
  'MISCELLANEOUS',
  'OTHER',
  'LABOUR',
  'MATERIAL',
  'FUEL',
  'ELECTRICITY',
]);

export const createPaymentSchema = z.object({
  workerId: z.string().min(1, 'Worker is required'),
  projectId: z.string().optional().nullable(),
  siteId: z.string().optional().nullable(),
  date: z.string().min(10, 'Valid date is required'),
  transactionType: paymentTransactionTypeEnum.default('PAYMENT'),
  amount: z.number().min(1, 'Amount must be greater than 0'),
  paymentMethod: paymentMethodEnum.default('CASH'),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export const createAllowanceSchema = z.object({
  workerId: z.string().min(1, 'Worker is required'),
  projectId: z.string().optional().nullable(),
  siteId: z.string().optional().nullable(),
  date: z.string().min(10, 'Valid date is required'),
  type: allowanceTypeEnum.default('FOOD'),
  amount: z.number().min(1, 'Amount must be greater than 0'),
  description: z.string().optional(),
});

export const createExpenseSchema = z.object({
  date: z.string().min(10, 'Valid date is required'),
  projectId: z.string().optional().nullable(),
  siteId: z.string().optional().nullable(),
  category: z.string().min(1).default('MISCELLANEOUS'),
  description: z.string().min(2, 'Expense description is required'),
  amount: z.number().min(1, 'Amount must be greater than 0'),
  paidBy: z.string().optional(),
  walletOwnerId: z.string().optional().nullable(),
  spentById: z.string().optional().nullable(),
  receiptId: z.string().optional().nullable(),
  paymentMethod: paymentMethodEnum.default('CASH'),
  vendorName: z.string().optional(),
  receiptUrl: z.string().optional(),
  notes: z.string().optional(),
});

export const updateExpenseSchema = createExpenseSchema.partial();
export const updatePaymentSchema = createPaymentSchema.partial();
export const updateAllowanceSchema = createAllowanceSchema.partial();

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;
export type CreateAllowanceInput = z.infer<typeof createAllowanceSchema>;
export type UpdateAllowanceInput = z.infer<typeof updateAllowanceSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
