'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRightLeft, Plus, ArrowLeft, Search, Info, Trash2, MapPin, User } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TransferFormModal } from '@/components/materials/TransferFormModal';

function parseDispatchNotes(notes?: string | null) {
  if (!notes) return { supervisor: null, location: null, vehicle: null, remarks: null };
  const supMatch = notes.match(/Receiver Supervisor:\s*([^|]+)/i) || notes.match(/TO_SUPERVISOR:\s*([^|]+)/i) || notes.match(/RECEIVER_SUPERVISOR:\s*([^|]+)/i);
  const locMatch = notes.match(/Location\/Site:\s*([^|]+)/i) || notes.match(/DESTLOC:\s*([^|]+)/i) || notes.match(/LOCATION:\s*([^|]+)/i);
  const vehMatch = notes.match(/Vehicle\/Challan:\s*([^|]+)/i) || notes.match(/Vehicle:\s*([^|]+)/i) || notes.match(/VEHICLE:\s*([^|]+)/i);
  const remMatch = notes.match(/Remarks:\s*([^|]+)/i);
  const cleanRem = remMatch
    ? remMatch[1].trim()
    : notes
        .replace(/\[[^\]]+\]/g, '')
        .replace(/Receiver Supervisor:[^|]+/i, '')
        .replace(/Location\/Site:[^|]+/i, '')
        .replace(/Mobile:[^|]+/i, '')
        .replace(/Vehicle\/Challan:[^|]+/i, '')
        .replace(/Vehicle:[^|]+/i, '')
        .replace(/Remarks:/i, '')
        .replace(/\|/g, '')
        .trim();

  return {
    supervisor: supMatch ? supMatch[1].trim() : null,
    location: locMatch ? locMatch[1].trim() : null,
    vehicle: vehMatch ? vehMatch[1].trim() : null,
    remarks: cleanRem || null,
  };
}

export default function MaterialTransfersPage() {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('ALL');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTransfers = async () => {
    setIsLoading(true);
    try {
      const [projRes, trRes] = await Promise.all([
        fetch('/api/projects'),
        fetch(`/api/materials/transfers${selectedProjectId !== 'ALL' ? `?projectId=${selectedProjectId}` : ''}`),
      ]);

      if (projRes.ok) {
        const p = await projRes.json();
        setProjects(p.projects || []);
      }
      if (trRes.ok) {
        const t = await trRes.json();
        setTransfers(t.transfers || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string, matName: string) => {
    if (!confirm(`Are you sure you want to delete the transfer record for '${matName || 'material'}'?`)) return;
    try {
      const res = await fetch(`/api/materials/transfers/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to delete transfer record');
        return;
      }
      fetchTransfers();
    } catch (e: any) {
      alert(e.message || 'Error deleting transfer record');
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, [selectedProjectId]);

  const filteredTransfers = transfers.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      t.material?.name?.toLowerCase().includes(q) ||
      t.sourceProject?.name?.toLowerCase().includes(q) ||
      t.destinationProject?.name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/materials" className="text-xs text-slate-400 hover:text-amber-400 flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Materials Hub
            </Link>
          </div>
          <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2.5">
            <ArrowRightLeft className="w-7 h-7 text-indigo-400" />
            Internal Transfer (Site-to-Site Transfer)
          </h1>
          <p className="text-sm text-slate-400">
            Shift material stocks between project sites without creating duplicate purchase expenses
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => setIsModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Internal Transfer
          </Button>
        </div>
      </div>

      <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-3 text-xs text-blue-300">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
        <div>
          <strong className="text-blue-200">Construction Accounting Rule (Section 67):</strong> When 100 bags of cement are transferred from Project 1 to Project 2, Project 1 stock decreases by 100 bags and Project 2 stock increases by 100 bags. <strong>No purchase expense is generated</strong>, keeping project financial ledgers completely accurate.
        </div>
      </div>

      {/* Filter and stats banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="w-full sm:w-56">
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:ring-1 focus:ring-amber-500"
            >
              <option value="ALL">🏢 All Construction Sites</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.projectCode})</option>
              ))}
            </select>
          </div>

          <div className="relative w-full sm:w-60">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search material or site..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg pl-9 pr-3 py-2 focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>

        <div className="text-xs text-slate-400 font-medium">
          Total Transfers:{' '}
          <span className="text-indigo-400 font-bold font-mono text-sm">
            {filteredTransfers.length} transfers
          </span>
        </div>
      </div>

      {/* Transfers Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-3">Material</th>
                <th className="py-3 px-3">Source Site (From)</th>
                <th className="py-3 px-3">Destination Site &amp; Receiver (To)</th>
                <th className="py-3 px-3 text-right font-bold text-slate-200">Quantity Transferred</th>
                <th className="py-3 px-4">Vehicle &amp; Notes</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-500">
                    Loading transfers...
                  </td>
                </tr>
              ) : filteredTransfers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    No inter-site material transfers logged yet.
                  </td>
                </tr>
              ) : (
                filteredTransfers.map((t) => {
                  const parsed = parseDispatchNotes(t.notes);
                  return (
                    <tr key={t.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 text-slate-300 font-medium">
                        {new Date(t.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-100">{t.material?.name}</div>
                        <span className="text-[11px] text-slate-500 font-mono">{t.material?.materialCode}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/30 text-[11px] font-medium block w-fit">
                          {t.sourceProject?.name}
                        </span>
                        {t.sourceSite?.name && (
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-2.5 h-2.5 text-rose-400 shrink-0" />
                            {t.sourceSite.name}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[11px] font-medium block w-fit">
                          {t.destinationProject?.name}
                        </span>
                        {(t.destSite?.name || parsed.location) && (
                          <div className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5 font-medium">
                            <MapPin className="w-2.5 h-2.5 shrink-0" />
                            {t.destSite?.name || parsed.location}
                          </div>
                        )}
                        {parsed.supervisor && (
                          <div className="text-[10px] text-slate-300 flex items-center gap-1 mt-0.5">
                            <User className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                            {parsed.supervisor}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-indigo-400 text-sm">
                        {t.quantity} {t.material?.unit}
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        <div className="text-xs">
                          {parsed.vehicle && (
                            <span className="inline-block bg-slate-800 text-indigo-300 px-1.5 py-0.5 rounded text-[10px] font-mono mr-1 mb-1">
                              🚚 {parsed.vehicle}
                            </span>
                          )}
                          <div className="text-[11px] text-slate-400">{parsed.remarks || 'Inter-site stock movement'}</div>
                        </div>
                      </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-slate-400 hover:text-rose-400"
                        onClick={() => handleDelete(t.id, t.material?.name)}
                        title="Delete Transfer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <TransferFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchTransfers}
        defaultSourceProjectId={selectedProjectId !== 'ALL' ? selectedProjectId : undefined}
      />
    </div>
  );
}
