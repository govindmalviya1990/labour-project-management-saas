'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Truck, Plus, ArrowLeft, Download, Search, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ReceiptFormModal } from '@/components/materials/ReceiptFormModal';

export default function MaterialReceivedPage() {
  const [receipts, setReceipts] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('ALL');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchReceipts = async () => {
    setIsLoading(true);
    try {
      const [projRes, recRes] = await Promise.all([
        fetch('/api/projects'),
        fetch(`/api/materials/receipts${selectedProjectId !== 'ALL' ? `?projectId=${selectedProjectId}` : ''}`),
      ]);

      if (projRes.ok) {
        const p = await projRes.json();
        setProjects(p.projects || []);
      }
      if (recRes.ok) {
        const r = await recRes.json();
        setReceipts(r.receipts || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, [selectedProjectId]);

  const filteredReceipts = receipts.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.material?.name?.toLowerCase().includes(q) ||
      r.supplier?.name?.toLowerCase().includes(q) ||
      r.project?.name?.toLowerCase().includes(q) ||
      r.invoiceNumber?.toLowerCase().includes(q)
    );
  });

  const totalAmount = filteredReceipts.reduce((sum, r) => sum + r.totalCost, 0);

  const handleEdit = (receipt: any) => {
    setEditingReceipt(receipt);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, matName: string) => {
    if (!confirm(`Are you sure you want to delete receipt entry for '${matName || 'material'}'?`)) return;
    try {
      const res = await fetch(`/api/materials/receipts/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to delete receipt');
        return;
      }
      fetchReceipts();
    } catch (e: any) {
      alert(e.message || 'Error deleting receipt');
    }
  };

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
            <Truck className="w-7 h-7 text-emerald-400" />
            Material Received / GRN Log
          </h1>
          <p className="text-sm text-slate-400">
            Track all incoming deliveries, vendor invoices, delivery challans, and inward quantities
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => {
              setEditingReceipt(null);
              setIsModalOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Receive Stock (GRN)
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
              placeholder="Search material, vendor, invoice..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg pl-9 pr-3 py-2 focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>

        <div className="text-xs text-slate-400 font-medium">
          Total Deliveries Value:{' '}
          <span className="text-emerald-400 font-bold font-mono text-sm">
            ₹{totalAmount.toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      {/* Receipts Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-3">Project Site</th>
                <th className="py-3 px-3">Material</th>
                <th className="py-3 px-3">Supplier / Vendor</th>
                <th className="py-3 px-3 text-right">Quantity</th>
                <th className="py-3 px-3 text-right">Rate</th>
                <th className="py-3 px-3 text-right font-bold text-slate-200">Total Amount</th>
                <th className="py-3 px-4">Challan / Inv</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-slate-500">
                    Loading receipts...
                  </td>
                </tr>
              ) : filteredReceipts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-slate-400">
                    No material inward receipts recorded.
                  </td>
                </tr>
              ) : (
                filteredReceipts.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 text-slate-300 font-medium">
                      {new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-100">{r.project?.name}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-200">{r.material?.name}</div>
                      <span className="text-[11px] text-slate-500 font-mono">{r.material?.materialCode}</span>
                    </td>
                    <td className="py-3 px-3 text-slate-300">
                      {r.supplier?.name || 'Direct Purchase'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                      +{r.quantity} {r.material?.unit}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-300">
                      ₹{r.purchaseRate}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-amber-400">
                      ₹{r.totalCost.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                      {r.invoiceNumber || '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-slate-400 hover:text-white"
                          onClick={() => handleEdit(r)}
                          title="Edit Receipt"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-slate-400 hover:text-rose-400"
                          onClick={() => handleDelete(r.id, r.material?.name)}
                          title="Delete Receipt"
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

      <ReceiptFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingReceipt(null);
        }}
        onSuccess={fetchReceipts}
        defaultProjectId={selectedProjectId !== 'ALL' ? selectedProjectId : undefined}
        initialData={editingReceipt}
      />
    </div>
  );
}
