import { z } from 'zod';

export const materialCategoryEnum = z.enum([
  'Cement',
  'Sand',
  'Steel',
  'Bricks',
  'Tiles',
  'Paint',
  'Electrical',
  'Plumbing',
  'Hardware',
  'Other',
]);

export const materialUnitEnum = z.enum([
  'bags',
  'sq.ft.',
  'sq.m.',
  'kg',
  'ton',
  'brass',
  'piece',
  'meter',
  'cum',
  'other',
]);

export const createMaterialSchema = z.object({
  materialCode: z.string().min(1, 'Material code is required'),
  name: z.string().min(2, 'Material name is required'),
  category: materialCategoryEnum.default('Other'),
  unit: z.string().default('bags'),
  openingStock: z.number().min(0, 'Opening stock cannot be negative').default(0),
  minimumStock: z.number().min(0, 'Minimum stock cannot be negative').default(10),
  purchaseRate: z.number().min(0, 'Purchase rate cannot be negative').default(0),
  supplierId: z.string().optional().nullable(),
  notes: z.string().optional(),
});

export const updateMaterialSchema = createMaterialSchema.partial();

export const createSupplierSchema = z.object({
  name: z.string().min(2, 'Supplier company name is required'),
  contactPerson: z.string().optional(),
  mobile: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().optional(),
  gstNumber: z.string().optional(),
});

export const updateSupplierSchema = createSupplierSchema.partial();

export const createMaterialReceiptSchema = z.object({
  materialId: z.string().min(1, 'Material is required'),
  projectId: z.string().min(1, 'Project is required'),
  siteId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  date: z.string().min(10, 'Valid date is required'),
  quantity: z.number().min(0.01, 'Quantity must be greater than 0'),
  purchaseRate: z.number().min(0, 'Purchase rate must be non-negative'),
  invoiceNumber: z.string().optional(),
  attachmentUrl: z.string().optional(),
  notes: z.string().optional(),
});

export const createMaterialUsageSchema = z.object({
  materialId: z.string().min(1, 'Material is required'),
  projectId: z.string().min(1, 'Project is required'),
  siteId: z.string().optional().nullable(),
  date: z.string().min(10, 'Valid date is required'),
  quantity: z.number().min(0.01, 'Quantity must be greater than 0'),
  taskPurpose: z.string().min(2, 'Purpose / task description is required'),
  notes: z.string().optional(),
});

export const createMaterialTransferSchema = z.object({
  materialId: z.string().min(1, 'Material is required'),
  sourceProjectId: z.string().min(1, 'Source project is required'),
  destinationProjectId: z.string().min(1, 'Destination project is required'),
  date: z.string().min(10, 'Valid date is required'),
  quantity: z.number().min(0.01, 'Quantity must be greater than 0'),
  notes: z.string().optional(),
});

export const updateMaterialReceiptSchema = createMaterialReceiptSchema.partial();
export const updateMaterialUsageSchema = createMaterialUsageSchema.partial();

export type CreateMaterialInput = z.infer<typeof createMaterialSchema>;
export type UpdateMaterialInput = z.infer<typeof updateMaterialSchema>;
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type CreateMaterialReceiptInput = z.infer<typeof createMaterialReceiptSchema>;
export type UpdateMaterialReceiptInput = z.infer<typeof updateMaterialReceiptSchema>;
export type CreateMaterialUsageInput = z.infer<typeof createMaterialUsageSchema>;
export type UpdateMaterialUsageInput = z.infer<typeof updateMaterialUsageSchema>;
export type CreateMaterialTransferInput = z.infer<typeof createMaterialTransferSchema>;
