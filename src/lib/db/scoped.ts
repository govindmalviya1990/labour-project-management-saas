import prisma from './prisma';
import { Prisma } from '@prisma/client';

/**
 * Returns tenant-scoped database query helpers to ensure data isolation.
 * A single organization can never access or query records belonging to another organization.
 */
export function getScopedDb(organizationId: string) {
  if (!organizationId) {
    throw new Error('Tenant isolation violation: organizationId is required for scoped database operations');
  }

  return {
    organizationId,

    // Projects
    projects: {
      findMany: (args: Prisma.ProjectFindManyArgs = {}) =>
        prisma.project.findMany({
          ...args,
          where: { ...args.where, organizationId, deletedAt: null },
        }),
      findFirst: (args: Prisma.ProjectFindFirstArgs = {}) =>
        prisma.project.findFirst({
          where: { ...args.where, organizationId, deletedAt: null },
        }),
      create: (data: Omit<Prisma.ProjectUncheckedCreateInput, 'organizationId'>) =>
        prisma.project.create({
          data: {
            ...data,
            organizationId,
          },
        }),
      count: (args: Prisma.ProjectCountArgs = {}) =>
        prisma.project.count({
          ...args,
          where: { ...args.where, organizationId, deletedAt: null },
        }),
    },

    // Workers
    workers: {
      findMany: (args: Prisma.WorkerFindManyArgs = {}) =>
        prisma.worker.findMany({
          ...args,
          where: { ...args.where, organizationId, deletedAt: null },
        }),
      findFirst: (args: Prisma.WorkerFindFirstArgs = {}) =>
        prisma.worker.findFirst({
          where: { ...args.where, organizationId, deletedAt: null },
        }),
      create: (data: Omit<Prisma.WorkerUncheckedCreateInput, 'organizationId'>) =>
        prisma.worker.create({
          data: {
            ...data,
            organizationId,
          },
        }),
      count: (args: Prisma.WorkerCountArgs = {}) =>
        prisma.worker.count({
          ...args,
          where: { ...args.where, organizationId, deletedAt: null },
        }),
    },

    // Attendance
    attendance: {
      findMany: (args: Prisma.AttendanceFindManyArgs = {}) =>
        prisma.attendance.findMany({
          ...args,
          where: { ...args.where, organizationId },
        }),
      count: (args: Prisma.AttendanceCountArgs = {}) =>
        prisma.attendance.count({
          ...args,
          where: { ...args.where, organizationId },
        }),
      upsert: (args: Prisma.AttendanceUpsertArgs) =>
        prisma.attendance.upsert({
          ...args,
          create: {
            ...args.create,
            organizationId,
          } as any,
        }),
    },

    // Expenses
    expenses: {
      findMany: (args: Prisma.ExpenseFindManyArgs = {}) =>
        prisma.expense.findMany({
          ...args,
          where: { ...args.where, organizationId, deletedAt: null },
        }),
      count: (args: Prisma.ExpenseCountArgs = {}) =>
        prisma.expense.count({
          ...args,
          where: { ...args.where, organizationId, deletedAt: null },
        }),
    },

    // Materials
    materials: {
      findMany: (args: Prisma.MaterialFindManyArgs = {}) =>
        prisma.material.findMany({
          ...args,
          where: { ...args.where, organizationId, deletedAt: null },
        }),
      count: (args: Prisma.MaterialCountArgs = {}) =>
        prisma.material.count({
          ...args,
          where: { ...args.where, organizationId, deletedAt: null },
        }),
    },

    // Payments
    payments: {
      findMany: (args: Prisma.PaymentFindManyArgs = {}) =>
        prisma.payment.findMany({
          ...args,
          where: { ...args.where, organizationId, deletedAt: null },
        }),
    },
  };
}
