'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  Calendar,
  Building2,
  Truck,
  IndianRupee,
  AlertCircle,
  CheckCircle2,
  Upload,
  User,
  ShoppingBag,
  CreditCard,
  Wallet,
  Landmark,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { formatINR } from '@/lib/calculations';

interface AddPurchaseBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialBill?: any;
}

interface ItemRow {
  id: string;
  materialId?: string;
  materialName: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
}

export function AddPurchaseBillModal({
  isOpen,
  onClose,
  onSuccess,
  initialBill,
}: AddPurchaseBillModalProps) {
  // Master lists
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);

  // Form Fields
  const [supplierId, setSupplierId] = useState('');
  const [billDate, setBillDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [billNumber, setBillNumber] = useState('');
  const [projectId, setProjectId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [receivedBy, setReceivedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Charges
  const [gstRate, setGstRate] = useState<string>('0');
  const [transportCharges, setTransportCharges] = useState<string>('0');
  const [discount, setDiscount] = useState<string>('0');

  // Items
  const [items, setItems] = useState<ItemRow[]>([]);
  // Item draft entry
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [itemMaterialName, setItemMaterialName] = useState('');
  const [itemQuantity, setItemQuantity] = useState('');
  const [itemUnit, setItemUnit] = useState('Bags');
  const [itemRate, setItemRate] = useState('');
  const [itemError, setItemError] = useState('');

  // Inline Supplier Add Form
  const [showAddSupplierInline, setShowAddSupplierInline] = useState(false);
  const [inlineSupplierName, setInlineSupplierName] = useState('');
  const [inlineSupplierMobile, setInlineSupplierMobile] = useState('');
  const [inlineSupplierGst, setInlineSupplierGst] = useState('');
  const [inlineSupplierOpeningBalance, setInlineSupplierOpeningBalance] = useState('0');
  const [isSavingSupplier, setIsSavingSupplier] = useState(false);
  const [inlineSupplierError, setInlineSupplierError] = useState('');

  // "Pay Now" Section (Optional single payment inside the bill transaction)
  const [payNow, setPayNow] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [paySourceType, setPaySourceType] = useState<'PARTNER' | 'BANK'>('PARTNER');
  const [paySourceId, setPaySourceId] = useState('');
  const [payMethod, setPayMethod] = useState('CASH');
  const [payReference, setPayReference] = useState('');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [editReason, setEditReason] = useState('');

  // Fetch metadata on mount/open
  useEffect(() => {
    if (!isOpen) return;

    const fetchMeta = async () => {
      setIsLoadingMeta(true);
      try {
        const [supRes, prjRes, matRes, hisaabRes] = await Promise.all([
          fetch('/api/purchases/suppliers'),
          fetch('/api/projects'),
          fetch('/api/materials'),
          fetch('/api/finance/partner-hisaab'),
        ]);

        if (supRes.ok) {
          const d = await supRes.json();
          setSuppliers(d.suppliers || []);
        }
        if (prjRes.ok) {
          const d = await prjRes.json();
          setProjects(d.projects || d || []);
        }
        if (matRes.ok) {
          const d = await matRes.json();
          setMaterials(d.materials || []);
        }
        if (hisaabRes.ok) {
          const d = await hisaabRes.json();
          setPartners(d.partners || []);
          setBankAccounts(d.bankAccounts || []);
          if (d.partners && d.partners.length > 0 && !paySourceId) {
            setPaySourceId(d.partners[0].id);
          }
        }
      } catch (err) {
        console.error('Error fetching metadata:', err);
      } finally {
        setIsLoadingMeta(false);
      }
    };

    fetchMeta();

    if (initialBill) {
      setSupplierId(initialBill.supplierId || '');
      setBillDate(initialBill.billDate ? initialBill.billDate.split('T')[0] : new Date().toISOString().split('T')[0]);
      setBillNumber(initialBill.billNumber || '');
      setProjectId(initialBill.projectId || '');
      setSiteId(initialBill.siteId || '');
      setVehicleNumber(initialBill.vehicleNumber || '');
      setReceivedBy(initialBill.receivedBy || '');
      setNotes(initialBill.notes || '');
      setAttachmentUrl(initialBill.attachmentUrl || '');
      if (initialBill.subtotal && initialBill.subtotal > 0 && initialBill.gstAmount) {
        const computedRate = Math.round(((initialBill.gstAmount / initialBill.subtotal) * 100) * 100) / 100;
        setGstRate(String(computedRate));
      } else {
        setGstRate('0');
      }
      setTransportCharges(String(initialBill.transportCharges || 0));
      setDiscount(String(initialBill.discount || 0));
      setItems(
        (initialBill.items || []).map((it: any) => ({
          id: it.id || Math.random().toString(),
          materialId: it.materialId || undefined,
          materialName: it.materialName,
          quantity: it.quantity,
          unit: it.unit,
          rate: it.rate,
          amount: it.amount,
        }))
      );
      setPayNow(false);
    } else {
      // Reset form
      setSupplierId('');
      setBillDate(new Date().toISOString().split('T')[0]);
      setBillNumber('');
      setProjectId('');
      setSiteId('');
      setVehicleNumber('');
      setReceivedBy('');
      setNotes('');
      setAttachmentUrl('');
      setGstRate('0');
      setTransportCharges('0');
      setDiscount('0');
      setItems([]);
      setPayNow(false);
      setPayAmount('');
      setEditReason('');
    }

    setSubmitError('');
    setShowAddSupplierInline(false);
  }, [isOpen, initialBill]);

  // Selected project sites
  const selectedProject = useMemo(() => {
    return projects.find((p) => p.id === projectId);
  }, [projects, projectId]);

  // Calculations
  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.amount, 0);
  }, [items]);

  const calculatedGstAmount = useMemo(() => {
    const rate = parseFloat(gstRate) || 0;
    if (rate <= 0 || subtotal <= 0) return 0;
    return Math.round(((subtotal * rate) / 100) * 100) / 100;
  }, [subtotal, gstRate]);

  const totalAmount = useMemo(() => {
    const transport = parseFloat(transportCharges) || 0;
    const disc = parseFloat(discount) || 0;
    return Math.max(0, Math.round((subtotal + calculatedGstAmount + transport - disc) * 100) / 100);
  }, [subtotal, calculatedGstAmount, transportCharges, discount]);

  // Available source balance
  const sourceAvailableBalance = useMemo(() => {
    if (paySourceType === 'PARTNER') {
      const p = partners.find((x) => x.id === paySourceId);
      return p?.currentBalance ?? 0;
    } else {
      const b = bankAccounts.find((x) => x.id === paySourceId);
      return b?.balance ?? 0;
    }
  }, [paySourceType, paySourceId, partners, bankAccounts]);

  // Auto-fill Pay Amount if Pay Now is checked and payAmount is empty
  useEffect(() => {
    if (payNow && (!payAmount || parseFloat(payAmount) === 0)) {
      setPayAmount(String(totalAmount));
    }
  }, [payNow, totalAmount]);

  // Handle adding an item to the queue
  const handleAddItem = () => {
    setItemError('');
    const name = itemMaterialName.trim();
    if (!name) {
      setItemError('Please select or enter material name');
      return;
    }
    const qty = parseFloat(itemQuantity);
    if (isNaN(qty) || qty <= 0) {
      setItemError('Please enter a valid quantity greater than 0');
      return;
    }
    const rate = parseFloat(itemRate);
    if (isNaN(rate) || rate < 0) {
      setItemError('Please enter a valid rate (₹)');
      return;
    }

    const amount = Math.round(qty * rate * 100) / 100;
    const newItem: ItemRow = {
      id: Math.random().toString(),
      materialId: selectedMaterialId || undefined,
      materialName: name,
      quantity: qty,
      unit: itemUnit.trim() || 'Units',
      rate: rate,
      amount: amount,
    };

    setItems((prev) => [...prev, newItem]);

    // Reset item draft
    setSelectedMaterialId('');
    setItemMaterialName('');
    setItemQuantity('');
    setItemRate('');
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Inline supplier save
  const handleSaveInlineSupplier = async () => {
    setInlineSupplierError('');
    if (!inlineSupplierName.trim()) {
      setInlineSupplierError('Supplier business name is required');
      return;
    }

    setIsSavingSupplier(true);
    try {
      const res = await fetch('/api/purchases/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: inlineSupplierName.trim(),
          mobile: inlineSupplierMobile.trim() || undefined,
          gstNumber: inlineSupplierGst.trim() || undefined,
          openingBalance: parseFloat(inlineSupplierOpeningBalance) || 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create supplier');
      }

      setSuppliers((prev) => [data.supplier, ...prev]);
      setSupplierId(data.supplier.id);
      setShowAddSupplierInline(false);
      setInlineSupplierName('');
      setInlineSupplierMobile('');
      setInlineSupplierGst('');
      setInlineSupplierOpeningBalance('0');
    } catch (err: any) {
      setInlineSupplierError(err.message || 'Error creating supplier');
    } finally {
      setIsSavingSupplier(false);
    }
  };

  // Upload bill file
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const d = await res.json();
        setAttachmentUrl(d.url || d.fileUrl || '');
      } else {
        // Fallback: convert to data URL if upload API is not available
        const reader = new FileReader();
        reader.onloadend = () => {
          setAttachmentUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    } catch (err) {
      console.warn('Fallback to data URL:', err);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachmentUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } finally {
      setIsUploading(false);
    }
  };

  // Submit bill
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (!supplierId) {
      setSubmitError('Please select a supplier');
      return;
    }
    if (items.length === 0) {
      setSubmitError('Please add at least one material item to the bill');
      return;
    }

    if (initialBill && !editReason.trim()) {
      setSubmitError('Please provide a reason for editing this bill');
      return;
    }

    if (payNow) {
      const pAmt = parseFloat(payAmount);
      if (isNaN(pAmt) || pAmt <= 0) {
        setSubmitError('Please enter a valid payment amount greater than ₹0');
        return;
      }
      if (pAmt > totalAmount) {
        setSubmitError(`Payment amount (₹${pAmt}) cannot exceed bill total (₹${totalAmount})`);
        return;
      }
      if (!paySourceId) {
        setSubmitError('Please select a payment source wallet or bank account');
        return;
      }
      if (pAmt > sourceAvailableBalance) {
        setSubmitError(
          `Payment amount (${formatINR(pAmt)}) exceeds available source balance (${formatINR(sourceAvailableBalance)})`
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        supplierId,
        billDate,
        billNumber: billNumber.trim() || undefined,
        projectId: projectId || null,
        siteId: siteId || null,
        vehicleNumber: vehicleNumber.trim() || null,
        receivedBy: receivedBy.trim() || null,
        notes: notes.trim() || null,
        attachmentUrl: attachmentUrl || null,
        gstAmount: calculatedGstAmount,
        transportCharges: parseFloat(transportCharges) || 0,
        discount: parseFloat(discount) || 0,
        items: items.map((it) => ({
          materialId: it.materialId || null,
          materialName: it.materialName,
          quantity: it.quantity,
          unit: it.unit,
          rate: it.rate,
          amount: it.amount,
        })),
      };

      if (payNow) {
        payload.payNow = {
          amount: parseFloat(payAmount),
          sourceType: paySourceType,
          sourceId: paySourceId,
          method: payMethod,
          reference: payReference.trim() || undefined,
        };
      }

      const url = initialBill ? `/api/purchases/bills/${initialBill.id}` : '/api/purchases/bills';
      const method = initialBill ? 'PUT' : 'POST';

      if (initialBill) {
        payload.editReason = editReason.trim();
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to save purchase bill');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setSubmitError(err.message || 'Something went wrong while saving bill');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialBill ? 'Edit Purchase Bill' : 'New Purchase Bill & Inward'}
      description="Record material supplier bill, items received, GST and optional payment"
      size="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {submitError && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {/* 1. Supplier & Bill Details Section */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-purple-500" />
            Supplier &amp; Bill Information
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Supplier Selector */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">
                  Supplier *
                </label>
                {!showAddSupplierInline && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddSupplierInline(true);
                      setInlineSupplierError('');
                    }}
                    className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Add new supplier
                  </button>
                )}
              </div>
              <select
                required
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">-- Choose Supplier --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.mobile ? `(${s.mobile})` : ''} • Bal: {formatINR(s.remainingBalance ?? s.openingBalance ?? 0)}
                  </option>
                ))}
              </select>
            </div>

            {/* Bill Date */}
            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                Bill / Challan Date *
              </label>
              <input
                type="date"
                required
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Inline Add Supplier Form */}
          {showAddSupplierInline && (
            <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                  Quick Add Supplier
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddSupplierInline(false)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Cancel
                </button>
              </div>

              {inlineSupplierError && (
                <p className="text-[11px] text-rose-500 font-semibold">{inlineSupplierError}</p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Business Name *"
                  value={inlineSupplierName}
                  onChange={(e) => setInlineSupplierName(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold"
                />
                <input
                  type="text"
                  placeholder="Mobile (10 digits)"
                  value={inlineSupplierMobile}
                  onChange={(e) => setInlineSupplierMobile(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
                />
                <input
                  type="text"
                  placeholder="GST Number (Optional)"
                  value={inlineSupplierGst}
                  onChange={(e) => setInlineSupplierGst(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs uppercase"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500">Opening Balance (₹):</span>
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={inlineSupplierOpeningBalance}
                    onChange={(e) => setInlineSupplierOpeningBalance(e.target.value)}
                    className="w-24 px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                  />
                  <span className="text-[10px] text-slate-400">(+ payable, - advance)</span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={isSavingSupplier}
                  onClick={handleSaveInlineSupplier}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs"
                >
                  {isSavingSupplier ? 'Saving...' : 'Save & Select'}
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Bill / Challan No */}
            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                Bill / Challan No.
              </label>
              <input
                type="text"
                placeholder="e.g. INV-2026-089"
                value={billNumber}
                onChange={(e) => setBillNumber(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Project */}
            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                Project
              </label>
              <select
                value={projectId}
                onChange={(e) => {
                  const pId = e.target.value;
                  const proj = projects.find((p) => p.id === pId);
                  setProjectId(pId);
                  setSiteId(proj?.sites && proj.sites.length > 0 ? proj.sites[0].id : '');
                }}
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">No project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.projectCode})
                  </option>
                ))}
              </select>
            </div>

            {/* Site */}
            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                Site
              </label>
              <select
                value={siteId}
                disabled={!selectedProject || !selectedProject.sites || selectedProject.sites.length === 0}
                onChange={(e) => setSiteId(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
              >
                <option value="">{selectedProject?.sites?.length ? '-- Select Site --' : 'No site'}</option>
                {selectedProject?.sites?.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                Vehicle No. (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. MH 12 AB 1234"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white uppercase"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                Received By (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Supervisor Ramesh"
                value={receivedBy}
                onChange={(e) => setReceivedBy(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                Bill Photo / Invoice Doc
              </label>
              <div className="flex items-center gap-2">
                <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-xs font-semibold text-slate-600 dark:text-slate-300 transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isUploading ? 'Uploading...' : attachmentUrl ? 'Change File' : 'Upload Bill'}</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
                {attachmentUrl && (
                  <span className="text-[11px] font-bold text-emerald-500">✓ Uploaded</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Items Entry Section */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <ShoppingBag className="w-3.5 h-3.5 text-amber-500" />
            Purchased Items &amp; Materials
          </span>

          {itemError && (
            <p className="text-[11px] text-rose-500 font-semibold">{itemError}</p>
          )}

          {/* Draft Item Input Row */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
            <div className="sm:col-span-4">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                Material / Item *
              </label>
              <input
                type="text"
                list="material-datalist"
                placeholder="e.g. Cement UltraTech OPC 53"
                value={itemMaterialName}
                onChange={(e) => {
                  const val = e.target.value;
                  setItemMaterialName(val);
                  const found = materials.find((m) => m.name.toLowerCase() === val.toLowerCase());
                  if (found) {
                    setSelectedMaterialId(found.id);
                    if (found.unit) setItemUnit(found.unit);
                    if (found.rate) setItemRate(String(found.rate));
                  }
                }}
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <datalist id="material-datalist">
                {materials.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.category ? `(${m.category})` : ''} - {m.unit}
                  </option>
                ))}
              </datalist>
            </div>

            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                Quantity *
              </label>
              <input
                type="number"
                step="any"
                min="0.001"
                placeholder="Qty"
                value={itemQuantity}
                onChange={(e) => setItemQuantity(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                Unit
              </label>
              <input
                type="text"
                placeholder="Bags, Tons, Sqft"
                value={itemUnit}
                onChange={(e) => setItemUnit(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                Rate (₹) *
              </label>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="Rate"
                value={itemRate}
                onChange={(e) => setItemRate(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white"
              />
            </div>

            <div className="sm:col-span-2">
              <Button
                type="button"
                onClick={handleAddItem}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-1.5"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Item
              </Button>
            </div>
          </div>

          {/* Items Table Queue */}
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-bold">
                <tr>
                  <th className="py-2 px-3">#</th>
                  <th className="py-2 px-3">Material</th>
                  <th className="py-2 px-3">Quantity</th>
                  <th className="py-2 px-3">Rate</th>
                  <th className="py-2 px-3 text-right">Amount (₹)</th>
                  <th className="py-2 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-slate-400">
                      No items added yet. Enter material details above and click &quot;Add Item&quot;.
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                      <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                      <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white">
                        {item.materialName}
                      </td>
                      <td className="py-2 px-3">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="py-2 px-3 font-mono">₹{item.rate}</td>
                      <td className="py-2 px-3 font-mono font-bold text-right text-slate-900 dark:text-white">
                        {formatINR(item.amount)}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
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

          {/* Charges and Totals Summary Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                Subtotal
              </label>
              <div className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-900 font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
                {formatINR(subtotal)}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">
                  GST (%)
                </label>
                <span className="text-[11px] font-mono font-bold text-purple-600 dark:text-purple-400">
                  {formatINR(calculatedGstAmount)}
                </span>
              </div>
              <div className="flex items-center gap-1 mb-1.5 flex-wrap">
                {['0', '5', '12', '18', '28'].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setGstRate(rate)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all border ${
                      gstRate === rate
                        ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {rate}%
                  </button>
                ))}
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0"
                  max="100"
                  placeholder="GST %"
                  value={gstRate}
                  onChange={(e) => setGstRate(e.target.value)}
                  className="w-full pr-7 pl-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                Transport / Loading (₹)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={transportCharges}
                onChange={(e) => setTransportCharges(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono font-semibold"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                Discount (₹)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono font-semibold text-emerald-600"
              />
            </div>
          </div>

          {/* Final Bill Total Box */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-transparent border border-purple-500/20">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
              Total Bill Amount
            </span>
            <span className="text-lg font-black font-mono text-purple-700 dark:text-purple-300">
              {formatINR(totalAmount)}
            </span>
          </div>
        </div>

        {/* 3. "Pay Now" Section (Optional single payment inside the bill transaction) */}
        {!initialBill && (
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={payNow}
                  onChange={(e) => setPayNow(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-500" />
                  Pay Now (Record Payment Against This Bill Immediately)
                </span>
              </label>
              {payNow && (
                <span className="text-[11px] font-mono text-emerald-600 font-bold">
                  Available: {formatINR(sourceAvailableBalance)}
                </span>
              )}
            </div>

            {payNow && (
              <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      Amount to Pay (₹) *
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      max={totalAmount}
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      Payment Source *
                    </label>
                    <div className="grid grid-cols-2 gap-1 mb-1">
                      <button
                        type="button"
                        onClick={() => {
                          setPaySourceType('PARTNER');
                          if (partners.length > 0) setPaySourceId(partners[0].id);
                        }}
                        className={`py-1 text-[11px] font-bold rounded ${
                          paySourceType === 'PARTNER'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        Partner
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPaySourceType('BANK');
                          if (bankAccounts.length > 0) setPaySourceId(bankAccounts[0].id);
                        }}
                        className={`py-1 text-[11px] font-bold rounded ${
                          paySourceType === 'BANK'
                            ? 'bg-sky-600 text-white'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        Bank
                      </button>
                    </div>

                    <select
                      value={paySourceId}
                      onChange={(e) => setPaySourceId(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold"
                    >
                      {paySourceType === 'PARTNER'
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

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      Payment Method
                    </label>
                    <select
                      value={payMethod}
                      onChange={(e) => setPayMethod(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold"
                    >
                      <option value="CASH">Cash in Hand</option>
                      <option value="BANK">Bank Transfer (NEFT/RTGS)</option>
                      <option value="UPI">UPI / QR Code</option>
                      <option value="CHEQUE">Cheque</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Payment Reference / UTR (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UTR-98765432, Cheque #123456"
                    value={payReference}
                    onChange={(e) => setPayReference(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Edit Reason (When editing existing bill) */}
        {initialBill && (
          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
              Reason for Editing Bill *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Corrected rate as per revised voucher"
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
            />
          </div>
        )}

        {/* Modal Actions */}
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
            disabled={isSubmitting || items.length === 0}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-6"
          >
            {isSubmitting ? 'Saving Bill...' : initialBill ? 'Update Bill' : 'Save Purchase Bill'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
