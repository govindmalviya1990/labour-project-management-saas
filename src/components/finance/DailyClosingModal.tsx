'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Lock, Loader2, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';

interface DailyClosingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  date: string;
  systemClosingBalance: number;
  existingActualCash?: number | null;
  existingNotes?: string | null;
  isAlreadyVerified?: boolean;
}

export function DailyClosingModal({
  isOpen,
  onClose,
  onSuccess,
  date,
  systemClosingBalance,
  existingActualCash,
  existingNotes,
  isAlreadyVerified = false,
}: DailyClosingModalProps) {
  const [actualCash, setActualCash] = useState<string>(
    existingActualCash !== undefined && existingActualCash !== null ? existingActualCash.toString() : ''
  );
  const [notes, setNotes] = useState(existingNotes || '');
  const [isVerified, setIsVerified] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActualCash(
        existingActualCash !== undefined && existingActualCash !== null
          ? existingActualCash.toString()
          : systemClosingBalance.toString()
      );
      setNotes(existingNotes || '');
      setIsVerified(true);
      setError(null);
    }
  }, [isOpen, existingActualCash, existingNotes, systemClosingBalance]);

  const parsedActual = actualCash === '' ? null : parseFloat(actualCash);
  const discrepancy =
    parsedActual !== null && !isNaN(parsedActual)
      ? Math.round((parsedActual - systemClosingBalance) * 100) / 100
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedActual === null || isNaN(parsedActual)) {
      setError('Please enter the physical cash counted in hand');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/wallet/closing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          actualCash: parsedActual,
          notes: notes.trim() || null,
          isVerified,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save daily closing');
      }

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
      title="Daily Cash Closing (Din Ka Hisaab)"
      description="Verify physical cash counted in hand against system calculated closing balance. Locking secures past entries against unauthorized edits."
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 text-sm text-rose-400 bg-rose-950/40 border border-rose-800 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isAlreadyVerified && (
          <div className="flex items-start gap-2 p-2.5 bg-emerald-950/30 border border-emerald-800/60 rounded-lg text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
            <span>
              This day was already verified. Saving updates will re-verify the cash count.
            </span>
          </div>
        )}

        {/* Closing Date & System Balance summary */}
        <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-950 border border-slate-800 rounded-xl">
          <div>
            <span className="text-[11px] text-slate-400 block font-medium">Closing Date:</span>
            <span className="text-sm font-semibold text-slate-200">
              {new Date(date).toLocaleDateString('en-IN', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block font-medium">System Closing:</span>
            <span className="text-base font-bold text-amber-400">
              ₹{systemClosingBalance.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* Physical Cash Input */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Physical Cash in Hand (Counted) <span className="text-rose-400">*</span>
          </label>
          <Input
            type="number"
            step="any"
            value={actualCash}
            onChange={(e) => setActualCash(e.target.value)}
            placeholder="Enter physical cash counted"
            required
            autoFocus
          />
        </div>

        {/* Discrepancy Indicator Card */}
        {discrepancy !== null && (
          <div
            className={`flex items-center justify-between p-3 rounded-xl border text-xs font-semibold ${
              discrepancy === 0
                ? 'bg-emerald-950/30 border-emerald-800 text-emerald-300'
                : discrepancy > 0
                ? 'bg-blue-950/30 border-blue-800 text-blue-300'
                : 'bg-rose-950/30 border-rose-800 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {discrepancy === 0 ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}
              <span>
                {discrepancy === 0
                  ? 'Exact Match! Hisaab Barabar Hai'
                  : discrepancy > 0
                  ? 'Surplus / Extra Cash Found'
                  : 'Shortage / Missing Cash'}
              </span>
            </div>
            <span className="text-sm font-bold">
              {discrepancy === 0
                ? '₹0'
                : `${discrepancy > 0 ? '+' : ''}₹${discrepancy.toLocaleString('en-IN')}`}
            </span>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Closing Remarks / Discrepancy Explanation
          </label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. ₹200 given as petty change to worker on site"
          />
        </div>

        {/* Lock Checkbox */}
        <label className="flex items-start gap-2.5 p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl cursor-pointer">
          <input
            type="checkbox"
            checked={isVerified}
            onChange={(e) => setIsVerified(e.target.checked)}
            className="mt-0.5 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500"
          />
          <div className="text-xs">
            <span className="font-semibold text-slate-200 block">
              Lock this day&apos;s records (Day Lock)
            </span>
            <span className="text-slate-400 text-[11px] block mt-0.5">
              Protects today&apos;s entries from accidental modification or deletion. Once locked, only the OWNER can edit or delete with audit logging.
            </span>
          </div>
        </label>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-2 shadow-lg shadow-emerald-900/30"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Lock className="w-4 h-4" />
            )}
            Verify &amp; Close Hisaab
          </Button>
        </div>
      </form>
    </Modal>
  );
}
