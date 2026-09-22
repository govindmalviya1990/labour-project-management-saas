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
    default: 'text-slate-400 bg-slate-800/80',
    amber: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
    emerald: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
    rose: 'text-rose-400 bg-rose-500/15 border-rose-500/30',
    blue: 'text-blue-400 bg-blue-500/15 border-blue-500/30',
  };

  return (
    <div
      className={clsx(
        'relative overflow-hidden rounded-xl border bg-slate-900/90 p-5 shadow-sm transition-all hover:border-slate-700',
        isAlert ? 'border-amber-500/50 ring-1 ring-amber-500/30' : 'border-slate-800'
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{title}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-white">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
        </div>
        <div className={clsx('p-3 rounded-lg border flex items-center justify-center', iconColor[variant])}>
          {icon}
        </div>
      </div>
    </div>
  );
}
