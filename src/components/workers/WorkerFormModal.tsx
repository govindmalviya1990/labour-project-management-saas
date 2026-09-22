'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { User, Phone, IndianRupee, AlertCircle } from 'lucide-react';

interface WorkerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: any;
}

export function WorkerFormModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}: WorkerFormModalProps) {
  const [formData, setFormData] = useState({
    workerCode: '',
    name: '',
    fatherOrHusbandName: '',
    mobile: '',
    address: '',
    skill: '',
    category: 'Mason',
    dailyWage: 800,
    wageUnit: 'PER_DAY',
    joiningDate: '',
    status: 'ACTIVE',
    notes: '',
  });

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        workerCode: initialData.workerCode || '',
        name: initialData.name || '',
        fatherOrHusbandName: initialData.fatherOrHusbandName || '',
        mobile: initialData.mobile || '',
        address: initialData.address || '',
        skill: initialData.skill || '',
        category: initialData.category || 'Mason',
        dailyWage: initialData.dailyWage || 800,
        wageUnit: initialData.wageUnit || 'PER_DAY',
        joiningDate: initialData.joiningDate ? initialData.joiningDate.split('T')[0] : '',
        status: initialData.status || 'ACTIVE',
        notes: initialData.notes || '',
      });
    } else {
      const randomCode = `WRK-${Math.floor(100 + Math.random() * 900)}`;
      setFormData({
        workerCode: randomCode,
        name: '',
        fatherOrHusbandName: '',
        mobile: '',
        address: '',
        skill: '',
        category: 'Mason',
        dailyWage: 800,
        wageUnit: 'PER_DAY',
        joiningDate: new Date().toISOString().split('T')[0],
        status: 'ACTIVE',
        notes: '',
      });
    }
    setError('');
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Worker name is required');
      return;
    }
    if (!formData.workerCode.trim()) {
      setError('Worker code is required');
      return;
    }

    setIsLoading(true);

    try {
      const url = initialData ? `/api/workers/${initialData.id}` : '/api/workers';
      const method = initialData ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'Failed to save worker');
        setIsLoading(false);
        return;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError('Network error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Edit Worker Profile' : 'Register New Worker'}
      description="Add worker identity, skill category, and daily wage parameters."
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
            label="Worker Full Name"
            required
            placeholder="e.g. Ramesh Kumar"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            leftIcon={<User className="w-4 h-4 text-amber-500" />}
          />

          <Input
            label="Worker ID / Code"
            required
            placeholder="e.g. WRK-101"
            value={formData.workerCode}
            onChange={(e) => setFormData({ ...formData, workerCode: e.target.value })}
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Skill Category
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:border-amber-500"
            >
              <option value="Mason">Mason (Rajmistri)</option>
              <option value="Helper">Helper (Beldar)</option>
              <option value="Carpenter">Carpenter (Badhai)</option>
              <option value="Electrician">Electrician</option>
              <option value="Plumber">Plumber</option>
              <option value="Painter">Painter</option>
              <option value="Flooring Worker">Flooring Worker</option>
              <option value="Steel Worker">Steel Worker (Fitter)</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <Input
            label="Daily Wage (₹ / Day)"
            type="number"
            min="0"
            required
            placeholder="800"
            value={formData.dailyWage}
            onChange={(e) => setFormData({ ...formData, dailyWage: Number(e.target.value) })}
            leftIcon={<IndianRupee className="w-4 h-4 text-amber-500" />}
          />

          <Input
            label="Mobile Number"
            type="tel"
            placeholder="+91 9876543210"
            value={formData.mobile}
            onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
            leftIcon={<Phone className="w-4 h-4 text-slate-500" />}
          />

          <Input
            label="Father / Husband Name"
            placeholder="e.g. Shri Ram Prasad"
            value={formData.fatherOrHusbandName}
            onChange={(e) => setFormData({ ...formData, fatherOrHusbandName: e.target.value })}
          />

          <Input
            label="Specialized Skill / Notes"
            placeholder="e.g. Tile cutter, slab reinforcement"
            value={formData.skill}
            onChange={(e) => setFormData({ ...formData, skill: e.target.value })}
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Employment Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:border-amber-500"
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          <Input
            label="Joining Date"
            type="date"
            value={formData.joiningDate}
            onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
          />

          <Input
            label="Home Address / Village"
            placeholder="Village, District, State"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md" isLoading={isLoading}>
            {initialData ? 'Update Worker' : 'Register Worker'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
