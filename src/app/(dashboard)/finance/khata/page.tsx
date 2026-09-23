'use client';

import React, { Suspense } from 'react';
import KhataPage from '@/app/(dashboard)/khata/page';

export default function FinanceKhataPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading Khata Ledger...</div>}>
      <KhataPage />
    </Suspense>
  );
}
