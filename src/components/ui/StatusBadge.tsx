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
    RUNNING: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    COMPLETED: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    COMING_SOON: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    ENQUIRY: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    ON_HOLD: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    CANCELLED: 'bg-rose-500/15 text-rose-400 border-rose-500/30',

    // Attendance statuses
    PRESENT: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    ABSENT: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    HALF_DAY: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    LEAVE: 'bg-blue-500/15 text-blue-400 border-blue-500/30',

    // Worker statuses
    ACTIVE: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    INACTIVE: 'bg-slate-600/20 text-slate-400 border-slate-600/30',

    // Payment statuses
    PAID: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    PARTIALLY_PAID: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    PENDING: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  };

  const style = statusStyles[normalized] || 'bg-slate-700/30 text-slate-300 border-slate-700';

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
