import { z } from 'zod';

export const workerCategoryEnum = z.enum([
  'Mason',
  'Helper',
  'Carpenter',
  'Electrician',
  'Plumber',
  'Painter',
  'Flooring Worker',
  'Steel Worker',
  'Other',
]);

export const wageUnitEnum = z.enum(['PER_DAY', 'PER_MONTH', 'PER_UNIT']);
export const attendanceStatusEnum = z.enum(['PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE']);

export const createWorkerSchema = z.object({
  workerCode: z.string().min(1, 'Worker code is required'),
  name: z.string().min(2, 'Worker name is required'),
  fatherOrHusbandName: z.string().optional(),
  mobile: z.string().optional(),
  address: z.string().optional(),
  skill: z.string().optional(),
  category: workerCategoryEnum.default('Helper'),
  dailyWage: z.number().min(0, 'Daily wage must be positive').default(500),
  wageUnit: wageUnitEnum.default('PER_DAY'),
  joiningDate: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  notes: z.string().optional(),
});

export const updateWorkerSchema = createWorkerSchema.partial();

export const attendanceItemSchema = z.object({
  workerId: z.string().min(1),
  status: attendanceStatusEnum.default('PRESENT'),
  shift: z.string().default('DAY'),
  overtimeHours: z
    .number()
    .min(0, 'Overtime hours cannot be negative')
    .max(16, 'Overtime hours cannot exceed 16 hours per day')
    .default(0),
  notes: z.string().optional(),
});

export const saveAttendanceSheetSchema = z.object({
  date: z
    .string()
    .min(10, 'Valid date is required (YYYY-MM-DD)')
    .refine(
      (val) => {
        // Enforce date <= today in IST (UTC+5:30)
        const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
        const todayIST = nowIST.toISOString().split('T')[0];
        return val <= todayIST;
      },
      {
        message: 'Attendance date cannot be in the future (IST)',
      }
    ),
  projectId: z.string().min(1, 'Project is required'),
  siteId: z.string().optional().nullable(),
  records: z.array(attendanceItemSchema),
});

export const createWorkRecordSchema = z.object({
  date: z.string().min(10, 'Valid date is required'),
  projectId: z.string().min(1, 'Project is required'),
  siteId: z.string().optional().nullable(),
  workerId: z.string().min(1, 'Worker is required'),
  task: z.string().min(2, 'Task name is required (e.g. Flooring, Brickwork)'),
  description: z.string().optional(),
  quantity: z.number().min(0, 'Quantity must be positive'),
  unit: z.string().min(1, 'Measurement unit is required (e.g. sq.ft., sq.m., meter)'),
  rate: z.number().min(0, 'Rate must be positive'),
  notes: z.string().optional(),
});

export const updateWorkRecordSchema = createWorkRecordSchema.partial();

export type CreateWorkerInput = z.infer<typeof createWorkerSchema>;
export type UpdateWorkerInput = z.infer<typeof updateWorkerSchema>;
export type SaveAttendanceSheetInput = z.infer<typeof saveAttendanceSheetSchema>;
export type CreateWorkRecordInput = z.infer<typeof createWorkRecordSchema>;
export type UpdateWorkRecordInput = z.infer<typeof updateWorkRecordSchema>;
