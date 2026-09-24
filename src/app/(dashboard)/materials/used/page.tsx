'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Hammer, Plus, ArrowLeft, Search, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { UsageFormModal } from '@/components/materials/UsageFormModal';

export default function MaterialUsedPage() {
  const [usages, setUsages] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('ALL');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUsage, setEditingUsage] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUsages = async () => {
    setIsLoading(true);
    try {
      const [projRes, useRes] = await Promise.all([
        fetch('/api/projects'),
        fetch(`/api/materials/usage${selectedProjectId !== 'ALL' ? `?projectId=${selectedProjectId}` : ''}`),
      ]);

      if (projRes.ok) {
        const p = await projRes.json();
        setProjects(p.projects || []);
      }
      if (useRes.ok) {
        const u = await useRes.json();
        setUsages(u.usages || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (usage: any) => {
    setEditingUsage(usage);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, matName: string) => {
    if (!confirm(`Are you sure you want to delete material usage entry for '${matName || 'material'}'?`)) return;
    try {
      const res = await fetch(`/api/materials/usage/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to delete usage record');
        return;
      }
      fetchUsages();
    } catch (e: any) {
      alert(e.message || 'Error deleting usage record');
    }
  };

  useEffect(() => {
    fetchUsages();
  }, [selectedProjectId]);

  const filteredUsages = usages.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      u.material?.name?.toLowerCase().includes(q) ||
      u.project?.name?.toLowerCase().includes(q) ||
      u.taskPurpose?.toLowerCase().includes(q)
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
            <Hammer className="w-7 h-7 text-sky-400" />
            Material Consumption / Daily Usage Log
          </h1>
          <p className="text-sm text-slate-400">
            Monitor daily material consumption on site. Enforces real-time negative stock prevention.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => {
              setEditingUsage(null);
              setIsModalOpen(true);
            }}
            className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Log Daily Usage
          </Button>
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
              placeholder="Search material, purpose..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg pl-9 pr-3 py-2 focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>

        <div className="text-xs text-slate-400 font-medium">
          Total Usage Records:{' '}
          <span className="text-sky-400 font-bold font-mono text-sm">
            {filteredUsages.length} entries
          </span>
        </div>
      </div>

      {/* Usages Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-3">Project Site</th>
                <th className="py-3 px-3">Material</th>
                <th className="py-3 px-3 text-right font-bold text-slate-200">Quantity Used</th>
                <th className="py-3 px-4">Work Purpose / Task</th>
                <th className="py-3 px-4">Supervisor Remarks</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-500">
                    Loading consumption logs...
                  </td>
                </tr>
              ) : filteredUsages.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    No material usage recorded yet.
                  </td>
                </tr>
              ) : (
                filteredUsages.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 text-slate-300 font-medium">
                      {new Date(u.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-100">{u.project?.name}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-200">{u.material?.name}</div>
                      <span className="text-[11px] text-slate-500 font-mono">{u.material?.materialCode}</span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-rose-400 text-sm">
                      -{u.quantity} {u.material?.unit}
                    </td>
                    <td className="py-3 px-4 text-slate-100 font-medium">
                      {u.taskPurpose}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {u.notes || '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-slate-400 hover:text-white"
                          onClick={() => handleEdit(u)}
                          title="Edit Usage"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-slate-400 hover:text-rose-400"
                          onClick={() => handleDelete(u.id, u.material?.name)}
                          title="Delete Usage"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <UsageFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingUsage(null);
        }}
        onSuccess={fetchUsages}
        defaultProjectId={selectedProjectId !== 'ALL' ? selectedProjectId : undefined}
        initialData={editingUsage}
      />
    </div>
  );
}
