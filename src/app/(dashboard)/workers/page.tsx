'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Users,
  Plus,
  ArrowUpRight,
  Edit2,
  Trash2,
  BookOpen,
  IndianRupee,
  RefreshCw,
  Phone,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { WorkerFormModal } from '@/components/workers/WorkerFormModal';
import { formatINR } from '@/lib/calculations';
import { clsx } from 'clsx';

export default function WorkersPage() {
  const searchParams = useSearchParams();
  const [workers, setWorkers] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({
    totalWorkers: 0,
    activeWorkers: 0,
    avgDailyWage: 0,
    categoryCounts: {},
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<any>(null);
  const [deletingWorker, setDeletingWorker] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setIsFormModalOpen(true);
    }
  }, [searchParams]);

  const fetchWorkers = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const url =
        selectedCategory && selectedCategory !== 'ALL'
          ? `/api/workers?category=${encodeURIComponent(selectedCategory)}`
          : '/api/workers';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load workers');
      const data = await res.json();
      setWorkers(data.workers || []);
      setSummary(data.summary || {});
    } catch (err: any) {
      setError(err.message || 'Error fetching workers');
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    fetchWorkers();
  }, [fetchWorkers]);

  const handleDeleteConfirm = async () => {
    if (!deletingWorker) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/workers/${deletingWorker.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to archive worker');
      setDeletingWorker(null);
      fetchWorkers();
    } catch (err: any) {
      alert(err.message || 'Error deleting worker');
    } finally {
      setIsDeleting(false);
    }
  };

  const categories = [
    'ALL',
    'Mason',
    'Helper',
    'Carpenter',
    'Electrician',
    'Plumber',
    'Painter',
    'Flooring Worker',
    'Steel Worker',
    'Other',
  ];

  const columns: Column<any>[] = [
    {
      header: 'Worker / ID',
      cell: (item) => (
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <Link
              href={`/workers/${item.id}`}
              className="font-semibold text-white hover:text-amber-400 transition-colors flex items-center gap-1 group"
            >
              <span>{item.name}</span>
              <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
              <span className="font-mono text-amber-400/90">{item.workerCode}</span>
              {item.mobile && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-500" />
                    {item.mobile}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      header: 'Skill Category',
      cell: (item) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-800 text-slate-200 border border-slate-700">
          {item.category}
        </span>
      ),
    },
    {
      header: 'Daily Wage',
      className: 'text-right',
      cell: (item) => (
        <div className="text-right">
          <p className="font-bold text-amber-400 text-xs sm:text-sm">
            {formatINR(item.dailyWage)}
          </p>
          <p className="text-[10px] text-slate-400 uppercase">{item.wageUnit || 'PER_DAY'}</p>
        </div>
      ),
    },
    {
      header: 'Activity Stats',
      cell: (item) => (
        <div className="text-xs text-slate-300 space-y-0.5">
          <p>{item._count?.attendance || 0} attendance days</p>
          <p className="text-slate-400 text-[11px]">{item._count?.workRecords || 0} work logs</p>
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
          <Link href={`/khata?workerId=${item.id}`}>
            <Button size="sm" variant="ghost" className="h-8 px-2 text-xs text-slate-300 hover:text-amber-400">
              <BookOpen className="w-3.5 h-3.5 mr-1 text-amber-400" />
              Khata
            </Button>
          </Link>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-slate-400 hover:text-white"
            onClick={() => {
              setEditingWorker(item);
              setIsFormModalOpen(true);
            }}
            title="Edit Worker"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-slate-400 hover:text-rose-400"
            onClick={() => setDeletingWorker(item)}
            title="Archive Worker"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-amber-500" />
            Labour & Worker Management
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Register and manage skilled masons, carpenters, fitters, helpers, and daily wages
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" onClick={fetchWorkers} isLoading={isLoading}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Refresh
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setEditingWorker(null);
              setIsFormModalOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Worker
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Workforce</p>
          <p className="mt-1 text-2xl font-bold text-white">{summary.totalWorkers || 0}</p>
        </div>
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Active Workers</p>
          <p className="mt-1 text-2xl font-bold text-emerald-400">{summary.activeWorkers || 0}</p>
        </div>
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl col-span-2 sm:col-span-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Avg. Daily Wage</p>
          <p className="mt-1 text-2xl font-bold text-amber-400">{formatINR(summary.avgDailyWage)} / day</p>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-800/80 scrollbar-none">
        {categories.map((cat) => {
          const count = cat === 'ALL' ? summary.totalWorkers : summary.categoryCounts[cat] || 0;
          const isActive = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors',
                isActive
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              )}
            >
              <span>{cat}</span>
              <span
                className={clsx(
                  'px-1.5 py-0.2 rounded-full text-[10px] font-bold',
                  isActive ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-400'
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* DataTable */}
      <DataTable
        data={workers}
        columns={columns}
        keyExtractor={(w) => w.id}
        searchPlaceholder="Search worker name, code, skill, or mobile..."
        emptyTitle="No workers registered yet"
        emptyDescription="Add workers to your workforce to start recording daily attendance, work output, and khata ledger."
        emptyActionLabel="Add Worker"
        onEmptyAction={() => {
          setEditingWorker(null);
          setIsFormModalOpen(true);
        }}
      />

      {/* Worker Form Modal */}
      <WorkerFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSuccess={fetchWorkers}
        initialData={editingWorker}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(deletingWorker)}
        onClose={() => setDeletingWorker(null)}
        title="Archive Worker"
        description="Are you sure you want to archive this worker? Historical attendance and khata ledger transactions will be preserved."
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>
              Worker: <strong>{deletingWorker?.name}</strong> ({deletingWorker?.workerCode})
            </span>
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <Button variant="outline" size="sm" onClick={() => setDeletingWorker(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" isLoading={isDeleting} onClick={handleDeleteConfirm}>
              Confirm Archive
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
