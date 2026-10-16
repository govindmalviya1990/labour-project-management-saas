'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import {
  Send,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Truck,
  Building2,
  MapPin,
  User,
  Phone,
  Calendar,
  FileText,
} from 'lucide-react';

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
    siteId: initialData?.siteId || '',
    locationDetail: '',
    receiverSupervisor: '',
    receiverMobile: '',
    materialId: initialData?.materialId || defaultMaterialId || '',
    date: initialData?.date ? new Date(initialData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    quantity: initialData?.quantity !== undefined ? initialData.quantity : 0,
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

        let loadedProjects: any[] = [];
        if (projRes.ok) {
          const p = await projRes.json();
          loadedProjects = p.projects || [];
          setProjects(loadedProjects);
        }

        if (matRes.ok) {
          const m = await matRes.json();
          const mats = m.materials || [];
          setMaterials(mats);
          if (!formData.materialId && mats.length > 0) {
            setFormData((prev) => ({ ...prev, materialId: defaultMaterialId || mats[0].id }));
          }
        }

        if (initialData) {
          const rawNotes = initialData.notes || '';
          const supMatch =
            rawNotes.match(/Receiver Supervisor:\s*([^|]+)/i) ||
            rawNotes.match(/RECEIVER_SUPERVISOR:\s*([^|]+)/i) ||
            rawNotes.match(/DISPATCH_TO_SUPERVISOR:\s*([^|]+)/i) ||
            rawNotes.match(/VERIFIED_BY:\s*([^|]+)/i);
          const locMatch =
            rawNotes.match(/Location\/Site:\s*([^|]+)/i) ||
            rawNotes.match(/LOCATION:\s*([^|]+)/i);
          const mobMatch =
            rawNotes.match(/Mobile:\s*([^|]+)/i) ||
            rawNotes.match(/MOBILE:\s*([^|]+)/i);
          const vehMatch =
            rawNotes.match(/Vehicle\/Challan:\s*([^|]+)/i) ||
            rawNotes.match(/VEHICLE:\s*([^|]+)/i);

          setFormData({
            projectId: initialData.projectId || '',
            siteId: initialData.siteId || '',
            locationDetail: locMatch ? locMatch[1].trim() : (initialData.site?.name || ''),
            receiverSupervisor: supMatch ? supMatch[1].trim() : '',
            receiverMobile: mobMatch ? mobMatch[1].trim() : '',
            materialId: initialData.materialId || '',
            date: initialData.date ? new Date(initialData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            quantity: initialData.quantity !== undefined ? initialData.quantity : 0,
            vehicleDetails: vehMatch
              ? vehMatch[1].trim()
              : initialData.taskPurpose !== 'PENDING' && initialData.taskPurpose !== 'APPROVED'
              ? initialData.taskPurpose
              : '',
            notes: rawNotes.replace(/\[[^\]]+\]/g, '').replace(/Receiver Supervisor:[^|]+/i, '').replace(/Location\/Site:[^|]+/i, '').replace(/Mobile:[^|]+/i, '').replace(/Vehicle\/Challan:[^|]+/i, '').replace(/Remarks:/i, '').replace(/\|/g, '').trim(),
          });
        } else if (loadedProjects.length > 0 && !formData.projectId) {
          const targetProj = loadedProjects.find((x) => x.id === defaultProjectId) || loadedProjects[0];
          const firstSite = targetProj?.sites && targetProj.sites.length > 0 ? targetProj.sites[0] : null;
          setFormData((prev) => ({
            ...prev,
            projectId: targetProj.id,
            siteId: firstSite ? firstSite.id : '',
            locationDetail: targetProj.location || '',
            receiverSupervisor: firstSite?.supervisorName || '',
          }));
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

  const handleProjectChange = (projId: string) => {
    const p = projects.find((x) => x.id === projId);
    const firstSite = p?.sites && p.sites.length > 0 ? p.sites[0] : null;
    setFormData((prev) => ({
      ...prev,
      projectId: projId,
      siteId: firstSite ? firstSite.id : '',
      locationDetail: p?.location || '',
      receiverSupervisor: firstSite?.supervisorName || prev.receiverSupervisor || '',
    }));
  };

  const handleSiteChange = (sId: string) => {
    const site = selectedProject?.sites?.find((s: any) => s.id === sId);
    setFormData((prev) => ({
      ...prev,
      siteId: sId,
      receiverSupervisor: site?.supervisorName || prev.receiverSupervisor,
      locationDetail: site?.name || prev.locationDetail,
    }));
  };

  const isStockInsufficient =
    availableStock !== null && Number(formData.quantity) > availableStock;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.projectId) {
      setError('Please select destination construction site / project');
      return;
    }
    if (!formData.receiverSupervisor.trim()) {
      setError('Receiver Supervisor Name is required (माल किस सुपरवाइजर को सौंपा जा रहा है उनका नाम दर्ज करें)');
      return;
    }
    if (!formData.materialId) {
      setError('Please select a material to dispatch');
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

      const structuredNotes = [
        `Receiver Supervisor: ${formData.receiverSupervisor.trim()}`,
        formData.receiverMobile ? `Mobile: ${formData.receiverMobile.trim()}` : null,
        formData.locationDetail ? `Location/Site: ${formData.locationDetail.trim()}` : null,
        formData.vehicleDetails ? `Vehicle/Challan: ${formData.vehicleDetails.trim()}` : null,
        formData.notes ? `Remarks: ${formData.notes.trim()}` : null,
      ]
        .filter(Boolean)
        .join(' | ');

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: formData.projectId,
          siteId: formData.siteId || null,
          materialId: formData.materialId,
          date: formData.date,
          quantity: Number(formData.quantity),
          taskPurpose: formData.vehicleDetails ? formData.vehicleDetails.trim() : 'PENDING',
          notes: structuredNotes,
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
      title={initialData ? 'Edit Material Dispatch Record' : 'Send Material to Site (कंपनी से साइट पर माल भेजें)'}
      description="Dispatch material from company godown to construction project site. Dispatched stock is deducted from total company inventory."
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. DESTINATION SITE & SUPERVISOR LOCATION */}
        <div className="p-3.5 bg-slate-900/90 border border-sky-500/30 rounded-xl space-y-3 shadow-inner">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">
                1. Destination Construction Site &amp; Receiver Details
              </span>
            </div>
            <span className="text-[11px] text-slate-500">माल किस साइट और किस सुपरवाइजर को जा रहा है</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-sky-400" />
                Destination Site / Project *
              </label>
              <select
                value={formData.projectId}
                onChange={(e) => handleProjectChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                required
              >
                <option value="">-- Select Destination Site --</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.projectCode}) {p.location ? `— ${p.location}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                Sub-Site / Wing / Floor Location *
              </label>
              {selectedProject?.sites && selectedProject.sites.length > 0 ? (
                <div className="space-y-1.5">
                  <select
                    value={formData.siteId}
                    onChange={(e) => handleSiteChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-slate-100 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="">-- Main Site / Default Yard --</option>
                    {selectedProject.sites.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.supervisorName ? `(Supervisor: ${s.supervisorName})` : ''}
                      </option>
                    ))}
                  </select>
                  <Input
                    value={formData.locationDetail}
                    onChange={(e) => setFormData({ ...formData, locationDetail: e.target.value })}
                    placeholder="Exact location (e.g. Tower A, 3rd Floor, Stock Yard)"
                    className="h-8 text-xs bg-slate-950"
                  />
                </div>
              ) : (
                <Input
                  value={formData.locationDetail}
                  onChange={(e) => setFormData({ ...formData, locationDetail: e.target.value })}
                  placeholder="e.g. Tower B, Plot 42, Main Gate Godown"
                  className="h-9 text-sm bg-slate-950"
                  required
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-400" />
                Receiver Site Supervisor Name *
              </label>
              <Input
                value={formData.receiverSupervisor}
                onChange={(e) => setFormData({ ...formData, receiverSupervisor: e.target.value })}
                placeholder="e.g. Ramesh Patel (Site In-charge)"
                className="h-9 text-sm bg-slate-950"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-teal-400" />
                Receiver Supervisor Mobile (Optional)
              </label>
              <Input
                value={formData.receiverMobile}
                onChange={(e) => setFormData({ ...formData, receiverMobile: e.target.value })}
                placeholder="e.g. 9876543210"
                className="h-9 text-sm bg-slate-950"
              />
            </div>
          </div>
        </div>

        {/* 2. MATERIAL TO SEND & QUANTITY */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-amber-400" />
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
                  {m.name} ({m.materialCode}) — [Godown: {m.remainingStock} {m.unit}]
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-sky-400" />
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

        {/* Live Company Godown Stock Status Badge */}
        {selectedMaterial && (
          <div
            className={`p-3 rounded-lg border flex items-center justify-between text-sm ${
              availableStock === null
                ? 'bg-slate-900/50 border-slate-800 text-slate-400'
                : availableStock <= 0
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                : availableStock < 20
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            }`}
          >
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
              value={formData.vehicleDetails}
              onChange={(e) => setFormData({ ...formData, vehicleDetails: e.target.value })}
              placeholder="e.g. Truck RJ14-1234, Challan #402, Driver Ramesh"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            Dispatch Instructions / Notes for Site Supervisor
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Special storage instructions, gate entry details, remarks..."
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
