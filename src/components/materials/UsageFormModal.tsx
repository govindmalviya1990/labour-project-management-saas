'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Hammer, AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';

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
  const [checkingStock, setCheckingStock] = useState(false);

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
          setMaterials(m.materials || []);
          if (!formData.materialId && m.materials?.length > 0) {
            setFormData((prev) => ({ ...prev, materialId: m.materials[0].id }));
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

  // Check available stock whenever project or material changes
  useEffect(() => {
    async function checkStock() {
      if (!formData.projectId || !formData.materialId) {
        setAvailableStock(null);
        return;
      }
      setCheckingStock(true);
      try {
        // Fetch project-specific materials stock
        const res = await fetch(`/api/materials?projectId=${formData.projectId}`);
        if (res.ok) {
          const data = await res.json();
          const found = (data.materials || []).find((m: any) => m.id === formData.materialId);
          if (found) {
            setAvailableStock(found.remainingStock);
          } else {
            setAvailableStock(0);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setCheckingStock(false);
      }
    }

    if (isOpen && formData.projectId && formData.materialId) {
      checkStock();
    }
  }, [isOpen, formData.projectId, formData.materialId]);

  const selectedMaterial = materials.find((m) => m.id === formData.materialId);
  const selectedProject = projects.find((p) => p.id === formData.projectId);

  const isStockInsufficient =
    availableStock !== null && Number(formData.quantity) > availableStock;

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
    if (!formData.taskPurpose.trim()) {
      setError('Please enter the purpose or activity where material was used');
      return;
    }

    if (!initialData && isStockInsufficient) {
      setError(
        `Cannot use ${formData.quantity} ${selectedMaterial?.unit || 'units'}. Only ${Math.max(
          0,
          availableStock
        )} ${selectedMaterial?.unit || 'units'} available at ${selectedProject?.name || 'this project'}.`
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
          taskPurpose: formData.taskPurpose,
          notes: formData.notes || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to record material consumption');
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
      title={initialData ? 'Edit Material Consumption / Usage Log' : 'Record Material Consumption / Daily Usage'}
      description="Log daily materials used on site. Negative inventory is strictly prevented."
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
              Project / Site *
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
              Date of Usage *
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
            Material to Consume *
          </label>
          <select
            value={formData.materialId}
            onChange={(e) => setFormData({ ...formData, materialId: e.target.value })}
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

        {/* Live Stock Status Badge */}
        {selectedMaterial && (
          <div className={`p-3 rounded-lg border flex items-center justify-between text-sm ${
            availableStock === null || checkingStock
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
                Available Stock at <strong>{selectedProject?.name || 'Selected Project'}</strong>:
              </span>
            </div>
            <span className="font-bold text-base">
              {checkingStock ? 'Checking...' : `${availableStock !== null ? availableStock : '0'} ${selectedMaterial.unit}`}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Quantity Used {selectedMaterial ? `(${selectedMaterial.unit})` : ''} *
            </label>
            <Input
              type="number"
              step="any"
              min="0.01"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
              className={isStockInsufficient ? 'border-rose-500 focus:ring-rose-500' : ''}
              required
            />
            {isStockInsufficient && (
              <p className="text-xs text-rose-400 mt-1 font-medium">
                ⚠️ Exceeds available stock of {availableStock} {selectedMaterial?.unit}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Purpose / Construction Work *
            </label>
            <Input
              value={formData.taskPurpose}
              onChange={(e) => setFormData({ ...formData, taskPurpose: e.target.value })}
              placeholder="e.g. Slab casting 4th floor, Plastering Tower B"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
            Supervisor Notes (Optional)
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Wastage notes, contractor name, weather conditions..."
            rows={2}
            className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isLoading || isStockInsufficient}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Hammer className="w-4 h-4 mr-1.5" />
            {isLoading ? 'Saving...' : initialData ? 'Update Material Usage' : 'Log Material Usage'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
