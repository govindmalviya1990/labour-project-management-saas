import React from 'react';
import { clsx } from 'clsx';

export interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalized = status.toUpperCase().replace(/\s+/g, '_');

  const statusStyles: Record<string, string> = {
    // Project statuses
    RUNNING: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-semibold',
    COMPLETED: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 font-semibold',
    COMING_SOON: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 font-semibold',
    ENQUIRY: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30 font-semibold',
    ON_HOLD: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30 font-semibold',
    CANCELLED: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 font-semibold',

    // Attendance statuses
    PRESENT: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-semibold',
    ABSENT: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 font-semibold',
    HALF_DAY: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 font-semibold',
    LEAVE: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 font-semibold',

    // Worker statuses
    ACTIVE: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-semibold',
    INACTIVE: 'bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-400/30 font-semibold',

    // Payment statuses
    PAID: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-semibold',
    PARTIALLY_PAID: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 font-semibold',
    PENDING: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 font-semibold',
  };

  const style = statusStyles[normalized] || 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-400/30 font-semibold';

  const label = status
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border tracking-wide select-none',
        style,
        className
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-80" />
      {label}
    </span>
  );
}
