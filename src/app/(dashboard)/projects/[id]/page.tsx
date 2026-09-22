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
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { MetricCard } from '@/components/ui/MetricCard';
import { Modal } from '@/components/ui/Modal';
import { ProjectFormModal } from '@/components/projects/ProjectFormModal';
import { SiteFormModal } from '@/components/projects/SiteFormModal';
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
  const [activeTab, setActiveTab] = useState<'overview' | 'sites' | 'attendance' | 'materials' | 'expenses'>('overview');

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSiteModalOpen, setIsSiteModalOpen] = useState(false);
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
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
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

          <div className="flex items-center gap-6 border-t lg:border-t-0 border-slate-800 pt-3 lg:pt-0">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                Project Value
              </p>
              <p className="text-xl sm:text-2xl font-bold text-amber-400">
                {formatINR(project.projectValue)}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                Target Quantity
              </p>
              <p className="text-lg sm:text-xl font-bold text-white">
                {project.targetQuantity?.toLocaleString() || 0}{' '}
                <span className="text-xs text-slate-400">{project.targetUnit || 'sq.ft.'}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 8 Financial Summary KPI Cards (Prompt Section 28) */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Live Project Financial Metrics
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
            title="Project Sites / Towers"
            value={project.sites?.length || 0}
            subtitle="Active site breakdown"
            icon={<Layers className="w-5 h-5 text-indigo-400" />}
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
              ? 'bg-amber-500 text-slate-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          )}
        >
          <Layers className="w-3.5 h-3.5" />
          Project Sites ({project.sites?.length || 0})
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

                <div className="border-t border-slate-800/80 pt-2 flex items-center justify-between text-[11px] text-slate-400">
                  <span>{site._count?.attendance || 0} attendance records</span>
                  <span>{site._count?.expenses || 0} expenses</span>
                </div>
              </div>
            ))}
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
