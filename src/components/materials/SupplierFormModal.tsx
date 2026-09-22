'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Building2, AlertCircle } from 'lucide-react';

interface SupplierFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: any;
}

export function SupplierFormModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}: SupplierFormModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    mobile: '',
    email: '',
    address: '',
    gstNumber: '',
  });

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          name: initialData.name || '',
          contactPerson: initialData.contactPerson || '',
          mobile: initialData.mobile || '',
          email: initialData.email || '',
          address: initialData.address || '',
          gstNumber: initialData.gstNumber || '',
        });
      } else {
        setFormData({
          name: '',
          contactPerson: '',
          mobile: '',
          email: '',
          address: '',
          gstNumber: '',
        });
      }
      setError('');
    }
  }, [isOpen, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Supplier business name is required');
      return;
    }

    setIsLoading(true);

    try {
      const url = initialData ? `/api/materials/suppliers/${initialData.id}` : '/api/materials/suppliers';
      const method = initialData ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to save supplier');
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
      title={initialData ? `Edit Supplier: ${initialData.name}` : 'Register New Material Supplier / Vendor'}
      description="Keep vendor contact, GST, and procurement details organized"
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
              Supplier / Company Name *
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Shree Ram Building Materials Pvt Ltd"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Contact Person
            </label>
            <Input
              value={formData.contactPerson}
              onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
              placeholder="e.g. Rajesh Sharma"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Mobile Number
            </label>
            <Input
              value={formData.mobile}
              onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
              placeholder="+91 98765 43210"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="vendor@company.com"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              GST Number (GSTIN)
            </label>
            <Input
              value={formData.gstNumber}
              onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value.toUpperCase() })}
              placeholder="27ABCDE1234F1Z5"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Office / Yard Address
            </label>
            <Input
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Warehouse 4, Ring Road, Pune"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading} className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold">
            <Building2 className="w-4 h-4 mr-1.5" />
            {isLoading ? 'Saving...' : initialData ? 'Update Supplier' : 'Save Supplier'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
