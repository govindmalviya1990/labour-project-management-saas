'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FolderKanban,
  CalendarCheck,
  BookOpen,
  Menu,
  Hammer,
  Wallet,
  Receipt,
  Package,
} from 'lucide-react';
import { clsx } from 'clsx';
import { normalizeRole } from '@/lib/auth/roles';

export function MobileNav({ userRole = 'OWNER' }: { userRole?: string }) {
  const pathname = usePathname();
  const currentRole = normalizeRole(userRole);

  const getNavItems = () => {
    if (currentRole === 'LABOUR') {
      return [
        { label: 'Overview', href: '/', icon: <LayoutDashboard className="w-5 h-5" /> },
        { label: 'Attendance', href: '/attendance', icon: <CalendarCheck className="w-5 h-5" /> },
        { label: 'Wages & Khata', href: '/khata', icon: <BookOpen className="w-5 h-5" /> },
      ];
    }

    if (currentRole === 'SITE_SUPERVISOR') {
      return [
        { label: 'Dashboard', href: '/', icon: <LayoutDashboard className="w-5 h-5" /> },
        { label: 'Projects', href: '/projects', icon: <FolderKanban className="w-5 h-5" /> },
        { label: 'Attendance', href: '/attendance', icon: <CalendarCheck className="w-5 h-5" /> },
        { label: 'Work', href: '/work', icon: <Hammer className="w-5 h-5" /> },
        { label: 'Materials', href: '/materials', icon: <Package className="w-5 h-5" /> },
      ];
    }

    if (currentRole === 'ACCOUNTANT') {
      return [
        { label: 'Dashboard', href: '/', icon: <LayoutDashboard className="w-5 h-5" /> },
        { label: 'Payments', href: '/finance/payments', icon: <Wallet className="w-5 h-5" /> },
        { label: 'Expenses', href: '/finance/expenses', icon: <Receipt className="w-5 h-5" /> },
        { label: 'Khata', href: '/khata', icon: <BookOpen className="w-5 h-5" /> },
      ];
    }

    return [
      { label: 'Dashboard', href: '/', icon: <LayoutDashboard className="w-5 h-5" /> },
      { label: 'Projects', href: '/projects', icon: <FolderKanban className="w-5 h-5" /> },
      { label: 'Attendance', href: '/attendance', icon: <CalendarCheck className="w-5 h-5" /> },
      { label: 'Khata', href: '/khata', icon: <BookOpen className="w-5 h-5" /> },
      { label: 'More', href: '/settings', icon: <Menu className="w-5 h-5" /> },
    ];
  };

  const navItems = getNavItems();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 px-2 py-1.5 flex items-center justify-around shadow-lg">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.label}
            href={item.href}
            className={clsx(
              'flex flex-col items-center justify-center py-1 px-3 rounded-lg transition-colors min-w-[56px]',
              isActive ? 'text-amber-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            )}
          >
            {item.icon}
            <span className="text-[10px] mt-1 tracking-tight">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
