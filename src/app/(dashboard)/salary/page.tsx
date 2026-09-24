'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Coins,
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
  Search,
  BookOpen,
  ArrowDownLeft,
  CreditCard,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PaymentFormModal } from '@/components/finance/PaymentFormModal';
import { AllowanceFormModal } from '@/components/finance/AllowanceFormModal';
import { formatINR } from '@/lib/calculations';

export default function SalaryPayrollPage() {
  const currentMonthStr = new Date().toISOString().slice(0, 7); // "YYYY-MM"

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

  const [projects, setProjects] = useState<any[]>([]);
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isAllowanceModalOpen, setIsAllowanceModalOpen] = useState(false);
  const [activeWorkerId, setActiveWorkerId] = useState<string | undefined>(undefined);
  const [paymentType, setPaymentType] = useState<'SALARY' | 'ADVANCE' | 'PAYMENT'>('SALARY');
  const [prefilledAmount, setPrefilledAmount] = useState<number | undefined>(undefined);

  // Load Projects
  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await fetch('/api/projects');
        if (res.ok) {
          const json = await res.json();
          setProjects(json.projects || []);
        }
      } catch (e) {
        console.error('Failed to load projects', e);
      }
    }
    loadProjects();
  }, []);

  // Fetch Payroll Data
  const fetchPayroll = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      let url = `/api/salary?month=${selectedMonth}`;
      if (selectedProjectId !== 'ALL') {
        url += `&projectId=${selectedProjectId}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load salary payroll sheet');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Error fetching salary sheet');
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth, selectedProjectId]);

  useEffect(() => {
    fetchPayroll();
  }, [fetchPayroll]);

  // Open Quick Pay Modal for specific worker
  const handlePayWorker = (worker: any) => {
    setActiveWorkerId(worker.id);
    setPaymentType('SALARY');
    setPrefilledAmount(worker.netPayable > 0 ? worker.netPayable : undefined);
    setIsPaymentModalOpen(true);
  };

  const handleGiveAdvance = (worker: any) => {
    setActiveWorkerId(worker.id);
    setPaymentType('ADVANCE');
    setPrefilledAmount(undefined);
    setIsPaymentModalOpen(true);
  };

  const handleAddAllowance = (worker: any) => {
    setActiveWorkerId(worker.id);
    setIsAllowanceModalOpen(true);
  };

  // Filtered workers
  const rawWorkers = data?.workers || [];
  const filteredWorkers = rawWorkers.filter((w: any) => {
    if (selectedCategory !== 'ALL' && w.category !== selectedCategory) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = w.name?.toLowerCase().includes(q);
      const matchCode = w.workerCode?.toLowerCase().includes(q);
      const matchPhone = w.mobile?.includes(q);
      if (!matchName && !matchCode && !matchPhone) return false;
    }
    return true;
  });

  // Export CSV
  const handleExportCSV = () => {
    if (!filteredWorkers.length) return;

    const headers = [
      'Worker Code',
      'Worker Name',
      'Category',
      'Daily Wage',
      'Days Worked',
      'OT Hours',
      'Wages Earned',
      'Allowances',
      'Gross Wages',
      'Advances',
      'Paid',
      'Net Payable',
      'Status',
    ];

    const rows = filteredWorkers.map((w: any) => [
      `"${w.workerCode}"`,
      `"${w.name}"`,
      `"${w.category}"`,
      w.dailyWage,
      w.daysWorked,
      w.totalOTHours,
      w.earnedWages,
      w.allowances,
      w.grossSalary,
      w.advances,
      w.payments,
      w.netPayable,
      `"${w.status}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r: any[]) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Salary_Payroll_${selectedMonth}_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Coins className="w-6 h-6 text-amber-500" />
            Worker Wage & Salary Payroll
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Monthly payroll calculation based on attendance, overtime, allowances, advances, and payouts
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={handleExportCSV} disabled={!filteredWorkers.length}>
            <Download className="w-3.5 h-3.5 mr-1 text-emerald-400" />
            Export CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="w-3.5 h-3.5 mr-1" />
            Print Payroll
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
            onClick={() => {
              setActiveWorkerId(undefined);
              setIsAllowanceModalOpen(true);
            }}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add Allowance
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setActiveWorkerId(undefined);
              setPaymentType('SALARY');
              setPrefilledAmount(undefined);
              setIsPaymentModalOpen(true);
            }}
          >
            <CreditCard className="w-4 h-4 mr-1.5" />
            Disburse Payment / Advance
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 sm:p-5 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-500" />
              Salary Month
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-amber-500 font-mono"
            />
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
                  {p.name} ({p.projectCode})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-amber-500" />
              Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">All Categories</option>
              <option value="Mason">Mason</option>
              <option value="Helper">Helper</option>
              <option value="Carpenter">Carpenter</option>
              <option value="Electrician">Electrician</option>
              <option value="Plumber">Plumber</option>
              <option value="Painter">Painter</option>
              <option value="Steel Worker">Steel Worker</option>
              <option value="Flooring Worker">Flooring Worker</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-amber-500" />
              Search Worker
            </label>
            <input
              type="text"
              placeholder="Name or worker code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      {data?.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
          <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800 text-center">
            <p className="text-[11px] text-slate-400 font-medium">Total Workers</p>
            <p className="text-lg font-bold text-white mt-1">{data.summary.totalWorkers}</p>
          </div>
          <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800 text-center">
            <p className="text-[11px] text-slate-400 font-medium">Wages Earned</p>
            <p className="text-lg font-bold text-white mt-1">{formatINR(data.summary.totalEarnedWages)}</p>
          </div>
          <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800 text-center">
            <p className="text-[11px] text-slate-400 font-medium">+ Allowances</p>
            <p className="text-lg font-bold text-emerald-400 mt-1">{formatINR(data.summary.totalAllowances)}</p>
          </div>
          <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800 text-center">
            <p className="text-[11px] text-slate-400 font-medium">- Advances (Peshgi)</p>
            <p className="text-lg font-bold text-rose-400 mt-1">{formatINR(data.summary.totalAdvances)}</p>
          </div>
          <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800 text-center">
            <p className="text-[11px] text-slate-400 font-medium">- Salary Paid</p>
            <p className="text-lg font-bold text-blue-400 mt-1">{formatINR(data.summary.totalPaid)}</p>
          </div>
          <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/30 text-center col-span-2 sm:col-span-1">
            <p className="text-[11px] text-amber-400 font-semibold uppercase">Net Outstanding</p>
            <p className="text-lg font-bold text-amber-400 mt-1">{formatINR(data.summary.totalOutstandingPayable)}</p>
          </div>
        </div>
      )}

      {/* Salary Payroll Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Worker Wage Sheet & Payout Calculation</h3>
            <p className="text-[11px] text-slate-400">
              Computed for {selectedMonth}: Gross Wages = (Days × Wage + Overtime) + Allowances
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {filteredWorkers.length} workers
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="border-b border-slate-800 bg-slate-950/60 uppercase font-semibold text-slate-400">
              <tr>
                <th className="py-3 px-4">Worker</th>
                <th className="py-3 px-3 text-center">Turnout (Days)</th>
                <th className="py-3 px-3 text-right">Earned Wages</th>
                <th className="py-3 px-3 text-right text-emerald-400">+ Allowances</th>
                <th className="py-3 px-3 text-right text-rose-400">- Advances</th>
                <th className="py-3 px-3 text-right text-blue-400">- Paid</th>
                <th className="py-3 px-3 text-right font-bold text-amber-400">Net Payable</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredWorkers.length > 0 ? (
                filteredWorkers.map((w: any) => (
                  <tr key={w.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-semibold text-white">{w.name}</p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            {w.workerCode} • {w.category} • ₹{w.dailyWage}/day
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span className="font-bold text-white">{w.daysWorked}</span>
                      {w.totalOTHours > 0 && (
                        <span className="block text-[10px] text-amber-400 font-mono">
                          +{w.totalOTHours}h OT
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right font-medium text-slate-200">
                      {formatINR(w.earnedWages)}
                    </td>

                    <td className="py-3 px-3 text-right text-emerald-400 font-medium">
                      {w.allowances > 0 ? `+${formatINR(w.allowances)}` : '—'}
                    </td>

                    <td className="py-3 px-3 text-right text-rose-400 font-medium">
                      {w.advances > 0 ? `-${formatINR(w.advances)}` : '—'}
                    </td>

                    <td className="py-3 px-3 text-right text-blue-400 font-medium">
                      {w.payments > 0 ? `-${formatINR(w.payments)}` : '—'}
                    </td>

                    <td className="py-3 px-3 text-right font-bold text-sm">
                      {w.netPayable > 0 ? (
                        <span className="text-amber-400">{formatINR(w.netPayable)}</span>
                      ) : w.advanceDue > 0 ? (
                        <span className="text-rose-400 font-mono text-[11px]">
                          Advance Due: {formatINR(w.advanceDue)}
                        </span>
                      ) : (
                        <span className="text-emerald-400">Settled (₹0)</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-center">
                      <StatusBadge status={w.status} />
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        <Button
                          size="sm"
                          variant="primary"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => handlePayWorker(w)}
                          title="Pay worker wages"
                        >
                          <Coins className="w-3 h-3 mr-1" />
                          Pay
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[11px] text-rose-400 hover:bg-rose-500/10 border-rose-500/30"
                          onClick={() => handleGiveAdvance(w)}
                          title="Record advance payment"
                        >
                          Advance
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[11px] text-emerald-400 hover:bg-emerald-500/10 border-emerald-500/30"
                          onClick={() => handleAddAllowance(w)}
                          title="Add food or travel allowance"
                        >
                          Allowance
                        </Button>
                        <Link
                          href={`/khata?workerId=${w.id}`}
                          className="inline-flex items-center justify-center h-7 px-2 text-[11px] rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                          title="View worker personal Khata ledger"
                        >
                          <BookOpen className="w-3 h-3 mr-1 text-amber-400" />
                          Khata
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm font-medium">No workers found for the selected month/filters.</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Once attendance and workers are logged, salary calculations will appear here.
                    </p>
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
        onSuccess={fetchPayroll}
        defaultWorkerId={activeWorkerId}
        defaultType={paymentType}
        initialData={prefilledAmount ? { amount: prefilledAmount, transactionType: paymentType, workerId: activeWorkerId } : undefined}
      />

      {/* Record Allowance Modal */}
      <AllowanceFormModal
        isOpen={isAllowanceModalOpen}
        onClose={() => setIsAllowanceModalOpen(false)}
        onSuccess={fetchPayroll}
        defaultWorkerId={activeWorkerId}
      />
    </div>
  );
}
