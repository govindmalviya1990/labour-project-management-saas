'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  FolderKanban,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Edit2,
  Trash2,
  Building2,
  Layers,
  Phone,
  User,
  IndianRupee,
  TrendingDown,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { ProjectFormModal } from '@/components/projects/ProjectFormModal';
import { MoneyInModal } from '@/components/finance/MoneyInModal';
import { formatINR } from '@/lib/calculations';
import { clsx } from 'clsx';

export default function ProjectsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialStatus = searchParams.get('status') || 'ALL';

  const [activeStatus, setActiveStatus] = useState<string>(initialStatus);
  const [projects, setProjects] = useState<any[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [totalPortfolioValue, setTotalPortfolioValue] = useState<number>(0);
  const [totalPaymentReceived, setTotalPaymentReceived] = useState<number>(0);
  const [totalRemainingPayment, setTotalRemainingPayment] = useState<number>(0);
  const [overallCollectionPercentage, setOverallCollectionPercentage] = useState<number>(0);
  const [totalNetCashInHand, setTotalNetCashInHand] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isMoneyInModalOpen, setIsMoneyInModalOpen] = useState(false);
  const [selectedProjectForMoneyIn, setSelectedProjectForMoneyIn] = useState<any>(null);
  const [editingProject, setEditingProject] = useState<any>(null);
  const [deletingProject, setDeletingProject] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Sync status and action from URL parameters
  useEffect(() => {
    const statusParam = searchParams.get('status') || 'ALL';
    setActiveStatus(statusParam);

    if (searchParams.get('action') === 'new') {
      setIsFormModalOpen(true);
    }
  }, [searchParams]);

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const url =
        activeStatus && activeStatus !== 'ALL'
          ? `/api/projects?status=${activeStatus}`
          : '/api/projects';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch projects');
      const data = await res.json();
      setProjects(data.projects || []);
      setStatusCounts(data.statusCounts || {});
      setTotalPortfolioValue(data.totalPortfolioValue || 0);
      setTotalPaymentReceived(data.totalPaymentReceived || 0);
      setTotalRemainingPayment(data.totalRemainingPayment || 0);
      setOverallCollectionPercentage(data.overallCollectionPercentage || 0);
      setTotalNetCashInHand(data.totalNetCashInHand || 0);
    } catch (err: any) {
      setError(err.message || 'Error fetching projects');
    } finally {
      setIsLoading(false);
    }
  }, [activeStatus]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleTabChange = (status: string) => {
    setActiveStatus(status);
    if (status === 'ALL') {
      router.push('/projects');
    } else {
      router.push(`/projects?status=${status}`);
    }
  };

  const handleCreateNew = () => {
    setEditingProject(null);
    setIsFormModalOpen(true);
  };

  const handleEdit = (project: any) => {
    setEditingProject(project);
    setIsFormModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingProject) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/projects/${deletingProject.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete project');
      setDeletingProject(null);
      fetchProjects();
    } catch (err: any) {
      alert(err.message || 'Error deleting project');
    } finally {
      setIsDeleting(false);
    }
  };

  const statusTabs = [
    { key: 'ALL', label: 'All Projects' },
    { key: 'RUNNING', label: 'Running' },
    { key: 'ENQUIRY', label: 'Enquiry' },
    { key: 'COMING_SOON', label: 'Coming Soon' },
    { key: 'COMPLETED', label: 'Completed' },
    { key: 'ON_HOLD', label: 'On Hold' },
  ];

  const columns: Column<any>[] = [
    {
      header: 'Project / Code',
      cell: (item) => (
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 font-bold">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <Link
              href={`/projects/${item.id}`}
              className="font-semibold text-white hover:text-amber-400 transition-colors flex items-center gap-1 group"
            >
              <span>{item.name}</span>
              <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
              <span className="font-mono text-amber-400/90">{item.projectCode}</span>
              <span>•</span>
              <span>{item.projectType || 'General'}</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      header: 'Location / Client',
      cell: (item) => (
        <div className="space-y-0.5 text-xs">
          <p className="text-slate-200">{item.location || 'Site office'}</p>
          {item.clientName && (
            <p className="text-slate-400 flex items-center gap-1">
              <User className="w-3 h-3 text-slate-500" />
              <span>{item.clientName}</span>
              {item.clientMobile && <span>({item.clientMobile})</span>}
            </p>
          )}
        </div>
      ),
    },
    {
      header: 'Sites / Towers',
      cell: (item) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-300">
          <Layers className="w-3.5 h-3.5 text-amber-400" />
          <span>{item.sites?.length || 0} sites</span>
        </div>
      ),
    },
    {
      header: 'Contract Value',
      className: 'text-right',
      cell: (item) => (
        <div className="text-right">
          <p className="font-bold text-white text-xs sm:text-sm">{formatINR(item.projectValue)}</p>
          <p className="text-[11px] text-slate-400">
            Est: {formatINR(item.estimatedTotalCost)}
          </p>
        </div>
      ),
    },
    {
      header: 'Payment Received',
      className: 'text-right',
      cell: (item) => (
        <div className="text-right">
          <p className="font-bold text-emerald-400 text-xs sm:text-sm">
            {formatINR(item.totalReceived || 0)}
          </p>
          <div className="flex items-center justify-end gap-1 text-[11px] text-slate-400">
            <span className="text-emerald-400 font-medium">{item.collectionPercentage || 0}%</span>
            <span>rec</span>
            {item.receiptsCount > 0 && <span className="text-slate-500">({item.receiptsCount})</span>}
          </div>
        </div>
      ),
    },
    {
      header: 'Remaining Due',
      className: 'text-right',
      cell: (item) => {
        const remaining = item.remainingPayment ?? Math.max(0, (item.projectValue || 0) - (item.totalReceived || 0));
        const isPaid = remaining <= 0 && (item.projectValue || 0) > 0;
        return (
          <div className="text-right">
            <p className={clsx(
              "font-bold text-xs sm:text-sm",
              isPaid ? "text-emerald-400" : "text-amber-300"
            )}>
              {formatINR(remaining)}
            </p>
            <p className="text-[11px] text-slate-400">
              {isPaid ? (
                <span className="text-emerald-400 font-medium">100% Cleared</span>
              ) : (
                <span>{Math.max(0, 100 - (item.collectionPercentage || 0)).toFixed(0)}% pending</span>
              )}
            </p>
          </div>
        );
      },
    },
    {
      header: 'Status',
      className: 'text-center',
      cell: (item) => (
        <div className="text-center">
          <StatusBadge status={item.status} />
        </div>
      ),
    },
    {
      header: 'Actions',
      className: 'text-right',
      cell: (item) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
            onClick={() => {
              setSelectedProjectForMoneyIn(item);
              setIsMoneyInModalOpen(true);
            }}
            title="Receive Payment for this Project"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            <span className="hidden sm:inline">Receive</span>
          </Button>
          <Link href={`/projects/${item.id}`}>
            <Button size="sm" variant="ghost" className="h-8 px-2 text-xs">
              <ArrowUpRight className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline ml-1">Dashboard</span>
            </Button>
          </Link>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-slate-400 hover:text-white"
            onClick={() => handleEdit(item)}
            title="Edit Project"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-slate-400 hover:text-rose-400"
            onClick={() => setDeletingProject(item)}
            title="Archive Project"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <FolderKanban className="w-6 h-6 text-amber-500" />
            Project Management
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage construction sites, lifecycle statuses, project values, and budget estimates
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="primary"
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-sm"
            onClick={() => {
              setSelectedProjectForMoneyIn(null);
              setIsMoneyInModalOpen(true);
            }}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Receive Payment
          </Button>
          <Button size="sm" variant="outline" onClick={fetchProjects} isLoading={isLoading}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Refresh
          </Button>
          <Button size="sm" variant="primary" onClick={handleCreateNew}>
            <Plus className="w-4 h-4 mr-1.5" />
            New Project
          </Button>
        </div>
      </div>

      {/* Metric Counters Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Total Projects
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{statusCounts.ALL || 0}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">{statusCounts.RUNNING || 0} active running</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Portfolio Contract Value
          </p>
          <p className="mt-1 text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400">
            {formatINR(totalPortfolioValue)}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Total across all sites</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-emerald-500/30 dark:border-emerald-500/20 p-4 rounded-xl shadow-sm bg-emerald-500/5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Payment Received
            </p>
            <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              {overallCollectionPercentage}%
            </span>
          </div>
          <p className="mt-1 text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatINR(totalPaymentReceived)}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Total collected from clients
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-amber-500/30 dark:border-amber-500/20 p-4 rounded-xl shadow-sm bg-amber-500/5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-300 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              Remaining Due
            </p>
            <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
              {Math.max(0, 100 - overallCollectionPercentage).toFixed(1)}%
            </span>
          </div>
          <p className="mt-1 text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-300">
            {formatINR(totalRemainingPayment)}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Pending from clients
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl col-span-2 sm:col-span-1 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
            Net Cash in Hand
          </p>
          <p className={clsx(
            "mt-1 text-xl sm:text-2xl font-bold",
            totalNetCashInHand >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
          )}>
            {formatINR(totalNetCashInHand)}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Received &minus; Site Expenses
          </p>
        </div>
      </div>

      {/* Collection Progress Bar */}
      {totalPortfolioValue > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-3 rounded-xl shadow-sm -mt-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Portfolio Client Collection Progress (All Sites &amp; Projects)
            </span>
            <div className="flex items-center gap-3">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                Received: {formatINR(totalPaymentReceived)} ({overallCollectionPercentage}%)
              </span>
              <span className="text-slate-400 dark:text-slate-600">&bull;</span>
              <span className="text-amber-600 dark:text-amber-300 font-semibold">
                Remaining Due: {formatINR(totalRemainingPayment)}
              </span>
            </div>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-300 dark:border-slate-700/60">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, overallCollectionPercentage)}%` }}
            />
          </div>
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-800/80 scrollbar-none">
        {statusTabs.map((tab) => {
          const count = statusCounts[tab.key] || 0;
          const isActive = activeStatus === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              className={clsx(
                'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer',
                isActive
                  ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800'
              )}
            >
              <span>{tab.label}</span>
              <span
                className={clsx(
                  'px-1.5 py-0.2 rounded-full text-[10px] font-bold',
                  isActive
                    ? 'bg-slate-950/20 text-slate-950'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Projects DataTable */}
      <DataTable
        data={projects}
        columns={columns}
        keyExtractor={(p) => p.id}
        searchPlaceholder="Search project name, code, client, or location..."
        emptyTitle="No projects found"
        emptyDescription="Create your first construction project to begin tracking work, workers, expenses, and materials."
        emptyActionLabel="Create Project"
        onEmptyAction={handleCreateNew}
      />

      {/* Project Create/Edit Modal */}
      <ProjectFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingProject(null);
        }}
        onSuccess={() => {
          setEditingProject(null);
          fetchProjects();
        }}
        initialData={editingProject}
      />

      {/* Receive Client Payment Modal */}
      <MoneyInModal
        isOpen={isMoneyInModalOpen}
        onClose={() => {
          setIsMoneyInModalOpen(false);
          setSelectedProjectForMoneyIn(null);
        }}
        onSuccess={() => {
          fetchProjects();
        }}
        defaultProjectId={selectedProjectForMoneyIn?.id}
        defaultClientName={selectedProjectForMoneyIn?.clientName}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(deletingProject)}
        onClose={() => setDeletingProject(null)}
        title="Archive Project"
        description="Are you sure you want to archive this project? This will hide it from the active project registry while preserving existing historical financial records."
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>
              Project: <strong>{deletingProject?.name}</strong> ({deletingProject?.projectCode})
            </span>
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <Button variant="outline" size="sm" onClick={() => setDeletingProject(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={isDeleting}
              onClick={handleDeleteConfirm}
            >
              Confirm Archive
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
