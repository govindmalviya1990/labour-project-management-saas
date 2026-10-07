'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, PlusCircle, Sparkles, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function CashBookPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 sm:p-12 text-center shadow-xl">
        <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Sparkles className="w-8 h-8" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-3">
          Cash Book Module Removed
        </h1>
        <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto leading-relaxed mb-8">
          Purana Cash Book hisaab-kitaab aur interface successfully remove kar diya gaya hai.
          Naye sire se aapki marzi aur zaroorat ke mutabiq naya Cash Book banne ke liye system ready hai.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/dashboard">
            <Button className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-6 py-2.5 rounded-xl flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4" />
              <span>Go to Dashboard</span>
            </Button>
          </Link>
          <Link href="/projects">
            <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 px-6 py-2.5 rounded-xl flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              <span>View Projects</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
