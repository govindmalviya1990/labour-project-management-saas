import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('--- CHECKING DATABASE INITIALIZATION ---');

  const existingOrg = await prisma.organization.findFirst();
  if (existingOrg) {
    console.log('Database already initialized with organization:', existingOrg.name);
    const quoteCount = await prisma.quotation.count({ where: { organizationId: existingOrg.id } });
    if (quoteCount === 0) {
      console.log('Seeding initial sample quotation for Modern Way Civil Solution...');
      const project = await prisma.project.findFirst({ where: { organizationId: existingOrg.id } });
      await prisma.quotation.create({
        data: {
          organizationId: existingOrg.id,
          quotationNumber: 'MWCS-QT-2026-001',
          title: 'Turnkey Residential Construction (G+1 Villa)',
          clientName: 'Shree Sai Developers & Infra',
          clientPhone: '+91 98234 56789',
          clientEmail: 'contact@shreesaiinfra.com',
          clientAddress: 'Plot 45, Golden Heights, Sector 62, Noida, UP',
          clientGst: '07AAACH7409R1ZZ',
          projectId: project?.id,
          status: 'SENT',
          templateType: 'RESIDENTIAL_CONSTRUCTION',
          formatLayout: 'MODERN',
          subtotal: 1884800,
          discountType: 'PERCENT',
          discountValue: 5,
          discountAmount: 94240,
          taxRate: 18,
          taxAmount: 322300.8,
          grandTotal: 2112860.8,
          paymentTerms: '• 20% Mobilization advance on contract signing\n• 25% Upon casting of plinth beam\n• 25% Upon ground & first floor slab casting\n• 20% Upon completion of internal/external plaster\n• 10% On final snag clearance and key handover',
          termsAndConditions: '1. Electricity and construction water provided at site by client.\n2. Work execution strictly as per approved structural engineer drawings.\n3. Defect liability period is 12 months from final handover.\n4. Subject to Gautam Buddha Nagar (Noida) jurisdiction.',
          notes: 'Includes all shuttering materials, high-strength concrete pumps, and safety scaffolding.',
          items: {
            create: [
              { itemNumber: 1, description: 'Earthwork excavation for foundation footings up to 6ft depth', unit: 'cum', quantity: 180, rate: 280, amount: 50400 },
              { itemNumber: 2, description: 'PCC 1:4:8 base bed (100mm thick) with 40mm metal', unit: 'cum', quantity: 35, rate: 4200, amount: 147000 },
              { itemNumber: 3, description: 'RCC M25 grade for column footings, plinth beams, and columns with Fe550D steel', unit: 'cum', quantity: 50, rate: 8500, amount: 425000 },
              { itemNumber: 4, description: 'RCC M25 roof slab casting with boom pump pouring and shuttering', unit: 'sq.ft.', quantity: 1800, rate: 380, amount: 684000 },
              { itemNumber: 5, description: '9" Red brick masonry in cement mortar 1:6 for external walls', unit: 'sq.ft.', quantity: 2400, rate: 145, amount: 348000 },
              { itemNumber: 6, description: '12mm smooth internal cement plaster ready for wall putty', unit: 'sq.ft.', quantity: 4800, rate: 48, amount: 230400 },
            ],
          },
        },
      });
      console.log('✔ Initial sample quotation created!');
    }
    return;
  }

  console.log('--- SEEDING REAL MULTI-TENANT TEST DATA ---');

  // Clean previous seed
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.allowance.deleteMany();
  await prisma.salaryRecord.deleteMany();
  await prisma.workRecord.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.materialTransfer.deleteMany();
  await prisma.materialUsage.deleteMany();
  await prisma.materialReceipt.deleteMany();
  await prisma.material.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.projectBudget.deleteMany();
  await prisma.projectSite.deleteMany();
  await prisma.worker.deleteMany();
  await prisma.project.deleteMany();
  await prisma.organizationUser.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Create Organization
  const org = await prisma.organization.create({
    data: {
      name: 'Modern Way Civil Solutions Pvt Ltd',
      ownerName: 'Ramesh Chandra',
      mobile: '9876543210',
      email: 'owner@modernway.com',
      address: 'Plot 45, Industrial Zone, Sector 63',
      city: 'Noida',
      state: 'Uttar Pradesh',
      country: 'India',
      gstNumber: '07AAACM1234F1Z9',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
    },
  });

  // 2. Create Users with Roles
  const owner = await prisma.user.create({
    data: {
      name: 'Ramesh Chandra (Owner)',
      email: 'owner@modernway.com',
      passwordHash,
      mobile: '9876543210',
    },
  });
  await prisma.organizationUser.create({
    data: { organizationId: org.id, userId: owner.id, role: 'OWNER' },
  });

  const manager = await prisma.user.create({
    data: {
      name: 'Vikas Sharma (Manager)',
      email: 'manager@modernway.com',
      passwordHash,
      mobile: '9876543211',
    },
  });
  await prisma.organizationUser.create({
    data: { organizationId: org.id, userId: manager.id, role: 'MANAGER' },
  });

  const supervisor = await prisma.user.create({
    data: {
      name: 'Sonu Yadav (Site Supervisor)',
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
      name: 'Priya Verma (Accountant)',
      email: 'accountant@modernway.com',
      passwordHash,
      mobile: '9876543213',
    },
  });
  await prisma.organizationUser.create({
    data: { organizationId: org.id, userId: accountant.id, role: 'ACCOUNTANT' },
  });

  // 3. Create 3 Projects (Section 65)
  const project1 = await prisma.project.create({
    data: {
      organizationId: org.id,
      projectCode: 'PRJ-001',
      name: 'Sunrise Commercial Complex',
      projectType: 'Commercial',
      status: 'RUNNING',
      location: 'Sector 62, Noida',
      clientName: 'Sunrise Infotech Ltd',
      clientMobile: '9811002233',
      projectValue: 5000000,
      estimatedLabourCost: 1000000,
      estimatedMaterialCost: 2000000,
      estimatedOtherExpense: 500000,
      estimatedTotalCost: 3500000,
      targetUnit: 'sq.ft.',
      targetQuantity: 25000,
    },
  });

  // Project Sites
  const site1A = await prisma.projectSite.create({
    data: {
      organizationId: org.id,
      projectId: project1.id,
      name: 'Tower A',
      supervisorName: 'Sonu Yadav',
      supervisorMobile: '9876543212',
    },
  });

  const site1B = await prisma.projectSite.create({
    data: {
      organizationId: org.id,
      projectId: project1.id,
      name: 'Tower B',
      supervisorName: 'Sonu Yadav',
      supervisorMobile: '9876543212',
    },
  });

  const project2 = await prisma.project.create({
    data: {
      organizationId: org.id,
      projectCode: 'PRJ-002',
      name: 'Greenfield Residential Villa',
      projectType: 'Residential',
      status: 'RUNNING',
      location: 'Knowledge Park III, Greater Noida',
      clientName: 'Anil Kapoor',
      projectValue: 2500000,
      estimatedTotalCost: 1800000,
      targetUnit: 'sq.ft.',
      targetQuantity: 12000,
    },
  });

  const project3 = await prisma.project.create({
    data: {
      organizationId: org.id,
      projectCode: 'PRJ-003',
      name: 'City Metro Junction Walkway',
      projectType: 'Infrastructure',
      status: 'COMING_SOON',
      location: 'Botanical Garden Metro',
      projectValue: 8000000,
      estimatedTotalCost: 6000000,
    },
  });

  // 4. Create 20 Workers (Section 66 Ramesh + 19 others)
  const workerRamesh = await prisma.worker.create({
    data: {
      organizationId: org.id,
      workerCode: 'WRK-001',
      name: 'Ramesh (Rajmistri)',
      mobile: '9812345678',
      category: 'Mason',
      dailyWage: 800,
      wageUnit: 'PER_DAY',
      status: 'ACTIVE',
    },
  });

  const workerCategories = [
    { name: 'Suresh Helper', cat: 'Helper', wage: 500 },
    { name: 'Mahesh Carpenter', cat: 'Carpenter', wage: 750 },
    { name: 'Dinesh Plumber', cat: 'Plumber', wage: 700 },
    { name: 'Mukesh Electrician', cat: 'Electrician', wage: 800 },
    { name: 'Ganesh Painter', cat: 'Painter', wage: 650 },
    { name: 'Naresh Flooring', cat: 'Flooring Worker', wage: 750 },
    { name: 'Raju Steel Worker', cat: 'Steel Worker', wage: 700 },
    { name: 'Deepak Helper', cat: 'Helper', wage: 500 },
    { name: 'Vinod Helper', cat: 'Helper', wage: 500 },
    { name: 'Santosh Mason', cat: 'Mason', wage: 800 },
    { name: 'Ajay Carpenter', cat: 'Carpenter', wage: 750 },
    { name: 'Vikram Steel Worker', cat: 'Steel Worker', wage: 700 },
    { name: 'Pawan Electrician', cat: 'Electrician', wage: 800 },
    { name: 'Bablu Helper', cat: 'Helper', wage: 500 },
    { name: 'Kishan Painter', cat: 'Painter', wage: 650 },
    { name: 'Radhe Flooring', cat: 'Flooring Worker', wage: 750 },
    { name: 'Manish Plumber', cat: 'Plumber', wage: 700 },
    { name: 'Rohit Helper', cat: 'Helper', wage: 500 },
    { name: 'Sunil Mason', cat: 'Mason', wage: 800 },
  ];

  const otherWorkers = [];
  for (let i = 0; i < workerCategories.length; i++) {
    const item = workerCategories[i];
    const w = await prisma.worker.create({
      data: {
        organizationId: org.id,
        workerCode: `WRK-${String(i + 2).padStart(3, '0')}`,
        name: item.name,
        category: item.cat,
        dailyWage: item.wage,
        wageUnit: 'PER_DAY',
        status: 'ACTIVE',
      },
    });
    otherWorkers.push(w);
  }

  // 5. Section 66: Ramesh Attendance (20 Present, 2 Half Day = ₹16,800)
  const today = new Date();
  for (let i = 22; i >= 1; i--) {
    const attDate = new Date();
    attDate.setDate(today.getDate() - i);
    attDate.setUTCHours(0, 0, 0, 0);

    const isHalfDay = i === 1 || i === 2; // 2 half days
    const status = isHalfDay ? 'HALF_DAY' : 'PRESENT';
    const wage = isHalfDay ? 400 : 800;

    await prisma.attendance.create({
      data: {
        organizationId: org.id,
        projectId: project1.id,
        siteId: site1A.id,
        workerId: workerRamesh.id,
        date: attDate,
        status,
        wageForDay: wage,
      },
    });
  }

  // Ramesh Allowance: ₹1,000
  await prisma.allowance.create({
    data: {
      organizationId: org.id,
      workerId: workerRamesh.id,
      projectId: project1.id,
      date: new Date(),
      type: 'FOOD',
      amount: 1000,
      description: 'Site overtime food allowance',
    },
  });

  // Ramesh Advance: ₹3,000
  await prisma.payment.create({
    data: {
      organizationId: org.id,
      workerId: workerRamesh.id,
      projectId: project1.id,
      date: new Date(),
      transactionType: 'ADVANCE',
      amount: 3000,
      paymentMethod: 'CASH',
      notes: 'Festival advance',
    },
  });

  // Ramesh Payment: ₹10,000
  await prisma.payment.create({
    data: {
      organizationId: org.id,
      workerId: workerRamesh.id,
      projectId: project1.id,
      date: new Date(),
      transactionType: 'PAYMENT',
      amount: 10000,
      paymentMethod: 'BANK',
      reference: 'NEFT992381239',
      notes: 'Partial wage settlement',
    },
  });

  // 6. Section 67: Materials & Supplier
  const supplier = await prisma.supplier.create({
    data: {
      organizationId: org.id,
      name: 'Ambuja Cements & Building Supplies',
      contactPerson: 'Mr. Agarwal',
      mobile: '9822334455',
      address: 'Transport Nagar, Noida',
    },
  });

  // Cement (Opening 100, Received 200, Used 150 -> Remaining 150 bags)
  const cement = await prisma.material.create({
    data: {
      organizationId: org.id,
      materialCode: 'MAT-001',
      name: 'Ambuja OPC 53 Grade Cement',
      category: 'Cement',
      unit: 'bags',
      openingStock: 100,
      minimumStock: 50,
      purchaseRate: 350,
      supplierId: supplier.id,
    },
  });

  await prisma.materialReceipt.create({
    data: {
      organizationId: org.id,
      materialId: cement.id,
      projectId: project1.id,
      supplierId: supplier.id,
      date: new Date(),
      quantity: 200,
      purchaseRate: 350,
      totalCost: 70000,
      invoiceNumber: 'INV-2026-081',
    },
  });

  await prisma.materialUsage.create({
    data: {
      organizationId: org.id,
      materialId: cement.id,
      projectId: project1.id,
      date: new Date(),
      quantity: 150,
      taskPurpose: 'Tower A 3rd Floor Slab Casting',
    },
  });

  // 7. Site Expenses
  await prisma.expense.create({
    data: {
      organizationId: org.id,
      projectId: project1.id,
      date: new Date(),
      category: 'FUEL',
      description: 'Diesel for Site DG Generator (100L)',
      amount: 9000,
      paidBy: 'Vikas Sharma',
      paymentMethod: 'UPI',
    },
  });

  await prisma.expense.create({
    data: {
      organizationId: org.id,
      projectId: project1.id,
      date: new Date(),
      category: 'EQUIPMENT',
      description: 'Concrete Mixer machine rental for 7 days',
      amount: 14000,
      paidBy: 'Ramesh Chandra',
      paymentMethod: 'BANK',
    },
  });

  console.log('✅ Real Database Seed Completed Successfully!');
  console.log('Test Accounts:');
  console.log('Owner:      owner@modernway.com       / password123');
  console.log('Manager:    manager@modernway.com     / password123');
  console.log('Supervisor: supervisor@modernway.com  / password123');
  console.log('Accountant: accountant@modernway.com  / password123');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
