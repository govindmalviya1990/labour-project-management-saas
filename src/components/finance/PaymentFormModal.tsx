'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { IndianRupee, CreditCard, AlertCircle, Users, Landmark, Wallet } from 'lucide-react';
import { formatINR } from '@/lib/calculations';
import { clsx } from 'clsx';

interface PaymentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultWorkerId?: string;
  defaultProjectId?: string;
  defaultType?: 'SALARY' | 'ADVANCE' | 'PAYMENT' | 'ADJUSTMENT';
  initialData?: any;
}

export function PaymentFormModal({
  isOpen,
  onClose,
  onSuccess,
  defaultWorkerId,
  defaultProjectId,
  defaultType = 'PAYMENT',
  initialData,
}: PaymentFormModalProps) {
  const [workers, setWorkers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    workerId: initialData?.workerId || defaultWorkerId || '',
    projectId: initialData?.projectId || defaultProjectId || '',
    siteId: initialData?.siteId || '',
    date: initialData?.date ? new Date(initialData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    transactionType: initialData?.transactionType || defaultType,
    amount: initialData?.amount !== undefined ? initialData.amount : 0,
    paymentMethod: initialData?.paymentMethod || 'CASH',
    sourceType: (initialData?.sourceType || 'PARTNER') as 'PARTNER' | 'BANK',
    sourceId: initialData?.sourceId || '',
    reference: initialData?.reference || '',
    notes: initialData?.notes || '',
  });

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function loadOptions() {
      try {
        const [wRes, pRes, partRes, bankRes] = await Promise.all([
          fetch('/api/workers?status=ACTIVE').then((r) => r.json()),
          fetch('/api/projects?status=RUNNING').then((r) => r.json()),
          fetch('/api/partners').then((r) => r.json()).catch(() => ({ partners: [] })),
          fetch('/api/finance/bank-accounts').then((r) => r.json()).catch(() => ({ bankAccounts: [] })),
        ]);
        const loadedWorkers = wRes.workers || [];
        const loadedProjects = pRes.projects || [];
        const loadedPartners = partRes.partners || [];
        const loadedBankAccounts = bankRes.bankAccounts || [];

        setWorkers(loadedWorkers);
        setProjects(loadedProjects);
        setPartners(loadedPartners);
        setBankAccounts(loadedBankAccounts);

        if (initialData) {
          setFormData({
            workerId: initialData.workerId || '',
            projectId: initialData.projectId || '',
            siteId: initialData.siteId || '',
            date: new Date(initialData.date).toISOString().split('T')[0],
            transactionType: initialData.transactionType || 'PAYMENT',
            amount: initialData.amount || 0,
            paymentMethod: initialData.paymentMethod || 'CASH',
            sourceType: initialData.sourceType || 'PARTNER',
            sourceId: initialData.sourceId || (loadedPartners[0]?.id || ''),
            reference: initialData.reference || '',
            notes: initialData.notes || '',
          });
        } else {
          setFormData((prev) => ({
            ...prev,
            workerId: defaultWorkerId || (loadedWorkers[0]?.id || ''),
            projectId: defaultProjectId || '',
            transactionType: defaultType,
            amount: 0,
            sourceType: prev.sourceType || 'PARTNER',
            sourceId: prev.sourceId || (loadedPartners[0]?.id || loadedBankAccounts[0]?.id || ''),
          }));
        }
      } catch (e) {
        console.error(e);
      }
    }
    if (isOpen) {
      loadOptions();
      setError('');
    }
  }, [isOpen, defaultWorkerId, defaultProjectId, defaultType, initialData]);

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

    if (!formData.sourceId) {
      setError('Please select a payment source (partner wallet or bank account)');
      return;
    }

    setIsLoading(true);

    try {
      const url = initialData ? `/api/finance/payments/${initialData.id}` : '/api/finance/payments';
      const method = initialData ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
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

  const selectedPartner = partners.find((p) => p.id === formData.sourceId);
  const selectedBank = bankAccounts.find((b) => b.id === formData.sourceId);
  const currentSourceBalance =
    formData.sourceType === 'PARTNER'
      ? (selectedPartner?.walletBalance ?? 0)
      : (selectedBank?.currentBalance ?? 0);
  const isBalanceInsufficient = formData.amount > 0 && currentSourceBalance < formData.amount;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        initialData
          ? 'Edit Disbursed Payment / Advance'
          : formData.transactionType === 'ADVANCE'
          ? 'Record Worker Advance'
          : 'Record Worker Payment'
      }
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
        {/* Payment Source / Paying From */}
        <div className="space-y-2 p-3 rounded-xl border border-slate-700/80 bg-slate-950/60">
          <label className="block text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5" />
            Payment Source (Paying From)
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                const defaultPId = partners[0]?.id || '';
                setFormData((prev) => ({
                  ...prev,
                  sourceType: 'PARTNER',
                  sourceId: prev.sourceType === 'PARTNER' && prev.sourceId ? prev.sourceId : defaultPId,
                  paymentMethod: 'CASH',
                }));
              }}
              className={clsx(
                'py-2 px-3 rounded-lg text-xs font-bold text-center transition-all border flex items-center justify-center gap-1.5',
                formData.sourceType === 'PARTNER'
                  ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm font-extrabold'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
              )}
            >
              <Users className="w-3.5 h-3.5" />
              Partner / Owner Wallet
            </button>
            <button
              type="button"
              onClick={() => {
                const defaultBId = bankAccounts[0]?.id || '';
                setFormData((prev) => ({
                  ...prev,
                  sourceType: 'BANK',
                  sourceId: prev.sourceType === 'BANK' && prev.sourceId ? prev.sourceId : defaultBId,
                  paymentMethod: 'BANK',
                }));
              }}
              className={clsx(
                'py-2 px-3 rounded-lg text-xs font-bold text-center transition-all border flex items-center justify-center gap-1.5',
                formData.sourceType === 'BANK'
                  ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm font-extrabold'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
              )}
            >
              <Landmark className="w-3.5 h-3.5" />
              Company Bank Account
            </button>
          </div>

          {formData.sourceType === 'PARTNER' ? (
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400">
                Select Paying Partner / Owner:
              </label>
              <select
                value={formData.sourceId}
                onChange={(e) => setFormData({ ...formData, sourceId: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:border-amber-500 font-medium"
              >
                {partners.length === 0 && <option value="">No partners found</option>}
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.role}) • Wallet Bal: {formatINR(p.walletBalance || 0)}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400">
                Select Paying Bank Account:
              </label>
              <select
                value={formData.sourceId}
                onChange={(e) => setFormData({ ...formData, sourceId: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:border-amber-500 font-medium"
              >
                {bankAccounts.length === 0 && <option value="">No bank accounts found</option>}
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.bankName}) {b.accountLast4 ? `•••${b.accountLast4}` : ''} • Bal: {formatINR(b.currentBalance || 0)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isBalanceInsufficient && (
            <div className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-md p-2 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              <span>
                Note: Available balance ({formatINR(currentSourceBalance)}) is less than payment amount ({formatINR(formData.amount)}).
              </span>
            </div>
          )}
        </div>

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
            {initialData ? 'Update Payment' : 'Record Payment'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
