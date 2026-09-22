'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Wallet,
  Plus,
  ArrowUpRight,
  IndianRupee,
  RefreshCw,
  Building2,
  Users,
  CreditCard,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { DataTable, Column } from '@/components/ui/DataTable';
import { PaymentFormModal } from '@/components/finance/PaymentFormModal';
import { formatINR } from '@/lib/calculations';
import { clsx } from 'clsx';

export default function PaymentsPage() {
  const searchParams = useSearchParams();
  const [payments, setPayments] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({
    totalRecords: 0,
    totalPaid: 0,
    totalAdvances: 0,
    grandTotal: 0,
  });
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [paymentType, setPaymentType] = useState<'PAYMENT' | 'ADVANCE'>('PAYMENT');

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setIsModalOpen(true);
    }
  }, [searchParams]);

  const fetchPayments = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const url =
        selectedType && selectedType !== 'ALL'
          ? `/api/finance/payments?type=${selectedType}`
          : '/api/finance/payments';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load payments');
      const data = await res.json();
      setPayments(data.payments || []);
      setSummary(data.summary || {});
    } catch (err: any) {
      setError(err.message || 'Error fetching payments');
    } finally {
      setIsLoading(false);
    }
  }, [selectedType]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const typeTabs = [
    { key: 'ALL', label: 'All Disbursals' },
    { key: 'PAYMENT', label: 'Direct Payments' },
    { key: 'ADVANCE', label: 'Advances (Peshgi)' },
    { key: 'SALARY', label: 'Salary Settlements' },
  ];

  const columns: Column<any>[] = [
    {
      header: 'Date',
      cell: (item) => (
        <span className="font-mono text-xs text-slate-400">
          {new Date(item.date).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: 'Worker',
      cell: (item) => (
        <div className="text-xs">
          <Link
            href={`/workers/${item.worker?.id}`}
            className="font-semibold text-white hover:text-amber-400"
          >
            {item.worker?.name}
          </Link>
          <p className="text-slate-400 text-[11px]">
            {item.worker?.category} ({item.worker?.workerCode})
          </p>
        </div>
      ),
    },
    {
      header: 'Transaction Type',
      cell: (item) => {
        const isAdvance = item.transactionType === 'ADVANCE';
        return (
          <span
            className={clsx(
              'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border',
              isAdvance
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
            )}
          >
            {item.transactionType}
          </span>
        );
      },
    },
    {
      header: 'Method & Reference',
      cell: (item) => (
        <div className="text-xs text-slate-300">
          <span className="font-medium">{item.paymentMethod}</span>
          {item.reference && (
            <p className="text-[11px] text-slate-500 font-mono">{item.reference}</p>
          )}
        </div>
      ),
    },
    {
      header: 'Linked Project',
      cell: (item) => (
        <span className="text-xs text-slate-400">
          {item.project?.name || 'Company Direct'}
        </span>
      ),
    },
    {
      header: 'Disbursed Amount',
      className: 'text-right',
      cell: (item) => (
        <div className="text-right font-bold text-sm text-white">
          {formatINR(item.amount)}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Wallet className="w-6 h-6 text-amber-500" />
            Worker Payments & Advances
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Track wage disbursements, festival advances, and UPI/Cash transaction records
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" onClick={fetchPayments} isLoading={isLoading}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Refresh
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
            onClick={() => {
              setPaymentType('ADVANCE');
              setIsModalOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1" />
            Give Advance
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setPaymentType('PAYMENT');
              setIsModalOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Record Payment
          </Button>
        </div>
      </div>

      {/* KPI Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Total Disbursed
          </p>
          <p className="mt-1 text-2xl font-bold text-white">{formatINR(summary.grandTotal)}</p>
        </div>
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
            Wage Payments
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-400">{formatINR(summary.totalPaid)}</p>
        </div>
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl col-span-2 sm:col-span-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
            Total Advances Given
          </p>
          <p className="mt-1 text-2xl font-bold text-amber-400">{formatINR(summary.totalAdvances)}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        {typeTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setSelectedType(tab.key)}
            className={clsx(
              'px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors',
              selectedType === tab.key
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* DataTable */}
      <DataTable
        data={payments}
        columns={columns}
        keyExtractor={(p) => p.id}
        searchPlaceholder="Search worker name, reference, or project..."
        emptyTitle="No payments recorded"
        emptyDescription="Record worker payments or advances to track disbursements."
        emptyActionLabel="Record First Payment"
        onEmptyAction={() => setIsModalOpen(true)}
      />

      {/* Payment Modal */}
      <PaymentFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchPayments}
        defaultType={paymentType}
      />
    </div>
  );
}
