'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface AccessDeniedProps {
  title?: string;
  message?: string;
  requiredRole?: string;
  currentRole?: string;
}

export function AccessDenied({
  title = 'Access Restricted (403 Forbidden)',
  message = 'You do not have permission to view or manage this module.',
  requiredRole,
  currentRole,
}: AccessDeniedProps) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 mb-5 shadow-lg shadow-rose-500/10">
        <ShieldAlert className="w-8 h-8" />
      </div>

      <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
        {title}
      </h1>

      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2 max-w-md leading-relaxed">
        {message}
      </p>

      {(currentRole || requiredRole) && (
        <div className="flex items-center gap-3 mt-4 text-xs font-mono">
          {currentRole && (
            <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300">
              Your Role: <strong className="text-amber-500 uppercase">{currentRole}</strong>
            </span>
          )}
          {requiredRole && (
            <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300">
              Required: <strong className="text-emerald-500 uppercase">{requiredRole}</strong>
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 mt-8">
        <Link href="/">
          <Button className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs">
            <Home className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
