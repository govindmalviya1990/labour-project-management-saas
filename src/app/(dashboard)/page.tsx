'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  FolderKanban,
  Users,
  CalendarCheck,
  CalendarX,
  IndianRupee,
  Receipt,
  Package,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Plus,
  AlertTriangle,
  RefreshCw,
  Hammer,
  BookOpen,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Calendar,
  Filter,
  LayoutDashboard,
  Wallet,
} from 'lucide-react';
import { MetricCard } from '@/components/ui/MetricCard';
import { Button } from '@/components/ui/Button';
import { formatINR } from '@/lib/calculations';
import { PartnerHisaabSection } from '@/components/finance/PartnerHisaabSection';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const deniedParam = searchParams.get('denied');

  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState('');
  const [dashboardMode, setDashboardMode] = useState<'PARTNER_HISAAB' | 'EXECUTIVE' | 'COMBINED'>('PARTNER_HISAAB');
  const [period, setPeriod] = useState<'today' | 'weekly' | 'monthly' | 'custom' | 'all'>('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('mw_main_dashboard_view');
      if (saved === 'EXECUTIVE' || saved === 'PARTNER_HISAAB' || saved === 'COMBINED') {
        setDashboardMode(saved as any);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const handleDashboardModeChange = (mode: 'PARTNER_HISAAB' | 'EXECUTIVE' | 'COMBINED') => {
    setDashboardMode(mode);
    try {
      localStorage.setItem('mw_main_dashboard_view', mode);
    } catch (e) {
      // ignore
    }
  };

  const fetchDashboardData = useCallback(
    async (
      targetPeriod: 'today' | 'weekly' | 'monthly' | 'custom' | 'all' = period,
      targetStart: string = startDate,
      targetEnd: string = endDate,
      showUpdating = false
    ) => {
      if (showUpdating) {
        setIsUpdating(true);
      } else {
        setIsLoading(true);
      }
      setError('');
      try {
        const params = new URLSearchParams();
        if (targetPeriod) params.set('period', targetPeriod);
        if (targetPeriod === 'custom') {
          if (targetStart) params.set('startDate', targetStart);
          if (targetEnd) params.set('endDate', targetEnd);
        }
        const res = await fetch(`/api/dashboard?${params.toString()}`);
        if (!res.ok) {
          throw new Error('Failed to load dashboard metrics');
        }
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message || 'Error loading dashboard');
      } finally {
        setIsLoading(false);
        setIsUpdating(false);
      }
    },
    [period, startDate, endDate]
  );

  const handlePeriodChange = (newPeriod: 'today' | 'weekly' | 'monthly' | 'custom' | 'all') => {
    setPeriod(newPeriod);
    if (newPeriod === 'custom') {
      const today = new Date().toISOString().split('T')[0];
      const pastWeek = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
      const s = startDate || pastWeek;
      const e = endDate || today;
      if (!startDate) setStartDate(s);
      if (!endDate) setEndDate(e);
      fetchDashboardData('custom', s, e, true);
    } else {
      fetchDashboardData(newPeriod, '', '', true);
    }
  };

  const handleCustomApply = () => {
    if (startDate && endDate) {
      fetchDashboardData('custom', startDate, endDate, true);
    }
  };

  useEffect(() => {
    fetchDashboardData('today', '', '', false);
  }, []);

  const renderPeriodFilterToolbar = (summaryData: any) => (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Dashboard Period Filter
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Report View:{' '}
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                {summaryData?.periodLabel || (period === 'all' ? 'All Time' : period)}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-xl overflow-x-auto no-scrollbar scroll-smooth w-full md:w-auto">
            <button
              type="button"
              onClick={() => handlePeriodChange('today')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 whitespace-nowrap ${
                period === 'today'
                  ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handlePeriodChange('weekly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 whitespace-nowrap ${
                period === 'weekly'
                  ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Weekly
            </button>
            <button
              type="button"
              onClick={() => handlePeriodChange('monthly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 whitespace-nowrap ${
                period === 'monthly'
                  ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => handlePeriodChange('custom')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 whitespace-nowrap ${
                period === 'custom'
                  ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Custom Date
            </button>
            <button
              type="button"
              onClick={() => handlePeriodChange('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 whitespace-nowrap ${
                period === 'all'
                  ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All Time
            </button>
          </div>

          {isUpdating && (
            <span className="flex items-center gap-1.5 text-[11px] text-amber-500 font-medium px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 shrink-0">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Recalculating...
            </span>
          )}
        </div>
      </div>

      {period === 'custom' && (
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 md:flex md:items-center gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400 shrink-0">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full sm:w-auto px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400 shrink-0">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full sm:w-auto px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <Button
            size="sm"
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shrink-0 w-full sm:w-auto"
            onClick={handleCustomApply}
            disabled={!startDate || !endDate || isUpdating}
          >
            Apply Filter
          </Button>
        </div>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-lg" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-28 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="inline-flex p-3 rounded-full bg-rose-500/10 text-rose-500 mb-3">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Dashboard Error</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">{error}</p>
        <Button size="sm" variant="outline" className="mt-4" onClick={() => fetchDashboardData('today')}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Retry
        </Button>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 1: FIELD LABOUR WORKER PORTAL
  // -------------------------------------------------------------
  if (data.role === 'LABOUR') {
    const { worker, labourSummary, recentAttendance, recentPayments } = data;
    const daysWorked = (labourSummary?.presentDays || 0) + (labourSummary?.halfDays || 0) * 0.5;

    return (
      <div className="space-y-6">
        {deniedParam && (
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>Notice: As a Field Worker, your access is focused on your personal attendance and payment records.</span>
          </div>
        )}

        {/* Labour Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-cyan-950/60 to-slate-900 border border-cyan-800/40">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-xl bg-cyan-500 text-slate-950 flex items-center justify-center font-black text-lg shadow-md shadow-cyan-500/20">
              {worker?.name?.charAt(0) || 'L'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white tracking-tight">
                  {worker?.name || 'Labour Worker'}
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
                  {worker?.category || 'Worker'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Worker Code: <strong className="text-slate-200">{worker?.workerCode || 'WRK-001'}</strong> • Wage Rate: <strong className="text-emerald-400">{formatINR(worker?.dailyWage || 0)} / Day</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/attendance">
              <Button size="sm" variant="outline" className="border-cyan-700/50 text-cyan-300 hover:bg-cyan-950/50 text-xs">
                <CalendarCheck className="w-3.5 h-3.5 mr-1.5" />
                Attendance History
              </Button>
            </Link>
            <Link href="/khata">
              <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs">
                <BookOpen className="w-3.5 h-3.5 mr-1.5" />
                Full Khata Ledger
              </Button>
            </Link>
          </div>
        </div>

        {/* Labour Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
              <span>Days Worked</span>
              <CalendarCheck className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
              {daysWorked} <span className="text-xs font-normal text-slate-400">days</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {labourSummary?.presentDays || 0} Present • {labourSummary?.halfDays || 0} Half-day
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
              <span>Total Earned</span>
              <IndianRupee className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
              {formatINR(labourSummary?.totalEarned || 0)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Wages earned from attendance
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
              <span>Total Received</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
              {formatINR((labourSummary?.totalPaid || 0) + (labourSummary?.totalAdvances || 0))}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {formatINR(labourSummary?.totalPaid || 0)} Paid • {formatINR(labourSummary?.totalAdvances || 0)} Advance
            </div>
          </div>

          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 text-xs font-semibold">
              <span>Pending Dues / Balance</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">
              {formatINR(labourSummary?.remainingPayable || 0)}
            </div>
            <div className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-1 font-medium">
              Net balance payable by contractor
            </div>
          </div>
        </div>

        {/* Recent Attendance and Payments */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Attendance */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-emerald-500" />
                Recent Attendance Record
              </h2>
              <Link href="/attendance" className="text-xs text-amber-500 hover:underline">
                View all
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-950/20">
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-3">Project / Site</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-4 text-right">Wage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {recentAttendance && recentAttendance.length > 0 ? (
                    recentAttendance.map((att: any) => (
                      <tr key={att.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-4 text-slate-800 dark:text-slate-200 font-medium">
                          {new Date(att.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 truncate max-w-[140px]">
                          {att.project?.name || 'Main Site'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            att.status === 'PRESENT'
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                              : att.status === 'HALF_DAY'
                              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                          }`}>
                            {att.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-semibold text-slate-800 dark:text-slate-200">
                          {formatINR(att.wageForDay || 0)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400">
                        No recent attendance records.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Payments */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-amber-500" />
                Payments &amp; Advances Received
              </h2>
              <Link href="/khata" className="text-xs text-amber-500 hover:underline">
                View Ledger
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-950/20">
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Method</th>
                    <th className="py-2.5 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {recentPayments && recentPayments.length > 0 ? (
                    recentPayments.map((pmt: any) => (
                      <tr key={pmt.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-4 text-slate-800 dark:text-slate-200 font-medium">
                          {new Date(pmt.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            pmt.transactionType === 'ADVANCE'
                              ? 'bg-amber-500/10 text-amber-500'
                              : 'bg-emerald-500/10 text-emerald-500'
                          }`}>
                            {pmt.transactionType}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                          {pmt.paymentMethod || 'Cash'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-bold text-slate-900 dark:text-white">
                          {formatINR(pmt.amount || 0)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400">
                        No payments received yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: SITE SUPERVISOR DASHBOARD (OPERATIONAL)
  // -------------------------------------------------------------
  if (data.role === 'SITE_SUPERVISOR') {
    const { summary, runningProjects, recentWorkRecords } = data;

    return (
      <div className="space-y-6">
        {deniedParam && (
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>Notice: Financial settlement and company management are restricted to Owners and Accountants.</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Site Supervisor Dashboard
              </h1>
              <span className="text-[11px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                Field Operations
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Daily worker attendance muster, work logs, and material consumption monitoring
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/attendance?action=new">
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">
                <CalendarCheck className="w-4 h-4 mr-1.5" />
                Mark Daily Attendance
              </Button>
            </Link>
            <Link href="/work?action=new">
              <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs">
                <Hammer className="w-4 h-4 mr-1.5" />
                Record Work Log
              </Button>
            </Link>
          </div>
        </div>

        {/* Period Filter Toolbar */}
        {renderPeriodFilterToolbar(summary)}

        {/* Supervisor 4 Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Workforce"
            value={summary.totalWorkers}
            subtitle="Registered workers"
            icon={<Users className="w-5 h-5 text-indigo-400" />}
            variant="blue"
          />
          <MetricCard
            title="Present on Site"
            value={summary.presentWorkers ?? summary.presentToday}
            subtitle={`Present during ${summary.periodLabel || 'selected period'}`}
            icon={<CalendarCheck className="w-5 h-5 text-emerald-400" />}
            variant="emerald"
          />
          <MetricCard
            title="Absent Workers"
            value={summary.absentWorkers ?? summary.absentToday}
            subtitle={`Absent during ${summary.periodLabel || 'selected period'}`}
            icon={<CalendarX className="w-5 h-5 text-rose-400" />}
            variant="rose"
          />
          <MetricCard
            title="Active Sites"
            value={summary.runningProjects}
            subtitle="Running projects"
            icon={<FolderKanban className="w-5 h-5 text-amber-400" />}
            variant="amber"
          />
        </div>

        {/* Active Sites List and Recent Work Records */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-amber-500" />
              Assigned Running Projects
            </h2>
            <div className="space-y-3">
              {runningProjects && runningProjects.length > 0 ? (
                runningProjects.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{p.name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{p.projectCode} • {p.location || 'Site Location'}</p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase">
                      {p.status}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 py-6 text-center">No active projects running.</p>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
              <Hammer className="w-4 h-4 text-indigo-500" />
              Work Progress Output
            </h2>
            <div className="space-y-3">
              {recentWorkRecords && recentWorkRecords.length > 0 ? (
                recentWorkRecords.map((w: any) => (
                  <div key={w.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{w.task}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Worker: {w.worker?.name} • Site: {w.project?.name}</p>
                    </div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {w.quantity} {w.unit}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 py-6 text-center">No work recorded for this period.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 3: OWNER / MANAGER / ACCOUNTANT FULL EXECUTIVE DASHBOARD
  // -------------------------------------------------------------
  const { summary, runningProjects, chartData, organization } = data;

  return (
    <div className="space-y-8">
      {deniedParam && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>Notice: Access restricted for that module based on role permissions.</span>
        </div>
      )}

      {/* 1. Dashboard Mode Switcher Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 sm:p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shrink-0">
            <LayoutDashboard className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Select Dashboard View:
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 uppercase tracking-wider">
                Interactive
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
              Switch between Partner Cash Hisaab (Round Chart) and Projects Operations dashboards
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60 w-full md:w-auto">
          <button
            type="button"
            onClick={() => handleDashboardModeChange('PARTNER_HISAAB')}
            className={`flex items-center justify-center gap-1.5 px-2 sm:px-3.5 py-2 rounded-lg text-[11px] sm:text-xs font-bold transition-all text-center ${
              dashboardMode === 'PARTNER_HISAAB'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Partner Hisaab</span>
          </button>

          <button
            type="button"
            onClick={() => handleDashboardModeChange('EXECUTIVE')}
            className={`flex items-center justify-center gap-1.5 px-2 sm:px-3.5 py-2 rounded-lg text-[11px] sm:text-xs font-bold transition-all text-center ${
              dashboardMode === 'EXECUTIVE'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FolderKanban className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Projects</span>
          </button>

          <button
            type="button"
            onClick={() => handleDashboardModeChange('COMBINED')}
            className={`flex items-center justify-center gap-1.5 px-2 sm:px-3.5 py-2 rounded-lg text-[11px] sm:text-xs font-bold transition-all text-center ${
              dashboardMode === 'COMBINED'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">All-in-One</span>
          </button>
        </div>
      </div>

      {/* 2. Partner Hisaab Section (Shown when PARTNER_HISAAB or COMBINED is active) */}
      {(dashboardMode === 'PARTNER_HISAAB' || dashboardMode === 'COMBINED') && (
        <div className="space-y-6">
          <PartnerHisaabSection showHeaderTitle={false} />
        </div>
      )}

      {/* 3. Executive Projects Dashboard (Shown when EXECUTIVE or COMBINED is active) */}
      {(dashboardMode === 'EXECUTIVE' || dashboardMode === 'COMBINED') && (
        <div className="space-y-8 pt-2">
          {/* Top Banner & Quick Actions Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Executive Dashboard
            </h1>
            <span className="hidden sm:inline-block text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
              Live Relational Data
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time project operations, daily labour attendance, expenses, and financial tracking for{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-200">{organization?.name}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/attendance?action=new">
            <Button size="sm" variant="outline">
              <CalendarCheck className="w-4 h-4 mr-1.5 text-emerald-500" />
              Mark Attendance
            </Button>
          </Link>
          <Link href="/projects?action=new">
            <Button size="sm" variant="primary" className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold">
              <Plus className="w-4 h-4 mr-1.5" />
              New Project
            </Button>
          </Link>
        </div>
      </div>

      {/* Period Filter Toolbar */}
      {renderPeriodFilterToolbar(summary)}

      {/* 12 Key Summary Metrics Grid */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
          Key Performance Indicators (KPIs)
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Projects"
            value={summary.totalProjects}
            subtitle={`${summary.runningProjects} currently running`}
            icon={<FolderKanban className="w-5 h-5 text-amber-500" />}
            variant="amber"
          />

          <MetricCard
            title="Total Workers"
            value={summary.totalWorkers}
            subtitle="Registered workforce"
            icon={<Users className="w-5 h-5 text-indigo-500" />}
            variant="blue"
          />

          <MetricCard
            title="Present Workers"
            value={summary.presentWorkers ?? summary.presentToday}
            subtitle={`Attended during ${summary.periodLabel || 'selected period'}`}
            icon={<CalendarCheck className="w-5 h-5 text-emerald-500" />}
            variant="emerald"
          />

          <MetricCard
            title="Absent Workers"
            value={summary.absentWorkers ?? summary.absentToday}
            subtitle={`Absent during ${summary.periodLabel || 'selected period'}`}
            icon={<CalendarX className="w-5 h-5 text-rose-500" />}
            variant="rose"
          />

          <MetricCard
            title="Total Labour Cost"
            value={formatINR(summary.labourCost ?? summary.todayLabourCost)}
            subtitle={`Wages for ${summary.periodLabel || 'selected period'}`}
            icon={<IndianRupee className="w-5 h-5 text-amber-500" />}
            variant="amber"
          />

          <MetricCard
            title="Total Expenses"
            value={formatINR(summary.expenseTotal ?? summary.todayExpense)}
            subtitle={`Expenses for ${summary.periodLabel || 'selected period'}`}
            icon={<Receipt className="w-5 h-5 text-rose-500" />}
            variant="rose"
          />

          <MetricCard
            title="Pending Labour Dues"
            value={formatINR(summary.pendingLabourPayment)}
            subtitle="Unsettled wages ledger"
            icon={<IndianRupee className="w-5 h-5 text-amber-500" />}
            variant="amber"
          />

          <MetricCard
            title="Material Stock Value"
            value={formatINR(summary.materialStockValue)}
            subtitle={`${summary.lowStockCount} items below threshold`}
            icon={<Package className="w-5 h-5 text-blue-500" />}
            variant="blue"
          />

          <MetricCard
            title="Total Portfolio Value"
            value={formatINR(summary.totalProjectValue)}
            subtitle="All active contracts"
            icon={<FolderKanban className="w-5 h-5 text-amber-500" />}
            variant="amber"
          />

          <MetricCard
            title="Actual Total Cost"
            value={formatINR(summary.actualProjectCost)}
            subtitle="Labour + Material + Expense"
            icon={<Receipt className="w-5 h-5 text-rose-500" />}
            variant="rose"
          />

          <MetricCard
            title="Actual Gross Profit"
            value={formatINR(summary.actualProfit)}
            subtitle="Portfolio net margin"
            icon={
              summary.actualProfit >= 0 ? (
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              ) : (
                <TrendingDown className="w-5 h-5 text-rose-500" />
              )
            }
            variant={summary.actualProfit >= 0 ? 'emerald' : 'rose'}
          />

          <MetricCard
            title="Profit Margin"
            value={`${summary.profitMargin}%`}
            subtitle="Contract profitability"
            icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
            variant="emerald"
          />
        </div>
      </div>

      {/* Operational Trends & Active Running Projects */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-500" />
            7-Day Operational Trends (Labour &amp; Expenses)
          </h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    fontSize: '12px',
                    color: '#fff',
                  }}
                />
                <Bar dataKey="labourCost" name="Labour Cost" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenseAmount" name="Site Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-amber-500" />
                Active Running Sites
              </h2>
              <Link
                href="/projects"
                className="text-xs font-semibold text-amber-500 hover:text-amber-400 flex items-center gap-1 transition-colors"
              >
                View all <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="space-y-3">
              {runningProjects && runningProjects.length > 0 ? (
                runningProjects.map((p: any) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800"
                  >
                    <div className="truncate mr-2">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{p.name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {p.projectCode} • {p.location || 'Site Location'}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase">
                      {p.status}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 py-8 text-center">No active projects running.</p>
              )}
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
            <span className="text-xs text-slate-500">Need to start a new contract?</span>
            <Link href="/projects?action=new">
              <Button size="sm" variant="outline" className="text-xs">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Project
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )}
</div>
  );
}
