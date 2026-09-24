'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Plus,
  X,
  CalendarCheck,
  Hammer,
  Receipt,
  IndianRupee,
  PackagePlus,
  PackageMinus,
  UserPlus,
  FolderPlus,
  FileSpreadsheet,
} from 'lucide-react';
import { clsx } from 'clsx';
import { normalizeRole } from '@/lib/auth/roles';

export function FloatingActionButton({ userRole = 'OWNER' }: { userRole?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const currentRole = normalizeRole(userRole);

  // Labour role has no administrative creation actions
  if (currentRole === 'LABOUR') {
    return null;
  }

  const actions = useMemo(() => {
    if (currentRole === 'SITE_SUPERVISOR') {
      return [
        { label: 'Mark Attendance', href: '/attendance?action=new', icon: <CalendarCheck className="w-4 h-4 text-emerald-400" /> },
        { label: 'Record Work', href: '/work?action=new', icon: <Hammer className="w-4 h-4 text-blue-400" /> },
        { label: 'Material Used', href: '/materials/used?action=new', icon: <PackageMinus className="w-4 h-4 text-orange-400" /> },
        { label: 'Material Received', href: '/materials/received?action=new', icon: <PackagePlus className="w-4 h-4 text-emerald-400" /> },
      ];
    }

    if (currentRole === 'ACCOUNTANT') {
      return [
        { label: 'Record Payment', href: '/finance/payments?action=new', icon: <IndianRupee className="w-4 h-4 text-amber-400" /> },
        { label: 'Add Expense', href: '/finance/expenses?action=new', icon: <Receipt className="w-4 h-4 text-rose-400" /> },
        { label: 'New Quotation', href: '/quotations', icon: <FileSpreadsheet className="w-4 h-4 text-amber-400" /> },
      ];
    }

    // Default for OWNER / MANAGER
    return [
      { label: 'Mark Attendance', href: '/attendance?action=new', icon: <CalendarCheck className="w-4 h-4 text-emerald-400" /> },
      { label: 'Record Work', href: '/work?action=new', icon: <Hammer className="w-4 h-4 text-blue-400" /> },
      { label: 'Add Expense', href: '/finance/expenses?action=new', icon: <Receipt className="w-4 h-4 text-rose-400" /> },
      { label: 'Record Payment', href: '/finance/payments?action=new', icon: <IndianRupee className="w-4 h-4 text-amber-400" /> },
      { label: 'Material Received', href: '/materials/received?action=new', icon: <PackagePlus className="w-4 h-4 text-emerald-400" /> },
      { label: 'Material Used', href: '/materials/used?action=new', icon: <PackageMinus className="w-4 h-4 text-orange-400" /> },
      { label: 'Add Worker', href: '/workers?action=new', icon: <UserPlus className="w-4 h-4 text-indigo-400" /> },
      { label: 'Create Project', href: '/projects?action=new', icon: <FolderPlus className="w-4 h-4 text-amber-400" /> },
      { label: 'New Quotation', href: '/quotations', icon: <FileSpreadsheet className="w-4 h-4 text-amber-400" /> },
    ];
  }, [currentRole]);

  return (
    <>
      {/* Backdrop overlay when speed dial is open */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Floating Speed Dial Actions */}
      <div className="fixed bottom-20 right-4 lg:bottom-8 lg:right-8 z-50 flex flex-col items-end gap-2.5">
        {isOpen && (
          <div className="flex flex-col items-end gap-2 mb-1 animate-fade-in">
            {actions.map((act) => (
              <Link
                key={act.label}
                href={act.href}
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2.5 bg-slate-900/95 hover:bg-slate-800 text-slate-200 border border-slate-700 px-3.5 py-2 rounded-full shadow-xl transition-transform hover:scale-105 active:scale-95 text-xs font-semibold"
              >
                <span>{act.label}</span>
                <div className="p-1 rounded-full bg-slate-800">{act.icon}</div>
              </Link>
            ))}
          </div>
        )}

        {/* Main Floating Trigger Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Quick Actions"
          className={clsx(
            'flex h-14 w-14 items-center justify-center rounded-full shadow-2xl transition-transform active:scale-90 font-bold focus:outline-none focus:ring-4 focus:ring-amber-500/40',
            isOpen
              ? 'bg-slate-800 text-white border border-slate-700 rotate-90'
              : 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/30'
          )}
        >
          {isOpen ? <X className="w-6 h-6" /> : <Plus className="w-7 h-7 stroke-[2.5]" />}
        </button>
      </div>
    </>
  );
}
