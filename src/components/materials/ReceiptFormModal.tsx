'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Truck, AlertCircle, IndianRupee } from 'lucide-react';

interface ReceiptFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultProjectId?: string;
}

export function ReceiptFormModal({
  isOpen,
  onClose,
  onSuccess,
  defaultProjectId,
}: ReceiptFormModalProps) {
  const [projects, setProjects] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    projectId: defaultProjectId || '',
    siteId: '',
    materialId: '',
    supplierId: '',
    date: new Date().toISOString().split('T')[0],
    quantity: 100,
    purchaseRate: 350,
    invoiceNumber: '',
    notes: '',
  });

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [projRes, matRes, supRes] = await Promise.all([
          fetch('/api/projects'),
          fetch('/api/materials'),
          fetch('/api/materials/suppliers'),
        ]);

        if (projRes.ok) {
          const p = await projRes.json();
          setProjects(p.projects || []);
          if (!formData.projectId && p.projects?.length > 0) {
            setFormData((prev) => ({ ...prev, projectId: p.projects[0].id }));
          }
        }
        if (matRes.ok) {
          const m = await matRes.json();
          setMaterials(m.materials || []);
          if (m.materials?.length > 0 && !formData.materialId) {
            const first = m.materials[0];
            setFormData((prev) => ({
              ...prev,
              materialId: first.id,
              purchaseRate: first.purchaseRate || 0,
            }));
          }
        }
        if (supRes.ok) {
          const s = await supRes.json();
          setSuppliers(s.suppliers || []);
        }
      } catch (e) {
        console.error('Failed to load receipt form data:', e);
      }
    }

    if (isOpen) {
      loadData();
      setError('');
    }
  }, [isOpen, defaultProjectId]);

  const selectedMaterial = materials.find((m) => m.id === formData.materialId);
  const totalCost = Math.round((Number(formData.quantity) || 0) * (Number(formData.purchaseRate) || 0) * 100) / 100;

  const handleMaterialChange = (matId: string) => {
    const mat = materials.find((m) => m.id === matId);
    setFormData({
      ...formData,
      materialId: matId,
      purchaseRate: mat?.purchaseRate || formData.purchaseRate,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.projectId) {
      setError('Please select a project');
      return;
    }
    if (!formData.materialId) {
      setError('Please select a material');
      return;
    }
    if (!formData.quantity || formData.quantity <= 0) {
      setError('Quantity must be greater than zero');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/materials/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: formData.projectId,
          materialId: formData.materialId,
          supplierId: formData.supplierId || null,
          date: formData.date,
          quantity: Number(formData.quantity),
          purchaseRate: Number(formData.purchaseRate) || 0,
          invoiceNumber: formData.invoiceNumber || null,
          notes: formData.notes || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to record receipt');
        setIsLoading(false);
        return;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Material Inward / Receipt (GRN)"
      description="Add incoming material shipment to site inventory and project cost"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Receiving Project *
            </label>
            <select
              value={formData.projectId}
              onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              required
            >
              <option value="">-- Select Project --</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.projectCode})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Receipt Date *
            </label>
            <Input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Material Item *
            </label>
            <select
              value={formData.materialId}
              onChange={(e) => handleMaterialChange(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              required
            >
              <option value="">-- Select Material --</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.materialCode}) - Unit: {m.unit}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Supplier / Vendor
            </label>
            <select
              value={formData.supplierId}
              onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">-- Direct / Local Purchase --</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.contactPerson || s.mobile || 'Vendor'})</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Received Quantity {selectedMaterial ? `(${selectedMaterial.unit})` : ''} *
            </label>
            <Input
              type="number"
              step="any"
              min="0.01"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Purchase Rate (₹ / {selectedMaterial?.unit || 'unit'})
            </label>
            <Input
              type="number"
              step="any"
              min="0"
              value={formData.purchaseRate}
              onChange={(e) => setFormData({ ...formData, purchaseRate: parseFloat(e.target.value) || 0 })}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Total Cost
            </label>
            <div className="flex items-center h-10 px-3 bg-slate-950 border border-slate-800 rounded-lg text-amber-400 font-bold text-sm">
              ₹{totalCost.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
            Challan / Invoice Number
          </label>
          <Input
            value={formData.invoiceNumber}
            onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
            placeholder="e.g. INV-2024-8849 / DC-102"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
            Remarks / Vehicle / Unloading Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Vehicle number, unloaded at tower B, batch number..."
            rows={2}
            className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading} className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold">
            <Truck className="w-4 h-4 mr-1.5" />
            {isLoading ? 'Recording...' : 'Record Inward Stock'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
