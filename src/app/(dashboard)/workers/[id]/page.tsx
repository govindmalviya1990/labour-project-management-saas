'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Users,
  Calendar,
  CalendarCheck,
  CalendarX,
  IndianRupee,
  ArrowLeft,
  Edit2,
  BookOpen,
  Phone,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Calculator,
  Hammer,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { MetricCard } from '@/components/ui/MetricCard';
import { Modal } from '@/components/ui/Modal';
import { WorkerFormModal } from '@/components/workers/WorkerFormModal';
import { formatINR } from '@/lib/calculations';

export default function WorkerProfilePage() {
  const params = useParams();
  const workerId = params.id as string;

  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCalcModalOpen, setIsCalcModalOpen] = useState(false);

  const fetchWorker = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/workers/${workerId}`);
      if (!res.ok) throw new Error('Failed to load worker profile');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Error fetching worker');
    } finally {
      setIsLoading(false);
    }
  }, [workerId]);

  useEffect(() => {
    fetchWorker();
  }, [fetchWorker]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-32 bg-slate-800 rounded animate-pulse" />
        <div className="h-24 bg-slate-900 border border-slate-800 rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-900 border border-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-12 text-center">
        <div className="inline-flex p-3 rounded-full bg-rose-500/10 text-rose-400 mb-3">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-white">Worker Profile Not Found</h3>
        <p className="text-xs text-slate-400 mt-1">{error}</p>
        <div className="mt-4">
          <Link href="/workers">
            <Button size="sm" variant="outline">
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Back to Workers
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const { worker, stats, balance, recentAttendance, recentWorkRecords } = data;

  return (
    <div className="space-y-6">
      {/* Top Breadcrumbs & Actions */}
      <div className="flex items-center justify-between">
        <Link
          href="/workers"
          className="inline-flex items-center text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Workers Directory
        </Link>

        <div className="flex items-center gap-2">
          <Link href={`/khata?workerId=${worker.id}`}>
            <Button size="sm" variant="outline">
              <BookOpen className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
              View Full Khata Ledger
            </Button>
          </Link>
          <Button size="sm" variant="secondary" onClick={() => setIsEditModalOpen(true)}>
            <Edit2 className="w-3.5 h-3.5 mr-1.5" />
            Edit Profile
          </Button>
        </div>
      </div>

      {/* Worker Header Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold text-xl">
              {worker.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {worker.name}
                </h1>
                <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  {worker.workerCode}
                </span>
                <StatusBadge status={worker.status} />
              </div>

              <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-400">
                <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-200 font-medium">
                  {worker.category}
                </span>
                {worker.mobile && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    {worker.mobile}
                  </span>
                )}
                {worker.fatherOrHusbandName && (
                  <span>S/O: {worker.fatherOrHusbandName}</span>
                )}
                {worker.address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    {worker.address}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 border-t sm:border-t-0 border-slate-800 pt-3 sm:pt-0">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                Daily Wage Rate
              </p>
              <p className="text-xl sm:text-2xl font-bold text-amber-400">
                {formatINR(worker.dailyWage)} <span className="text-xs text-slate-400">/ day</span>
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                Payment Status
              </p>
              <div className="mt-1">
                <StatusBadge status={balance.paymentStatus} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Ledger & Balance Overview (Prompt Section 58 & 66) */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-amber-500" />
              Khata / Ledger Balance Overview
            </h3>
            <p className="text-[11px] text-slate-400">
              Live earnings from attendance minus advances and payments
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() => setIsCalcModalOpen(true)}
          >
            <Calculator className="w-3.5 h-3.5 mr-1 text-amber-400" />
            View Calculation
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <p className="text-[11px] text-slate-400 font-medium">Earned Wage</p>
            <p className="text-base sm:text-lg font-bold text-white mt-1">
              {formatINR(stats.totalEarnedSalary)}
            </p>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <p className="text-[11px] text-slate-400 font-medium">+ Allowances</p>
            <p className="text-base sm:text-lg font-bold text-emerald-400 mt-1">
              {formatINR(stats.totalAllowances)}
            </p>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <p className="text-[11px] text-slate-400 font-medium">- Advances</p>
            <p className="text-base sm:text-lg font-bold text-rose-400 mt-1">
              {formatINR(stats.totalAdvances)}
            </p>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <p className="text-[11px] text-slate-400 font-medium">- Paid Amount</p>
            <p className="text-base sm:text-lg font-bold text-blue-400 mt-1">
              {formatINR(stats.totalDirectPayments)}
            </p>
          </div>
          <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/30 col-span-2 sm:col-span-1">
            <p className="text-[11px] text-amber-400 font-semibold uppercase">Remaining Payable</p>
            <p className="text-base sm:text-lg font-bold text-amber-400 mt-1">
              {formatINR(balance.remainingPayable)}
            </p>
          </div>
        </div>
      </div>

      {/* Attendance & Activity KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard
          title="Total Days Worked"
          value={stats.totalDaysWorked}
          subtitle="Attendance score"
          icon={<CalendarCheck className="w-5 h-5 text-emerald-400" />}
          variant="emerald"
        />
        <MetricCard
          title="Full Days Present"
          value={stats.presentDays}
          subtitle="Full day turnout"
          icon={<CheckCircle2 className="w-5 h-5 text-amber-400" />}
          variant="amber"
        />
        <MetricCard
          title="Half Days"
          value={stats.halfDays}
          subtitle="50% wage credit"
          icon={<Calendar className="w-5 h-5 text-indigo-400" />}
        />
        <MetricCard
          title="Work Output Value"
          value={formatINR(stats.totalWorkValue)}
          subtitle="Recorded task value"
          icon={<Hammer className="w-5 h-5 text-blue-400" />}
          variant="blue"
        />
      </div>

      {/* Recent Attendance Logs Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Recent Attendance Logs</h3>
          <span className="text-xs text-slate-400 font-mono">Last 10 records</span>
        </div>

        {recentAttendance?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="border-b border-slate-800 text-slate-400 uppercase font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Project / Site</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Shift / OT</th>
                  <th className="py-2.5 px-3 text-right">Day Wage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {recentAttendance.map((a: any) => (
                  <tr key={a.id} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-mono text-slate-400">
                      {new Date(a.date).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-white">
                      {a.project?.name || 'General Site'}
                      {a.site?.name && <span className="text-slate-400 text-[11px] ml-1">({a.site.name})</span>}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-400">
                      {a.shift} {a.overtimeHours > 0 ? `(${a.overtimeHours}h OT)` : ''}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-amber-400">
                      {formatINR(a.wageForDay)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-400 py-4 text-center">No attendance logged yet.</p>
        )}
      </div>

      {/* Edit Worker Modal */}
      <WorkerFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={fetchWorker}
        initialData={worker}
      />

      {/* View Calculation Modal (Prompt Section 58) */}
      <Modal
        isOpen={isCalcModalOpen}
        onClose={() => setIsCalcModalOpen(false)}
        title={`Balance Calculation: ${worker.name}`}
        description="Auditable mathematical verification of current payable balance."
      >
        <div className="space-y-4 text-xs text-slate-300">
          <div className="space-y-2 border-b border-slate-800 pb-3">
            <div className="flex justify-between">
              <span className="text-slate-400">1. Gross Salary Earned (from Attendance):</span>
              <span className="font-bold text-white">{formatINR(stats.totalEarnedSalary)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">2. Allowances (Food / Travel / Stay):</span>
              <span className="font-bold text-emerald-400">+{formatINR(stats.totalAllowances)}</span>
            </div>
            <div className="flex justify-between font-semibold border-t border-slate-800/80 pt-1.5">
              <span>Total Earnings (Credits):</span>
              <span className="text-white">{formatINR(balance.totalCredits)}</span>
            </div>
          </div>

          <div className="space-y-2 border-b border-slate-800 pb-3">
            <div className="flex justify-between">
              <span className="text-slate-400">3. Advances Received:</span>
              <span className="font-bold text-rose-400">-{formatINR(stats.totalAdvances)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">4. Direct Payments Settled:</span>
              <span className="font-bold text-rose-400">-{formatINR(stats.totalDirectPayments)}</span>
            </div>
            <div className="flex justify-between font-semibold border-t border-slate-800/80 pt-1.5">
              <span>Total Disbursed (Debits):</span>
              <span className="text-rose-400">{formatINR(balance.totalDebits)}</span>
            </div>
          </div>

          <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/30 flex justify-between items-center text-sm font-bold">
            <span className="text-amber-400">Net Remaining Payable:</span>
            <span className="text-amber-400 text-base">{formatINR(balance.remainingPayable)}</span>
          </div>

          <div className="flex justify-end pt-2">
            <Button size="sm" variant="primary" onClick={() => setIsCalcModalOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
