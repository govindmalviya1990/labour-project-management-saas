'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Hammer,
  Plus,
  TrendingUp,
  Calendar,
  Building2,
  Users,
  IndianRupee,
  RefreshCw,
  AlertCircle,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { MetricCard } from '@/components/ui/MetricCard';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { DataTable, Column } from '@/components/ui/DataTable';
import { formatINR } from '@/lib/calculations';
import { clsx } from 'clsx';

export default function WorkPage() {
  const [workRecords, setWorkRecords] = useState<any[]>([]);
  const [productivity, setProductivity] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'logs' | 'productivity'>('logs');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // New Work Log Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    workerId: '',
    projectId: '',
    siteId: '',
    task: 'Flooring',
    description: '',
    quantity: 450,
    unit: 'sq.ft.',
    rate: 12,
    notes: '',
  });

  const calculatedWorkValue = (formData.quantity || 0) * (formData.rate || 0);

  // Load workers & projects for dropdowns
  useEffect(() => {
    async function loadMeta() {
      try {
        const [wRes, pRes] = await fetchAllMeta();
        setWorkers(wRes.workers || []);
        setProjects(pRes.projects || []);
        if (wRes.workers?.length > 0) {
          setFormData((prev) => ({ ...prev, workerId: wRes.workers[0].id }));
        }
        if (pRes.projects?.length > 0) {
          setFormData((prev) => ({ ...prev, projectId: pRes.projects[0].id }));
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadMeta();
  }, []);

  async function fetchAllMeta() {
    const [w, p] = await Promise.all([
      fetch('/api/workers?status=ACTIVE').then((r) => r.json()),
      fetch('/api/projects?status=RUNNING').then((r) => r.json()),
    ]);
    return [w, p];
  }

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [recordsRes, prodRes] = await Promise.all([
        fetch('/api/work').then((r) => r.json()),
        fetch('/api/productivity').then((r) => r.json()),
      ]);

      setWorkRecords(recordsRes.records || []);
      setProductivity(prodRes.productivity || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load work records');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateWorkRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');

    if (!formData.workerId || !formData.projectId) {
      setModalError('Worker and Project are required');
      return;
    }
    if (!formData.task.trim()) {
      setModalError('Task description is required');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/work', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save work record');

      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      setModalError(err.message || 'Error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const columns: Column<any>[] = [
    {
      header: 'Date / Project',
      cell: (item) => (
        <div className="space-y-0.5 text-xs">
          <p className="font-mono text-slate-400">{new Date(item.date).toLocaleDateString()}</p>
          <p className="font-semibold text-white">{item.project?.name}</p>
          {item.site?.name && <p className="text-[11px] text-slate-400">Site: {item.site.name}</p>}
        </div>
      ),
    },
    {
      header: 'Worker',
      cell: (item) => (
        <div className="text-xs">
          <p className="font-semibold text-white">{item.worker?.name}</p>
          <p className="text-slate-400 text-[11px]">
            {item.worker?.category} ({item.worker?.workerCode})
          </p>
        </div>
      ),
    },
    {
      header: 'Task & Details',
      cell: (item) => (
        <div className="text-xs">
          <p className="font-semibold text-amber-400">{item.task}</p>
          {item.description && <p className="text-slate-400 text-[11px]">{item.description}</p>}
        </div>
      ),
    },
    {
      header: 'Quantity & Unit',
      className: 'text-right',
      cell: (item) => (
        <div className="text-right font-medium text-slate-200 text-xs">
          {item.quantity?.toLocaleString()} {item.unit}
        </div>
      ),
    },
    {
      header: 'Rate',
      className: 'text-right',
      cell: (item) => (
        <div className="text-right text-slate-300 text-xs">
          {formatINR(item.rate)} / {item.unit}
        </div>
      ),
    },
    {
      header: 'Total Value',
      className: 'text-right',
      cell: (item) => (
        <div className="text-right font-bold text-amber-400 text-xs sm:text-sm">
          {formatINR(item.totalWorkValue)}
        </div>
      ),
    },
  ];

  const totalQuantitySum = workRecords.reduce((sum, r) => sum + (r.quantity || 0), 0);
  const totalWorkValueSum = workRecords.reduce((sum, r) => sum + (r.totalWorkValue || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Hammer className="w-6 h-6 text-amber-500" />
            Work Output & Productivity
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Track daily work volume, sq.ft. output, rates, and worker performance metrics
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" onClick={fetchData} isLoading={isLoading}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Refresh
          </Button>
          <Button size="sm" variant="primary" onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Record Work
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard
          title="Total Work Logs"
          value={workRecords.length}
          subtitle="Completed assignments"
          icon={<Hammer className="w-5 h-5 text-indigo-400" />}
          variant="blue"
        />
        <MetricCard
          title="Total Output Quantity"
          value={totalQuantitySum.toLocaleString()}
          subtitle="Cumulative units"
          icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
          variant="emerald"
        />
        <MetricCard
          title="Total Work Value"
          value={formatINR(totalWorkValueSum)}
          subtitle="Value of work output"
          icon={<IndianRupee className="w-5 h-5 text-amber-400" />}
          variant="amber"
        />
        <MetricCard
          title="Workers Active"
          value={productivity.length}
          subtitle="Contributing labour"
          icon={<Users className="w-5 h-5 text-slate-400" />}
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={clsx(
            'px-4 py-2 rounded-lg text-xs font-semibold transition-colors',
            activeTab === 'logs'
              ? 'bg-amber-500 text-slate-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          )}
        >
          Daily Work Logs ({workRecords.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('productivity')}
          className={clsx(
            'px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5',
            activeTab === 'productivity'
              ? 'bg-amber-500 text-slate-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          )}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          Worker Productivity Leaderboard
        </button>
      </div>

      {/* TAB 1: WORK LOGS */}
      {activeTab === 'logs' && (
        <DataTable
          data={workRecords}
          columns={columns}
          keyExtractor={(r) => r.id}
          searchPlaceholder="Search task, worker name, or project..."
          emptyTitle="No work records logged yet"
          emptyDescription="Record completed site tasks with quantities and rates to track labour output."
          emptyActionLabel="Record First Task"
          onEmptyAction={() => setIsModalOpen(true)}
        />
      )}

      {/* TAB 2: PRODUCTIVITY LEADERBOARD (Prompt Section 16) */}
      {activeTab === 'productivity' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-sm animate-fade-in">
          <div className="p-4 border-b border-slate-800">
            <h3 className="text-sm font-semibold text-white">Worker Productivity Performance</h3>
            <p className="text-xs text-slate-400">
              Average output per day worked and unit cost calculations
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="border-b border-slate-800 bg-slate-950/60 uppercase font-semibold text-slate-400">
                <tr>
                  <th className="py-3 px-4">Worker / Category</th>
                  <th className="py-3 px-3 text-center">Days Worked</th>
                  <th className="py-3 px-3 text-right">Total Output</th>
                  <th className="py-3 px-3 text-right">Avg Output / Day</th>
                  <th className="py-3 px-3 text-right">Work Value</th>
                  <th className="py-3 px-4 text-right">Cost Per Unit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {productivity.map((p) => (
                  <tr key={p.workerId} className="hover:bg-slate-800/30">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-white text-sm">{p.name}</p>
                      <p className="text-slate-400 text-[11px]">{p.category} ({p.workerCode})</p>
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-white">
                      {p.daysWorked} days
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-emerald-400">
                      {p.totalQuantity.toLocaleString()} {p.unit}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-amber-400">
                      {p.averageQuantityPerDay.toLocaleString()} {p.unit} / day
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-slate-200">
                      {formatINR(p.workValue)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-300">
                      {formatINR(p.costPerUnit)} / {p.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Work Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Record Completed Work Task"
        description="Log worker output with measurements and rates (e.g. Ramesh Flooring 450 sq.ft. @ ₹12 = ₹5,400)."
        maxWidth="lg"
      >
        {modalError && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{modalError}</span>
          </div>
        )}

        <form onSubmit={handleCreateWorkRecord} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Date of Work"
              type="date"
              required
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Worker
              </label>
              <select
                value={formData.workerId}
                onChange={(e) => setFormData({ ...formData, workerId: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:border-amber-500"
              >
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.category})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Project
              </label>
              <select
                value={formData.projectId}
                onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:border-amber-500"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Task Name"
              required
              placeholder="e.g. Flooring, Plastering, Brickwork"
              value={formData.task}
              onChange={(e) => setFormData({ ...formData, task: e.target.value })}
            />

            <Input
              label="Completed Quantity"
              type="number"
              min="0"
              step="any"
              required
              placeholder="450"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Measurement Unit
              </label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:border-amber-500"
              >
                <option value="sq.ft.">sq.ft.</option>
                <option value="sq.m.">sq.m.</option>
                <option value="running ft.">running ft.</option>
                <option value="meter">meter</option>
                <option value="piece">piece</option>
                <option value="kg">kg</option>
                <option value="ton">ton</option>
                <option value="hour">hour</option>
                <option value="day">day</option>
              </select>
            </div>

            <Input
              label={`Rate (₹ / ${formData.unit})`}
              type="number"
              min="0"
              step="any"
              required
              placeholder="12"
              value={formData.rate}
              onChange={(e) => setFormData({ ...formData, rate: Number(e.target.value) })}
            />

            <Input
              label="Task Description / Details"
              placeholder="e.g. 2nd Floor Master Bedroom vitrified tiles"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          {/* Live Calculated Work Value Preview */}
          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">Calculated Task Work Value:</span>
            <span className="text-base font-bold text-amber-400">
              {formatINR(calculatedWorkValue)}
            </span>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" isLoading={isSaving}>
              Save Work Record
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
