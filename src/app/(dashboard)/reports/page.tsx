'use client';

import React from 'react';
import Link from 'next/link';
import {
  FileBarChart,
  Users,
  CalendarCheck,
  Zap,
  Hammer,
  Calendar,
  Layers,
  Receipt,
  Package,
  IndianRupee,
  BookOpen,
  Building2,
  TrendingUp,
  ArrowRight,
  Printer,
  Download
} from 'lucide-react';

const REPORTS = [
  {
    id: 'labour',
    title: 'Labour Report',
    href: '/reports/labour',
    description: 'Worker directory, attendance totals, daily wages, earned compensation and pending khata balances.',
    icon: <Users className="w-6 h-6 text-amber-500" />,
    tag: 'HR & Workers',
  },
  {
    id: 'attendance',
    title: 'Attendance Report',
    href: '/reports/attendance',
    description: 'Daily muster roll, present/absent counts, check-in/out times, overtime hours and calculated wages.',
    icon: <CalendarCheck className="w-6 h-6 text-emerald-400" />,
    tag: 'Daily Muster',
  },
  {
    id: 'expense',
    title: 'Expense Report (खर्च रिपोर्ट)',
    href: '/reports/expense',
    description: 'Daily, Weekly, Monthly & Custom Date site expenditure with complete category-wise breakdown.',
    icon: <Receipt className="w-6 h-6 text-purple-400" />,
    tag: 'Site Expenses',
  },
  {
    id: 'material',
    title: 'Material Report',
    href: '/reports/material',
    description: 'Inventory valuation, inward deliveries (GRN), consumption logs, inter-site transfers & stock alerts.',
    icon: <Package className="w-6 h-6 text-amber-400" />,
    tag: 'Inventory',
  },
  {
    id: 'salary',
    title: 'Salary Report',
    href: '/reports/salary',
    description: 'Monthly payroll sheet, regular wages, overtime pay, food/travel allowances, advances and net payables.',
    icon: <IndianRupee className="w-6 h-6 text-emerald-400" />,
    tag: 'Payroll',
  },
  {
    id: 'khata',
    title: 'Khata Report',
    href: '/reports/khata',
    description: 'Master worker ledger statement: previous balance, credits (salary+allowance), debits (advance+payment).',
    icon: <BookOpen className="w-6 h-6 text-sky-400" />,
    tag: 'Ledger',
  },
];

export default function ReportsHubPage() {
  return (
    <div className="space-y-6 pb-20">
      <div>
        <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2.5">
          <FileBarChart className="w-7 h-7 text-amber-500" />
          Construction Reports & Export Center
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Access verified operational, payroll, material, and site expense audit reports with 1-click Print/PDF and CSV downloads
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORTS.map((rep) => (
          <Link
            key={rep.id}
            href={rep.href}
            className="group block bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-xl p-5 transition duration-200 hover:shadow-lg hover:shadow-amber-500/5"
          >
            <div className="flex items-start justify-between">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 group-hover:border-amber-500/30 transition">
                {rep.icon}
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                {rep.tag}
              </span>
            </div>

            <h2 className="text-base font-bold text-slate-100 group-hover:text-amber-400 transition mt-4">
              {rep.title}
            </h2>

            <p className="text-xs text-slate-400 line-clamp-2 mt-1.5 leading-relaxed">
              {rep.description}
            </p>

            <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-800/80 text-xs font-semibold text-amber-500 group-hover:text-amber-400">
              <span>View & Export Report</span>
              <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
