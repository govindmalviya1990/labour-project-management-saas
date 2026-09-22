'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  BookOpen,
  IndianRupee,
  Users,
  Calendar,
  Building2,
  Printer,
  Download,
  Plus,
  ArrowUpRight,
  Calculator,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { PaymentFormModal } from '@/components/finance/PaymentFormModal';
import { AllowanceFormModal } from '@/components/finance/AllowanceFormModal';
import { formatINR } from '@/lib/calculations';
import { clsx } from 'clsx';

export default function KhataPage() {
  const searchParams = useSearchParams();
  const initialWorkerId = searchParams.get('workerId') || '';

  const [workers, setWorkers] = useState<any[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>(initialWorkerId);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL');

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isAllowanceModalOpen, setIsAllowanceModalOpen] = useState(false);
  const [isCalcModalOpen, setIsCalcModalOpen] = useState(false);
  const [paymentType, setPaymentType] = useState<'PAYMENT' | 'ADVANCE'>('PAYMENT');

  // Load workers and projects
  useEffect(() => {
    async function loadMeta() {
      try {
        const [wRes, pRes] = await Promise.all([
          fetch('/api/workers?status=ACTIVE').then((r) => r.json()),
          fetch('/api/projects?status=RUNNING').then((r) => r.json()),
        ]);
        setWorkers(wRes.workers || []);
        setProjects(pRes.projects || []);

        if (!selectedWorkerId && wRes.workers?.length > 0) {
          setSelectedWorkerId(wRes.workers[0].id);
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadMeta();
  }, [selectedWorkerId]);

  const fetchKhata = useCallback(async () => {
    if (!selectedWorkerId) return;
    setIsLoading(true);
    setError('');
    try {
      let url = `/api/finance/khata?workerId=${selectedWorkerId}`;
      if (selectedProjectId && selectedProjectId !== 'ALL') url += `&projectId=${selectedProjectId}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load Khata ledger');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Error fetching Khata');
    } finally {
      setIsLoading(false);
    }
  }, [selectedWorkerId, selectedProjectId, startDate, endDate]);

  useEffect(() => {
    fetchKhata();
  }, [fetchKhata]);

  // CSV Export
  const handleExportCSV = () => {
    if (!data || !data.ledger || data.ledger.length === 0) return;

    const headers = ['Date', 'Description', 'Project', 'Debit (Paid)', 'Credit (Earned)', 'Balance'];
    const rows = data.ledger.map((item: any) => [
      new Date(item.date).toLocaleDateString(),
      `"${item.description.replace(/"/g, '""')}"`,
      `"${(item.project || 'General').replace(/"/g, '""')}"`,
      item.debit,
      item.credit,
      item.balance,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e: any[]) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Khata_${data.worker.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print view trigger
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-amber-500" />
            Worker Khata / Personal Ledger
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Complete transaction ledger with chronological earnings, advances, and remaining balance
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={handleExportCSV} disabled={!data?.ledger?.length}>
            <Download className="w-3.5 h-3.5 mr-1 text-emerald-400" />
            Export CSV
          </Button>
          <Button size="sm" variant="outline" onClick={handlePrint}>
            <Printer className="w-3.5 h-3.5 mr-1" />
            Print Khata
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
            onClick={() => setIsAllowanceModalOpen(true)}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add Allowance
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setPaymentType('PAYMENT');
              setIsPaymentModalOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Record Payment / Advance
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 sm:p-5 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="space-y-1.5 sm:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-amber-500" />
              Select Worker
            </label>
            <select
              value={selectedWorkerId}
              onChange={(e) => setSelectedWorkerId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-amber-500 font-medium"
            >
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.category}) - {w.workerCode} | ₹{w.dailyWage}/day
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-amber-500" />
              Project Filter
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-500" />
              From Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:border-amber-500 font-mono"
            />
          </div>
        </div>
      </div>

      {/* Error or Empty State */}
      {error && (
        <div className="flex items-center gap-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Khata Summary Cards (Section 20 & 66) */}
      {data?.summary && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>{data.worker.name}</span>
                <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  {data.worker.workerCode}
                </span>
                <StatusBadge status={data.summary.paymentStatus} />
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {data.worker.category} • Rate: {formatINR(data.worker.dailyWage)}/day
              </p>
            </div>

            <Button
              size="sm"
              variant="outline"
              className="text-xs self-start sm:self-auto"
              onClick={() => setIsCalcModalOpen(true)}
            >
              <Calculator className="w-3.5 h-3.5 mr-1 text-amber-400" />
              View Calculation Breakdown
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
              <p className="text-[11px] text-slate-400 font-medium">Total Earned</p>
              <p className="text-lg font-bold text-white mt-1">
                {formatINR(data.summary.totalEarned)}
              </p>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
              <p className="text-[11px] text-slate-400 font-medium">+ Total Allowance</p>
              <p className="text-lg font-bold text-emerald-400 mt-1">
                {formatINR(data.summary.totalAllowances)}
              </p>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
              <p className="text-[11px] text-slate-400 font-medium">- Total Advance</p>
              <p className="text-lg font-bold text-rose-400 mt-1">
                {formatINR(data.summary.totalAdvances)}
              </p>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
              <p className="text-[11px] text-slate-400 font-medium">- Total Paid</p>
              <p className="text-lg font-bold text-blue-400 mt-1">
                {formatINR(data.summary.totalPaid)}
              </p>
            </div>
            <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/30 col-span-2 sm:col-span-1">
              <p className="text-[11px] text-amber-400 font-semibold uppercase">Remaining Payable</p>
              <p className="text-xl font-bold text-amber-400 mt-1">
                {formatINR(data.summary.remainingPayable)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Ledger Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Chronological Ledger Statement</h3>
            <p className="text-[11px] text-slate-400">
              Debits reduce payable balance; Credits increase earnings
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {data?.ledger?.length || 0} entries
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="border-b border-slate-800 bg-slate-950/60 uppercase font-semibold text-slate-400">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Transaction / Description</th>
                <th className="py-3 px-3">Project / Site</th>
                <th className="py-3 px-3 text-right text-rose-400">Debit (Paid)</th>
                <th className="py-3 px-3 text-right text-emerald-400">Credit (Earned)</th>
                <th className="py-3 px-4 text-right">Balance Payable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {data?.ledger?.length > 0 ? (
                data.ledger.map((item: any) => (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {new Date(item.date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-white">{item.description}</p>
                      {item.method && (
                        <p className="text-[10px] text-slate-500 uppercase">
                          Via {item.method} {item.reference ? `• ${item.reference}` : ''}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-400">
                      {item.project || 'General Site'}
                      {item.site && <span className="text-slate-500 ml-1">({item.site})</span>}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-rose-400">
                      {item.debit > 0 ? formatINR(item.debit) : '—'}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-400">
                      {item.credit > 0 ? formatINR(item.credit) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-200">
                      {formatINR(item.balance)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    No transactions recorded for this worker in the selected period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment / Advance Modal */}
      <PaymentFormModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSuccess={fetchKhata}
        defaultWorkerId={selectedWorkerId}
        defaultType={paymentType}
      />

      {/* Record Allowance Modal */}
      <AllowanceFormModal
        isOpen={isAllowanceModalOpen}
        onClose={() => setIsAllowanceModalOpen(false)}
        onSuccess={fetchKhata}
        defaultWorkerId={selectedWorkerId}
      />

      {/* View Calculation Modal */}
      {data?.summary && (
        <Modal
          isOpen={isCalcModalOpen}
          onClose={() => setIsCalcModalOpen(false)}
          title={`Khata Calculation Audit: ${data.worker.name}`}
          description="Detailed breakdown of credits and debits explaining the current remaining payable."
        >
          <div className="space-y-4 text-xs text-slate-300">
            <div className="space-y-2 border-b border-slate-800 pb-3">
              <div className="flex justify-between">
                <span className="text-slate-400">Gross Attendance Earnings:</span>
                <span className="font-bold text-white">{formatINR(data.summary.totalEarned)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Allowances Credit:</span>
                <span className="font-bold text-emerald-400">+{formatINR(data.summary.totalAllowances)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t border-slate-800/80 pt-1.5">
                <span>Total Credits (Earned):</span>
                <span className="text-white">{formatINR(data.summary.totalCredits)}</span>
              </div>
            </div>

            <div className="space-y-2 border-b border-slate-800 pb-3">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Advances (Peshgi):</span>
                <span className="font-bold text-rose-400">-{formatINR(data.summary.totalAdvances)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Direct Payments Settled:</span>
                <span className="font-bold text-rose-400">-{formatINR(data.summary.totalPaid)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t border-slate-800/80 pt-1.5">
                <span>Total Debits (Disbursed):</span>
                <span className="text-rose-400">{formatINR(data.summary.totalDebits)}</span>
              </div>
            </div>

            <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/30 flex justify-between items-center text-sm font-bold">
              <span className="text-amber-400">Remaining Payable:</span>
              <span className="text-amber-400 text-base">{formatINR(data.summary.remainingPayable)}</span>
            </div>

            <div className="flex justify-end pt-2">
              <Button size="sm" variant="primary" onClick={() => setIsCalcModalOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
