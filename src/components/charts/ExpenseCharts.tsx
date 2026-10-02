'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  PieChart as PieIcon,
  BarChart3,
  Calendar,
  Filter,
  Users,
  Building,
  RefreshCw,
  Receipt,
  Layers,
} from 'lucide-react';
import { formatINR } from '@/lib/calculations';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';

interface CategoryItem {
  category: string;
  rawCategory: string;
  amount: number;
  count: number;
  percentage: number;
  color: string;
}

interface PartnerItem {
  partnerId: string;
  partnerName: string;
  amount: number;
  count: number;
  percentage: number;
  color: string;
}

interface AnalyticsData {
  totalAmount: number;
  totalCount: number;
  byCategory: CategoryItem[];
  byPartner: PartnerItem[];
  filters: {
    dateRange: string;
    startDate: string;
    endDate: string;
    partnerId: string;
    projectId: string;
  };
  partners: { id: string; name: string }[];
  projects: { id: string; name: string; projectCode: string }[];
  isOwnerOrManager: boolean;
}

interface ExpenseChartsProps {
  title?: string;
  subtitle?: string;
  initialDateRange?: 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM';
  onRefreshNeeded?: () => void;
}

export function ExpenseCharts({
  title = 'Expense Analytics & Breakdown',
  subtitle = 'Category & Partner distribution (Single source of truth)',
  initialDateRange = 'THIS_MONTH',
}: ExpenseChartsProps) {
  const [dateRange, setDateRange] = useState<'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM'>(
    initialDateRange
  );
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('ALL');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL');
  const [barChartMode, setBarChartMode] = useState<'PARTNER' | 'CATEGORY'>('PARTNER');

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('dateRange', dateRange);
      if (dateRange === 'CUSTOM') {
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
      }
      if (selectedPartnerId) params.append('partnerId', selectedPartnerId);
      if (selectedProjectId) params.append('projectId', selectedProjectId);

      const res = await fetch(`/api/finance/expenses/analytics?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to load expense analytics');
      }
      const json = await res.json();
      setData(json);
      if (!startDate && json.filters?.startDate) setStartDate(json.filters.startDate);
      if (!endDate && json.filters?.endDate) setEndDate(json.filters.endDate);
    } catch (err: any) {
      setError(err.message || 'Error loading expense analytics');
    } finally {
      setLoading(false);
    }
  }, [dateRange, startDate, endDate, selectedPartnerId, selectedProjectId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const hasData = (data?.totalAmount ?? 0) > 0 && (data?.byCategory.length ?? 0) > 0;

  // Custom Donut Tooltip
  const DonutTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const p = payload[0].payload;
      return (
        <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-xl shadow-xl text-white text-xs">
          <div className="font-bold flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
            {p.category}
          </div>
          <div className="mt-1 text-slate-300">
            Amount: <span className="font-bold text-amber-400">{formatINR(p.amount)}</span>
          </div>
          <div className="text-[11px] text-slate-400">
            Share: <span className="font-semibold text-emerald-400">{p.percentage}%</span> ({p.count} entries)
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom Bar Tooltip
  const BarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const p = payload[0].payload;
      const label = barChartMode === 'PARTNER' ? p.partnerName : p.category;
      return (
        <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-xl shadow-xl text-white text-xs">
          <div className="font-bold">{label}</div>
          <div className="mt-1 text-slate-300">
            Expense: <span className="font-bold text-amber-400">{formatINR(p.amount)}</span>
          </div>
          <div className="text-[11px] text-slate-400">
            Share: <span className="font-semibold text-emerald-400">{p.percentage}%</span> ({p.count} entries)
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
      {/* Header & Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20">
              <PieIcon className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              {title}
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20">
              Round + Pillar
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {subtitle}
          </p>
        </div>

        {/* Total Expense Display Badge */}
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-right">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Filtered Total Expense
            </span>
            <span className="text-base sm:text-lg font-extrabold text-rose-600 dark:text-rose-400">
              {formatINR(data?.totalAmount || 0)}
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchAnalytics}
            className="h-9 px-2.5 text-xs"
            title="Refresh Charts"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5 pt-1">
        {/* Date Filter Buttons */}
        <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-800 p-0.5 bg-slate-50 dark:bg-slate-950">
          <button
            type="button"
            onClick={() => setDateRange('TODAY')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              dateRange === 'TODAY'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Aaj
          </button>
          <button
            type="button"
            onClick={() => setDateRange('THIS_WEEK')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              dateRange === 'THIS_WEEK'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Is Hafta
          </button>
          <button
            type="button"
            onClick={() => setDateRange('THIS_MONTH')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              dateRange === 'THIS_MONTH'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Is Mahina
          </button>
          <button
            type="button"
            onClick={() => setDateRange('CUSTOM')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              dateRange === 'CUSTOM'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Custom
          </button>
        </div>

        {/* Custom Date Range Inputs */}
        {dateRange === 'CUSTOM' && (
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-1 text-xs">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent px-2 py-0.5 font-semibold text-slate-800 dark:text-slate-200 focus:outline-none"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent px-2 py-0.5 font-semibold text-slate-800 dark:text-slate-200 focus:outline-none"
            />
          </div>
        )}

        {/* Partner Filter Dropdown (Owner/Manager view) */}
        {data?.isOwnerOrManager && (data?.partners?.length ?? 0) > 0 && (
          <div className="flex items-center">
            <select
              value={selectedPartnerId}
              onChange={(e) => setSelectedPartnerId(e.target.value)}
              className="h-8 px-2.5 text-xs font-semibold rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">👥 Sab Partners (All)</option>
              {data.partners.map((p) => (
                <option key={p.id} value={p.id}>
                  👤 {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Project Filter Dropdown */}
        {(data?.projects?.length ?? 0) > 0 && (
          <div className="flex items-center">
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="h-8 px-2.5 text-xs font-semibold rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500 max-w-[180px] truncate"
            >
              <option value="ALL">🏗️ Sab Projects (All)</option>
              {data?.projects?.map((pr) => (
                <option key={pr.id} value={pr.id}>
                  {pr.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Main Charts Area */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400 text-xs">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" />
          Loading expense charts...
        </div>
      ) : !hasData ? (
        <EmptyState
          icon={<Receipt className="w-6 h-6" />}
          title="Is Samay Ke Liye Koi Expense Record Nahi Mila"
          description="Chune gaye filters ya date range mein koi expense entry darj nahi hai. Nayee entry karne ke baad charts automatically update ho jayenge."
        />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* 1. Round Donut Chart: Category-wise Expense */}
            <div className="lg:col-span-6 p-4 rounded-xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <PieIcon className="w-4 h-4 text-amber-500" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Category-wise Expense (Round Donut)
                  </h3>
                </div>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {data?.byCategory.length || 0} categories
                </span>
              </div>

              {/* Donut Chart Canvas */}
              <div className="h-56 sm:h-64 w-full relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip content={<DonutTooltip />} />
                    <Pie
                      data={data?.byCategory}
                      dataKey="amount"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={3}
                    >
                      {data?.byCategory.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* Center Badge inside donut hole */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Total</span>
                  <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {formatINR(data?.totalAmount || 0)}
                  </span>
                </div>
              </div>

              {/* Legend with Amount & Percentage */}
              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800/80 space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {data?.byCategory.map((cat) => (
                  <div
                    key={cat.category}
                    className="flex items-center justify-between text-xs py-1 px-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900/60 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {cat.category}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        ({cat.count})
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {formatINR(cat.amount)}
                      </span>
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 w-12 text-right">
                        {cat.percentage}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Pillar Bar Chart: Partner-wise or Category-wise */}
            <div className="lg:col-span-6 p-4 rounded-xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-500" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    {barChartMode === 'PARTNER' ? 'Partner-wise Expense' : 'Category-wise Pillars'}
                  </h3>
                </div>

                {/* Mode Toggle Button */}
                <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-800 p-0.5 bg-slate-100 dark:bg-slate-900">
                  <button
                    type="button"
                    onClick={() => setBarChartMode('PARTNER')}
                    className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                      barChartMode === 'PARTNER'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Partner
                  </button>
                  <button
                    type="button"
                    onClick={() => setBarChartMode('CATEGORY')}
                    className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                      barChartMode === 'CATEGORY'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Category
                  </button>
                </div>
              </div>

              {/* Bar Chart Canvas */}
              <div className="h-56 sm:h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={barChartMode === 'PARTNER' ? data?.byPartner : data?.byCategory}
                    margin={{ top: 15, right: 10, left: 10, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                    <XAxis
                      dataKey={barChartMode === 'PARTNER' ? 'partnerName' : 'category'}
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                    />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                    />
                    <Tooltip content={<BarTooltip />} />
                    <Bar
                      dataKey="amount"
                      fill={barChartMode === 'PARTNER' ? '#3b82f6' : '#f59e0b'}
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Legend with Amount & Percentage */}
              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800/80 space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {(barChartMode === 'PARTNER' ? data?.byPartner : data?.byCategory)?.map((item: any) => (
                  <div
                    key={item.partnerId || item.category}
                    className="flex items-center justify-between text-xs py-1 px-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900/60 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.color || '#3b82f6' }}
                      />
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {barChartMode === 'PARTNER' ? item.partnerName : item.category}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        ({item.count} entries)
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {formatINR(item.amount)}
                      </span>
                      <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 w-12 text-right">
                        {item.percentage}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
