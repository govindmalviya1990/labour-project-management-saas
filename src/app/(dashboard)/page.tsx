'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
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
  HardHat,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { MetricCard } from '@/components/ui/MetricCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatINR } from '@/lib/calculations';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts';

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/dashboard');
      if (!res.ok) {
        throw new Error('Failed to load dashboard metrics');
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Error loading dashboard');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-slate-800 animate-pulse rounded-lg" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-900 border border-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center">
        <div className="inline-flex p-3 rounded-full bg-rose-500/10 text-rose-400 mb-3">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-white">Dashboard Error</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">{error}</p>
        <Button size="sm" variant="outline" className="mt-4" onClick={fetchDashboardData}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Retry
        </Button>
      </div>
    );
  }

  const { summary, runningProjects, chartData, organization } = data;

  return (
    <div className="space-y-8">
      {/* Top Banner & Quick Actions Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Executive Dashboard
            </h1>
            <span className="hidden sm:inline-block text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
              Live Relational Data
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time project operations, daily labour attendance, expenses, and financial tracking for{' '}
            <span className="font-semibold text-slate-200">{organization?.name}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/attendance?action=new">
            <Button size="sm" variant="outline">
              <CalendarCheck className="w-4 h-4 mr-1.5 text-emerald-400" />
              Mark Attendance
            </Button>
          </Link>
          <Link href="/projects?action=new">
            <Button size="sm" variant="primary">
              <Plus className="w-4 h-4 mr-1.5" />
              New Project
            </Button>
          </Link>
        </div>
      </div>

      {/* 12 Key Summary Metrics Grid */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Key Performance Indicators (KPIs)
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Projects"
            value={summary.totalProjects}
            subtitle={`${summary.runningProjects} currently running`}
            icon={<FolderKanban className="w-5 h-5 text-amber-400" />}
            variant="amber"
          />

          <MetricCard
            title="Total Workers"
            value={summary.totalWorkers}
            subtitle="Registered workforce"
            icon={<Users className="w-5 h-5 text-indigo-400" />}
            variant="blue"
          />

          <MetricCard
            title="Present Today"
            value={summary.presentToday}
            subtitle="On site today"
            icon={<CalendarCheck className="w-5 h-5 text-emerald-400" />}
            variant="emerald"
          />

          <MetricCard
            title="Absent Today"
            value={summary.absentToday}
            subtitle="Marked absent"
            icon={<CalendarX className="w-5 h-5 text-rose-400" />}
            variant="rose"
          />

          <MetricCard
            title="Today's Labour Cost"
            value={formatINR(summary.todayLabourCost)}
            subtitle="Calculated from attendance"
            icon={<IndianRupee className="w-5 h-5 text-amber-400" />}
            variant="amber"
          />

          <MetricCard
            title="Today's Expense"
            value={formatINR(summary.todayExpense)}
            subtitle="Recorded site expenses"
            icon={<Receipt className="w-5 h-5 text-rose-400" />}
            variant="rose"
          />

          <MetricCard
            title="Pending Labour Payment"
            value={formatINR(summary.pendingLabourPayment)}
            subtitle="Unsettled worker balances"
            icon={<IndianRupee className="w-5 h-5 text-amber-400" />}
            variant="amber"
            isAlert={summary.pendingLabourPayment > 0}
          />

          <MetricCard
            title="Material Stock Value"
            value={formatINR(summary.materialStockValue)}
            subtitle={`${summary.lowStockCount || 0} low stock items`}
            icon={<Package className="w-5 h-5 text-emerald-400" />}
            variant="emerald"
            isAlert={summary.lowStockCount > 0}
          />

          <MetricCard
            title="Total Project Value"
            value={formatINR(summary.totalProjectValue)}
            subtitle="Cumulative contract value"
            icon={<TrendingUp className="w-5 h-5 text-blue-400" />}
            variant="blue"
          />

          <MetricCard
            title="Actual Total Cost"
            value={formatINR(summary.actualProjectCost)}
            subtitle="Labour + Material + Other"
            icon={<IndianRupee className="w-5 h-5 text-rose-400" />}
            variant="rose"
          />

          <MetricCard
            title="Actual Profit / Loss"
            value={formatINR(summary.actualProfit)}
            subtitle={`${summary.profitMargin}% profit margin`}
            icon={
              summary.actualProfit >= 0 ? (
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              ) : (
                <TrendingDown className="w-5 h-5 text-rose-400" />
              )
            }
            variant={summary.actualProfit >= 0 ? 'emerald' : 'rose'}
          />

          <MetricCard
            title="Running Projects"
            value={summary.runningProjects}
            subtitle="Active construction sites"
            icon={<HardHat className="w-5 h-5 text-amber-400" />}
            variant="amber"
          />
        </div>
      </div>

      {/* Analytics Charts (Attendance Trends & Expenses) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Trend Chart */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Daily Attendance Trend</h3>
              <p className="text-[11px] text-slate-400">Worker turnout over the past 7 days</p>
            </div>
            <span className="text-xs text-amber-400 font-medium">Past 7 Days</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="day" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                  labelStyle={{ color: '#cbd5e1' }}
                />
                <Bar dataKey="present" name="Present Workers" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Financial Labour & Expense Burn Chart */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Daily Labour & Site Expenses</h3>
              <p className="text-[11px] text-slate-400">Operational cost trend</p>
            </div>
            <span className="text-xs text-emerald-400 font-medium">Live Aggregation</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="day" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                  formatter={(value: any) => [formatINR(Number(value)), 'Amount']}
                />
                <Area type="monotone" dataKey="labourCost" name="Labour Cost" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} />
                <Area type="monotone" dataKey="expenseAmount" name="Site Expenses" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Running Projects List */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Active Running Projects</h3>
            <p className="text-[11px] text-slate-400">Current live projects and contract valuations</p>
          </div>
          <Link href="/projects" className="text-xs text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1">
            View All Projects
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {runningProjects.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Project Code</th>
                  <th className="py-2.5 px-3">Project Name</th>
                  <th className="py-2.5 px-3">Location</th>
                  <th className="py-2.5 px-3 text-right">Project Value</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {runningProjects.map((project: any) => (
                  <tr key={project.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 font-semibold text-amber-400">{project.projectCode}</td>
                    <td className="py-3 px-3 font-medium text-white">{project.name}</td>
                    <td className="py-3 px-3 text-slate-400">{project.location || 'Site office'}</td>
                    <td className="py-3 px-3 text-right font-semibold text-slate-200">
                      {formatINR(project.projectValue)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <StatusBadge status={project.status} />
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Link
                        href={`/projects/${project.id}`}
                        className="inline-flex items-center text-xs font-semibold text-amber-400 hover:text-amber-300"
                      >
                        Dashboard
                        <ArrowUpRight className="w-3 h-3 ml-0.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<FolderKanban className="w-6 h-6" />}
            title="No running projects yet"
            description="Create your first construction project to begin logging attendance, expenses, and tracking profitability."
            actionLabel="Create Project"
            actionHref="/projects?action=new"
          />
        )}
      </div>
    </div>
  );
}
