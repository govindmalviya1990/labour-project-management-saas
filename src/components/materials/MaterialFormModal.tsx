'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Package, AlertCircle } from 'lucide-react';

interface MaterialFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: any;
}

const CATEGORIES = [
  'Cement',
  'Sand',
  'Steel',
  'Bricks',
  'Tiles',
  'Paint',
  'Electrical',
  'Plumbing',
  'Hardware',
  'Other',
];

const UNITS = [
  'bags',
  'sq.ft.',
  'sq.m.',
  'kg',
  'ton',
  'brass',
  'piece',
  'meter',
  'cum',
  'other',
];

export function MaterialFormModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}: MaterialFormModalProps) {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    materialCode: '',
    name: '',
    category: 'Cement',
    unit: 'bags',
    openingStock: 0,
    minimumStock: 10,
    purchaseRate: 0,
    supplierId: '',
    notes: '',
  });

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function loadSuppliers() {
      try {
        const res = await fetch('/api/materials/suppliers');
        if (!res.ok) return;
        const data = await res.json();
        setSuppliers(data.suppliers || []);
      } catch (e) {
        console.error('Failed to load suppliers:', e);
      }
    }

    if (isOpen) {
      loadSuppliers();
      if (initialData) {
        setFormData({
          materialCode: initialData.materialCode || '',
          name: initialData.name || '',
          category: initialData.category || 'Cement',
          unit: initialData.unit || 'bags',
          openingStock: initialData.openingStock || 0,
          minimumStock: initialData.minimumStock || 0,
          purchaseRate: initialData.purchaseRate || 0,
          supplierId: initialData.supplierId || '',
          notes: initialData.notes || '',
        });
      } else {
        const randomCode = `MAT-${Math.floor(100 + Math.random() * 900)}`;
        setFormData({
          materialCode: randomCode,
          name: '',
          category: 'Cement',
          unit: 'bags',
          openingStock: 0,
          minimumStock: 10,
          purchaseRate: 350,
          supplierId: '',
          notes: '',
        });
      }
      setError('');
    }
  }, [isOpen, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Material name is required');
      return;
    }
    if (!formData.materialCode.trim()) {
      setError('Material code is required');
      return;
    }

    setIsLoading(true);

    try {
      const url = initialData ? `/api/materials/${initialData.id}` : '/api/materials';
      const method = initialData ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        openingStock: Number(formData.openingStock) || 0,
        minimumStock: Number(formData.minimumStock) || 0,
        purchaseRate: Number(formData.purchaseRate) || 0,
        supplierId: formData.supplierId || null,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to save material');
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
      title={initialData ? `Edit Material: ${initialData.name}` : 'Add New Material to Catalog'}
      description="Track inventory items across all construction sites and projects"
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
              Material Code *
            </label>
            <Input
              value={formData.materialCode}
              onChange={(e) => setFormData({ ...formData, materialCode: e.target.value })}
              placeholder="e.g. MAT-CEM-01"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Material Name *
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. UltraTech PPC Cement"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Category
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Unit of Measurement
            </label>
            <select
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Opening Stock
            </label>
            <Input
              type="number"
              step="any"
              min="0"
              value={formData.openingStock}
              onChange={(e) => setFormData({ ...formData, openingStock: parseFloat(e.target.value) || 0 })}
              placeholder="0"
              disabled={!!initialData}
            />
            {initialData && <p className="text-[11px] text-slate-500 mt-1">Opening stock locked after creation</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Min Stock Alert Level
            </label>
            <Input
              type="number"
              step="any"
              min="0"
              value={formData.minimumStock}
              onChange={(e) => setFormData({ ...formData, minimumStock: parseFloat(e.target.value) || 0 })}
              placeholder="10"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Purchase Rate (₹ / {formData.unit})
            </label>
            <Input
              type="number"
              step="any"
              min="0"
              value={formData.purchaseRate}
              onChange={(e) => setFormData({ ...formData, purchaseRate: parseFloat(e.target.value) || 0 })}
              placeholder="350"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
            Default Supplier (Optional)
          </label>
          <select
            value={formData.supplierId}
            onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
            className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">-- No Default Supplier --</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.contactPerson || s.mobile || 'Vendor'})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
            Specifications / Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Grade, brand, packaging or storage instructions..."
            rows={2}
            className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading} className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold">
            <Package className="w-4 h-4 mr-1.5" />
            {isLoading ? 'Saving...' : initialData ? 'Update Material' : 'Save Material'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
