'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  FolderKanban,
  Plus,
  ArrowUpRight,
  Edit2,
  Trash2,
  Building2,
  Layers,
  Phone,
  User,
  IndianRupee,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { ProjectFormModal } from '@/components/projects/ProjectFormModal';
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
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);
  const [deletingProject, setDeletingProject] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Check URL action parameter (e.g. /projects?action=new)
  useEffect(() => {
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

        <div className="flex items-center gap-3">
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
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Total Projects
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{statusCounts.ALL || 0}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Running Projects
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{statusCounts.RUNNING || 0}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl col-span-2 sm:col-span-1 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Portfolio Contract Value
          </p>
          <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">{formatINR(totalPortfolioValue)}</p>
        </div>
      </div>

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
        onClose={() => setIsFormModalOpen(false)}
        onSuccess={fetchProjects}
        initialData={editingProject}
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
