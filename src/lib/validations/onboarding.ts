import { z } from 'zod';

export const organizationStepSchema = z.object({
  name: z.string().min(2, 'Company name is required'),
  ownerName: z.string().min(2, 'Owner name is required'),
  mobile: z.string().min(10, 'Valid 10-digit mobile number is required'),
  email: z.string().email('Valid email address is required'),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().default('India'),
  gstNumber: z.string().optional(),
  currency: z.string().default('INR'),
  timezone: z.string().default('Asia/Kolkata'),
});

export const projectStepSchema = z.object({
  name: z.string().min(2, 'Project name is required'),
  projectCode: z.string().min(1, 'Project code is required'),
  location: z.string().optional(),
  projectValue: z.number().min(0, 'Project value cannot be negative').default(0),
  status: z.string().default('RUNNING'),
});

export const workerStepSchema = z.object({
  name: z.string().min(2, 'Worker name is required'),
  workerCode: z.string().min(1, 'Worker code is required'),
  mobile: z.string().optional(),
  category: z.string().default('Helper'),
  dailyWage: z.number().min(0, 'Daily wage cannot be negative').default(500),
});

export const attendanceStepSchema = z.object({
  date: z.string().min(10, 'Date is required'),
  status: z.enum(['PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE']).default('PRESENT'),
});

export type OrganizationStepInput = z.infer<typeof organizationStepSchema>;
export type ProjectStepInput = z.infer<typeof projectStepSchema>;
export type WorkerStepInput = z.infer<typeof workerStepSchema>;
export type AttendanceStepInput = z.infer<typeof attendanceStepSchema>;
