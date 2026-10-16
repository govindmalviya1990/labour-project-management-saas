'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import {
  ArrowRightLeft,
  AlertCircle,
  Info,
  AlertTriangle,
  Building2,
  MapPin,
  User,
  Phone,
  Truck,
  Calendar,
  FileText,
  CheckCircle2,
} from 'lucide-react';

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
    // Source Site (From)
    sourceProjectId: defaultSourceProjectId || '',
    sourceSiteId: '',
    sourceLocation: '',
    senderSupervisor: '',

    // Destination Site (To)
    destinationProjectId: '',
    destinationSiteId: '',
    destinationLocation: '',
    receiverSupervisor: '',
    receiverMobile: '',

    // Transfer Items
    materialId: '',
    date: new Date().toISOString().split('T')[0],
    quantity: 50,
    vehicleDetails: '',
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

        let projList: any[] = [];
        if (projRes.ok) {
          const p = await projRes.json();
          projList = p.projects || [];
          setProjects(projList);

          const srcProj = projList.find((x) => x.id === defaultSourceProjectId) || projList[0];
          const destProj = projList.find((x) => x.id !== srcProj?.id) || null;

          if (srcProj && !formData.sourceProjectId) {
            const firstSrcSite = srcProj.sites && srcProj.sites.length > 0 ? srcProj.sites[0] : null;
            const firstDestSite = destProj?.sites && destProj.sites.length > 0 ? destProj.sites[0] : null;

            setFormData((prev) => ({
              ...prev,
              sourceProjectId: srcProj.id,
              sourceSiteId: firstSrcSite ? firstSrcSite.id : '',
              sourceLocation: srcProj.location || '',
              senderSupervisor: firstSrcSite?.supervisorName || '',
              destinationProjectId: destProj ? destProj.id : '',
              destinationSiteId: firstDestSite ? firstDestSite.id : '',
              destinationLocation: destProj?.location || '',
              receiverSupervisor: firstDestSite?.supervisorName || '',
            }));
          }
        }

        if (matRes.ok) {
          const m = await matRes.json();
          const mats = m.materials || [];
          setMaterials(mats);
          if (mats.length > 0 && !formData.materialId) {
            setFormData((prev) => ({ ...prev, materialId: mats[0].id }));
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

  const handleSourceProjectChange = (projId: string) => {
    const p = projects.find((x) => x.id === projId);
    const firstSite = p?.sites && p.sites.length > 0 ? p.sites[0] : null;
    setFormData((prev) => ({
      ...prev,
      sourceProjectId: projId,
      sourceSiteId: firstSite ? firstSite.id : '',
      sourceLocation: p?.location || '',
      senderSupervisor: firstSite?.supervisorName || prev.senderSupervisor || '',
    }));
  };

  const handleDestProjectChange = (projId: string) => {
    const p = projects.find((x) => x.id === projId);
    const firstSite = p?.sites && p.sites.length > 0 ? p.sites[0] : null;
    setFormData((prev) => ({
      ...prev,
      destinationProjectId: projId,
      destinationSiteId: firstSite ? firstSite.id : '',
      destinationLocation: p?.location || '',
      receiverSupervisor: firstSite?.supervisorName || prev.receiverSupervisor || '',
    }));
  };

  const isStockInsufficient =
    sourceStock !== null && Number(formData.quantity) > sourceStock;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.sourceProjectId) {
      setError('Please select source project (From)');
      return;
    }
    if (!formData.destinationProjectId) {
      setError('Please select destination project (To)');
      return;
    }
    if (formData.sourceProjectId === formData.destinationProjectId) {
      setError('Source and destination sites must be different');
      return;
    }
    if (!formData.receiverSupervisor.trim()) {
      setError('Receiver Supervisor Name is required (Destination site par mal kis supervisor ko receive hoga)');
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
          sourceStock || 0
        )} ${selectedMaterial?.unit || 'units'} available at ${sourceProject?.name}.`
      );
      return;
    }

    setIsLoading(true);

    try {
      const structuredNotes = [
        `From: ${sourceProject?.name || ''} (${formData.sourceLocation || 'Main Site'})`,
        formData.senderSupervisor ? `Sender: ${formData.senderSupervisor}` : null,
        `To: ${destProject?.name || ''} (${formData.destinationLocation || 'Main Site'})`,
        `Receiver Supervisor: ${formData.receiverSupervisor.trim()}`,
        formData.receiverMobile ? `Receiver Mobile: ${formData.receiverMobile.trim()}` : null,
        formData.vehicleDetails ? `Vehicle: ${formData.vehicleDetails.trim()}` : null,
        formData.notes ? `Remarks: ${formData.notes.trim()}` : null,
      ]
        .filter(Boolean)
        .join(' | ');

      const res = await fetch('/api/materials/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceProjectId: formData.sourceProjectId,
          sourceSiteId: formData.sourceSiteId || null,
          destinationProjectId: formData.destinationProjectId,
          destinationSiteId: formData.destinationSiteId || null,
          materialId: formData.materialId,
          date: formData.date,
          quantity: Number(formData.quantity),
          notes: structuredNotes,
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
      title="Inter-Site Material Transfer (साइट से साइट पर माल ट्रांसफर)"
      description="Transfer materials between construction sites with live inventory adjustments and zero duplicate purchase expense."
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-start gap-2.5 text-xs text-indigo-300">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-indigo-400" />
          <span>
            <strong>Construction Accounting Rule:</strong> Source site stock deduct hoga aur Destination site stock me add ho jayega. <strong>No purchase expense is generated</strong>, keeping financial accounts clean.
          </span>
        </div>

        {/* 1. SOURCE PROJECT (FROM) */}
        <div className="p-3 bg-rose-950/20 border border-rose-500/30 rounded-xl space-y-3">
          <div className="flex items-center gap-2 border-b border-rose-500/20 pb-1.5">
            <Building2 className="w-4 h-4 text-rose-400" />
            <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
              1. Source Site (कहाँ से माल भेजा जा रहा है - FROM)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Source Project (From) *
              </label>
              <select
                value={formData.sourceProjectId}
                onChange={(e) => handleSourceProjectChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-slate-100 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-rose-500"
                required
              >
                <option value="">-- Select Source Site --</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.projectCode})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Source Sub-Site / Location
              </label>
              {sourceProject?.sites && sourceProject.sites.length > 0 ? (
                <select
                  value={formData.sourceSiteId}
                  onChange={(e) => {
                    const site = sourceProject.sites.find((s: any) => s.id === e.target.value);
                    setFormData((prev) => ({
                      ...prev,
                      sourceSiteId: e.target.value,
                      sourceLocation: site?.name || prev.sourceLocation,
                      senderSupervisor: site?.supervisorName || prev.senderSupervisor,
                    }));
                  }}
                  className="w-full bg-slate-950 border border-slate-700 text-slate-100 rounded-lg px-2.5 py-1.5 text-xs"
                >
                  <option value="">-- Main Yard / Site --</option>
                  {sourceProject.sites.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.supervisorName ? `(${s.supervisorName})` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  value={formData.sourceLocation}
                  onChange={(e) => setFormData({ ...formData, sourceLocation: e.target.value })}
                  placeholder="e.g. Yard 1, Tower A"
                  className="h-8 text-xs bg-slate-950"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Sender Supervisor Name
              </label>
              <Input
                value={formData.senderSupervisor}
                onChange={(e) => setFormData({ ...formData, senderSupervisor: e.target.value })}
                placeholder="e.g. Mukesh (Site Staff)"
                className="h-8 text-xs bg-slate-950"
              />
            </div>
          </div>
        </div>

        {/* 2. DESTINATION PROJECT (TO) */}
        <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-xl space-y-3">
          <div className="flex items-center gap-2 border-b border-emerald-500/20 pb-1.5">
            <Building2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
              2. Destination Site &amp; Receiver (कहाँ माल जाएगा - TO)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                Destination Project (To) *
              </label>
              <select
                value={formData.destinationProjectId}
                onChange={(e) => handleDestProjectChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-slate-100 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500"
                required
              >
                <option value="">-- Select Destination Site --</option>
                {projects.map((p) => (
                  <option
                    key={p.id}
                    value={p.id}
                    disabled={p.id === formData.sourceProjectId}
                  >
                    {p.name} ({p.projectCode}) {p.id === formData.sourceProjectId ? '(Selected as Source)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                Unloading Location / Sub-Site *
              </label>
              {destProject?.sites && destProject.sites.length > 0 ? (
                <div className="space-y-1">
                  <select
                    value={formData.destinationSiteId}
                    onChange={(e) => {
                      const site = destProject.sites.find((s: any) => s.id === e.target.value);
                      setFormData((prev) => ({
                        ...prev,
                        destinationSiteId: e.target.value,
                        destinationLocation: site?.name || prev.destinationLocation,
                        receiverSupervisor: site?.supervisorName || prev.receiverSupervisor,
                      }));
                    }}
                    className="w-full bg-slate-950 border border-slate-700 text-slate-100 rounded-lg px-2.5 py-1.5 text-xs"
                  >
                    <option value="">-- Main Site / Default Yard --</option>
                    {destProject.sites.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.supervisorName ? `(Supervisor: ${s.supervisorName})` : ''}
                      </option>
                    ))}
                  </select>
                  <Input
                    value={formData.destinationLocation}
                    onChange={(e) => setFormData({ ...formData, destinationLocation: e.target.value })}
                    placeholder="Specific unloading point (e.g. Block C Ground)"
                    className="h-8 text-xs bg-slate-950"
                  />
                </div>
              ) : (
                <Input
                  value={formData.destinationLocation}
                  onChange={(e) => setFormData({ ...formData, destinationLocation: e.target.value })}
                  placeholder="e.g. Tower B, Plot 14, Main Store"
                  className="h-8 text-xs bg-slate-950"
                  required
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-400" />
                Receiver Supervisor Name *
              </label>
              <Input
                value={formData.receiverSupervisor}
                onChange={(e) => setFormData({ ...formData, receiverSupervisor: e.target.value })}
                placeholder="e.g. Suresh Bhai (Destination In-charge)"
                className="h-8 text-xs bg-slate-950"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-teal-400" />
                Receiver Supervisor Mobile (Optional)
              </label>
              <Input
                value={formData.receiverMobile}
                onChange={(e) => setFormData({ ...formData, receiverMobile: e.target.value })}
                placeholder="e.g. 9876543210"
                className="h-8 text-xs bg-slate-950"
              />
            </div>
          </div>
        </div>

        {/* 3. MATERIAL & QUANTITY */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Material to Transfer *
            </label>
            <select
              value={formData.materialId}
              onChange={(e) => setFormData({ ...formData, materialId: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-sky-400" />
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

        {/* Source Project Available Stock Badge */}
        {selectedMaterial && (
          <div
            className={`p-3 rounded-lg border flex items-center justify-between text-sm ${
              sourceStock === null || checkingStock
                ? 'bg-slate-900/50 border-slate-800 text-slate-400'
                : sourceStock <= 0
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs">
                Available at <strong>{sourceProject?.name || 'Source Project'}</strong>:
              </span>
            </div>
            <span className="font-bold text-sm font-mono">
              {checkingStock ? 'Checking...' : `${sourceStock !== null ? sourceStock : '0'} ${selectedMaterial.unit}`}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                ⚠️ Exceeds available stock of {sourceStock} {selectedMaterial?.unit} at source site
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-slate-400" />
              Vehicle / Transport / Challan Details
            </label>
            <Input
              value={formData.vehicleDetails}
              onChange={(e) => setFormData({ ...formData, vehicleDetails: e.target.value })}
              placeholder="e.g. Tractor GJ01-9988, Driver Ramesh, Challan #52"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            Transfer Notes / Authorization Remarks
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Transfer reason (e.g. Shortage at Block C, excess brick transfer)..."
            rows={2}
            className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isLoading || isStockInsufficient}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowRightLeft className="w-4 h-4 mr-1.5" />
            {isLoading ? 'Processing Transfer...' : 'Confirm & Shift Material'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
