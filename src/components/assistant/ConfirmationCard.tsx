'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  Calendar,
  Wallet,
  Building2,
  Tag,
  ArrowRight,
  User,
  Plus,
  ShieldCheck,
  Edit2,
} from 'lucide-react';
import { DraftConfirmationPayload } from '@/lib/assistant/draft-types';

interface ConfirmationCardProps {
  draft: DraftConfirmationPayload;
  onSaved?: (message: string) => void;
  onCancelled?: () => void;
}

export function ConfirmationCard({ draft, onSaved, onCancelled }: ConfirmationCardProps) {
  const [status, setStatus] = useState<'PENDING' | 'SAVING' | 'SAVED' | 'CANCELLED'>(draft.status || 'PENDING');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Editable local state
  const [amount, setAmount] = useState<number>(draft.amount || 0);
  const [date, setDate] = useState<string>(draft.date || new Date().toISOString().split('T')[0]);
  const [receiverName, setReceiverName] = useState<string>(draft.receiverName || '');
  const [receiverId, setReceiverId] = useState<string | undefined>(draft.receiverId);
  const [purpose, setPurpose] = useState<string>(draft.purpose || '');
  const [projectName, setProjectName] = useState<string>(draft.projectName || '');
  const [projectId, setProjectId] = useState<string | undefined>(draft.projectId);
  const [notes, setNotes] = useState<string>(draft.notes || '');

  // Add new reason inline modal toggle
  const [isAddingNewReason, setIsAddingNewReason] = useState(false);
  const [newReasonInput, setNewReasonInput] = useState('');
  const [isSavingNewReason, setIsSavingNewReason] = useState(false);

  const handleAddNewReason = async () => {
    const trimmed = newReasonInput.trim();
    if (!trimmed) return;
    setIsSavingNewReason(true);
    try {
      const res = await fetch('/api/reasons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmed,
          type: draft.draftType === 'FUND_TRANSFER' ? 'TRANSFER' : 'EXPENSE',
        }),
      });
      if (res.ok) {
        setPurpose(trimmed);
        setIsAddingNewReason(false);
        setNewReasonInput('');
      } else {
        const d = await res.json();
        setErrorMessage(d.error || 'Failed to save new reason');
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'Error saving new reason');
    } finally {
      setIsSavingNewReason(false);
    }
  };

  const handleConfirmSave = async () => {
    if (status === 'SAVING' || status === 'SAVED') return;
    setStatus('SAVING');
    setErrorMessage(null);

    try {
      const payload: DraftConfirmationPayload = {
        ...draft,
        amount: Number(amount),
        date,
        receiverName,
        receiverId,
        purpose,
        projectName,
        projectId,
        notes,
      };

      const res = await fetch('/api/assistant/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus('PENDING');
        setErrorMessage(data.error || 'Entry save karne me samasya aayi.');
        return;
      }

      setStatus('SAVED');
      setSuccessMessage(data.message || 'Entry successfully database me save ho gayi!');
      if (onSaved) {
        onSaved(data.message);
      }
    } catch (err: any) {
      setStatus('PENDING');
      setErrorMessage(err.message || 'Network error, dobara try karein.');
    }
  };

  const handleCancel = () => {
    setStatus('CANCELLED');
    if (onCancelled) onCancelled();
  };

  // 1. SAVED STATE
  if (status === 'SAVED') {
    return (
      <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs space-y-2 animate-in fade-in duration-200">
        <div className="flex items-center gap-2 text-emerald-400 font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Entry Saved • {draft.title}</span>
        </div>
        <p className="text-[11px] text-emerald-300/90 leading-relaxed">
          {successMessage || 'Record successfully Cash Book aur Khata me save ho gaya hai.'}
        </p>
        <div className="pt-2 border-t border-emerald-800/40 flex items-center justify-between text-[11px]">
          <span className="text-emerald-400/80">Source: AI Assistant</span>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 font-semibold text-emerald-300 hover:text-emerald-100 underline underline-offset-2"
          >
            <span>Dashboard par dekhein</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    );
  }

  // 2. CANCELLED STATE
  if (status === 'CANCELLED') {
    return (
      <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400 text-xs flex items-center gap-2">
        <XCircle className="w-4 h-4 text-slate-500" />
        <span>Entry draft cancel kar diya gaya. Koi badlav nahi hua.</span>
      </div>
    );
  }

  // 3. EDITABLE PENDING DRAFT CARD
  return (
    <div className="p-3.5 rounded-xl bg-slate-900 border border-amber-500/30 text-slate-100 text-xs space-y-3 shadow-lg">
      {/* Header & Status Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-bold text-amber-400">
          <Edit2 className="w-3.5 h-3.5" />
          <span>{draft.title}</span>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
          Draft (Not Saved)
        </span>
      </div>

      {/* Sender indicator */}
      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
        <Wallet className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span>
          <strong className="text-slate-200">Wallet:</strong> {draft.senderUserName} (Cash in Hand)
        </span>
      </div>

      {/* Editable Fields Grid */}
      <div className="space-y-2 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80">
        {/* Person / Receiver (if applicable) */}
        {(draft.draftType === 'FUND_TRANSFER' || draft.draftType === 'WORKER_PAYMENT' || draft.draftType === 'WORK_RECORD') && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <User className="w-3 h-3 text-slate-400" />
              <span>Kisko:</span>
            </span>
            <input
              type="text"
              value={receiverName}
              onChange={(e) => setReceiverName(e.target.value)}
              className="px-2 py-1 text-xs rounded bg-slate-900 border border-slate-700 text-slate-100 font-semibold focus:outline-none focus:border-amber-500 w-36 text-right"
            />
          </div>
        )}

        {/* Amount */}
        {draft.amount !== undefined && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-400 font-medium">Kitna Amount (₹):</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="px-2 py-1 text-xs rounded bg-slate-900 border border-slate-700 text-amber-300 font-bold focus:outline-none focus:border-amber-500 w-32 text-right"
            />
          </div>
        )}

        {/* Date */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <Calendar className="w-3 h-3 text-slate-400" />
            <span>Date:</span>
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-2 py-1 text-[11px] rounded bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Reason / Purpose */}
        {purpose !== undefined && (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Tag className="w-3 h-3 text-slate-400" />
                <span>Reason:</span>
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g. Dinner, Chay, Petrol"
                  className="px-2 py-1 text-xs rounded bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-amber-500 w-32 text-right"
                />
                <button
                  type="button"
                  onClick={() => setIsAddingNewReason(!isAddingNewReason)}
                  title="Add custom reason"
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-400"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Quick add custom reason inline */}
            {isAddingNewReason && (
              <div className="flex items-center gap-1.5 pt-1.5">
                <input
                  type="text"
                  value={newReasonInput}
                  onChange={(e) => setNewReasonInput(e.target.value)}
                  placeholder="New Reason name..."
                  className="flex-1 px-2 py-1 text-[11px] rounded bg-slate-900 border border-amber-500/50 text-slate-100 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddNewReason}
                  disabled={!newReasonInput.trim() || isSavingNewReason}
                  className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[10px] disabled:opacity-50"
                >
                  {isSavingNewReason ? 'Saving...' : 'Add'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Project / Site */}
        {draft.options?.projects && draft.options.projects.length > 0 && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Building2 className="w-3 h-3 text-slate-400" />
              <span>Project:</span>
            </span>
            <select
              value={projectId || ''}
              onChange={(e) => {
                setProjectId(e.target.value);
                const sel = draft.options?.projects?.find((p) => p.id === e.target.value);
                setProjectName(sel?.name || '');
              }}
              className="px-2 py-1 text-[11px] rounded bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-amber-500 max-w-[150px]"
            >
              <option value="">General (No project)</option>
              {draft.options.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Error alert if any */}
      {errorMessage && (
        <div className="p-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Information Banner */}
      <div className="text-[10px] text-slate-400 flex items-center gap-1">
        <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
        <span>Save dabane se pehle wallet ya DB me koi badlav nahi hoga.</span>
      </div>

      {/* Action Buttons: Save & Cancel */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleConfirmSave}
          disabled={status === 'SAVING'}
          className="flex-1 min-h-[36px] px-3 rounded-lg bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
        >
          {status === 'SAVING' ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>✓ Save Karein</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleCancel}
          disabled={status === 'SAVING'}
          className="px-3 min-h-[36px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
        >
          ✕ Cancel
        </button>
      </div>
    </div>
  );
}
