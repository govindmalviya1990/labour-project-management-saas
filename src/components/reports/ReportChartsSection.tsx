'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  PieChart as PieChartIcon,
  BarChart3,
  Layers,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { formatINR } from '@/lib/calculations';

// 12 distinct, vibrant colors for executive-grade visual hierarchy
export const CHART_PALETTE = [
  '#F59E0B', // Amber / Gold
  '#10B981', // Emerald Green
  '#3B82F6', // Royal Blue
  '#EC4899', // Rose Pink
  '#8B5CF6', // Purple Violet
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#14B8A6', // Teal
  '#6366F1', // Indigo
  '#E11D48', // Crimson
  '#84CC16', // Lime Green
  '#D946EF', // Fuchsia
];

export interface ChartItem {
  name: string;
  amount: number;
  count?: number;
  percentage?: number;
  color: string;
  secondaryAmount?: number;
}

interface ReportChartsSectionProps {
  reportType: string;
  data: any;
  selectedCategory?: string;
  onSelectCategory?: (category: string) => void;
  isExpenseReport?: boolean;
}

export function ReportChartsSection({
  reportType,
  data,
  selectedCategory = 'ALL',
  onSelectCategory,
  isExpenseReport = false,
}: ReportChartsSectionProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [viewMode, setViewMode] = useState<'DUAL' | 'ROUND' | 'PILLAR'>('DUAL');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Compute round chart slices and pillar chart data based on report type
  const { chartData, pillarData, totalAmount, totalCount, metricTitle, secondaryMetricTitle } = useMemo(() => {
    if (!data?.data || !Array.isArray(data.data) || data.data.length === 0) {
      return {
        chartData: [],
        pillarData: [],
        totalAmount: 0,
        totalCount: 0,
        metricTitle: 'Total Expenses',
        secondaryMetricTitle: 'Breakdown',
      };
    }

    const rows: any[] = data.data;

    // 1. EXPENSE REPORTS (Daily, Weekly, Monthly, All Expense)
    if (
      reportType === 'expense' ||
      reportType === 'daily-expense' ||
      reportType === 'weekly-expense' ||
      reportType === 'monthly-expense'
    ) {
      const catMap: Record<string, { amount: number; count: number }> = {};
      let total = 0;
      rows.forEach((r) => {
        const cat = r.category || 'MISCELLANEOUS';
        const amt = Number(r.amount) || 0;
        if (!catMap[cat]) catMap[cat] = { amount: 0, count: 0 };
        catMap[cat].amount += amt;
        catMap[cat].count += 1;
        total += amt;
      });

      const slices: ChartItem[] = Object.entries(catMap)
        .sort((a, b) => b[1].amount - a[1].amount)
        .map(([name, stats], idx) => ({
          name,
          amount: stats.amount,
          count: stats.count,
          percentage: total > 0 ? Math.round((stats.amount / total) * 1000) / 10 : 0,
          color: CHART_PALETTE[idx % CHART_PALETTE.length],
        }));

      // Top project sites for pillar chart
      const siteMap: Record<string, number> = {};
      rows.forEach((r) => {
        const site = r.projectName || 'General HQ';
        siteMap[site] = (siteMap[site] || 0) + (Number(r.amount) || 0);
      });
      const pillars: ChartItem[] = Object.entries(siteMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 7)
        .map(([name, amt], idx) => ({
          name: name.length > 14 ? name.slice(0, 14) + '…' : name,
          amount: amt,
          color: CHART_PALETTE[idx % CHART_PALETTE.length],
        }));

      return {
        chartData: slices,
        pillarData: pillars.length > 0 ? pillars : slices.slice(0, 7),
        totalAmount: total,
        totalCount: rows.length,
        metricTitle: 'Total Expenses',
        secondaryMetricTitle: 'Project / Category Breakdown',
      };
    }

    // 2. LABOUR REPORT
    if (reportType === 'labour') {
      const catMap: Record<string, { earned: number; paid: number; count: number }> = {};
      let totalEarned = 0;
      rows.forEach((r) => {
        const cat = r.category || 'Helper';
        const earned = Number(r.totalEarned) || 0;
        const paid = Number(r.totalPaid) || 0;
        if (!catMap[cat]) catMap[cat] = { earned: 0, paid: 0, count: 0 };
        catMap[cat].earned += earned;
        catMap[cat].paid += paid;
        catMap[cat].count += 1;
        totalEarned += earned;
      });

      const slices: ChartItem[] = Object.entries(catMap)
        .sort((a, b) => b[1].earned - a[1].earned)
        .map(([name, stats], idx) => ({
          name,
          amount: stats.earned,
          count: stats.count,
          percentage: totalEarned > 0 ? Math.round((stats.earned / totalEarned) * 1000) / 10 : 0,
          color: CHART_PALETTE[idx % CHART_PALETTE.length],
          secondaryAmount: stats.paid,
        }));

      return {
        chartData: slices,
        pillarData: slices.slice(0, 7),
        totalAmount: totalEarned,
        totalCount: rows.length,
        metricTitle: 'Total Labour Wages',
        secondaryMetricTitle: 'Wages by Trade / Category',
      };
    }

    // 3. ATTENDANCE REPORT
    if (reportType === 'attendance') {
      const catMap: Record<string, { amount: number; count: number }> = {};
      let totalWage = 0;
      rows.forEach((r) => {
        const cat = r.category || 'Worker';
        const wage = Number(r.wageForDay) || 0;
        if (!catMap[cat]) catMap[cat] = { amount: 0, count: 0 };
        catMap[cat].amount += wage;
        catMap[cat].count += 1;
        totalWage += wage;
      });

      const slices: ChartItem[] = Object.entries(catMap)
        .sort((a, b) => b[1].amount - a[1].amount)
        .map(([name, stats], idx) => ({
          name,
          amount: stats.amount,
          count: stats.count,
          percentage: totalWage > 0 ? Math.round((stats.amount / totalWage) * 1000) / 10 : 0,
          color: CHART_PALETTE[idx % CHART_PALETTE.length],
        }));

      // Project wise wages for pillar chart
      const projMap: Record<string, number> = {};
      rows.forEach((r) => {
        const p = r.projectName || 'Site Work';
        projMap[p] = (projMap[p] || 0) + (Number(r.wageForDay) || 0);
      });
      const pillars: ChartItem[] = Object.entries(projMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 7)
        .map(([name, amt], idx) => ({
          name: name.length > 14 ? name.slice(0, 14) + '…' : name,
          amount: amt,
          color: CHART_PALETTE[idx % CHART_PALETTE.length],
        }));

      return {
        chartData: slices,
        pillarData: pillars.length > 0 ? pillars : slices.slice(0, 7),
        totalAmount: totalWage,
        totalCount: rows.length,
        metricTitle: 'Total Labour Cost',
        secondaryMetricTitle: 'Project Labour Incurred',
      };
    }

    // 4. MATERIAL REPORT
    if (reportType === 'material') {
      const catMap: Record<string, { amount: number; count: number }> = {};
      let totalVal = 0;
      rows.forEach((r) => {
        const cat = r.category || 'General Material';
        const val = Number(r.stockValue) || 0;
        if (!catMap[cat]) catMap[cat] = { amount: 0, count: 0 };
        catMap[cat].amount += val;
        catMap[cat].count += 1;
        totalVal += val;
      });

      const slices: ChartItem[] = Object.entries(catMap)
        .sort((a, b) => b[1].amount - a[1].amount)
        .map(([name, stats], idx) => ({
          name,
          amount: stats.amount,
          count: stats.count,
          percentage: totalVal > 0 ? Math.round((stats.amount / totalVal) * 1000) / 10 : 0,
          color: CHART_PALETTE[idx % CHART_PALETTE.length],
        }));

      const topMaterials: ChartItem[] = rows
        .sort((a, b) => (Number(b.stockValue) || 0) - (Number(a.stockValue) || 0))
        .slice(0, 7)
        .map((r, idx) => ({
          name: r.name ? (r.name.length > 14 ? r.name.slice(0, 14) + '…' : r.name) : 'Material',
          amount: Number(r.stockValue) || 0,
          color: CHART_PALETTE[idx % CHART_PALETTE.length],
        }));

      return {
        chartData: slices,
        pillarData: topMaterials,
        totalAmount: totalVal,
        totalCount: rows.length,
        metricTitle: 'Total Stock Valuation',
        secondaryMetricTitle: 'Top Material Stock Values',
      };
    }

    // 5. SALARY REPORT
    if (reportType === 'salary') {
      const catMap: Record<string, { amount: number; count: number }> = {};
      let totalSalary = 0;
      rows.forEach((r) => {
        const cat = r.category || 'Worker';
        const sal = Number(r.grossSalary) || 0;
        if (!catMap[cat]) catMap[cat] = { amount: 0, count: 0 };
        catMap[cat].amount += sal;
        catMap[cat].count += 1;
        totalSalary += sal;
      });

      const slices: ChartItem[] = Object.entries(catMap)
        .sort((a, b) => b[1].amount - a[1].amount)
        .map(([name, stats], idx) => ({
          name,
          amount: stats.amount,
          count: stats.count,
          percentage: totalSalary > 0 ? Math.round((stats.amount / totalSalary) * 1000) / 10 : 0,
          color: CHART_PALETTE[idx % CHART_PALETTE.length],
        }));

      const paidOut = rows.reduce((sum, r) => sum + (Number(r.payments) || 0) + (Number(r.advances) || 0), 0);
      const netPayable = rows.reduce((sum, r) => sum + (Number(r.netPayable) || 0), 0);

      const statusPillars: ChartItem[] = [
        { name: 'Paid / Advance', amount: paidOut, color: '#10B981' },
        { name: 'Pending Balance', amount: netPayable, color: '#F59E0B' },
      ];

      return {
        chartData: slices,
        pillarData: slices.slice(0, 7),
        totalAmount: totalSalary,
        totalCount: rows.length,
        metricTitle: 'Total Gross Salary',
        secondaryMetricTitle: 'Payroll Distribution by Trade',
      };
    }

    // 6. KHATA REPORT
    if (reportType === 'khata') {
      const catMap: Record<string, { credit: number; debit: number; payable: number; count: number }> = {};
      let totalCredits = 0;
      let totalDebits = 0;
      let totalPayable = 0;
      rows.forEach((r) => {
        const cat = r.category || 'Worker';
        const cr = Number(r.totalCredits) || 0;
        const db = Number(r.totalDebits) || 0;
        const py = Number(r.remainingPayable) || 0;
        if (!catMap[cat]) catMap[cat] = { credit: 0, debit: 0, payable: 0, count: 0 };
        catMap[cat].credit += cr;
        catMap[cat].debit += db;
        catMap[cat].payable += py;
        catMap[cat].count += 1;
        totalCredits += cr;
        totalDebits += db;
        totalPayable += py;
      });

      const slices: ChartItem[] = [
        { name: 'Total Disbursed (Debit)', amount: totalDebits, color: '#10B981', percentage: totalCredits > 0 ? Math.round((totalDebits / totalCredits) * 1000) / 10 : 0 },
        { name: 'Outstanding Balance (Payable)', amount: Math.max(0, totalPayable), color: '#F59E0B', percentage: totalCredits > 0 ? Math.round((totalPayable / totalCredits) * 1000) / 10 : 0 },
      ];

      const pillars: ChartItem[] = Object.entries(catMap)
        .sort((a, b) => b[1].credit - a[1].credit)
        .slice(0, 7)
        .map(([name, stats], idx) => ({
          name,
          amount: stats.credit,
          color: CHART_PALETTE[idx % CHART_PALETTE.length],
        }));

      return {
        chartData: slices,
        pillarData: pillars,
        totalAmount: totalCredits,
        totalCount: rows.length,
        metricTitle: 'Total Master Turnover',
        secondaryMetricTitle: 'Total Credit Ledger by Trade',
      };
    }

    // 7. PROJECT COST REPORT & 8. PROFIT / LOSS REPORT
    if (reportType === 'project-cost' || reportType === 'profit-loss') {
      let totalLabour = 0;
      let totalMaterial = 0;
      let totalOther = 0;
      let totalBudget = 0;

      rows.forEach((r) => {
        totalLabour += Number(r.actualLabour) || 0;
        totalMaterial += Number(r.actualMaterial) || 0;
        totalOther += Number(r.actualOther) || 0;
        totalBudget += Number(r.estimatedBudget || r.projectValue) || 0;
      });

      const grandActual = totalLabour + totalMaterial + totalOther;

      const slices: ChartItem[] = [
        { name: 'Labour Wages Cost', amount: totalLabour, color: '#F59E0B', percentage: grandActual > 0 ? Math.round((totalLabour / grandActual) * 1000) / 10 : 0 },
        { name: 'Material Expenses', amount: totalMaterial, color: '#3B82F6', percentage: grandActual > 0 ? Math.round((totalMaterial / grandActual) * 1000) / 10 : 0 },
        { name: 'Other Site Expenses', amount: totalOther, color: '#10B981', percentage: grandActual > 0 ? Math.round((totalOther / grandActual) * 1000) / 10 : 0 },
      ];

      const pillars: ChartItem[] = rows.slice(0, 7).map((r, idx) => ({
        name: r.name ? (r.name.length > 14 ? r.name.slice(0, 14) + '…' : r.name) : `Project ${idx + 1}`,
        amount: Number(r.totalActualCost) || 0,
        color: CHART_PALETTE[idx % CHART_PALETTE.length],
      }));

      return {
        chartData: slices,
        pillarData: pillars,
        totalAmount: grandActual,
        totalCount: rows.length,
        metricTitle: 'Total Actual Expenditure',
        secondaryMetricTitle: 'Project Expenditure Breakdown',
      };
    }

    // 9. PRODUCTIVITY & 10. WORK REPORT
    if (reportType === 'productivity' || reportType === 'work') {
      const taskMap: Record<string, { amount: number; count: number }> = {};
      let totalVal = 0;
      rows.forEach((r) => {
        const task = r.task || r.category || 'General Work';
        const val = Number(r.totalWorkValue || r.totalCost) || 0;
        if (!taskMap[task]) taskMap[task] = { amount: 0, count: 0 };
        taskMap[task].amount += val;
        taskMap[task].count += 1;
        totalVal += val;
      });

      const slices: ChartItem[] = Object.entries(taskMap)
        .sort((a, b) => b[1].amount - a[1].amount)
        .slice(0, 8)
        .map(([name, stats], idx) => ({
          name,
          amount: stats.amount,
          count: stats.count,
          percentage: totalVal > 0 ? Math.round((stats.amount / totalVal) * 1000) / 10 : 0,
          color: CHART_PALETTE[idx % CHART_PALETTE.length],
        }));

      return {
        chartData: slices,
        pillarData: slices.slice(0, 7),
        totalAmount: totalVal,
        totalCount: rows.length,
        metricTitle: 'Total Completed Work Value',
        secondaryMetricTitle: 'Output Value by Task',
      };
    }

    // Default fallback
    const genericTotal = rows.reduce((sum, r) => sum + (Number(r.amount || r.totalCost || r.totalWorkValue) || 0), 0);
    return {
      chartData: [],
      pillarData: [],
      totalAmount: genericTotal,
      totalCount: rows.length,
      metricTitle: 'Total Amount',
      secondaryMetricTitle: 'Overview',
    };
  }, [reportType, data]);

  const hasData = isMounted && chartData.length > 0 && totalAmount > 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 print:border-black print:bg-white print:text-black">
      {/* Chart Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800 print:border-black">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-600/20 text-amber-500 border border-amber-500/20 shadow-sm shrink-0">
            <PieChartIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-bold text-slate-100 print:text-black truncate">
                {metricTitle} & Visual Analytics
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wider shrink-0">
                Round & Pillar Charts
              </span>
            </div>
            <p className="text-xs text-slate-400 print:text-gray-600 mt-0.5">
              Live visual cost distribution, category percentage share & interactive breakdown
            </p>
          </div>
        </div>

        {/* View Mode Toggle Buttons */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto flex-wrap print:hidden">
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('ROUND')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition ${
                viewMode === 'ROUND'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="View Round Chart (Donut)"
            >
              <PieChartIcon className="w-3.5 h-3.5" />
              Round Chart
            </button>
            <button
              type="button"
              onClick={() => setViewMode('PILLAR')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition ${
                viewMode === 'PILLAR'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="View Pillar Chart (Bar)"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Pillar Chart
            </button>
            <button
              type="button"
              onClick={() => setViewMode('DUAL')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition ${
                viewMode === 'DUAL'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="View Both Charts Side-by-Side"
            >
              <Layers className="w-3.5 h-3.5" />
              Dual View
            </button>
          </div>

          <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Total: {formatINR(totalAmount)}
          </span>
        </div>
      </div>

      {/* Charts Grid */}
      {!hasData ? (
        <div className="py-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full border-4 border-dashed border-slate-800 flex items-center justify-center mb-3">
            <PieChartIcon className="w-7 h-7 text-slate-600" />
          </div>
          <p className="text-xs font-bold text-slate-300">
            No chart distribution available for this period
          </p>
          <p className="text-[11px] text-slate-500 max-w-sm mt-1">
            When expenditures, labour vouchers, or site materials are logged, vibrant Round and Pillar charts will render automatically here.
          </p>
        </div>
      ) : (
        <div
          className={`grid gap-5 items-stretch ${
            viewMode === 'DUAL' ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1'
          }`}
        >
          {/* 1. PRIMARY CHART: ROUND CHART (DONUT) */}
          {(viewMode === 'DUAL' || viewMode === 'ROUND') && (
            <div
              className={`${
                viewMode === 'DUAL' ? 'lg:col-span-6 xl:col-span-5' : 'w-full'
              } bg-slate-950/70 border border-slate-800/90 rounded-xl p-4 flex flex-col justify-between`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Primary: Round Chart (Donut Distribution)
                  </h3>
                </div>
                <span className="text-[10px] text-slate-500">
                  {chartData.length} {chartData.length === 1 ? 'slice' : 'slices'}
                </span>
              </div>

              {/* Responsive Donut Visual */}
              <div className="h-64 sm:h-72 w-full relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload as ChartItem;
                          return (
                            <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 p-3 rounded-xl text-white text-xs shadow-xl min-w-[170px]">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span
                                  className="w-3 h-3 rounded-full shrink-0"
                                  style={{ backgroundColor: d.color }}
                                />
                                <span className="font-bold text-slate-100">{d.name}</span>
                              </div>
                              <div className="text-amber-400 font-black text-sm font-mono">
                                {formatINR(d.amount)}
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5 pt-1.5 border-t border-slate-800">
                                <span>{d.count ? `${d.count} records` : 'Share'}</span>
                                <span className="text-emerald-400 font-bold">{d.percentage}%</span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Pie
                      data={chartData}
                      dataKey="amount"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={92}
                      paddingAngle={3}
                      cursor="pointer"
                      onClick={(entry) => {
                        if (isExpenseReport && onSelectCategory) {
                          onSelectCategory(selectedCategory === entry.name ? 'ALL' : entry.name);
                        }
                      }}
                    >
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`donut-cell-${index}`}
                          fill={entry.color}
                          stroke={selectedCategory === entry.name ? '#F59E0B' : '#0F172A'}
                          strokeWidth={selectedCategory === entry.name ? 3 : 1}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>

                {/* Donut Center Hole Content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-2 text-center">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    Grand Total
                  </span>
                  <span className="text-base sm:text-lg font-black text-white font-mono truncate max-w-[140px] sm:max-w-[180px]">
                    {formatINR(totalAmount)}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-semibold mt-0.5">
                    100% Share
                  </span>
                </div>
              </div>

              {/* Slice Badges with percentages below Donut */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 pt-3 border-t border-slate-800/80 max-h-24 overflow-y-auto no-scrollbar">
                {chartData.map((slice) => (
                  <button
                    key={slice.name}
                    type="button"
                    onClick={() => {
                      if (isExpenseReport && onSelectCategory) {
                        onSelectCategory(selectedCategory === slice.name ? 'ALL' : slice.name);
                      }
                    }}
                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border transition ${
                      selectedCategory === slice.name
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: slice.color }}
                    />
                    <span className="truncate max-w-[110px]">{slice.name}</span>
                    <span className="font-mono text-[10px] text-amber-400 font-bold">
                      {slice.percentage}%
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 2. SECONDARY CHART: PILLAR CHART (BAR COLUMNS) */}
          {(viewMode === 'DUAL' || viewMode === 'PILLAR') && (
            <div
              className={`${
                viewMode === 'DUAL' ? 'lg:col-span-6 xl:col-span-7' : 'w-full'
              } bg-slate-950/70 border border-slate-800/90 rounded-xl p-4 flex flex-col justify-between`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Secondary: Pillar Chart ({secondaryMetricTitle})
                  </h3>
                </div>
                <span className="text-[10px] text-slate-500">
                  Distinct Column Colors
                </span>
              </div>

              {/* Responsive Pillar Visual */}
              <div className="h-64 sm:h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={pillarData}
                    margin={{ top: 12, right: 12, left: -10, bottom: 25 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#1E293B"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      stroke="#94A3B8"
                      fontSize={11}
                      tickLine={false}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={35}
                    />
                    <YAxis
                      stroke="#94A3B8"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(val) => {
                        if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
                        if (val >= 1000) return `₹${(val / 1000).toFixed(0)}k`;
                        return `₹${val}`;
                      }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload as ChartItem;
                          return (
                            <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 p-3 rounded-xl text-white text-xs shadow-xl min-w-[160px]">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span
                                  className="w-3 h-3 rounded-full shrink-0"
                                  style={{ backgroundColor: d.color }}
                                />
                                <span className="font-bold text-slate-100">{d.name}</span>
                              </div>
                              <div className="text-amber-400 font-black text-sm font-mono">
                                {formatINR(d.amount)}
                              </div>
                              {totalAmount > 0 && (
                                <div className="text-[11px] text-slate-400 mt-1.5 pt-1.5 border-t border-slate-800">
                                  <span>Share: </span>
                                  <span className="text-emerald-400 font-bold">
                                    {Math.round((d.amount / totalAmount) * 1000) / 10}%
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="amount"
                      radius={[6, 6, 0, 0]}
                      cursor="pointer"
                      onClick={(entry) => {
                        if (isExpenseReport && onSelectCategory) {
                          onSelectCategory(selectedCategory === entry.name ? 'ALL' : entry.name);
                        }
                      }}
                    >
                      {pillarData.map((entry, index) => (
                        <Cell
                          key={`pillar-cell-${index}`}
                          fill={entry.color || CHART_PALETTE[index % CHART_PALETTE.length]}
                          opacity={selectedCategory === 'ALL' || selectedCategory === entry.name ? 1 : 0.4}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Pillar Legend footer */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-3 border-t border-slate-800/80">
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                  Showing top {pillarData.length} breakdown records
                </span>
                <span className="text-slate-500">
                  Click any pillar to inspect
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
