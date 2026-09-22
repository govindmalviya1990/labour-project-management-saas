import { z } from 'zod';

export const projectStatusEnum = z.enum([
  'ENQUIRY',
  'COMING_SOON',
  'RUNNING',
  'COMPLETED',
  'ON_HOLD',
  'CANCELLED',
]);

export const createProjectSchema = z.object({
  name: z.string().min(2, 'Project name must be at least 2 characters'),
  projectCode: z.string().min(1, 'Project code is required'),
  projectType: z.string().default('Residential'),
  status: projectStatusEnum.default('RUNNING'),
  location: z.string().optional(),
  fullAddress: z.string().optional(),
  clientName: z.string().optional(),
  clientMobile: z.string().optional(),
  clientEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  referenceSource: z.string().optional(),
  engineerName: z.string().optional(),
  engineerMobile: z.string().optional(),
  architectName: z.string().optional(),
  architectMobile: z.string().optional(),
  startDate: z.string().optional().nullable(),
  expectedCompletionDate: z.string().optional().nullable(),
  actualCompletionDate: z.string().optional().nullable(),
  projectValue: z.number().min(0, 'Project value must be positive').default(0),
  estimatedLabourCost: z.number().min(0).default(0),
  estimatedMaterialCost: z.number().min(0).default(0),
  estimatedOtherExpense: z.number().min(0).default(0),
  targetUnit: z.string().default('sq.ft.'),
  targetQuantity: z.number().min(0).default(0),
  notes: z.string().optional(),
  initialSiteName: z.string().optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

export const createSiteSchema = z.object({
  name: z.string().min(1, 'Site name is required (e.g. Tower A, Block 1)'),
  address: z.string().optional(),
  location: z.string().optional(),
  supervisorName: z.string().optional(),
  supervisorMobile: z.string().optional(),
  notes: z.string().optional(),
});

export const updateSiteSchema = createSiteSchema.partial();

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateSiteInput = z.infer<typeof createSiteSchema>;
export type UpdateSiteInput = z.infer<typeof updateSiteSchema>;
