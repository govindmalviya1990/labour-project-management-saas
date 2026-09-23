import React from 'react';
import { clsx } from 'clsx';

export interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  variant?: 'default' | 'amber' | 'emerald' | 'rose' | 'blue';
  isAlert?: boolean;
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon,
  variant = 'default',
  isAlert = false,
}: MetricCardProps) {
  const iconColor = {
    default: 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
    amber: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/30',
    emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30',
    rose: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/15 border-rose-200 dark:border-rose-500/30',
    blue: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/15 border-blue-200 dark:border-blue-500/30',
  };

  return (
    <div
      className={clsx(
        'relative overflow-hidden rounded-xl border p-5 shadow-sm transition-all',
        'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700',
        isAlert && 'border-amber-500/50 ring-1 ring-amber-500/30'
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
        <div className={clsx('p-3 rounded-lg border flex items-center justify-center', iconColor[variant])}>
          {icon}
        </div>
      </div>
    </div>
  );
}
