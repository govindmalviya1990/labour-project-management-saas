'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Wallet,
  Package,
  FileBarChart,
  Bell,
  Settings,
  ShieldCheck,
  ChevronDown,
  HardHat,
  FileSpreadsheet,
  CalendarCheck,
  Hammer,
  BookOpen,
  Receipt,
  UserCheck,
} from 'lucide-react';
import { clsx } from 'clsx';
import { normalizeRole } from '@/lib/auth/roles';

interface NavItem {
  title: string;
  href?: string;
  icon: React.ReactNode;
  allowedRoles?: string[];
  children?: { title: string; href: string; allowedRoles?: string[] }[];
}

export function Sidebar({
  organizationName,
  userRole = 'OWNER',
}: {
  organizationName?: string;
  userRole?: string;
}) {
  const pathname = usePathname();
  const currentRole = normalizeRole(userRole);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    Projects: true,
    Workers: true,
    Finance: true,
    Materials: false,
    Reports: false,
  });

  const toggleSection = (title: string) => {
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  // Full Navigation List with Granular Role-Based Access Controls
  const rawNavItems: NavItem[] = useMemo(() => {
    // -------------------------------------------------------------
    // LABOUR ROLE: Dedicated Personal Self-Service Menu
    // -------------------------------------------------------------
    if (currentRole === 'LABOUR') {
      return [
        {
          title: 'My Overview',
          href: '/',
          icon: <LayoutDashboard className="w-4 h-4 text-cyan-400" />,
        },
        {
          title: 'My Attendance',
          href: '/attendance',
          icon: <CalendarCheck className="w-4 h-4 text-emerald-400" />,
        },
        {
          title: 'My Wages & Ledger',
          href: '/khata',
          icon: <BookOpen className="w-4 h-4 text-amber-400" />,
        },
        {
          title: 'Digital Passbook Slip',
          href: '/worker-portal',
          icon: <HardHat className="w-4 h-4 text-cyan-400" />,
        },
      ];
    }

    // -------------------------------------------------------------
    // SUPERVISOR ROLE: Attendance & Work Records Focused
    // -------------------------------------------------------------
    if (currentRole === 'SITE_SUPERVISOR') {
      return [
        {
          title: 'Site Dashboard',
          href: '/',
          icon: <LayoutDashboard className="w-4 h-4 text-amber-400" />,
        },
        {
          title: 'Site Projects',
          href: '/projects',
          icon: <FolderKanban className="w-4 h-4 text-blue-400" />,
        },
        {
          title: 'Daily Attendance',
          href: '/attendance',
          icon: <CalendarCheck className="w-4 h-4 text-emerald-400" />,
        },
        {
          title: 'Work Progress Logs',
          href: '/work',
          icon: <Hammer className="w-4 h-4 text-indigo-400" />,
        },
        {
          title: 'Worker Passbook Lookup',
          href: '/worker-portal',
          icon: <UserCheck className="w-4 h-4 text-cyan-400" />,
        },
        {
          title: 'Materials',
          icon: <Package className="w-4 h-4 text-orange-400" />,
          children: [
            { title: 'Inventory Stock', href: '/materials' },
            { title: 'Material Received', href: '/materials/received' },
            { title: 'Material Used', href: '/materials/used' },
            { title: 'Site Transfers', href: '/materials/transfers' },
          ],
        },
        {
          title: 'Notifications',
          href: '/notifications',
          icon: <Bell className="w-4 h-4" />,
        },
      ];
    }

    // -------------------------------------------------------------
    // ACCOUNTANT ROLE: Financials, Salary, Expenses, Khata Ledger
    // -------------------------------------------------------------
    if (currentRole === 'ACCOUNTANT') {
      return [
        {
          title: 'Accounts Dashboard',
          href: '/',
          icon: <LayoutDashboard className="w-4 h-4 text-purple-400" />,
        },
        {
          title: 'Projects',
          icon: <FolderKanban className="w-4 h-4" />,
          children: [
            { title: 'All Projects', href: '/projects' },
            { title: 'Financial Matrix', href: '/projects/financials' },
          ],
        },
        {
          title: 'Workers Directory',
          icon: <Users className="w-4 h-4" />,
          children: [
            { title: 'Worker Directory', href: '/workers' },
            { title: 'Worker Passbook Portal', href: '/worker-portal' },
            { title: 'Salary & Wages', href: '/salary' },
            { title: 'Khata / Ledger', href: '/khata' },
          ],
        },
        {
          title: 'Finance & Accounts',
          icon: <Wallet className="w-4 h-4 text-emerald-400" />,
          children: [
            { title: 'Payments & Advances', href: '/finance/payments' },
            { title: 'Site Expenses', href: '/finance/expenses' },
            { title: 'Khata Ledger', href: '/finance/khata' },
          ],
        },
        {
          title: 'Quotations',
          href: '/quotations',
          icon: <FileSpreadsheet className="w-4 h-4 text-amber-400" />,
        },
        {
          title: 'Financial Reports',
          icon: <FileBarChart className="w-4 h-4" />,
          children: [
            { title: 'Daily Expense', href: '/reports/daily-expense' },
            { title: 'Weekly Expense', href: '/reports/weekly-expense' },
            { title: 'Monthly Expense', href: '/reports/monthly-expense' },
            { title: 'Salary Report', href: '/reports/salary' },
            { title: 'Khata Report', href: '/reports/khata' },
            { title: 'Project Cost', href: '/reports/project-cost' },
            { title: 'Profit / Loss', href: '/reports/profit-loss' },
          ],
        },
        {
          title: 'Notifications',
          href: '/notifications',
          icon: <Bell className="w-4 h-4" />,
        },
      ];
    }

    // -------------------------------------------------------------
    // OWNER / MANAGER: Full Unrestricted Access to All Modules
    // -------------------------------------------------------------
    return [
      {
        title: 'Dashboard',
        href: '/',
        icon: <LayoutDashboard className="w-4 h-4" />,
      },
      {
        title: 'Projects',
        icon: <FolderKanban className="w-4 h-4" />,
        children: [
          { title: 'All Projects', href: '/projects' },
          { title: 'Financial Matrix', href: '/projects/financials' },
          { title: 'Enquiry', href: '/projects?status=ENQUIRY' },
          { title: 'Coming Soon', href: '/projects?status=COMING_SOON' },
          { title: 'Running', href: '/projects?status=RUNNING' },
          { title: 'Completed', href: '/projects?status=COMPLETED' },
          { title: 'On Hold', href: '/projects?status=ON_HOLD' },
        ],
      },
      {
        title: 'Workers',
        icon: <Users className="w-4 h-4" />,
        children: [
          { title: 'All Workers', href: '/workers' },
          { title: 'Worker Passbook Portal', href: '/worker-portal' },
          { title: 'Attendance', href: '/attendance' },
          { title: 'Work Records', href: '/work' },
          { title: 'Salary', href: '/salary' },
          { title: 'Khata / Ledger', href: '/khata' },
        ],
      },
      {
        title: 'Finance',
        icon: <Wallet className="w-4 h-4" />,
        children: [
          { title: 'Payments', href: '/finance/payments' },
          { title: 'Expenses', href: '/finance/expenses' },
          { title: 'Khata Ledger', href: '/finance/khata' },
        ],
      },
      {
        title: 'Quotations',
        href: '/quotations',
        icon: <FileSpreadsheet className="w-4 h-4" />,
      },
      {
        title: 'Materials',
        icon: <Package className="w-4 h-4" />,
        children: [
          { title: 'Inventory Stock', href: '/materials' },
          { title: 'Material Received', href: '/materials/received' },
          { title: 'Material Used', href: '/materials/used' },
          { title: 'Inter-Site Transfers', href: '/materials/transfers' },
          { title: 'Suppliers', href: '/materials/suppliers' },
        ],
      },
      {
        title: 'Reports',
        icon: <FileBarChart className="w-4 h-4" />,
        children: [
          { title: 'Labour Report', href: '/reports/labour' },
          { title: 'Attendance Report', href: '/reports/attendance' },
          { title: 'Productivity Report', href: '/reports/productivity' },
          { title: 'Work Report', href: '/reports/work' },
          { title: 'Daily Expense', href: '/reports/daily-expense' },
          { title: 'Weekly Expense', href: '/reports/weekly-expense' },
          { title: 'Monthly Expense', href: '/reports/monthly-expense' },
          { title: 'Material Report', href: '/reports/material' },
          { title: 'Salary Report', href: '/reports/salary' },
          { title: 'Khata Report', href: '/reports/khata' },
          { title: 'Project Cost', href: '/reports/project-cost' },
          { title: 'Profit / Loss', href: '/reports/profit-loss' },
        ],
      },
      {
        title: 'Notifications',
        href: '/notifications',
        icon: <Bell className="w-4 h-4" />,
      },
      {
        title: 'Settings',
        href: '/settings',
        icon: <Settings className="w-4 h-4" />,
      },
      {
        title: 'Users & Roles',
        href: '/users',
        icon: <ShieldCheck className="w-4 h-4" />,
      },
    ];
  }, [currentRole]);

  // Role display styling badge
  const roleBadgeConfig = useMemo(() => {
    switch (currentRole) {
      case 'OWNER':
        return { label: 'Owner', badge: 'bg-amber-500/10 text-amber-500 border-amber-500/30' };
      case 'SITE_SUPERVISOR':
        return { label: 'Site Supervisor', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
      case 'ACCOUNTANT':
        return { label: 'Accountant', badge: 'bg-purple-500/10 text-purple-400 border-purple-500/30' };
      case 'LABOUR':
        return { label: 'Field Labour', badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' };
      default:
        return { label: currentRole, badge: 'bg-slate-500/10 text-slate-400 border-slate-500/30' };
    }
  }, [currentRole]);

  return (
    <aside className="hidden lg:flex flex-col w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 h-screen sticky top-0 overflow-y-auto select-none transition-colors">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/40">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 font-bold shadow-md shadow-amber-500/20">
          <HardHat className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight leading-snug">
            Modern Way Civil Solutions
          </h1>
          <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-500 uppercase tracking-wider">
            Waterproofing &amp; Epoxy SaaS
          </p>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {rawNavItems.map((item) => {
          if (!item.children) {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.title}
                href={item.href || '#'}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-colors',
                  isActive
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900'
                )}
              >
                {item.icon}
                <span>{item.title}</span>
              </Link>
            );
          }

          const isOpen = openSections[item.title];
          const hasActiveChild = item.children.some((c) => pathname === c.href);

          return (
            <div key={item.title} className="space-y-1">
              <button
                type="button"
                onClick={() => toggleSection(item.title)}
                className={clsx(
                  'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-colors',
                  hasActiveChild
                    ? 'text-amber-600 dark:text-amber-400 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900'
                )}
              >
                <div className="flex items-center gap-3">
                  {item.icon}
                  <span>{item.title}</span>
                </div>
                <ChevronDown
                  className={clsx('w-3.5 h-3.5 transition-transform duration-200', isOpen ? 'rotate-180' : '')}
                />
              </button>

              {isOpen && (
                <div className="pl-9 pr-2 space-y-1 border-l border-slate-200 dark:border-slate-800 ml-5">
                  {item.children.map((child) => {
                    const isChildActive = pathname === child.href;
                    return (
                      <Link
                        key={child.title}
                        href={child.href}
                        className={clsx(
                          'block px-2 py-1.5 rounded-md text-xs transition-colors',
                          isChildActive
                            ? 'font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900/60'
                        )}
                      >
                        {child.title}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Role Badge Footer */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80">
        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Access Role:</span>
          <span className={clsx('font-bold text-[10px] tracking-wider uppercase px-2 py-0.5 rounded border', roleBadgeConfig.badge)}>
            {roleBadgeConfig.label}
          </span>
        </div>
      </div>
    </aside>
  );
}
