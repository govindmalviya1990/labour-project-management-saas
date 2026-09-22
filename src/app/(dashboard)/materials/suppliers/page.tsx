'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Building2, Plus, ArrowLeft, Search, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SupplierFormModal } from '@/components/materials/SupplierFormModal';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSuppliers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/materials/suppliers?search=${encodeURIComponent(search)}`);
      if (res.ok) {
        const data = await res.json();
        setSuppliers(data.suppliers || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [search]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete supplier '${name}'?`)) return;
    try {
      const res = await fetch(`/api/materials/suppliers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchSuppliers();
      }
    } catch (e) {
      console.error(e);
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
            <Building2 className="w-7 h-7 text-purple-400" />
            Material Suppliers & Vendors Directory
          </h1>
          <p className="text-sm text-slate-400">
            Maintain vendor company profiles, contact numbers, GSTIN, and linked catalog materials
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => {
              setEditingSupplier(null);
              setIsModalOpen(true);
            }}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Register Supplier
          </Button>
        </div>
      </div>

      {/* Filter and stats banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search vendor name, contact person, mobile..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg pl-9 pr-3 py-2 focus:ring-1 focus:ring-amber-500"
          />
        </div>

        <div className="text-xs text-slate-400 font-medium">
          Total Registered Vendors:{' '}
          <span className="text-purple-400 font-bold font-mono text-sm">
            {suppliers.length} vendors
          </span>
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Supplier / Company</th>
                <th className="py-3 px-3">Contact Person</th>
                <th className="py-3 px-3">Mobile & Email</th>
                <th className="py-3 px-3">GSTIN</th>
                <th className="py-3 px-3">Office / Yard Address</th>
                <th className="py-3 px-3 text-center">Catalog Items</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-500">
                    Loading suppliers...
                  </td>
                </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    No suppliers found. Click "Register Supplier" to add vendor contact cards.
                  </td>
                </tr>
              ) : (
                suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-100">{s.name}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-300">
                      {s.contactPerson || '—'}
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-slate-200 font-mono">{s.mobile || '—'}</div>
                      <div className="text-[11px] text-slate-500">{s.email || ''}</div>
                    </td>
                    <td className="py-3 px-3 font-mono text-amber-400">
                      {s.gstNumber || '—'}
                    </td>
                    <td className="py-3 px-3 text-slate-400">
                      {s.address || '—'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">
                        {s._count?.materials || 0}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          title="Edit Supplier"
                          onClick={() => {
                            setEditingSupplier(s);
                            setIsModalOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          title="Delete Supplier"
                          onClick={() => handleDelete(s.id, s.name)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SupplierFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchSuppliers}
        initialData={editingSupplier}
      />
    </div>
  );
}
