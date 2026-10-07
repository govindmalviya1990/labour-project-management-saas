'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Truck,
  Plus,
  ArrowLeft,
  Search,
  CheckCircle2,
  Clock,
  Building2,
  Package,
  AlertCircle,
  FileCheck,
  Calendar,
  Layers,
  Edit2,
  Trash2,
  FileText,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { ReceiptFormModal } from '@/components/materials/ReceiptFormModal';
import { SupervisorVerificationBadge } from '@/components/materials/SupervisorVerificationBadge';
import { VerificationDetailsModal } from '@/components/materials/VerificationDetailsModal';

export default function MaterialReceivedPage() {
  const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending');
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('ALL');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Data
  const [usages, setUsages] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);

  // Verification Modal State
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [selectedDispatch, setSelectedDispatch] = useState<any | null>(null);
  const [receivedQty, setReceivedQty] = useState<number>(0);
  const [supervisorName, setSupervisorName] = useState('Site Supervisor');
  const [verificationRemarks, setVerificationRemarks] = useState('Stock checked and received in good condition at site.');
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const [approvalError, setApprovalError] = useState('');

  // Manual Receipt Modal State
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<any | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedDetailRecord, setSelectedDetailRecord] = useState<any | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          setCurrentUser(d.user);
          if (d.user.name) {
            setSupervisorName(d.user.name);
          }
        }
      })
      .catch(() => {});
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [projRes, useRes, recRes] = await Promise.all([
        fetch('/api/projects'),
        fetch(`/api/materials/usage${selectedProjectId !== 'ALL' ? `?projectId=${selectedProjectId}` : ''}`),
        fetch(`/api/materials/receipts${selectedProjectId !== 'ALL' ? `?projectId=${selectedProjectId}` : ''}`),
      ]);

      if (projRes.ok) {
        const p = await projRes.json();
        setProjects(p.projects || []);
      }
      if (useRes.ok) {
        const u = await useRes.json();
        setUsages(u.usages || []);
      }
      if (recRes.ok) {
        const r = await recRes.json();
        setReceipts(r.receipts || []);
      }
    } catch (e) {
      console.error('Failed to load received materials data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedProjectId]);

  // Dispatches pending supervisor verification at site
  const pendingDispatches = usages.filter((u) => {
    const isPending = u.taskPurpose !== 'APPROVED';
    if (!isPending) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      u.material?.name?.toLowerCase().includes(q) ||
      u.project?.name?.toLowerCase().includes(q) ||
      u.notes?.toLowerCase().includes(q)
    );
  });

  // Approved dispatches verified at site
  const approvedDispatches = usages.filter((u) => {
    const isApproved = u.taskPurpose === 'APPROVED';
    if (!isApproved) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      u.material?.name?.toLowerCase().includes(q) ||
      u.project?.name?.toLowerCase().includes(q) ||
      u.notes?.toLowerCase().includes(q)
    );
  });

  // Direct vendor receipts
  const filteredReceipts = receipts.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.material?.name?.toLowerCase().includes(q) ||
      r.project?.name?.toLowerCase().includes(q) ||
      r.supplier?.name?.toLowerCase().includes(q) ||
      r.invoiceNumber?.toLowerCase().includes(q)
    );
  });

  // Open Verify & Approve Modal
  const handleOpenVerifyModal = (dispatch: any) => {
    setSelectedDispatch(dispatch);
    setReceivedQty(dispatch.quantity || 0);
    setVerificationRemarks('Stock physically verified and received in good condition at site.');
    if (currentUser?.name) {
      setSupervisorName(currentUser.name);
    }
    setApprovalError('');
    setVerifyModalOpen(true);
  };

  // Submit Supervisor Approval
  const handleConfirmApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDispatch) return;
    setIsSubmittingApproval(true);
    setApprovalError('');

    try {
      const res = await fetch(`/api/materials/usage/${selectedDispatch.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskPurpose: 'APPROVED',
          quantity: receivedQty,
          supervisorName,
          verificationRemarks,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setApprovalError(data.error || 'Failed to approve receipt');
        setIsSubmittingApproval(false);
        return;
      }

      setVerifyModalOpen(false);
      setSelectedDispatch(null);
      fetchData();
    } catch (err: any) {
      setApprovalError(err.message || 'Something went wrong');
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/materials" className="text-xs text-slate-400 hover:text-amber-400 flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Materials Hub
            </Link>
          </div>
          <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2.5">
            <Truck className="w-7 h-7 text-emerald-400" />
            Receive Material at Site (साइट पर सामग्री रिसीव और अप्रूव करें)
          </h1>
          <p className="text-sm text-slate-400">
            Site supervisor checks dispatched materials arriving at construction sites and approves inward receipts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => {
              setEditingReceipt(null);
              setIsManualModalOpen(true);
            }}
            variant="outline"
            className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            + Direct Site Receipt (लोकल वेंडर खरीद)
          </Button>
        </div>
      </div>

      {/* KPI Stats Banner */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <div className="text-xs text-amber-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Awaiting Verification
            </div>
            <div className="text-2xl font-black text-amber-400 mt-1">
              {pendingDispatches.length}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Dispatches waiting for supervisor at site</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <div className="text-xs text-emerald-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Verified & Approved
            </div>
            <div className="text-2xl font-black text-emerald-400 mt-1">
              {approvedDispatches.length}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Dispatches received & verified at site</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between col-span-2 md:col-span-1">
          <div>
            <div className="text-xs text-sky-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              Direct Vendor Receipts
            </div>
            <div className="text-2xl font-black text-sky-400 mt-1">
              {filteredReceipts.length}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Purchases received directly on site</div>
          </div>
        </div>
      </div>

      {/* Tabs & Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="flex border-b sm:border-b-0 border-slate-800 space-x-2 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition flex items-center gap-2 ${
              activeTab === 'pending'
                ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            Incoming Dispatches ({pendingDispatches.length})
            {pendingDispatches.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'pending' ? 'bg-slate-950 text-amber-400' : 'bg-amber-500/20 text-amber-400'
              }`}>
                Action Required
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('approved')}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition flex items-center gap-2 ${
              activeTab === 'approved'
                ? 'bg-emerald-600 text-white font-black shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            Approved & Received Stock ({approvedDispatches.length + filteredReceipts.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <div className="w-full sm:w-52">
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:ring-1 focus:ring-emerald-500"
            >
              <option value="ALL">🏢 All Construction Sites</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.projectCode})</option>
              ))}
            </select>
          </div>

          <div className="relative w-full sm:w-52">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search material, notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg pl-9 pr-3 py-2 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* TAB 1: PENDING DISPATCHES AWAITING SUPERVISOR VERIFICATION */}
      {activeTab === 'pending' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-3.5 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
              <Clock className="w-4 h-4" />
              Incoming Stock Sent by Company — Pending Site Supervisor Approval
            </div>
            <span className="text-[11px] text-slate-500 font-mono">
              Site par aate hi 'Verify & Approve' click karein
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Date Sent</th>
                  <th className="py-3 px-3">Destination Site</th>
                  <th className="py-3 px-3">Material</th>
                  <th className="py-3 px-3 text-right">Dispatched Qty</th>
                  <th className="py-3 px-4">Vehicle / Challan / Dispatch Note</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Supervisor Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-500">
                      Loading incoming dispatches...
                    </td>
                  </tr>
                ) : pendingDispatches.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-50" />
                      Sabhi stock verify ho chuke hain! No pending dispatches awaiting verification.
                    </td>
                  </tr>
                ) : (
                  pendingDispatches.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 text-slate-300 font-medium">
                        {new Date(u.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-sky-400" />
                          {u.project?.name}
                        </div>
                        <span className="text-[11px] text-slate-500 font-mono">{u.project?.projectCode}</span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-200">{u.material?.name}</div>
                        <span className="text-[11px] text-slate-500 font-mono">{u.material?.materialCode}</span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-black text-amber-400 text-sm">
                        {u.quantity} {u.material?.unit}
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {u.taskPurpose && u.taskPurpose !== 'PENDING' ? (
                          <div className="font-medium text-slate-200">{u.taskPurpose}</div>
                        ) : null}
                        {u.notes ? (
                          <div className="text-[11px] text-slate-400">{u.notes}</div>
                        ) : (
                          <span className="text-slate-600 italic">Dispatched from company warehouse</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          <Clock className="w-3 h-3 animate-pulse" />
                          वेरीफिकेशन बाकी
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          size="sm"
                          onClick={() => handleOpenVerifyModal(u)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 px-3 shadow-md shadow-emerald-950/40"
                        >
                          <FileCheck className="w-3.5 h-3.5 mr-1.5" />
                          Verify & Approve (चेक करके अप्रूव करें)
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: APPROVED & RECEIVED MATERIALS */}
      {activeTab === 'approved' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-3.5 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              Verified & Received Materials at Site (साइट पर प्राप्त सामग्री)
            </div>
            <span className="text-[11px] text-slate-500">
              Supervisor dwara approve ki gayi ya direct deliver hui samagri
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-3">Site / Project</th>
                  <th className="py-3 px-3">Material</th>
                  <th className="py-3 px-3 text-right">Received Quantity</th>
                  <th className="py-3 px-4">Verified By (चेक करने वाला सुपरवाइज़र)</th>
                  <th className="py-3 px-4">Delivery & Verification Remarks</th>
                  <th className="py-3 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-500">
                      Loading received records...
                    </td>
                  </tr>
                ) : approvedDispatches.length === 0 && filteredReceipts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      Abhi tak koi material receive nahi hua hai.
                    </td>
                  </tr>
                ) : (
                  <>
                    {/* Approved Dispatches */}
                    {approvedDispatches.map((u) => (
                      <tr key={`disp-${u.id}`} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 text-slate-300 font-medium">
                          {new Date(u.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-sky-400" />
                            {u.project?.name}
                          </div>
                          <span className="text-[11px] text-slate-500 font-mono">{u.project?.projectCode}</span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-200">{u.material?.name}</div>
                          <span className="text-[11px] text-slate-500 font-mono">{u.material?.materialCode}</span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-black text-emerald-400 text-sm">
                          +{u.quantity} {u.material?.unit}
                        </td>
                        <td className="py-3 px-4">
                          <SupervisorVerificationBadge
                            notes={u.notes}
                            taskPurpose={u.taskPurpose}
                            onViewDetails={() => setSelectedDetailRecord(u)}
                          />
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          <div className="text-slate-200">{u.notes || 'Verified at site'}</div>
                          <div className="text-[10px] text-emerald-400/80 mt-0.5">Dispatched from Company Warehouse</div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" />
                            साइट पर प्राप्त (Approved)
                          </span>
                        </td>
                      </tr>
                    ))}

                    {/* Direct Vendor Receipts */}
                    {filteredReceipts.map((r) => (
                      <tr key={`rec-${r.id}`} className="hover:bg-slate-800/40 transition bg-slate-900/30">
                        <td className="py-3 px-4 text-slate-300 font-medium">
                          {new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-sky-400" />
                            {r.project?.name}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-200">{r.material?.name}</div>
                          <span className="text-[11px] text-slate-500 font-mono">{r.material?.materialCode}</span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-black text-emerald-400 text-sm">
                          +{r.quantity} {r.material?.unit}
                        </td>
                        <td className="py-3 px-4">
                          <SupervisorVerificationBadge
                            notes={r.notes}
                            fallbackUser={r.purchasedBy}
                            onViewDetails={() => setSelectedDetailRecord(r)}
                          />
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          <div className="text-slate-200">
                            {r.supplier?.name ? `Supplier: ${r.supplier.name}` : 'Direct Purchase'}
                            {r.invoiceNumber ? ` | Inv: ${r.invoiceNumber}` : ''}
                          </div>
                          {r.notes && <div className="text-[11px] text-slate-400">{r.notes}</div>}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/30">
                            <CheckCircle2 className="w-3 h-3" />
                            Direct Inward
                          </span>
                        </td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUPERVISOR VERIFICATION & APPROVAL MODAL */}
      {selectedDispatch && (
        <Modal
          isOpen={verifyModalOpen}
          onClose={() => {
            setVerifyModalOpen(false);
            setSelectedDispatch(null);
          }}
          title="Verify & Receive Material at Site (साइट पर चेक और अप्रूव करें)"
          description="Confirm physical arrival of material dispatched from company stock to this construction site."
          size="md"
        >
          <form onSubmit={handleConfirmApproval} className="space-y-4">
            {approvalError && (
              <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{approvalError}</span>
              </div>
            )}

            {/* Dispatch Overview Box */}
            <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Material Name:</span>
                <span className="font-bold text-slate-100 text-sm">{selectedDispatch.material?.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Receiving Site:</span>
                <span className="font-semibold text-sky-400">{selectedDispatch.project?.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Dispatched Quantity:</span>
                <span className="font-mono font-bold text-amber-400">
                  {selectedDispatch.quantity} {selectedDispatch.material?.unit}
                </span>
              </div>
              {selectedDispatch.notes && (
                <div className="text-xs text-slate-400 pt-1 border-t border-slate-800">
                  <span className="font-semibold text-slate-300">Dispatch Notes:</span> {selectedDispatch.notes}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Physical Quantity Received ({selectedDispatch.material?.unit}) *
              </label>
              <Input
                type="number"
                step="any"
                min="0.01"
                value={receivedQty}
                onChange={(e) => setReceivedQty(parseFloat(e.target.value) || 0)}
                required
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Enter quantity received physically on site. Defaults to dispatched quantity.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Verified By (Site Supervisor Name) *
              </label>
              <Input
                value={supervisorName}
                onChange={(e) => setSupervisorName(e.target.value)}
                placeholder="Supervisor Name"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Receiving Condition & Remarks
              </label>
              <textarea
                value={verificationRemarks}
                onChange={(e) => setVerificationRemarks(e.target.value)}
                placeholder="e.g. Stock received in good condition, bags intact..."
                rows={2}
                className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setVerifyModalOpen(false);
                  setSelectedDispatch(null);
                }}
                disabled={isSubmittingApproval}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingApproval || !receivedQty || receivedQty <= 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                {isSubmittingApproval ? 'Approving...' : 'Confirm & Mark Received at Site'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* DIRECT INWARD RECEIPT MODAL */}
      <ReceiptFormModal
        isOpen={isManualModalOpen}
        onClose={() => {
          setIsManualModalOpen(false);
          setEditingReceipt(null);
        }}
        onSuccess={fetchData}
        defaultProjectId={selectedProjectId !== 'ALL' ? selectedProjectId : undefined}
        initialData={editingReceipt}
      />

      {/* VERIFICATION DETAILS MODAL */}
      <VerificationDetailsModal
        isOpen={!!selectedDetailRecord}
        onClose={() => setSelectedDetailRecord(null)}
        record={selectedDetailRecord}
      />
    </div>
  );
}
