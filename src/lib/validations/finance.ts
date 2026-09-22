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
  'LABOUR',
  'MATERIAL',
  'TRANSPORT',
  'FOOD',
  'FUEL',
  'EQUIPMENT',
  'RENT',
  'ELECTRICITY',
  'MISCELLANEOUS',
  'OTHER',
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
  category: expenseCategoryEnum.default('MISCELLANEOUS'),
  description: z.string().min(2, 'Expense description is required'),
  amount: z.number().min(1, 'Amount must be greater than 0'),
  paidBy: z.string().optional(),
  paymentMethod: paymentMethodEnum.default('CASH'),
  vendorName: z.string().optional(),
  receiptUrl: z.string().optional(),
  notes: z.string().optional(),
});

export const updateExpenseSchema = createExpenseSchema.partial();

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type CreateAllowanceInput = z.infer<typeof createAllowanceSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
