'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ArrowRightLeft, AlertCircle, Info, AlertTriangle } from 'lucide-react';

interface TransferFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultSourceProjectId?: string;
}

export function TransferFormModal({
  isOpen,
  onClose,
  onSuccess,
  defaultSourceProjectId,
}: TransferFormModalProps) {
  const [projects, setProjects] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [sourceStock, setSourceStock] = useState<number | null>(null);
  const [checkingStock, setCheckingStock] = useState(false);

  const [formData, setFormData] = useState({
    sourceProjectId: defaultSourceProjectId || '',
    destinationProjectId: '',
    materialId: '',
    date: new Date().toISOString().split('T')[0],
    quantity: 50,
    notes: '',
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
          const projList = p.projects || [];
          setProjects(projList);
          if (!formData.sourceProjectId && projList.length > 0) {
            setFormData((prev) => ({
              ...prev,
              sourceProjectId: projList[0].id,
              destinationProjectId: projList.length > 1 ? projList[1].id : '',
            }));
          }
        }
        if (matRes.ok) {
          const m = await matRes.json();
          setMaterials(m.materials || []);
          if (m.materials?.length > 0 && !formData.materialId) {
            setFormData((prev) => ({ ...prev, materialId: m.materials[0].id }));
          }
        }
      } catch (e) {
        console.error('Failed to load transfer form dependencies:', e);
      }
    }

    if (isOpen) {
      loadData();
      setError('');
    }
  }, [isOpen, defaultSourceProjectId]);

  // Check source project stock
  useEffect(() => {
    async function checkSourceStock() {
      if (!formData.sourceProjectId || !formData.materialId) {
        setSourceStock(null);
        return;
      }
      setCheckingStock(true);
      try {
        const res = await fetch(`/api/materials?projectId=${formData.sourceProjectId}`);
        if (res.ok) {
          const data = await res.json();
          const found = (data.materials || []).find((m: any) => m.id === formData.materialId);
          setSourceStock(found ? found.remainingStock : 0);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setCheckingStock(false);
      }
    }

    if (isOpen && formData.sourceProjectId && formData.materialId) {
      checkSourceStock();
    }
  }, [isOpen, formData.sourceProjectId, formData.materialId]);

  const selectedMaterial = materials.find((m) => m.id === formData.materialId);
  const sourceProject = projects.find((p) => p.id === formData.sourceProjectId);
  const destProject = projects.find((p) => p.id === formData.destinationProjectId);

  const isStockInsufficient =
    sourceStock !== null && Number(formData.quantity) > sourceStock;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.sourceProjectId) {
      setError('Please select source project');
      return;
    }
    if (!formData.destinationProjectId) {
      setError('Please select destination project');
      return;
    }
    if (formData.sourceProjectId === formData.destinationProjectId) {
      setError('Source and destination projects must be different');
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

    if (isStockInsufficient) {
      setError(
        `Cannot transfer ${formData.quantity} ${selectedMaterial?.unit || 'units'}. Only ${Math.max(
          0,
          sourceStock
        )} ${selectedMaterial?.unit || 'units'} available at ${sourceProject?.name}.`
      );
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/materials/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceProjectId: formData.sourceProjectId,
          destinationProjectId: formData.destinationProjectId,
          materialId: formData.materialId,
          date: formData.date,
          quantity: Number(formData.quantity),
          notes: formData.notes || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to record transfer');
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
      title="Inter-Project Material Transfer"
      description="Transfer excess or shared materials between construction sites with zero purchase expense"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-start gap-2.5 text-xs text-blue-300">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
          <span>
            <strong>Accounting rule:</strong> Material transfers re-allocate inventory between projects.
            Stock will decrease at source and increase at destination. <strong>No purchase expense is generated.</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Source Project (From) *
            </label>
            <select
              value={formData.sourceProjectId}
              onChange={(e) => setFormData({ ...formData, sourceProjectId: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              required
            >
              <option value="">-- Select Source Project --</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.projectCode})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Destination Project (To) *
            </label>
            <select
              value={formData.destinationProjectId}
              onChange={(e) => setFormData({ ...formData, destinationProjectId: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              required
            >
              <option value="">-- Select Destination Project --</option>
              {projects.map((p) => (
                <option
                  key={p.id}
                  value={p.id}
                  disabled={p.id === formData.sourceProjectId}
                >
                  {p.name} ({p.projectCode}) {p.id === formData.sourceProjectId ? '(Source)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Material to Transfer *
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

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Transfer Date *
            </label>
            <Input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>
        </div>

        {/* Source Stock Indicator */}
        {selectedMaterial && (
          <div className={`p-3 rounded-lg border flex items-center justify-between text-sm ${
            sourceStock === null || checkingStock
              ? 'bg-slate-900/50 border-slate-800 text-slate-400'
              : sourceStock <= 0
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          }`}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Available at <strong>{sourceProject?.name || 'Source Project'}</strong>:</span>
            </div>
            <span className="font-bold text-base">
              {checkingStock ? 'Checking...' : `${sourceStock !== null ? sourceStock : 0} ${selectedMaterial.unit}`}
            </span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
            Transfer Quantity {selectedMaterial ? `(${selectedMaterial.unit})` : ''} *
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
              ⚠️ Cannot transfer more than source project balance ({sourceStock} {selectedMaterial?.unit})
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
            Transfer Notes / Vehicle Info
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Vehicle registration, driver contact, delivery slip number..."
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
            <ArrowRightLeft className="w-4 h-4 mr-1.5" />
            {isLoading ? 'Transferring...' : 'Execute Material Transfer'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
