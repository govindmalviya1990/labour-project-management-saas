'use client';

import React from 'react';
import { CheckCircle2, Clock, User, ShieldCheck, FileText } from 'lucide-react';
import { extractVerificationInfo } from '@/lib/materials/verification';

interface SupervisorVerificationBadgeProps {
  notes?: string | null;
  taskPurpose?: string | null;
  fallbackUser?: any;
  onViewDetails?: () => void;
  compact?: boolean;
}

export function SupervisorVerificationBadge({
  notes,
  taskPurpose,
  fallbackUser,
  onViewDetails,
  compact = false,
}: SupervisorVerificationBadgeProps) {
  const isApproved = taskPurpose === 'APPROVED' || (notes && notes.includes('VERIFIED'));
  const info = extractVerificationInfo(notes, fallbackUser);

  if (!isApproved) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
        <Clock className="w-3 h-3 animate-pulse" />
        Pending Verification
      </span>
    );
  }

  const verifierName = info?.verifierName || fallbackUser?.name || 'Site Supervisor';
  const role = info?.role || (fallbackUser?.name ? 'Direct Inward' : 'Site Supervisor');
  const date = info?.displayDate || null;
  const remarks = info?.remarks;

  if (compact) {
    return (
      <div className="flex flex-col gap-0.5 text-left">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 w-fit">
          <CheckCircle2 className="w-2.5 h-2.5" />
          Verified
        </span>
        <div className="text-[11px] font-semibold text-slate-200 flex items-center gap-1 mt-0.5">
          <User className="w-3 h-3 text-emerald-400 shrink-0" />
          <span className="truncate max-w-[130px]">{verifierName}</span>
        </div>
        {date && <span className="text-[10px] text-slate-400 font-mono">{date}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 text-left bg-slate-950/40 p-2 rounded-lg border border-slate-800/80">
      <div className="flex items-center justify-between gap-1.5">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          Received & Approved
        </span>
        {onViewDetails && (
          <button
            type="button"
            onClick={onViewDetails}
            className="text-[10px] text-sky-400 hover:text-sky-300 flex items-center gap-0.5 font-medium hover:underline"
            title="View Verification Details"
          >
            <FileText className="w-3 h-3" /> Details
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 mt-0.5">
        <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
          <User className="w-3 h-3 text-emerald-400" />
        </div>
        <div className="leading-tight">
          <div className="text-[11px] font-bold text-slate-100 flex items-center gap-1">
            <span>{verifierName}</span>
          </div>
          <div className="text-[10px] text-emerald-400/90 font-medium">{role}</div>
        </div>
      </div>

      {date && (
        <div className="text-[10px] text-slate-400 flex items-center gap-1 font-mono pt-0.5 border-t border-slate-800/60">
          <Clock className="w-2.5 h-2.5 text-slate-500 shrink-0" />
          <span>{date}</span>
        </div>
      )}

      {remarks && (
        <div className="text-[10px] text-slate-300 italic bg-slate-900/80 p-1.5 rounded border border-slate-800/60 mt-0.5">
          "{remarks}"
        </div>
      )}
    </div>
  );
}
