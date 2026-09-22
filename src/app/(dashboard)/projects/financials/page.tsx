'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  IndianRupee,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Building2,
  Download,
  Search,
  ArrowRight,
  PieChart as PieIcon,
  Layers,
  BarChart3,
  HardHat,
  Package,
  Receipt
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatINR } from '@/lib/calculations';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

export default function ProjectFinancialsPage() {
  const [data, setData] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchFinancials = async () => {
    setIsLoading(true);
    try {
      const url = `/api/projects/financials?status=${statusFilter}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancials();
  }, [statusFilter]);

  const projects = (data?.projects || []).filter((p: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return p.name?.toLowerCase().includes(q) || p.projectCode?.toLowerCase().includes(q);
  });

  const portfolio = data?.portfolio || {
    totalProjects: 0,
    portfolioValue: 0,
    portfolioEstimatedBudget: 0,
    portfolioActualCost: 0,
    portfolioProjectedProfit: 0,
    portfolioMarginPct: 0,
    overBudgetProjectsCount: 0,
  };

  // Chart data for top projects
  const chartData = projects.slice(0, 8).map((p: any) => ({
    name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
    Estimated: p.financials.estimatedTotalCost,
    Actual: p.financials.actualTotalCost,
    Value: p.projectValue,
  }));

  const exportCSV = () => {
    const headers = [
      'Project Code',
      'Project Name',
      'Status',
      'Project Value (INR)',
      'Estimated Budget (INR)',
      'Labour Cost (INR)',
      'Material Cost (INR)',
      'Other Expenses (INR)',
      'Total Actual Cost (INR)',
      'Budget Variance (INR)',
      'Variance %',
      'Budget Status',
      'Projected Profit (INR)',
      'Margin %',
      'Cost per Unit (INR)',
    ];

    const rows = projects.map((p: any) => [
      `"${p.projectCode}"`,
      `"${p.name}"`,
      `"${p.status}"`,
      p.projectValue,
      p.financials.estimatedTotalCost,
      p.financials.actualLabourCost,
      p.financials.actualMaterialCost,
      p.financials.actualOtherExpense,
      p.financials.actualTotalCost,
      p.financials.variance,
      p.financials.variancePercentage,
      p.financials.isOverBudget ? 'OVER BUDGET' : 'WITHIN BUDGET',
      p.financials.projectedProfit,
      p.financials.profitMarginPercentage,
      p.costPerUnit.costPerUnit,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e: any) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `project_financials_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2.5">
            <IndianRupee className="w-7 h-7 text-amber-500" />
            Project Financial Matrix & Cost Analysis
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time multi-project financial control: budget vs actuals, cost per sq.ft., variance & profit/loss projections
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={exportCSV}
            variant="outline"
            className="text-xs border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            <Download className="w-4 h-4 mr-1.5" />
            Export Financial Matrix
          </Button>
        </div>
      </div>

      {/* Portfolio KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Contract Value</span>
            <Building2 className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400 mt-2">
            {formatINR(portfolio.portfolioValue)}
          </div>
          <div className="text-xs text-slate-500 mt-1">{portfolio.totalProjects} active projects contracted</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Actual Spend</span>
            <Receipt className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-slate-100 mt-2">
            {formatINR(portfolio.portfolioActualCost)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            vs {formatINR(portfolio.portfolioEstimatedBudget)} budgeted
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Projected Portfolio Profit</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className={`text-2xl font-black mt-2 ${portfolio.portfolioProjectedProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatINR(portfolio.portfolioProjectedProfit)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Overall Margin: <strong className="text-slate-300 font-bold">{portfolio.portfolioMarginPct}%</strong>
          </div>
        </div>

        <div className={`border rounded-xl p-4 ${portfolio.overBudgetProjectsCount > 0 ? 'bg-rose-950/20 border-rose-500/40' : 'bg-slate-900 border-slate-800'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-300 uppercase tracking-wider">Over-Budget Alerts</span>
            <AlertTriangle className={`w-4 h-4 ${portfolio.overBudgetProjectsCount > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-500'}`} />
          </div>
          <div className={`text-2xl font-black mt-2 ${portfolio.overBudgetProjectsCount > 0 ? 'text-rose-400' : 'text-slate-100'}`}>
            {portfolio.overBudgetProjectsCount}
          </div>
          <div className="text-xs text-slate-500 mt-1">Sites requiring cost audit</div>
        </div>
      </div>

      {/* Comparison Chart */}
      {chartData.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-500" />
            Budget vs Actual Spend Comparison by Project
          </h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `₹${(v / 100000).toFixed(1)}L`} />
                <Tooltip
                  formatter={(val: any) => formatINR(Number(val))}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                />
                <Legend />
                <Bar dataKey="Estimated" fill="#3b82f6" name="Estimated Budget" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Actual" fill="#f59e0b" name="Actual Cost" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="w-full sm:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:ring-1 focus:ring-amber-500"
            >
              <option value="ALL">All Project Statuses</option>
              <option value="RUNNING">Running Projects</option>
              <option value="COMPLETED">Completed Projects</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="COMING_SOON">Coming Soon</option>
              <option value="ENQUIRY">Enquiry Stage</option>
            </select>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search project name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg pl-9 pr-3 py-2 focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>

        <div className="text-xs text-slate-400 font-medium">
          Showing {projects.length} project records
        </div>
      </div>

      {/* Financial Matrix Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Project</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Project Value</th>
                <th className="py-3 px-3 text-right">Estimated Budget</th>
                <th className="py-3 px-3 text-right text-sky-400">Labour</th>
                <th className="py-3 px-3 text-right text-emerald-400">Materials</th>
                <th className="py-3 px-3 text-right text-amber-400">Expenses</th>
                <th className="py-3 px-3 text-right font-bold text-slate-200">Total Actual Cost</th>
                <th className="py-3 px-3 text-right">Budget Variance</th>
                <th className="py-3 px-3 text-right font-bold">Projected Profit</th>
                <th className="py-3 px-3 text-right">Cost / {projects[0]?.targetUnit || 'sq.ft.'}</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={12} className="text-center py-10 text-slate-500">
                    Calculating live project financials...
                  </td>
                </tr>
              ) : projects.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-10 text-slate-400">
                    No projects found for selected filters.
                  </td>
                </tr>
              ) : (
                projects.map((p: any) => {
                  const f = p.financials;
                  const isOver = f.isOverBudget;
                  return (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4">
                        <Link href={`/projects/${p.id}`} className="font-bold text-slate-100 hover:text-amber-400 transition">
                          {p.name}
                        </Link>
                        <div className="text-[11px] text-slate-500 font-mono">{p.projectCode}</div>
                      </td>
                      <td className="py-3 px-3">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-amber-400">
                        {formatINR(p.projectValue)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-300">
                        {formatINR(f.estimatedTotalCost)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-sky-400">
                        {formatINR(f.actualLabourCost)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-emerald-400">
                        {formatINR(f.actualMaterialCost)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-amber-300">
                        {formatINR(f.actualOtherExpense)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-100 text-sm">
                        {formatINR(f.actualTotalCost)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono">
                        <div className={`font-bold flex items-center justify-end gap-1 ${isOver ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {isOver ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                          {formatINR(f.variance)}
                        </div>
                        <div className={`text-[10px] ${isOver ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {isOver ? `+${f.variancePercentage}% OVER` : `${f.variancePercentage}% remaining`}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono">
                        <div className={`font-bold ${f.projectedProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {formatINR(f.projectedProfit)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {f.profitMarginPercentage}% margin
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-amber-400 font-bold">
                        ₹{p.costPerUnit.costPerUnit}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Link
                          href={`/projects/${p.id}`}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20"
                        >
                          Details <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
