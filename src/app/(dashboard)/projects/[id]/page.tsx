'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Building2,
  Calendar,
  Layers,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  ArrowLeft,
  ArrowDownLeft,
  Edit2,
  Plus,
  Trash2,
  Users,
  Package,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Phone,
  Mail,
  MapPin,
  Wallet,
  Landmark,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { MetricCard } from '@/components/ui/MetricCard';
import { Modal } from '@/components/ui/Modal';
import { ProjectFormModal } from '@/components/projects/ProjectFormModal';
import { SiteFormModal } from '@/components/projects/SiteFormModal';
import { MoneyInModal } from '@/components/finance/MoneyInModal';
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
import { clsx } from 'clsx';

export default function ProjectDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'sites' | 'receipts' | 'attendance' | 'materials' | 'expenses'>('overview');

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSiteModalOpen, setIsSiteModalOpen] = useState(false);
  const [isMoneyInModalOpen, setIsMoneyInModalOpen] = useState(false);
  const [moneyInSiteId, setMoneyInSiteId] = useState<string | undefined>(undefined);
  const [editingSite, setEditingSite] = useState<any>(null);
  const [deletingSite, setDeletingSite] = useState<any>(null);

  const fetchProjectDetails = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error('Failed to load project details');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Error fetching project details');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProjectDetails();
  }, [fetchProjectDetails]);

  const handleDeleteSite = async () => {
    if (!deletingSite) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/sites/${deletingSite.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete site');
      setDeletingSite(null);
      fetchProjectDetails();
    } catch (err: any) {
      alert(err.message || 'Error deleting site');
    }
  };

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
        <h3 className="text-base font-semibold text-white">Project Not Found</h3>
        <p className="text-xs text-slate-400 mt-1">{error}</p>
        <div className="mt-4">
          <Link href="/projects">
            <Button size="sm" variant="outline">
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Back to Projects
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const { project, financials, costPerUnit, stats } = data;

  // Comparison data for Recharts
  const budgetVsActualData = [
    {
      category: 'Labour Cost',
      Estimated: project.estimatedLabourCost || 0,
      Actual: financials.actualLabourCost || 0,
    },
    {
      category: 'Material Cost',
      Estimated: project.estimatedMaterialCost || 0,
      Actual: financials.actualMaterialCost || 0,
    },
    {
      category: 'Other Expenses',
      Estimated: project.estimatedOtherExpense || 0,
      Actual: financials.actualOtherExpense || 0,
    },
    {
      category: 'Total Cost',
      Estimated: financials.estimatedTotalCost || 0,
      Actual: financials.actualTotalCost || 0,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/projects"
          className="inline-flex items-center text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Projects Registry
        </Link>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="primary"
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-sm"
            onClick={() => {
              setMoneyInSiteId(undefined);
              setIsMoneyInModalOpen(true);
            }}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Receive Payment
          </Button>
          <Button size="sm" variant="outline" onClick={fetchProjectDetails}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Refresh
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setIsEditModalOpen(true)}>
            <Edit2 className="w-3.5 h-3.5 mr-1.5" />
            Edit Project
          </Button>
        </div>
      </div>

      {/* Project Master Header */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 font-bold">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {project.name}
                </h1>
                <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  {project.projectCode}
                </span>
                <StatusBadge status={project.status} />
              </div>

              <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-400">
                {project.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    {project.location}
                  </span>
                )}
                {project.clientName && (
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-slate-500" />
                    Client: <strong className="text-slate-200">{project.clientName}</strong>
                    {project.clientMobile && <span>({project.clientMobile})</span>}
                  </span>
                )}
                {project.startDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    Start: {new Date(project.startDate).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 border-t lg:border-t-0 border-slate-800 pt-3 lg:pt-0 lg:pl-6 lg:border-l">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                Project Value
              </p>
              <p className="text-lg sm:text-xl font-bold text-amber-400">
                {formatINR(project.projectValue)}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Target: {project.targetQuantity?.toLocaleString() || 0} {project.targetUnit || 'sq.ft.'}
              </p>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                Payment Received
              </p>
              <p className="text-lg sm:text-xl font-bold text-emerald-400">
                {formatINR(financials.totalPaymentReceived || 0)}
              </p>
              <span className="inline-block text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 mt-0.5">
                {financials.collectionPercentage || 0}% Collected
              </span>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-wider text-amber-300 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                Remaining Due
              </p>
              <p className="text-lg sm:text-xl font-bold text-amber-300">
                {formatINR(financials.remainingPayment || 0)}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {Math.max(0, 100 - (financials.collectionPercentage || 0)).toFixed(1)}% Pending
              </p>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-wider text-sky-400 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                Net Cash in Hand
              </p>
              <p className={clsx(
                "text-lg sm:text-xl font-bold",
                (financials.netCashFlow || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
              )}>
                {formatINR(financials.netCashFlow || 0)}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Received &minus; Spent
              </p>
            </div>
          </div>
        </div>

        {/* Collection & Budget Progress Bar */}
        <div className="mt-4 pt-3 border-t border-slate-800/80">
          <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-slate-400 mb-1.5">
            <span className="flex items-center gap-1.5 font-medium text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Client Payment Collection Progress
            </span>
            <div className="flex items-center gap-3 font-medium">
              <span className="text-emerald-400 font-semibold">
                Received: {formatINR(financials.totalPaymentReceived || 0)} ({financials.collectionPercentage || 0}%)
              </span>
              <span className="text-slate-600">&bull;</span>
              <span className="text-amber-300 font-semibold">
                Remaining Due: {formatINR(financials.remainingPayment || 0)}
              </span>
            </div>
          </div>
          <div className="w-full bg-slate-800/90 rounded-full h-2.5 overflow-hidden border border-slate-700/60 flex">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, financials.collectionPercentage || 0)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Financial Summary KPI Cards */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Live Project Financial Metrics
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <MetricCard
            title="Payment Received (Client)"
            value={formatINR(financials.totalPaymentReceived)}
            subtitle={`${financials.collectionPercentage}% collected from client`}
            icon={<IndianRupee className="w-5 h-5 text-emerald-400" />}
            variant="emerald"
          />

          <MetricCard
            title="Remaining Payment (Due)"
            value={formatINR(financials.remainingPayment)}
            subtitle={financials.remainingPayment === 0 ? 'Fully collected' : 'Pending from client'}
            icon={<TrendingDown className="w-5 h-5 text-amber-400" />}
            variant={financials.remainingPayment === 0 ? 'emerald' : 'amber'}
          />

          <MetricCard
            title="Net Cash in Hand"
            value={formatINR(financials.netCashFlow)}
            subtitle="Received minus Actual Total Cost"
            icon={<IndianRupee className={(financials.netCashFlow || 0) >= 0 ? "w-5 h-5 text-emerald-400" : "w-5 h-5 text-rose-400"} />}
            variant={(financials.netCashFlow || 0) >= 0 ? 'emerald' : 'rose'}
            isAlert={(financials.netCashFlow || 0) < 0}
          />

          <MetricCard
            title="Actual Profit / Loss"
            value={formatINR(financials.actualProfit)}
            subtitle={`${financials.profitMarginPercentage}% profit margin`}
            icon={
              financials.actualProfit >= 0 ? (
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              ) : (
                <TrendingDown className="w-5 h-5 text-rose-400" />
              )
            }
            variant={financials.actualProfit >= 0 ? 'emerald' : 'rose'}
          />

          <MetricCard
            title="Total Budget (Est.)"
            value={formatINR(financials.estimatedTotalCost)}
            subtitle="Estimated total cost"
            icon={<IndianRupee className="w-5 h-5 text-slate-400" />}
          />

          <MetricCard
            title="Actual Total Cost"
            value={formatINR(financials.actualTotalCost)}
            subtitle="Labour + Material + Other"
            icon={<IndianRupee className="w-5 h-5 text-rose-400" />}
            variant="rose"
            isAlert={financials.isBudgetExceeded}
          />

          <MetricCard
            title="Remaining Budget"
            value={formatINR(financials.costVariance)}
            subtitle={financials.costVariance >= 0 ? 'Under budget' : 'Budget exceeded'}
            icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
            variant={financials.costVariance >= 0 ? 'emerald' : 'rose'}
          />

          <MetricCard
            title="Project Sites / Towers"
            value={project.sites?.length || 0}
            subtitle="Active site breakdown"
            icon={<Layers className="w-5 h-5 text-indigo-400" />}
          />

          <MetricCard
            title="Actual Labour Cost"
            value={formatINR(financials.actualLabourCost)}
            subtitle={`Est: ${formatINR(project.estimatedLabourCost)}`}
            icon={<Users className="w-5 h-5 text-amber-400" />}
            variant="amber"
          />

          <MetricCard
            title="Actual Material Cost"
            value={formatINR(financials.actualMaterialCost)}
            subtitle={`Est: ${formatINR(project.estimatedMaterialCost)}`}
            icon={<Package className="w-5 h-5 text-emerald-400" />}
            variant="emerald"
          />

          <MetricCard
            title="Actual Other Expenses"
            value={formatINR(financials.actualOtherExpense)}
            subtitle={`Est: ${formatINR(project.estimatedOtherExpense)}`}
            icon={<Receipt className="w-5 h-5 text-blue-400" />}
            variant="blue"
          />

          <MetricCard
            title="Target Quantity"
            value={`${project.targetQuantity?.toLocaleString() || 0} ${project.targetUnit || 'sq.ft.'}`}
            subtitle="Total project scope"
            icon={<Building2 className="w-5 h-5 text-slate-400" />}
          />
        </div>
      </div>

      {/* Cost Per Sq.Ft. Breakdown Widget (Section 29) */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-500" />
              Cost Per Unit Breakdown ({costPerUnit.unit})
            </h3>
            <p className="text-[11px] text-slate-400">
              Live unit economics calculated from actual expenses divided by completed output
            </p>
          </div>
          <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 self-start sm:self-auto">
            Total: {formatINR(costPerUnit.totalCostPerUnit)} / {costPerUnit.unit}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <p className="text-[11px] text-slate-400 font-medium">Labour / {costPerUnit.unit}</p>
            <p className="text-lg font-bold text-amber-400 mt-1">
              {formatINR(costPerUnit.labourCostPerUnit)}
            </p>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <p className="text-[11px] text-slate-400 font-medium">Material / {costPerUnit.unit}</p>
            <p className="text-lg font-bold text-emerald-400 mt-1">
              {formatINR(costPerUnit.materialCostPerUnit)}
            </p>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <p className="text-[11px] text-slate-400 font-medium">Other / {costPerUnit.unit}</p>
            <p className="text-lg font-bold text-blue-400 mt-1">
              {formatINR(costPerUnit.otherCostPerUnit)}
            </p>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <p className="text-[11px] text-slate-400 font-medium">Completed Output</p>
            <p className="text-lg font-bold text-white mt-1">
              {costPerUnit.completedQuantity.toLocaleString()} {costPerUnit.unit}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={clsx(
            'px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors',
            activeTab === 'overview'
              ? 'bg-amber-500 text-slate-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          )}
        >
          Budget vs Actual Charts
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('sites')}
          className={clsx(
            'px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5',
            activeTab === 'sites'
              ? 'bg-amber-500 text-slate-950 font-bold'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          )}
        >
          <Layers className="w-3.5 h-3.5" />
          Project Sites ({project.sites?.length || 0})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('receipts')}
          className={clsx(
            'px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5',
            activeTab === 'receipts'
              ? 'bg-amber-500 text-slate-950 font-bold'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          )}
        >
          <IndianRupee className="w-3.5 h-3.5 text-emerald-400" />
          Client Payments Received ({data.receipts?.length || 0})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('attendance')}
          className={clsx(
            'px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5',
            activeTab === 'attendance'
              ? 'bg-amber-500 text-slate-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          )}
        >
          <Users className="w-3.5 h-3.5" />
          Attendance Logs ({stats.totalAttendanceCount || 0})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('materials')}
          className={clsx(
            'px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5',
            activeTab === 'materials'
              ? 'bg-amber-500 text-slate-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          )}
        >
          <Package className="w-3.5 h-3.5" />
          Material Receipts ({stats.materialReceiptsCount || 0})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('expenses')}
          className={clsx(
            'px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5',
            activeTab === 'expenses'
              ? 'bg-amber-500 text-slate-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          )}
        >
          <Receipt className="w-3.5 h-3.5" />
          Site Expenses ({stats.expensesCount || 0})
        </button>
      </div>

      {/* TAB 1: OVERVIEW & FINANCIAL CHART */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          {/* Recharts Budget vs Actual */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Estimated Budget vs. Actual Costs</h3>
                <p className="text-[11px] text-slate-400">Category-wise cost comparison</p>
              </div>
              <span className="text-xs text-amber-400 font-medium">Variance Analysis</span>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={budgetVsActualData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="category" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                    formatter={(val: any) => [formatINR(Number(val)), 'Cost']}
                  />
                  <Legend />
                  <Bar dataKey="Estimated" name="Estimated Budget" fill="#64748b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Actual" name="Actual Cost" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Project Details / Contacts Card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-white border-b border-slate-800 pb-2">
              Project Contacts & Timeline
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <p className="text-slate-400 font-medium">Client Details</p>
                <p className="font-semibold text-white mt-0.5">{project.clientName || 'Not specified'}</p>
                {project.clientMobile && (
                  <p className="text-slate-400 flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3 text-amber-500" />
                    {project.clientMobile}
                  </p>
                )}
                {project.clientEmail && (
                  <p className="text-slate-400 flex items-center gap-1 mt-0.5">
                    <Mail className="w-3 h-3 text-amber-500" />
                    {project.clientEmail}
                  </p>
                )}
              </div>

              <div className="border-t border-slate-800 pt-3">
                <p className="text-slate-400 font-medium">Site Engineer</p>
                <p className="font-semibold text-white mt-0.5">{project.engineerName || 'Not specified'}</p>
                {project.engineerMobile && (
                  <p className="text-slate-400 flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3 text-amber-500" />
                    {project.engineerMobile}
                  </p>
                )}
              </div>

              <div className="border-t border-slate-800 pt-3">
                <p className="text-slate-400 font-medium">Architect</p>
                <p className="font-semibold text-white mt-0.5">{project.architectName || 'Not specified'}</p>
                {project.architectMobile && (
                  <p className="text-slate-400 flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3 text-amber-500" />
                    {project.architectMobile}
                  </p>
                )}
              </div>

              <div className="border-t border-slate-800 pt-3">
                <p className="text-slate-400 font-medium">Target Completion Date</p>
                <p className="font-semibold text-amber-400 mt-0.5">
                  {project.expectedCompletionDate
                    ? new Date(project.expectedCompletionDate).toLocaleDateString()
                    : 'Flexible'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PROJECT SITES (Section 11) */}
      {activeTab === 'sites' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Project Sites / Towers / Wings</h3>
              <p className="text-xs text-slate-400">
                Manage distinct work locations within this project (e.g. Tower A, Tower B, Basement)
              </p>
            </div>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                setEditingSite(null);
                setIsSiteModalOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add Site
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {project.sites?.map((site: any) => (
              <div
                key={site.id}
                className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 shadow-sm hover:border-slate-700 transition-all space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white text-sm">{site.name}</h4>
                      {site.location && <p className="text-xs text-slate-400">{site.location}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingSite(site);
                        setIsSiteModalOpen(true);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-white"
                      title="Edit Site"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeletingSite(site)}
                      className="p-1 rounded text-slate-400 hover:text-rose-400"
                      title="Delete Site"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="border-t border-slate-800/80 pt-2.5 text-xs space-y-1 text-slate-300">
                  {site.supervisorName && (
                    <p className="flex items-center gap-1.5 text-slate-300">
                      <Users className="w-3 h-3 text-slate-500" />
                      Supervisor: <strong className="text-white">{site.supervisorName}</strong>
                    </p>
                  )}
                  {site.supervisorMobile && (
                    <p className="flex items-center gap-1.5 text-slate-400">
                      <Phone className="w-3 h-3 text-slate-500" />
                      {site.supervisorMobile}
                    </p>
                  )}
                </div>

                <div className="border-t border-slate-800/80 pt-2.5 text-xs space-y-1.5 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/50">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium flex items-center gap-1">
                      <ArrowDownLeft className="w-3 h-3 text-emerald-400" />
                      Client Received:
                    </span>
                    <span className="font-bold text-emerald-400">
                      {formatINR(site.totalReceived || 0)}
                      {site.receiptsCount > 0 && (
                        <span className="text-[10px] text-slate-400 font-normal ml-1">
                          ({site.receiptsCount} rec)
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium flex items-center gap-1">
                      <Receipt className="w-3 h-3 text-rose-400" />
                      Direct Expenses:
                    </span>
                    <span className="font-bold text-rose-400">
                      {formatINR(site.totalExpenses || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-800 pt-1 text-[11px]">
                    <span className="text-slate-400 font-medium">Net Site Balance:</span>
                    <span className={clsx(
                      "font-bold",
                      (site.totalReceived || 0) - (site.totalExpenses || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                    )}>
                      {formatINR((site.totalReceived || 0) - (site.totalExpenses || 0))}
                    </span>
                  </div>
                </div>

                <div className="border-t border-slate-800/80 pt-2 flex items-center justify-between text-[11px] text-slate-400">
                  <span>{site._count?.attendance || 0} attendance &bull; {site._count?.expenses || 0} expenses</span>
                  <button
                    type="button"
                    onClick={() => {
                      setMoneyInSiteId(site.id);
                      setIsMoneyInModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Receive
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: CLIENT PAYMENTS RECEIVED */}
      {activeTab === 'receipts' && (
        <div className="space-y-4 animate-fade-in">
          {/* Summary & Action Toolbar */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <IndianRupee className="w-5 h-5 text-emerald-400" />
                  Client Payments Received (Money IN)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  All incoming client payments credited to partner wallets or bank accounts for {project.name}
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <Link href={`/hisaab?projectId=${project.id}`}>
                  <Button size="sm" variant="outline" className="text-xs">
                    View Hisaab Book
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="primary"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-sm"
                  onClick={() => {
                    setMoneyInSiteId(undefined);
                    setIsMoneyInModalOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Receive Payment
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800">
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                <p className="text-[11px] text-slate-400 font-medium">Project Value</p>
                <p className="text-lg font-bold text-amber-400 mt-0.5">{formatINR(project.projectValue)}</p>
              </div>
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                <p className="text-[11px] text-emerald-400 font-medium">Total Received</p>
                <p className="text-lg font-bold text-emerald-400 mt-0.5">{formatINR(financials.totalPaymentReceived)}</p>
                <span className="text-[10px] text-emerald-400">({financials.collectionPercentage}% collected)</span>
              </div>
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                <p className="text-[11px] text-amber-300 font-medium">Remaining Due</p>
                <p className="text-lg font-bold text-amber-300 mt-0.5">{formatINR(financials.remainingPayment)}</p>
                <span className="text-[10px] text-slate-400">pending from client</span>
              </div>
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                <p className="text-[11px] text-sky-400 font-medium">Net Cash in Hand</p>
                <p className={clsx(
                  "text-lg font-bold mt-0.5",
                  (financials.netCashFlow || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                )}>
                  {formatINR(financials.netCashFlow)}
                </p>
                <span className="text-[10px] text-slate-400">after all project expenses</span>
              </div>
            </div>
          </div>

          {/* Receipts Table */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-white">Payment Transactions ({data.receipts?.length || 0})</h4>
              <span className="text-xs text-slate-400">Auto-synced with Partner Hisaab &amp; Cash Book</span>
            </div>

            {data.receipts && data.receipts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="border-b border-slate-800 text-slate-400 uppercase font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Client</th>
                      <th className="py-2.5 px-3">Site / Tower</th>
                      <th className="py-2.5 px-3">Received In</th>
                      <th className="py-2.5 px-3">Received By</th>
                      <th className="py-2.5 px-3">Method &amp; Purpose</th>
                      <th className="py-2.5 px-3">Reference / Notes</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {data.receipts.map((r: any) => (
                      <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-slate-400 whitespace-nowrap">
                          {new Date(r.date).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-white whitespace-nowrap">
                          {r.clientName}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {r.site?.name ? (
                            <span className="bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded text-[11px] font-medium border border-amber-500/20">
                              {r.site.name}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">Entire Project</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {r.receivedIn === 'BANK' ? (
                            <span className="inline-flex items-center gap-1 text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded text-[11px] font-medium border border-sky-500/20">
                              <Landmark className="w-3 h-3" />
                              {r.bankAccount ? `${r.bankAccount.bankName || r.bankAccount.name}${r.bankAccount.accountLast4 ? ' (..' + r.bankAccount.accountLast4 + ')' : ''}` : 'Bank Account'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded text-[11px] font-medium border border-emerald-500/20">
                              <Wallet className="w-3 h-3" />
                              Partner Wallet
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-200 whitespace-nowrap">
                          {r.receivedBy?.name || '-'}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-300">
                              {r.paymentMethod}
                            </span>
                            <span className="text-slate-400 text-[11px]">
                              {r.purpose?.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 max-w-[180px] truncate">
                          {r.reference ? <span className="text-slate-300 font-mono text-[11px] mr-1">{r.reference}</span> : null}
                          {r.notes || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-400 text-sm whitespace-nowrap">
                          +{formatINR(r.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-10 space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
                  <IndianRupee className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-white">No Client Payments Recorded Yet</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Record advance or running bill payments received from client to reflect collections against project value.
                </p>
                <Button
                  size="sm"
                  variant="primary"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                  onClick={() => {
                    setMoneyInSiteId(undefined);
                    setIsMoneyInModalOpen(true);
                  }}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Receive First Payment
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: ATTENDANCE LOGS */}
      {activeTab === 'attendance' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-sm space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Recent Attendance for this Project</h3>
            <Link href={`/attendance?projectId=${project.id}`}>
              <Button size="sm" variant="outline">
                Open Full Attendance Sheet
              </Button>
            </Link>
          </div>

          {stats.recentAttendance?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="border-b border-slate-800 text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Worker</th>
                    <th className="py-2 px-3">Skill / Category</th>
                    <th className="py-2 px-3 text-center">Status</th>
                    <th className="py-2 px-3 text-right">Wage Earned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {stats.recentAttendance.map((a: any) => (
                    <tr key={a.id} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-mono text-slate-400">
                        {new Date(a.date).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-white">{a.worker?.name}</td>
                      <td className="py-2.5 px-3 text-slate-400">{a.worker?.category}</td>
                      <td className="py-2.5 px-3 text-center">
                        <StatusBadge status={a.status} />
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-amber-400">
                        {formatINR(a.wageForDay)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-4 text-center">No attendance logged yet for this project.</p>
          )}
        </div>
      )}

      {/* TAB 4: MATERIALS */}
      {activeTab === 'materials' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-sm space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Materials Delivered to this Project</h3>
            <Link href={`/materials/received?projectId=${project.id}`}>
              <Button size="sm" variant="outline">
                Record New Delivery
              </Button>
            </Link>
          </div>

          {stats.recentMaterialReceipts?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="border-b border-slate-800 text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Material</th>
                    <th className="py-2 px-3 text-right">Quantity</th>
                    <th className="py-2 px-3 text-right">Rate</th>
                    <th className="py-2 px-3 text-right">Total Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {stats.recentMaterialReceipts.map((m: any) => (
                    <tr key={m.id} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-mono text-slate-400">
                        {new Date(m.date).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-white">{m.material?.name}</td>
                      <td className="py-2.5 px-3 text-right font-semibold">
                        {m.quantity} {m.material?.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-400">
                        {formatINR(m.purchaseRate)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                        {formatINR(m.totalCost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-4 text-center">No material receipts logged for this project yet.</p>
          )}
        </div>
      )}

      {/* TAB 5: EXPENSES */}
      {activeTab === 'expenses' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-sm space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Direct Site Expenses for this Project</h3>
            <Link href={`/finance/expenses?projectId=${project.id}`}>
              <Button size="sm" variant="outline">
                Record New Expense
              </Button>
            </Link>
          </div>

          {stats.recentExpenses?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="border-b border-slate-800 text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Category</th>
                    <th className="py-2 px-3">Description</th>
                    <th className="py-2 px-3">Paid By</th>
                    <th className="py-2 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {stats.recentExpenses.map((e: any) => (
                    <tr key={e.id} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-mono text-slate-400">
                        {new Date(e.date).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="bg-slate-800 px-2 py-0.5 rounded text-[10px] font-semibold text-slate-300">
                          {e.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-200">{e.description}</td>
                      <td className="py-2.5 px-3 text-slate-400">{e.paidBy || 'Company'}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-rose-400">
                        {formatINR(e.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-4 text-center">No expenses recorded for this project yet.</p>
          )}
        </div>
      )}

      {/* Edit Project Modal */}
      <ProjectFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={fetchProjectDetails}
        initialData={project}
      />

      {/* Site Form Modal */}
      <SiteFormModal
        isOpen={isSiteModalOpen}
        onClose={() => {
          setIsSiteModalOpen(false);
          setEditingSite(null);
        }}
        onSuccess={fetchProjectDetails}
        projectId={project.id}
        initialData={editingSite}
      />

      {/* Receive Client Payment Modal */}
      <MoneyInModal
        isOpen={isMoneyInModalOpen}
        onClose={() => {
          setIsMoneyInModalOpen(false);
          setMoneyInSiteId(undefined);
        }}
        onSuccess={fetchProjectDetails}
        defaultProjectId={project.id}
        defaultSiteId={moneyInSiteId}
        defaultClientName={project.clientName}
      />

      {/* Delete Site Confirmation Modal */}
      <Modal
        isOpen={Boolean(deletingSite)}
        onClose={() => setDeletingSite(null)}
        title="Delete Project Site"
        description="Are you sure you want to remove this site section from the project?"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-300">
            Site: <strong>{deletingSite?.name}</strong>
          </p>
          <div className="flex justify-end gap-3 pt-3">
            <Button variant="outline" size="sm" onClick={() => setDeletingSite(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleDeleteSite}>
              Delete Site
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
