'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ShoppingBag, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface MaterialOption {
  id: string;
  name: string;
  unit: string;
  purchaseRate: number;
}

interface ProjectOption {
  id: string;
  name: string;
  projectCode: string;
  sites?: { id: string; name: string }[];
}

interface SupplierOption {
  id: string;
  name: string;
}

interface GoodsPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultDate?: string;
}

export function GoodsPurchaseModal({
  isOpen,
  onClose,
  onSuccess,
  defaultDate,
}: GoodsPurchaseModalProps) {
  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);

  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [customSupplierName, setCustomSupplierName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [purchaseRate, setPurchaseRate] = useState('');
  const [date, setDate] = useState(defaultDate || new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [invoiceNumber, setInvoiceNumber] = useState('');
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
      const [mRes, pRes, sRes] = await Promise.all([
        fetch('/api/materials?limit=200'),
        fetch('/api/projects'),
        fetch('/api/materials/suppliers'),
      ]);

      if (mRes.ok) {
        const mData = await mRes.json();
        setMaterials(mData.materials || []);
      }
      if (pRes.ok) {
        const pData = await pRes.json();
        setProjects(pData.projects || []);
        if (pData.projects?.length > 0 && !selectedProjectId) {
          setSelectedProjectId(pData.projects[0].id);
        }
      }
      if (sRes.ok) {
        const sData = await sRes.json();
        setSuppliers(sData.suppliers || []);
      }
    } catch (err) {
      console.error('Failed to load purchase dependencies:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleMaterialChange = (matId: string) => {
    setSelectedMaterialId(matId);
    const found = materials.find((m) => m.id === matId);
    if (found && found.purchaseRate > 0) {
      setPurchaseRate(found.purchaseRate.toString());
    }
  };

  const selectedMaterial = materials.find((m) => m.id === selectedMaterialId);
  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const availableSites = selectedProject?.sites || [];

  const parsedQty = parseFloat(quantity) || 0;
  const parsedRate = parseFloat(purchaseRate) || 0;
  const calculatedTotal = Math.round(parsedQty * parsedRate * 100) / 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterialId) {
      setError('Please select a material');
      return;
    }
    if (!selectedProjectId) {
      setError('Please select a project');
      return;
    }
    if (parsedQty <= 0) {
      setError('Please enter a valid quantity');
      return;
    }
    if (parsedRate <= 0) {
      setError('Please enter a valid purchase rate');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/materials/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialId: selectedMaterialId,
          projectId: selectedProjectId,
          siteId: selectedSiteId || null,
          supplierId: selectedSupplierId || null,
          supplierName: customSupplierName.trim() || undefined,
          quantity: parsedQty,
          purchaseRate: parsedRate,
          date,
          paymentMethod,
          invoiceNumber: invoiceNumber.trim() || null,
          notes: notes.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to record goods purchase');
      }

      setQuantity('');
      setPurchaseRate('');
      setInvoiceNumber('');
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
      title="1-Click Goods Purchase (Material Stock + Cash Book)"
      description="Record goods/materials purchased on site. Increases site material inventory AND debits your cash book in a single click."
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 text-sm text-rose-400 bg-rose-950/40 border border-rose-800 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-start gap-2 p-2.5 bg-emerald-950/30 border border-emerald-800/60 rounded-lg text-xs text-emerald-300">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
          <span>
            <strong>Dual Update:</strong> Adds stock to site inventory (&quot;Aaya&quot;) and simultaneously logs an expense in your Cash Book.
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Material */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Select Material / Item <span className="text-rose-400">*</span>
            </label>
            <select
              value={selectedMaterialId}
              onChange={(e) => handleMaterialChange(e.target.value)}
              required
              className="w-full h-10 px-3 text-sm rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="">Select Material...</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.unit})
                </option>
              ))}
            </select>
          </div>

          {/* Project */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Project <span className="text-rose-400">*</span>
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                setSelectedSiteId('');
              }}
              required
              className="w-full h-10 px-3 text-sm rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="" disabled>Select Project...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Site / Tower */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Site / Tower (Optional)
            </label>
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className="w-full h-10 px-3 text-sm rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="">Main Site / Entire Project</option>
              {availableSites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Quantity {selectedMaterial ? `(${selectedMaterial.unit})` : ''} <span className="text-rose-400">*</span>
            </label>
            <Input
              type="number"
              min="0.01"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. 100"
              required
            />
          </div>

          {/* Rate per Unit */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Rate per Unit (₹) <span className="text-rose-400">*</span>
            </label>
            <Input
              type="number"
              min="0.01"
              step="any"
              value={purchaseRate}
              onChange={(e) => setPurchaseRate(e.target.value)}
              placeholder="e.g. 380"
              required
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Purchase Date <span className="text-rose-400">*</span>
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
              Paid Via
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full h-10 px-3 text-sm rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="CASH">💵 Cash in Hand</option>
              <option value="UPI">📱 UPI / GPay</option>
              <option value="BANK">🏦 Bank NEFT</option>
            </select>
          </div>

          {/* Supplier Name / Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Supplier / Shop Name
            </label>
            <Input
              value={customSupplierName}
              onChange={(e) => setCustomSupplierName(e.target.value)}
              placeholder="e.g. Gujarat Building Materials"
            />
          </div>

          {/* Bill / Invoice No. */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Bill / Challan No. (Optional)
            </label>
            <Input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="e.g. INV-10492"
            />
          </div>
        </div>

        {/* Calculated Total Display Card */}
        <div className="flex items-center justify-between p-3.5 bg-slate-950 border border-slate-800 rounded-xl">
          <span className="text-xs text-slate-400">Total Purchase Amount:</span>
          <span className="text-lg font-bold text-amber-400">
            ₹{calculatedTotal.toLocaleString('en-IN')}
          </span>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Notes / Quality Check
          </label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Delivered on Site Basement, unloaded by labour team"
          />
        </div>

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
              <ShoppingBag className="w-4 h-4" />
            )}
            Confirm Purchase &amp; Debit
          </Button>
        </div>
      </form>
    </Modal>
  );
}
