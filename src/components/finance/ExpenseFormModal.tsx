'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { IndianRupee, Receipt, AlertCircle } from 'lucide-react';

interface ExpenseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: any;
  defaultProjectId?: string;
}

export function ExpenseFormModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
  defaultProjectId,
}: ExpenseFormModalProps) {
  const [projects, setProjects] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    projectId: defaultProjectId || '',
    siteId: '',
    category: 'MISCELLANEOUS',
    description: '',
    amount: 1500,
    paidBy: '',
    paymentMethod: 'CASH',
    vendorName: '',
    receiptUrl: '',
    notes: '',
  });

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await fetch('/api/projects');
        if (!res.ok) return;
        const data = await res.json();
        setProjects(data.projects || []);
      } catch (e) {
        console.error(e);
      }
    }
    if (isOpen) {
      loadProjects();
      if (initialData) {
        setFormData({
          date: initialData.date ? initialData.date.split('T')[0] : '',
          projectId: initialData.projectId || '',
          siteId: initialData.siteId || '',
          category: initialData.category || 'MISCELLANEOUS',
          description: initialData.description || '',
          amount: initialData.amount || 0,
          paidBy: initialData.paidBy || '',
          paymentMethod: initialData.paymentMethod || 'CASH',
          vendorName: initialData.vendorName || '',
          receiptUrl: initialData.receiptUrl || '',
          notes: initialData.notes || '',
        });
      } else {
        setFormData({
          date: new Date().toISOString().split('T')[0],
          projectId: defaultProjectId || '',
          siteId: '',
          category: 'MISCELLANEOUS',
          description: '',
          amount: 1500,
          paidBy: '',
          paymentMethod: 'CASH',
          vendorName: '',
          receiptUrl: '',
          notes: '',
        });
      }
      setError('');
    }
  }, [isOpen, initialData, defaultProjectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.description.trim()) {
      setError('Expense description is required');
      return;
    }
    if (!formData.amount || formData.amount <= 0) {
      setError('Please enter a valid expense amount');
      return;
    }

    setIsLoading(true);

    try {
      const url = initialData ? `/api/finance/expenses/${initialData.id}` : '/api/finance/expenses';
      const method = initialData ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to save expense');
        setIsLoading(false);
        return;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError('Network error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Edit Expense' : 'Record Site Expense'}
      description="Record direct site costs (Fuel, Transport, Equipment Rent, Materials, etc.). This automatically updates project actual costs."
      maxWidth="lg"
    >
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Expense Description"
            required
            placeholder="e.g. Diesel for generator 100L"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            leftIcon={<Receipt className="w-4 h-4 text-amber-500" />}
          />

          <Input
            label="Amount (₹)"
            type="number"
            min="1"
            required
            placeholder="1500"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
            leftIcon={<IndianRupee className="w-4 h-4 text-rose-400" />}
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Expense Category
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:border-amber-500"
            >
              <option value="LABOUR">Labour / Daily Wages</option>
              <option value="MATERIAL">Material / Hardware</option>
              <option value="TRANSPORT">Transport / Cartage</option>
              <option value="FOOD">Food / Mess</option>
              <option value="FUEL">Fuel / Diesel / Petrol</option>
              <option value="EQUIPMENT">Equipment Rental / Machinery</option>
              <option value="RENT">Site Office / Scaffolding Rent</option>
              <option value="ELECTRICITY">Electricity / Power</option>
              <option value="MISCELLANEOUS">Miscellaneous</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Project (Linked Project)
            </label>
            <select
              value={formData.projectId}
              onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:border-amber-500"
            >
              <option value="">General Overhead / No Project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.projectCode})
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Date of Expense"
            type="date"
            required
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Payment Method
            </label>
            <select
              value={formData.paymentMethod}
              onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:border-amber-500"
            >
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="BANK">Bank Transfer</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <Input
            label="Paid By (Person Name)"
            placeholder="e.g. Vikas Sharma (Site Manager)"
            value={formData.paidBy}
            onChange={(e) => setFormData({ ...formData, paidBy: e.target.value })}
          />

          <Input
            label="Vendor / Shop Name"
            placeholder="e.g. Indian Oil Petrol Pump"
            value={formData.vendorName}
            onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
          />
        </div>

        <Input
          label="Notes / Bill Details"
          placeholder="e.g. Invoice #9982 or site supervisor approval"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
        />

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md" isLoading={isLoading}>
            {initialData ? 'Update Expense' : 'Save Expense'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
