import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('--- CHECKING DATABASE INITIALIZATION ---');

  const existingOrg = await prisma.organization.findFirst();
  if (existingOrg) {
    console.log('Database initialized with organization:', existingOrg.name);

    // Check if legacy demo project exists
    const demoProject = await prisma.project.findFirst({
      where: {
        organizationId: existingOrg.id,
        projectCode: { in: ['PRJ-001', 'PRJ-002', 'PRJ-003'] },
      },
    });

    if (demoProject) {
      console.log('🧹 Purging legacy demo projects, workers, attendances, expenses, and materials...');
      await prisma.attendance.deleteMany({ where: { organizationId: existingOrg.id } });
      await prisma.workRecord.deleteMany({ where: { organizationId: existingOrg.id } });
      await prisma.transaction.deleteMany({ where: { organizationId: existingOrg.id } });
      await prisma.payment.deleteMany({ where: { organizationId: existingOrg.id } });
      await prisma.allowance.deleteMany({ where: { organizationId: existingOrg.id } });
      await prisma.salaryRecord.deleteMany({ where: { organizationId: existingOrg.id } });
      await prisma.expense.deleteMany({ where: { organizationId: existingOrg.id } });
      await prisma.materialTransfer.deleteMany({ where: { organizationId: existingOrg.id } });
      await prisma.materialUsage.deleteMany({ where: { organizationId: existingOrg.id } });
      await prisma.materialReceipt.deleteMany({ where: { organizationId: existingOrg.id } });
      await prisma.material.deleteMany({ where: { organizationId: existingOrg.id } });
      await prisma.supplier.deleteMany({ where: { organizationId: existingOrg.id } });
      await prisma.projectBudget.deleteMany({ where: { organizationId: existingOrg.id } });
      await prisma.projectSite.deleteMany({ where: { organizationId: existingOrg.id } });
      await prisma.worker.deleteMany({ where: { organizationId: existingOrg.id } });
      await prisma.quotationItem.deleteMany({ where: { quotation: { organizationId: existingOrg.id } } });
      await prisma.quotation.deleteMany({ where: { organizationId: existingOrg.id } });
      await prisma.project.deleteMany({ where: { organizationId: existingOrg.id } });
      await prisma.notification.deleteMany({ where: { organizationId: existingOrg.id } });
      await prisma.auditLog.deleteMany({ where: { organizationId: existingOrg.id } });
      console.log('✔ All demo data successfully cleaned! Database is fresh and blank.');
    } else {
      console.log('✔ Database is clean and ready for fresh production entries.');
    }
    return;
  }

  console.log('--- CREATING CLEAN ORGANIZATION & CORE USERS ---');

  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Create Organization
  const org = await prisma.organization.create({
    data: {
      name: 'Modern Way Civil Solutions Pvt Ltd',
      ownerName: 'Modern Way Owner',
      mobile: '9876543210',
      email: 'owner@modernway.com',
      address: 'I 04 - S G Business Hub, Opp PNB Bank Sola Road, S G Highway Gota - Ahmedabad',
      city: 'Ahmedabad',
      state: 'Gujarat',
      country: 'India',
      gstNumber: '24AAACM1234F1Z9',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
    },
  });

  // 2. Create Core Role Users
  const owner = await prisma.user.create({
    data: {
      name: 'Modern Way Owner',
      email: 'owner@modernway.com',
      passwordHash,
      mobile: '9876543210',
    },
  });
  await prisma.organizationUser.create({
    data: { organizationId: org.id, userId: owner.id, role: 'OWNER' },
  });

  const supervisor = await prisma.user.create({
    data: {
      name: 'Site Supervisor',
      email: 'supervisor@modernway.com',
      passwordHash,
      mobile: '9876543212',
    },
  });
  await prisma.organizationUser.create({
    data: { organizationId: org.id, userId: supervisor.id, role: 'SITE_SUPERVISOR' },
  });

  const accountant = await prisma.user.create({
    data: {
      name: 'Accounts Manager',
      email: 'accountant@modernway.com',
      passwordHash,
      mobile: '9876543213',
    },
  });
  await prisma.organizationUser.create({
    data: { organizationId: org.id, userId: accountant.id, role: 'ACCOUNTANT' },
  });

  console.log('✔ Clean organization & users initialized successfully!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
