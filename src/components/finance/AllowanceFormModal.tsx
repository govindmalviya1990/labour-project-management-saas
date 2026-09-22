'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { IndianRupee, Utensils, AlertCircle } from 'lucide-react';

interface AllowanceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultWorkerId?: string;
  defaultProjectId?: string;
}

export function AllowanceFormModal({
  isOpen,
  onClose,
  onSuccess,
  defaultWorkerId,
  defaultProjectId,
}: AllowanceFormModalProps) {
  const [workers, setWorkers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    workerId: defaultWorkerId || '',
    projectId: defaultProjectId || '',
    siteId: '',
    date: new Date().toISOString().split('T')[0],
    type: 'FOOD',
    amount: 200,
    description: '',
  });

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function loadOptions() {
      try {
        const [wRes, pRes] = await Promise.all([
          fetch('/api/workers?status=ACTIVE').then((r) => r.json()),
          fetch('/api/projects?status=RUNNING').then((r) => r.json()),
        ]);
        setWorkers(wRes.workers || []);
        setProjects(pRes.projects || []);

        setFormData((prev) => ({
          ...prev,
          workerId: defaultWorkerId || (wRes.workers?.[0]?.id || ''),
          projectId: defaultProjectId || '',
        }));
      } catch (e) {
        console.error(e);
      }
    }
    if (isOpen) {
      loadOptions();
      setError('');
    }
  }, [isOpen, defaultWorkerId, defaultProjectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.workerId) {
      setError('Please select a worker');
      return;
    }
    if (!formData.amount || formData.amount <= 0) {
      setError('Please enter a valid allowance amount');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/finance/allowances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to log allowance');
        setIsLoading(false);
        return;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError('Network error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Worker Allowance"
      description="Record food, travel, stay, or transport allowances. This increases worker earned credit on their Khata."
      maxWidth="md"
    >
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
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
                {w.name} ({w.category}) - {w.workerCode}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Allowance Type
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:border-amber-500"
            >
              <option value="FOOD">Food (Khoraki)</option>
              <option value="TRAVEL">Travel / Conveyance</option>
              <option value="STAY">Stay / Accommodation</option>
              <option value="TRANSPORT">Transport</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <Input
            label="Allowance Amount (₹)"
            type="number"
            min="1"
            required
            placeholder="200"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
            leftIcon={<IndianRupee className="w-4 h-4 text-emerald-400" />}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Date"
            type="date"
            required
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Project (Optional)
            </label>
            <select
              value={formData.projectId}
              onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:border-amber-500"
            >
              <option value="">No Project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Input
          label="Description / Purpose"
          placeholder="e.g. Night shift overtime dinner"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        />

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md" isLoading={isLoading}>
            Add Allowance
          </Button>
        </div>
      </form>
    </Modal>
  );
}
