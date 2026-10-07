'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Send, AlertCircle, AlertTriangle, CheckCircle2, Truck } from 'lucide-react';

interface UsageFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultProjectId?: string;
  defaultMaterialId?: string;
  initialData?: any;
}

export function UsageFormModal({
  isOpen,
  onClose,
  onSuccess,
  defaultProjectId,
  defaultMaterialId,
  initialData,
}: UsageFormModalProps) {
  const [projects, setProjects] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [availableStock, setAvailableStock] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    projectId: initialData?.projectId || defaultProjectId || '',
    materialId: initialData?.materialId || defaultMaterialId || '',
    date: initialData?.date ? new Date(initialData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    quantity: initialData?.quantity !== undefined ? initialData.quantity : 0,
    taskPurpose: initialData?.taskPurpose || '',
    notes: initialData?.notes || '',
  });

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [projRes, matRes] = await Promise.all([
          fetch('/api/projects'),
          fetch('/api/materials'),
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
          const mats = m.materials || [];
          setMaterials(mats);
          if (!formData.materialId && mats.length > 0) {
            setFormData((prev) => ({ ...prev, materialId: mats[0].id }));
          }
        }

        if (initialData) {
          setFormData({
            projectId: initialData.projectId || '',
            materialId: initialData.materialId || '',
            date: initialData.date ? new Date(initialData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            quantity: initialData.quantity !== undefined ? initialData.quantity : 0,
            taskPurpose: initialData.taskPurpose || '',
            notes: initialData.notes || '',
          });
        }
      } catch (e) {
        console.error('Failed to load usage form dependencies:', e);
      }
    }

    if (isOpen) {
      loadData();
      setError('');
    }
  }, [isOpen, defaultProjectId, defaultMaterialId, initialData]);

  // Check available stock in Company Godown
  useEffect(() => {
    if (!formData.materialId || materials.length === 0) {
      setAvailableStock(null);
      return;
    }
    const found = materials.find((m: any) => m.id === formData.materialId);
    setAvailableStock(found ? found.remainingStock : 0);
  }, [formData.materialId, materials]);

  const selectedMaterial = materials.find((m) => m.id === formData.materialId);
  const selectedProject = projects.find((p) => p.id === formData.projectId);

  const isStockInsufficient =
    availableStock !== null && Number(formData.quantity) > availableStock;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.projectId) {
      setError('Please select destination construction site/project');
      return;
    }
    if (!formData.materialId) {
      setError('Please select a material');
      return;
    }
    if (!formData.quantity || formData.quantity <= 0) {
      setError('Quantity to send must be greater than zero');
      return;
    }

    if (!initialData && isStockInsufficient) {
      setError(
        `Cannot send ${formData.quantity} ${selectedMaterial?.unit || 'units'}. Only ${Math.max(
          0,
          availableStock || 0
        )} ${selectedMaterial?.unit || 'units'} available in Company Godown Stock.`
      );
      return;
    }

    setIsLoading(true);

    try {
      const url = initialData ? `/api/materials/usage/${initialData.id}` : '/api/materials/usage';
      const method = initialData ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: formData.projectId,
          materialId: formData.materialId,
          date: formData.date,
          quantity: Number(formData.quantity),
          taskPurpose: formData.taskPurpose || 'PENDING',
          notes: formData.notes || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to dispatch material');
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
      title={initialData ? 'Edit Send Material Record' : 'Send Material to Site'}
      description="Dispatch material from company godown stock to construction project site. Dispatched stock is deducted from total company inventory."
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
              Destination Site / Project *
            </label>
            <select
              value={formData.projectId}
              onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              required
            >
              <option value="">-- Select Destination Site --</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.projectCode})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Dispatch Date *
            </label>
            <Input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
            Material to Send *
          </label>
          <select
            value={formData.materialId}
            onChange={(e) => setFormData({ ...formData, materialId: e.target.value })}
            className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            required
          >
            <option value="">-- Select Material --</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.materialCode}) — [Available in Godown: {m.remainingStock} {m.unit}]
              </option>
            ))}
          </select>
        </div>

        {/* Live Company Stock Status Badge */}
        {selectedMaterial && (
          <div className={`p-3 rounded-lg border flex items-center justify-between text-sm ${
            availableStock === null
              ? 'bg-slate-900/50 border-slate-800 text-slate-400'
              : availableStock <= 0
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              : availableStock < 20
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          }`}>
            <div className="flex items-center gap-2">
              {availableStock && availableStock > 0 ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>
                Company Godown Available Stock: <strong>{selectedMaterial.name}</strong>
              </span>
            </div>
            <span className="font-bold text-base">
              {availableStock !== null ? `${availableStock} ${selectedMaterial.unit}` : '0 units'}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Quantity to Send {selectedMaterial ? `(${selectedMaterial.unit})` : ''} *
            </label>
            <Input
              type="number"
              step="any"
              min="0.01"
              value={formData.quantity || ''}
              onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
              className={isStockInsufficient ? 'border-rose-500 focus:ring-rose-500' : ''}
              placeholder="Enter quantity to dispatch"
              required
            />
            {isStockInsufficient && (
              <p className="text-xs text-rose-400 mt-1 font-medium">
                ⚠️ Exceeds company available stock of {availableStock} {selectedMaterial?.unit}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Vehicle / Challan / Delivery Ref
            </label>
            <Input
              value={formData.taskPurpose === 'PENDING' ? '' : formData.taskPurpose}
              onChange={(e) => setFormData({ ...formData, taskPurpose: e.target.value })}
              placeholder="e.g. Truck RJ14-1234, Challan #402, Driver Ramesh"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
            Dispatch Instructions / Notes for Site Supervisor
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Any specific instructions for supervisor verifying at site..."
            rows={2}
            className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isLoading || isStockInsufficient}
            className="bg-sky-600 hover:bg-sky-700 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Truck className="w-4 h-4 mr-1.5" />
            {isLoading ? 'Sending...' : initialData ? 'Update Dispatch Record' : 'Confirm & Send to Site'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
