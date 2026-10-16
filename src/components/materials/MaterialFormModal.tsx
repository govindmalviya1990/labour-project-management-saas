'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Package, AlertCircle, Plus, Building2 } from 'lucide-react';

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
  const [dynamicCategories, setDynamicCategories] = useState<string[]>(CATEGORIES);
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategory, setCustomCategory] = useState('');

  // Inline Quick Supplier Creation state
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);
  const [isSavingSupplier, setIsSavingSupplier] = useState(false);
  const [supplierAddError, setSupplierAddError] = useState('');
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    contactPerson: '',
    mobile: '',
    address: '',
    gstNumber: '',
  });

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
    async function loadSuppliersAndCategories() {
      try {
        const [supRes, matRes] = await Promise.all([
          fetch('/api/materials/suppliers'),
          fetch('/api/materials'),
        ]);

        if (supRes.ok) {
          const data = await supRes.json();
          setSuppliers(data.suppliers || []);
        }

        if (matRes.ok) {
          const matData = await matRes.json();
          const existingCats = (matData.materials || []).map((m: any) => m.category).filter(Boolean);
          const combined = Array.from(new Set([...CATEGORIES, ...existingCats])) as string[];
          setDynamicCategories(combined);
        }
      } catch (e) {
        console.error('Failed to load modal metadata:', e);
      }
    }

    if (isOpen) {
      loadSuppliersAndCategories();
      setIsAddingSupplier(false);
      setSupplierAddError('');
      setNewSupplier({
        name: '',
        contactPerson: '',
        mobile: '',
        address: '',
        gstNumber: '',
      });

      if (initialData) {
        const cat = initialData.category || 'Cement';
        const isKnown = CATEGORIES.includes(cat);
        setIsCustomCategory(!isKnown);
        setCustomCategory(!isKnown ? cat : '');
        setFormData({
          materialCode: initialData.materialCode || '',
          name: initialData.name || '',
          category: cat,
          unit: initialData.unit || 'bags',
          openingStock: initialData.openingStock || 0,
          minimumStock: initialData.minimumStock || 0,
          purchaseRate: initialData.purchaseRate || 0,
          supplierId: initialData.supplierId || '',
          notes: initialData.notes || '',
        });
      } else {
        setIsCustomCategory(false);
        setCustomCategory('');
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

  const handleCreateSupplier = async () => {
    if (!newSupplier.name.trim()) {
      setSupplierAddError('Supplier / Vendor business name is required');
      return;
    }

    setIsSavingSupplier(true);
    setSupplierAddError('');

    try {
      const res = await fetch('/api/materials/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSupplier.name.trim(),
          contactPerson: newSupplier.contactPerson.trim() || undefined,
          mobile: newSupplier.mobile.trim() || undefined,
          address: newSupplier.address.trim() || undefined,
          gstNumber: newSupplier.gstNumber.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create supplier');
      }

      const created = data.supplier;
      setSuppliers((prev) => [created, ...prev]);
      setFormData((prev) => ({ ...prev, supplierId: created.id }));
      setIsAddingSupplier(false);
      setNewSupplier({
        name: '',
        contactPerson: '',
        mobile: '',
        address: '',
        gstNumber: '',
      });
    } catch (err: any) {
      setSupplierAddError(err.message || 'Failed to register supplier');
    } finally {
      setIsSavingSupplier(false);
    }
  };

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
    if (isAddingSupplier && !formData.supplierId) {
      setError('Please click "Save & Select Supplier" first or cancel adding supplier');
      return;
    }
    if (!formData.supplierId) {
      setError('Supplier is required. Please select an existing supplier or click "+ Add New Supplier"');
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Category *
              </label>
              {!isCustomCategory ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomCategory(true);
                    setCustomCategory('');
                    setFormData((prev) => ({ ...prev, category: '' }));
                  }}
                  className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold"
                >
                  + Add Custom Category
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomCategory(false);
                    setFormData((prev) => ({ ...prev, category: 'Cement' }));
                  }}
                  className="text-[11px] text-slate-400 hover:text-slate-200"
                >
                  Back to List
                </button>
              )}
            </div>

            {isCustomCategory ? (
              <div className="space-y-1.5">
                <Input
                  value={customCategory}
                  onChange={(e) => {
                    setCustomCategory(e.target.value);
                    setFormData({ ...formData, category: e.target.value });
                  }}
                  placeholder="Enter Custom Category (e.g. Wood, Rori, Marble, Glass)"
                  required
                  autoFocus
                />
                <p className="text-[10px] text-slate-400">
                  Custom category will be saved and available in your catalog.
                </p>
              </div>
            ) : (
              <select
                value={formData.category}
                onChange={(e) => {
                  if (e.target.value === '__NEW__') {
                    setIsCustomCategory(true);
                    setCustomCategory('');
                    setFormData({ ...formData, category: '' });
                  } else {
                    setFormData({ ...formData, category: e.target.value });
                  }
                }}
                className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {dynamicCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option value="__NEW__">➕ + Custom Category (Add New)...</option>
              </select>
            )}
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
              Company Stock (Godown Inventory)
            </label>
            <Input
              type="number"
              step="any"
              min="0"
              value={formData.openingStock}
              onChange={(e) => setFormData({ ...formData, openingStock: parseFloat(e.target.value) || 0 })}
              placeholder="0"
            />
            <p className="text-[11px] text-slate-500 mt-1">Total stock held in company godown</p>
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
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Supplier / Vendor *
            </label>
            {!isAddingSupplier ? (
              <button
                type="button"
                onClick={() => {
                  setIsAddingSupplier(true);
                  setSupplierAddError('');
                }}
                className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                + Add New Supplier
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsAddingSupplier(false);
                  setSupplierAddError('');
                }}
                className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancel Quick Add
              </button>
            )}
          </div>

          {/* Quick Inline Supplier Registration Form */}
          {isAddingSupplier && (
            <div className="mb-3 p-3.5 bg-slate-900/90 border border-amber-500/40 rounded-xl space-y-3 shadow-lg shadow-black/20 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                    Register New Supplier / Vendor
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingSupplier(false);
                    setSupplierAddError('');
                  }}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {supplierAddError && (
                <div className="flex items-center gap-2 p-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-xs">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{supplierAddError}</span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                  Supplier / Vendor Business Name *
                </label>
                <Input
                  value={newSupplier.name}
                  onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                  placeholder="e.g. Balaji Steel & Cement Traders"
                  autoFocus
                  className="h-9 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                    Contact Person (Optional)
                  </label>
                  <Input
                    value={newSupplier.contactPerson}
                    onChange={(e) => setNewSupplier({ ...newSupplier, contactPerson: e.target.value })}
                    placeholder="e.g. Ramesh Kumar"
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                    Mobile Number (Optional)
                  </label>
                  <Input
                    value={newSupplier.mobile}
                    onChange={(e) => setNewSupplier({ ...newSupplier, mobile: e.target.value })}
                    placeholder="e.g. 9876543210"
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                    GSTIN (Optional)
                  </label>
                  <Input
                    value={newSupplier.gstNumber}
                    onChange={(e) => setNewSupplier({ ...newSupplier, gstNumber: e.target.value })}
                    placeholder="e.g. 27ABCDE1234F1Z5"
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                    City / Address (Optional)
                  </label>
                  <Input
                    value={newSupplier.address}
                    onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
                    placeholder="e.g. Industrial Area, Pune"
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsAddingSupplier(false);
                    setSupplierAddError('');
                  }}
                  disabled={isSavingSupplier}
                  className="text-xs h-8"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCreateSupplier}
                  disabled={isSavingSupplier}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs h-8"
                >
                  {isSavingSupplier ? 'Saving Supplier...' : '✓ Save & Select Supplier'}
                </Button>
              </div>
            </div>
          )}

          <select
            value={formData.supplierId}
            onChange={(e) => {
              if (e.target.value === '__add_new__') {
                setIsAddingSupplier(true);
                setSupplierAddError('');
                return;
              }
              setFormData({ ...formData, supplierId: e.target.value });
            }}
            className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            required
          >
            <option value="">-- Select Supplier / Vendor * --</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.contactPerson || s.mobile || 'Vendor'})
              </option>
            ))}
            <option value="__add_new__" className="text-amber-400 font-bold bg-slate-800">
              ➕ + Register New Supplier Directly...
            </option>
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
