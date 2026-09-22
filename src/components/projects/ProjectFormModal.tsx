'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { formatINR } from '@/lib/calculations';
import { Building2, IndianRupee, Users, Calendar, AlertCircle } from 'lucide-react';

interface ProjectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: any;
}

export function ProjectFormModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}: ProjectFormModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    projectCode: '',
    projectType: 'Residential',
    status: 'RUNNING',
    location: '',
    fullAddress: '',
    clientName: '',
    clientMobile: '',
    clientEmail: '',
    referenceSource: '',
    engineerName: '',
    engineerMobile: '',
    architectName: '',
    architectMobile: '',
    startDate: '',
    expectedCompletionDate: '',
    projectValue: 0,
    estimatedLabourCost: 0,
    estimatedMaterialCost: 0,
    estimatedOtherExpense: 0,
    targetUnit: 'sq.ft.',
    targetQuantity: 0,
    notes: '',
    initialSiteName: '',
  });

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        projectCode: initialData.projectCode || '',
        projectType: initialData.projectType || 'Residential',
        status: initialData.status || 'RUNNING',
        location: initialData.location || '',
        fullAddress: initialData.fullAddress || '',
        clientName: initialData.clientName || '',
        clientMobile: initialData.clientMobile || '',
        clientEmail: initialData.clientEmail || '',
        referenceSource: initialData.referenceSource || '',
        engineerName: initialData.engineerName || '',
        engineerMobile: initialData.engineerMobile || '',
        architectName: initialData.architectName || '',
        architectMobile: initialData.architectMobile || '',
        startDate: initialData.startDate ? initialData.startDate.split('T')[0] : '',
        expectedCompletionDate: initialData.expectedCompletionDate
          ? initialData.expectedCompletionDate.split('T')[0]
          : '',
        projectValue: initialData.projectValue || 0,
        estimatedLabourCost: initialData.estimatedLabourCost || 0,
        estimatedMaterialCost: initialData.estimatedMaterialCost || 0,
        estimatedOtherExpense: initialData.estimatedOtherExpense || 0,
        targetUnit: initialData.targetUnit || 'sq.ft.',
        targetQuantity: initialData.targetQuantity || 0,
        notes: initialData.notes || '',
        initialSiteName: '',
      });
    } else {
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      setFormData({
        name: '',
        projectCode: `PRJ-${randomSuffix}`,
        projectType: 'Residential',
        status: 'RUNNING',
        location: '',
        fullAddress: '',
        clientName: '',
        clientMobile: '',
        clientEmail: '',
        referenceSource: '',
        engineerName: '',
        engineerMobile: '',
        architectName: '',
        architectMobile: '',
        startDate: new Date().toISOString().split('T')[0],
        expectedCompletionDate: '',
        projectValue: 0,
        estimatedLabourCost: 0,
        estimatedMaterialCost: 0,
        estimatedOtherExpense: 0,
        targetUnit: 'sq.ft.',
        targetQuantity: 0,
        notes: '',
        initialSiteName: 'Main Site',
      });
    }
    setError('');
  }, [initialData, isOpen]);

  const estimatedTotalCost =
    Number(formData.estimatedLabourCost || 0) +
    Number(formData.estimatedMaterialCost || 0) +
    Number(formData.estimatedOtherExpense || 0);

  const estimatedProfit = Number(formData.projectValue || 0) - estimatedTotalCost;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Project name is required');
      return;
    }
    if (!formData.projectCode.trim()) {
      setError('Project code is required');
      return;
    }

    setIsLoading(true);

    try {
      const url = initialData ? `/api/projects/${initialData.id}` : '/api/projects';
      const method = initialData ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'Failed to save project');
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
      title={initialData ? 'Edit Project' : 'Create New Construction Project'}
      description="Add project parameters, client contacts, schedule, and cost estimations."
      maxWidth="2xl"
    >
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Details */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" />
            Basic Project Information
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Project Name"
              required
              placeholder="e.g. Sunrise Heights Tower A"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <Input
              label="Project Code"
              required
              placeholder="e.g. PRJ-101"
              value={formData.projectCode}
              onChange={(e) => setFormData({ ...formData, projectCode: e.target.value })}
            />
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Project Type
              </label>
              <select
                value={formData.projectType}
                onChange={(e) => setFormData({ ...formData, projectType: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:border-amber-500"
              >
                <option value="Residential">Residential</option>
                <option value="Commercial">Commercial</option>
                <option value="Infrastructure">Infrastructure</option>
                <option value="Industrial">Industrial</option>
                <option value="Renovation">Renovation</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:border-amber-500"
              >
                <option value="RUNNING">Running (Active)</option>
                <option value="ENQUIRY">Enquiry</option>
                <option value="COMING_SOON">Coming Soon</option>
                <option value="COMPLETED">Completed</option>
                <option value="ON_HOLD">On Hold</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            <Input
              label="Location / Area"
              placeholder="Sector 62, Noida"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            />
            <Input
              label="Full Site Address"
              placeholder="Plot 42, Block B, Industrial Hub"
              value={formData.fullAddress}
              onChange={(e) => setFormData({ ...formData, fullAddress: e.target.value })}
            />
            {!initialData && (
              <Input
                label="Initial Site Name"
                placeholder="e.g. Tower A or Main Block"
                value={formData.initialSiteName}
                onChange={(e) => setFormData({ ...formData, initialSiteName: e.target.value })}
              />
            )}
          </div>
        </div>

        {/* Client & Consultants */}
        <div className="space-y-3 border-t border-slate-800 pt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            Client & Project Consultants
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Client / Owner Name"
              placeholder="Mr. Rajesh Singhal"
              value={formData.clientName}
              onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
            />
            <Input
              label="Client Mobile"
              type="tel"
              placeholder="+91 9876543210"
              value={formData.clientMobile}
              onChange={(e) => setFormData({ ...formData, clientMobile: e.target.value })}
            />
            <Input
              label="Site Engineer Name"
              placeholder="Er. Amit Verma"
              value={formData.engineerName}
              onChange={(e) => setFormData({ ...formData, engineerName: e.target.value })}
            />
            <Input
              label="Engineer Mobile"
              type="tel"
              placeholder="+91 9812345678"
              value={formData.engineerMobile}
              onChange={(e) => setFormData({ ...formData, engineerMobile: e.target.value })}
            />
            <Input
              label="Architect Name"
              placeholder="Ar. Sunita Mehta"
              value={formData.architectName}
              onChange={(e) => setFormData({ ...formData, architectName: e.target.value })}
            />
            <Input
              label="Architect Mobile"
              type="tel"
              placeholder="+91 9823456789"
              value={formData.architectMobile}
              onChange={(e) => setFormData({ ...formData, architectMobile: e.target.value })}
            />
          </div>
        </div>

        {/* Financial Estimations & Contract Value */}
        <div className="space-y-3 border-t border-slate-800 pt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <IndianRupee className="w-3.5 h-3.5" />
            Financial Budget & Estimations
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Project Contract Value (₹)"
              type="number"
              min="0"
              placeholder="5000000"
              value={formData.projectValue}
              onChange={(e) => setFormData({ ...formData, projectValue: Number(e.target.value) })}
            />
            <Input
              label="Estimated Labour Cost (₹)"
              type="number"
              min="0"
              placeholder="1000000"
              value={formData.estimatedLabourCost}
              onChange={(e) => setFormData({ ...formData, estimatedLabourCost: Number(e.target.value) })}
            />
            <Input
              label="Estimated Material Cost (₹)"
              type="number"
              min="0"
              placeholder="2000000"
              value={formData.estimatedMaterialCost}
              onChange={(e) => setFormData({ ...formData, estimatedMaterialCost: Number(e.target.value) })}
            />
            <Input
              label="Estimated Other Expense (₹)"
              type="number"
              min="0"
              placeholder="500000"
              value={formData.estimatedOtherExpense}
              onChange={(e) => setFormData({ ...formData, estimatedOtherExpense: Number(e.target.value) })}
            />
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Measurement Unit
              </label>
              <select
                value={formData.targetUnit}
                onChange={(e) => setFormData({ ...formData, targetUnit: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:border-amber-500"
              >
                <option value="sq.ft.">sq.ft.</option>
                <option value="sq.m.">sq.m.</option>
                <option value="running ft.">running ft.</option>
                <option value="meter">meter</option>
                <option value="unit">unit / flat</option>
              </select>
            </div>
            <Input
              label={`Target Quantity (${formData.targetUnit})`}
              type="number"
              min="0"
              placeholder="25000"
              value={formData.targetQuantity}
              onChange={(e) => setFormData({ ...formData, targetQuantity: Number(e.target.value) })}
            />
          </div>

          {/* Real-time Calculation Summary Badge */}
          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-400">Estimated Total Cost:</span>{' '}
              <span className="font-bold text-white">{formatINR(estimatedTotalCost)}</span>
            </div>
            <div>
              <span className="text-slate-400">Estimated Profit:</span>{' '}
              <span className={`font-bold ${estimatedProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatINR(estimatedProfit)}
              </span>
            </div>
          </div>
        </div>

        {/* Dates & Schedule */}
        <div className="space-y-3 border-t border-slate-800 pt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            Project Schedule & Dates
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Start Date"
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            />
            <Input
              label="Expected Completion Date"
              type="date"
              value={formData.expectedCompletionDate}
              onChange={(e) => setFormData({ ...formData, expectedCompletionDate: e.target.value })}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md" isLoading={isLoading}>
            {initialData ? 'Update Project' : 'Create Project'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
