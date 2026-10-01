'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ArrowUpRight, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface UserOption {
  id: string;
  name: string;
  role?: string;
}

interface WorkerOption {
  id: string;
  name: string;
  workerCode: string;
  category: string;
}

interface ProjectOption {
  id: string;
  name: string;
  projectCode: string;
  sites?: { id: string; name: string }[];
}

interface FundTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultDate?: string;
  currentUserRole?: string;
}

export function FundTransferModal({
  isOpen,
  onClose,
  onSuccess,
  defaultDate,
  currentUserRole = 'PARTNER',
}: FundTransferModalProps) {
  const isSupervisor = currentUserRole === 'SITE_SUPERVISOR' || currentUserRole === 'SUPERVISOR';

  const [transferType, setTransferType] = useState<string>(
    isSupervisor ? 'SUPERVISOR_TO_WORKER' : 'PARTNER_TO_SUPERVISOR'
  );
  const [users, setUsers] = useState<UserOption[]>([]);
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);

  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(defaultDate || new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [purpose, setPurpose] = useState('SITE_EXPENSE');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDate(defaultDate || new Date().toISOString().split('T')[0]);
      setError(null);
      fetchDependencies();
    }
  }, [isOpen, defaultDate]);

  const fetchDependencies = async () => {
    setLoadingData(true);
    try {
      const [uRes, wRes, pRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/workers?limit=200'),
        fetch('/api/projects'),
      ]);

      if (uRes.ok) {
        const uData = await uRes.json();
        setUsers(uData.users || []);
      }
      if (wRes.ok) {
        const wData = await wRes.json();
        setWorkers(wData.workers || []);
      }
      if (pRes.ok) {
        const pData = await pRes.json();
        setProjects(pData.projects || []);
      }
    } catch (err) {
      console.error('Failed to load transfer dependencies:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const isWorkerTarget =
    transferType === 'PARTNER_TO_WORKER' || transferType === 'SUPERVISOR_TO_WORKER';
  const isDrawing = transferType === 'PARTNER_DRAWING';
  const isUserTarget = !isWorkerTarget && !isDrawing;

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const availableSites = selectedProject?.sites || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }

    if (isWorkerTarget && !selectedWorkerId) {
      setError('Please select a worker for payment');
      return;
    }

    if (isUserTarget && !selectedUserId) {
      setError('Please select a recipient');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/finance/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transferType,
          toUserId: isUserTarget ? selectedUserId : null,
          toWorkerId: isWorkerTarget ? selectedWorkerId : null,
          projectId: selectedProjectId || null,
          siteId: selectedSiteId || null,
          amount: parsedAmount,
          date,
          paymentMethod,
          purpose,
          notes: notes.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to record fund transfer');
      }

      setAmount('');
      setNotes('');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Give Money (Fund Transfer / Worker Payout)"
      description="Record cash given to supervisor, direct worker salary/advance, or drawing. Debited from your cash book automatically."
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 text-sm text-rose-400 bg-rose-950/40 border border-rose-800 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Transfer Type Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Transfer Category <span className="text-rose-400">*</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {!isSupervisor && (
              <button
                type="button"
                onClick={() => {
                  setTransferType('PARTNER_TO_SUPERVISOR');
                  setPurpose('SITE_EXPENSE');
                }}
                className={`px-3 py-2 text-xs font-medium rounded-lg border text-left transition-colors ${
                  transferType === 'PARTNER_TO_SUPERVISOR'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                👷 To Supervisor
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setTransferType(isSupervisor ? 'SUPERVISOR_TO_WORKER' : 'PARTNER_TO_WORKER');
                setPurpose('ADVANCE');
              }}
              className={`px-3 py-2 text-xs font-medium rounded-lg border text-left transition-colors ${
                isWorkerTarget
                  ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              🔨 To Worker (Khata Sync)
            </button>

            {!isSupervisor && (
              <button
                type="button"
                onClick={() => {
                  setTransferType('PARTNER_TO_PARTNER');
                  setPurpose('SETTLEMENT');
                }}
                className={`px-3 py-2 text-xs font-medium rounded-lg border text-left transition-colors ${
                  transferType === 'PARTNER_TO_PARTNER'
                    ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                🤝 Partner to Partner
              </button>
            )}

            {!isSupervisor && (
              <button
                type="button"
                onClick={() => {
                  setTransferType('PARTNER_DRAWING');
                  setPurpose('PERSONAL_DRAWING');
                }}
                className={`px-3 py-2 text-xs font-medium rounded-lg border text-left transition-colors ${
                  transferType === 'PARTNER_DRAWING'
                    ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                💼 Partner Drawing (Self)
              </button>
            )}
          </div>
        </div>

        {/* Worker Notice for Zero Double Counting */}
        {isWorkerTarget && (
          <div className="flex items-start gap-2 p-2.5 bg-blue-950/30 border border-blue-800/60 rounded-lg text-xs text-blue-300">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-blue-400 mt-0.5" />
            <span>
              <strong>Zero Double Counting:</strong> Debited from your Cash Book once, and automatically credited to the worker&apos;s ledger as payment without creating redundant expense entries.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Target: Worker or User */}
          {isWorkerTarget && (
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Select Worker <span className="text-rose-400">*</span>
              </label>
              <select
                value={selectedWorkerId}
                onChange={(e) => setSelectedWorkerId(e.target.value)}
                required
                className="w-full h-10 px-3 text-sm rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="">Select Worker...</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.workerCode} - {w.category})
                  </option>
                ))}
              </select>
            </div>
          )}

          {isUserTarget && (
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Select Recipient Person <span className="text-rose-400">*</span>
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                required
                className="w-full h-10 px-3 text-sm rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="">Select Person...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role || 'User'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Amount Given (₹) <span className="text-rose-400">*</span>
            </label>
            <Input
              type="number"
              min="1"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 10000"
              required
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Transfer Date <span className="text-rose-400">*</span>
            </label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full h-10 px-3 text-sm rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="CASH">💵 Cash</option>
              <option value="UPI">📱 UPI</option>
              <option value="BANK">🏦 Bank Transfer</option>
            </select>
          </div>

          {/* Purpose */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Purpose / Reason
            </label>
            <select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="w-full h-10 px-3 text-sm rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="SITE_EXPENSE">Site Daily Expenses &amp; Petty Cash</option>
              <option value="ADVANCE">Worker Advance (Kharcha)</option>
              <option value="SALARY">Salary Payout</option>
              <option value="PERSONAL_DRAWING">Partner Drawing</option>
              <option value="SETTLEMENT">Internal Settlement</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          {/* Linked Project (Optional) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Related Project (Optional)
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                setSelectedSiteId('');
              }}
              className="w-full h-10 px-3 text-sm rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="">None / General Cash</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Linked Site */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Related Site / Tower (Optional)
            </label>
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className="w-full h-10 px-3 text-sm rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="">All / Entire Project</option>
              {availableSites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Remarks */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Remarks / Instructions
          </label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Given cash to Ramesh for site labour kharcha"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold flex items-center gap-2 shadow-lg shadow-amber-900/30"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowUpRight className="w-4 h-4" />
            )}
            Debit Cash Book
          </Button>
        </div>
      </form>
    </Modal>
  );
}
