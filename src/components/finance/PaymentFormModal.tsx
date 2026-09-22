'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { IndianRupee, CreditCard, AlertCircle } from 'lucide-react';

interface PaymentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultWorkerId?: string;
  defaultProjectId?: string;
  defaultType?: 'SALARY' | 'ADVANCE' | 'PAYMENT' | 'ADJUSTMENT';
}

export function PaymentFormModal({
  isOpen,
  onClose,
  onSuccess,
  defaultWorkerId,
  defaultProjectId,
  defaultType = 'PAYMENT',
}: PaymentFormModalProps) {
  const [workers, setWorkers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    workerId: defaultWorkerId || '',
    projectId: defaultProjectId || '',
    siteId: '',
    date: new Date().toISOString().split('T')[0],
    transactionType: defaultType,
    amount: 1000,
    paymentMethod: 'CASH',
    reference: '',
    notes: '',
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
          transactionType: defaultType,
        }));
      } catch (e) {
        console.error(e);
      }
    }
    if (isOpen) {
      loadOptions();
      setError('');
    }
  }, [isOpen, defaultWorkerId, defaultProjectId, defaultType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.workerId) {
      setError('Please select a worker');
      return;
    }
    if (!formData.amount || formData.amount <= 0) {
      setError('Please enter a valid payment amount');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/finance/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to record payment');
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
      title={formData.transactionType === 'ADVANCE' ? 'Record Worker Advance' : 'Record Worker Payment'}
      description="Disburse wages or advances to workers. This automatically updates the worker Khata ledger."
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
              Transaction Type
            </label>
            <select
              value={formData.transactionType}
              onChange={(e) => setFormData({ ...formData, transactionType: e.target.value as any })}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:border-amber-500"
            >
              <option value="PAYMENT">Regular Payment</option>
              <option value="ADVANCE">Advance (Peshgi)</option>
              <option value="SALARY">Salary Settlement</option>
              <option value="ADJUSTMENT">Adjustment</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Payment Method
            </label>
            <select
              value={formData.paymentMethod}
              onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as any })}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:border-amber-500"
            >
              <option value="CASH">Cash</option>
              <option value="UPI">UPI (GPay/PhonePe)</option>
              <option value="BANK">Bank Transfer (NEFT/IMPS)</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Payment Amount (₹)"
            type="number"
            min="1"
            required
            placeholder="5000"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
            leftIcon={<IndianRupee className="w-4 h-4 text-amber-500" />}
          />

          <Input
            label="Date of Payment"
            type="date"
            required
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
            Linked Project (Optional)
          </label>
          <select
            value={formData.projectId}
            onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
            className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:border-amber-500"
          >
            <option value="">General Company Expense / No Project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.projectCode})
              </option>
            ))}
          </select>
        </div>

        <Input
          label="Transaction Reference / Cheque / UTR No."
          placeholder="e.g. UPI Ref 3829103912 or Cheque #1234"
          value={formData.reference}
          onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
          leftIcon={<CreditCard className="w-4 h-4 text-slate-500" />}
        />

        <Input
          label="Notes / Reason"
          placeholder="e.g. Festival advance or Weekly settlement"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
        />

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md" isLoading={isLoading}>
            Record Payment
          </Button>
        </div>
      </form>
    </Modal>
  );
}
