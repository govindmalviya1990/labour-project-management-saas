'use client';

import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { CheckCircle2, ShieldCheck, User, Building2, Package, Clock, FileText } from 'lucide-react';
import { extractVerificationInfo } from '@/lib/materials/verification';

interface VerificationDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: any | null; // MaterialUsage or MaterialReceipt
}

export function VerificationDetailsModal({
  isOpen,
  onClose,
  record,
}: VerificationDetailsModalProps) {
  if (!record) return null;

  const info = extractVerificationInfo(record.notes, record.purchasedBy);
  const materialName = record.material?.name || 'Material Item';
  const materialUnit = record.material?.unit || 'units';
  const projectName = record.project?.name || 'Project Site';
  const projectCode = record.project?.projectCode || '';
  const siteName = record.site?.name;

  const verifierName = info?.verifierName || record.purchasedBy?.name || 'Site Supervisor';
  const role = info?.role || (record.purchasedBy ? 'Direct Inward / Staff' : 'Site Supervisor');
  const verifiedDate = info?.displayDate || new Date(record.date || record.updatedAt).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const remarks = info?.remarks || record.notes || 'Physical stock verified and received in good condition.';
  const quantity = info?.receivedQty || `${record.quantity} ${materialUnit}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Site Material Receipt Verification Record"
      description="Official physical inspection and verification record of material delivered to site."
      size="md"
    >
      <div className="space-y-4">
        {/* Verification Success Banner */}
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="text-sm font-bold text-emerald-300 flex items-center gap-1.5">
              <span>Verified & Officially Received at Site</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                APPROVED
              </span>
            </div>
            <div className="text-xs text-slate-300 mt-1">
              This delivery has been physically inspected and accepted at the construction site.
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
          {/* Material */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-slate-500" /> Material:
            </span>
            <span className="font-bold text-slate-100 text-sm">{materialName}</span>
          </div>

          {/* Site */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-500" /> Site / Project:
            </span>
            <span className="font-semibold text-sky-400">
              {projectName} {siteName ? `• ${siteName}` : ''} {projectCode ? `(${projectCode})` : ''}
            </span>
          </div>

          {/* Quantity */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
            <span className="text-slate-400">Physical Quantity Received:</span>
            <span className="font-mono font-bold text-emerald-400 text-sm">
              +{quantity}
            </span>
          </div>

          {/* Verified By - THE KEY HIGHLIGHT */}
          <div className="p-3 bg-slate-950/70 border border-emerald-500/20 rounded-lg space-y-2">
            <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-400" />
              Verified By Supervisor:
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Supervisor Name:</span>
              <span className="font-bold text-slate-100 text-sm">{verifierName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Role / Designation:</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {role}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-500" /> Verified On:
              </span>
              <span className="text-slate-200 font-mono font-semibold">{verifiedDate}</span>
            </div>
          </div>

          {/* Remarks */}
          <div className="pt-1">
            <div className="text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
              <FileText className="w-3 h-3 text-slate-500" /> Supervisor Inspection Remarks:
            </div>
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-slate-300 italic text-xs leading-relaxed">
              "{remarks}"
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button onClick={onClose} className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs">
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
