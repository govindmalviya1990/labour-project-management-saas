'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard,
  Plus,
  Trash2,
  Calendar,
  Building2,
  AlertCircle,
  CheckCircle2,
  Wallet,
  Landmark,
  User,
  ArrowRight,
  Send,
  ListPlus,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { formatINR } from '@/lib/calculations';

interface RecordSupplierPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preSelectedSupplierId?: string;
  preSelectedBillId?: string;
}

interface BulkQueueItem {
  id: string;
  supplierId: string;
  supplierName: string;
  billId?: string;
  billNumber?: string;
  amount: number;
  remarks?: string;
}

export function RecordSupplierPaymentModal({
  isOpen,
  onClose,
  onSuccess,
  preSelectedSupplierId,
  preSelectedBillId,
}: RecordSupplierPaymentModalProps) {
  // Mode: Single vs Bulk
  const [mode, setMode] = useState<'SINGLE' | 'BULK'>('SINGLE');

  // Metadata
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [unpaidBills, setUnpaidBills] = useState<any[]>([]);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);

  // Source selection (Shared for Single & Bulk)
  const [sourceType, setSourceType] = useState<'PARTNER' | 'BANK'>('PARTNER');
  const [sourceId, setSourceId] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [projectId, setProjectId] = useState('');
  const [reference, setReference] = useState('');

  // Single mode fields
  const [singleSupplierId, setSingleSupplierId] = useState('');
  const [singleBillId, setSingleBillId] = useState('');
  const [singleAmount, setSingleAmount] = useState('');
  const [singleNotes, setSingleNotes] = useState('');

  // Bulk mode queue fields
  const [bulkQueue, setBulkQueue] = useState<BulkQueueItem[]>([]);
  const [bulkSupplierId, setBulkSupplierId] = useState('');
  const [bulkBillId, setBulkBillId] = useState('');
  const [bulkAmount, setBulkAmount] = useState('');
  const [bulkItemNotes, setBulkItemNotes] = useState('');
  const [queueError, setQueueError] = useState('');

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Fetch metadata on modal open
  useEffect(() => {
    if (!isOpen) return;

    const fetchMeta = async () => {
      setIsLoadingMeta(true);
      try {
        const [supRes, hisaabRes, projRes] = await Promise.all([
          fetch('/api/purchases/suppliers'),
          fetch('/api/finance/partner-hisaab'),
          fetch('/api/projects'),
        ]);

        if (supRes.ok) {
          const d = await supRes.json();
          setSuppliers(d.suppliers || []);
        }
        if (hisaabRes.ok) {
          const d = await hisaabRes.json();
          setPartners(d.partners || []);
          setBankAccounts(d.bankAccounts || []);
          if (d.partners && d.partners.length > 0 && !sourceId) {
            setSourceId(d.partners[0].id);
          }
        }
        if (projRes.ok) {
          const d = await projRes.json();
          setProjects(d.projects || d || []);
        }
      } catch (err) {
        console.error('Error fetching metadata:', err);
      } finally {
        setIsLoadingMeta(false);
      }
    };

    fetchMeta();

    if (preSelectedSupplierId) {
      setSingleSupplierId(preSelectedSupplierId);
      setBulkSupplierId(preSelectedSupplierId);
    }
    if (preSelectedBillId) {
      setSingleBillId(preSelectedBillId);
    }

    setSubmitError('');
    setQueueError('');
  }, [isOpen, preSelectedSupplierId, preSelectedBillId]);

  // Fetch unpaid bills when supplier changes
  useEffect(() => {
    const targetSupId = mode === 'SINGLE' ? singleSupplierId : bulkSupplierId;
    if (!targetSupId) {
      setUnpaidBills([]);
      return;
    }

    const fetchBills = async () => {
      try {
        const res = await fetch(`/api/purchases/bills?supplierId=${targetSupId}&status=UNPAID,PARTIAL`);
        if (res.ok) {
          const d = await res.json();
          setUnpaidBills(d.bills || []);
        }
      } catch (err) {
        console.error('Error fetching bills:', err);
      }
    };

    fetchBills();
  }, [mode, singleSupplierId, bulkSupplierId]);

  // Available source balance
  const sourceAvailableBalance = useMemo(() => {
    if (sourceType === 'PARTNER') {
      const p = partners.find((x) => x.id === sourceId);
      return p?.currentBalance ?? 0;
    } else {
      const b = bankAccounts.find((x) => x.id === sourceId);
      return b?.balance ?? 0;
    }
  }, [sourceType, sourceId, partners, bankAccounts]);

  // Total in bulk queue
  const totalBulkAmount = useMemo(() => {
    return bulkQueue.reduce((sum, item) => sum + item.amount, 0);
  }, [bulkQueue]);

  // Add item to bulk queue
  const handleAddToBulkQueue = () => {
    setQueueError('');
    if (!bulkSupplierId) {
      setQueueError('Please select a supplier');
      return;
    }
    const amt = parseFloat(bulkAmount);
    if (isNaN(amt) || amt <= 0) {
      setQueueError('Please enter a valid amount greater than ₹0');
      return;
    }

    const sup = suppliers.find((s) => s.id === bulkSupplierId);
    const bill = unpaidBills.find((b) => b.id === bulkBillId);

    const newItem: BulkQueueItem = {
      id: Math.random().toString(),
      supplierId: bulkSupplierId,
      supplierName: sup ? sup.name : 'Unknown Supplier',
      billId: bulkBillId || undefined,
      billNumber: bill ? bill.billNumber || 'Bill' : undefined,
      amount: amt,
      remarks: bulkItemNotes.trim() || undefined,
    };

    setBulkQueue((prev) => [...prev, newItem]);
    setBulkAmount('');
    setBulkBillId('');
    setBulkItemNotes('');
  };

  const handleRemoveFromBulkQueue = (id: string) => {
    setBulkQueue((prev) => prev.filter((item) => item.id !== id));
  };

  // Submit single payment
  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (!singleSupplierId) {
      setSubmitError('Please select a supplier');
      return;
    }
    const amt = parseFloat(singleAmount);
    if (isNaN(amt) || amt <= 0) {
      setSubmitError('Please enter a valid amount greater than ₹0');
      return;
    }
    if (!sourceId) {
      setSubmitError('Please select a payment source wallet or bank account');
      return;
    }
    if (amt > sourceAvailableBalance) {
      setSubmitError(
        `Payment amount (${formatINR(amt)}) exceeds available source balance (${formatINR(sourceAvailableBalance)})`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        supplierId: singleSupplierId,
        billId: singleBillId || null,
        date: paymentDate,
        amount: amt,
        method: paymentMethod,
        sourceType,
        sourceId,
        reference: reference.trim() || null,
        notes: singleNotes.trim() || null,
        projectId: projectId || null,
      };

      const res = await fetch('/api/purchases/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to record supplier payment');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setSubmitError(err.message || 'Something went wrong while recording payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit bulk queue
  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (bulkQueue.length === 0) {
      setSubmitError('Please add at least one payment to the queue');
      return;
    }
    if (!sourceId) {
      setSubmitError('Please select a payment source wallet or bank account');
      return;
    }
    if (totalBulkAmount > sourceAvailableBalance) {
      setSubmitError(
        `Total batch payments (${formatINR(totalBulkAmount)}) exceed available source balance (${formatINR(sourceAvailableBalance)})`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        sourceType,
        sourceId,
        method: paymentMethod,
        date: paymentDate,
        projectId: projectId || undefined,
        reference: reference.trim() || undefined,
        items: bulkQueue.map((it) => ({
          supplierId: it.supplierId,
          billId: it.billId,
          amount: it.amount,
          notes: it.remarks,
        })),
      };

      const res = await fetch('/api/purchases/payments/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to record bulk supplier payments');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setSubmitError(err.message || 'Something went wrong while recording payments');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Supplier Payment"
      description="Debit partner cash wallet or bank account and credit supplier ledger"
      size="xl"
    >
      <div className="space-y-4">
        {/* Mode Switcher */}
        <div className="flex items-center justify-between p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setMode('SINGLE')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
              mode === 'SINGLE'
                ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Single Supplier Payment
          </button>
          <button
            type="button"
            onClick={() => setMode('BULK')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
              mode === 'BULK'
                ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Bulk Multi-Supplier Batch ({bulkQueue.length})
          </button>
        </div>

        {submitError && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {/* 1. Payment Source & Common Fields */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-indigo-500" />
              Paying Source Account
            </span>
            <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
              Available Bal: {formatINR(sourceAvailableBalance)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Source Type & Dropdown */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <button
                  type="button"
                  onClick={() => {
                    setSourceType('PARTNER');
                    if (partners.length > 0) setSourceId(partners[0].id);
                  }}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    sourceType === 'PARTNER'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Partner Wallet
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSourceType('BANK');
                    if (bankAccounts.length > 0) setSourceId(bankAccounts[0].id);
                  }}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    sourceType === 'BANK'
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Bank Account
                </button>
              </div>

              <select
                required
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white"
              >
                {sourceType === 'PARTNER'
                  ? partners.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.role}) • {formatINR(p.currentBalance)}
                      </option>
                    ))
                  : bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bankName} - {b.name} • {formatINR(b.balance)}
                      </option>
                    ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                Payment Date *
              </label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white"
              />
            </div>

            {/* Method */}
            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold"
              >
                <option value="CASH">Cash in Hand</option>
                <option value="BANK">Bank Transfer (NEFT/RTGS/IMPS)</option>
                <option value="UPI">UPI / QR Code</option>
                <option value="CHEQUE">Cheque</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                Link to Project (Optional)
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold"
              >
                <option value="">-- No Specific Project --</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.projectCode})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                Reference / UTR / Remarks
              </label>
              <input
                type="text"
                placeholder="e.g. UTR12345678, GPay Ref, Cheque #000123"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
              />
            </div>
          </div>
        </div>

        {/* 2. SINGLE PAYMENT FORM */}
        {mode === 'SINGLE' && (
          <form onSubmit={handleSingleSubmit} className="space-y-3">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-purple-500" />
                Recipient Supplier &amp; Amount
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Select Supplier *
                  </label>
                  <select
                    required
                    value={singleSupplierId}
                    onChange={(e) => {
                      setSingleSupplierId(e.target.value);
                      setSingleBillId('');
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">-- Choose Supplier --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.mobile ? `(${s.mobile})` : ''} • Due: {formatINR(s.remainingBalance ?? s.openingBalance ?? 0)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Specific Bill (Optional / Leave for Advance On Account)
                  </label>
                  <select
                    value={singleBillId}
                    onChange={(e) => {
                      const bId = e.target.value;
                      setSingleBillId(bId);
                      const bill = unpaidBills.find((b) => b.id === bId);
                      if (bill && !singleAmount) {
                        setSingleAmount(String(bill.totalAmount));
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    <option value="">-- Advance / On Account (Auto FIFO) --</option>
                    {unpaidBills.map((b) => (
                      <option key={b.id} value={b.id}>
                        Bill #{b.billNumber || 'No #'} • {new Date(b.billDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} • Due: {formatINR(b.totalAmount)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Payment Amount (₹) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      required
                      placeholder="0.00"
                      value={singleAmount}
                      onChange={(e) => setSingleAmount(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Payment Notes / Remarks
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Part payment against cement supply"
                    value={singleNotes}
                    onChange={(e) => setSingleNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={isSubmitting}
                className="text-xs font-semibold"
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={isSubmitting || !singleSupplierId || !singleAmount}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-6"
              >
                {isSubmitting ? 'Recording Payment...' : 'Record Payment'}
              </Button>
            </div>
          </form>
        )}

        {/* 3. BULK MULTI-SUPPLIER QUEUE FLOW */}
        {mode === 'BULK' && (
          <form onSubmit={handleBulkSubmit} className="space-y-3">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <ListPlus className="w-3.5 h-3.5 text-purple-500" />
                Add Suppliers to Payment Queue
              </span>

              {queueError && (
                <p className="text-[11px] text-rose-500 font-semibold">{queueError}</p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                <div className="sm:col-span-4">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Supplier *
                  </label>
                  <select
                    value={bulkSupplierId}
                    onChange={(e) => {
                      setBulkSupplierId(e.target.value);
                      setBulkBillId('');
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold"
                  >
                    <option value="">-- Choose Supplier --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} • Due: {formatINR(s.remainingBalance ?? s.openingBalance ?? 0)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Bill (Optional)
                  </label>
                  <select
                    value={bulkBillId}
                    onChange={(e) => {
                      const bId = e.target.value;
                      setBulkBillId(bId);
                      const bill = unpaidBills.find((b) => b.id === bId);
                      if (bill && !bulkAmount) {
                        setBulkAmount(String(bill.totalAmount));
                      }
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
                  >
                    <option value="">Advance / On Account</option>
                    {unpaidBills.map((b) => (
                      <option key={b.id} value={b.id}>
                        #{b.billNumber || 'Bill'} • {formatINR(b.totalAmount)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    placeholder="Amount"
                    value={bulkAmount}
                    onChange={(e) => setBulkAmount(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <Button
                    type="button"
                    onClick={handleAddToBulkQueue}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-1.5"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add
                  </Button>
                </div>
              </div>

              {/* Queue Table */}
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-bold">
                    <tr>
                      <th className="py-2 px-3">#</th>
                      <th className="py-2 px-3">Supplier</th>
                      <th className="py-2 px-3">Bill</th>
                      <th className="py-2 px-3 text-right">Amount (₹)</th>
                      <th className="py-2 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {bulkQueue.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-slate-400">
                          Queue is empty. Select supplier and amount above and click &quot;Add&quot;.
                        </td>
                      </tr>
                    ) : (
                      bulkQueue.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                          <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                          <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white">
                            {item.supplierName}
                          </td>
                          <td className="py-2 px-3 text-slate-500">
                            {item.billNumber ? `Bill #${item.billNumber}` : 'On Account'}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-right text-slate-900 dark:text-white">
                            {formatINR(item.amount)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveFromBulkQueue(item.id)}
                              className="text-slate-400 hover:text-rose-500 p-1 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Queue Total Summary */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <span className="text-xs font-bold text-purple-700 dark:text-purple-300">
                  Total Batch Payment ({bulkQueue.length} {bulkQueue.length === 1 ? 'supplier' : 'suppliers'})
                </span>
                <span className="text-sm font-black font-mono text-purple-700 dark:text-purple-300">
                  {formatINR(totalBulkAmount)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={isSubmitting}
                className="text-xs font-semibold"
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={isSubmitting || bulkQueue.length === 0 || totalBulkAmount > sourceAvailableBalance}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-6"
              >
                {isSubmitting ? 'Processing Batch...' : 'Confirm and Send All'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
