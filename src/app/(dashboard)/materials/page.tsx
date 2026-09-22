'use client';

import React, { useState, useEffect, useTransition } from 'react';
import {
  Package,
  Plus,
  Truck,
  Hammer,
  ArrowRightLeft,
  Building2,
  AlertTriangle,
  Search,
  Filter,
  Download,
  IndianRupee,
  Layers,
  CheckCircle2,
  Trash2,
  Edit2,
  FileSpreadsheet
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { MaterialFormModal } from '@/components/materials/MaterialFormModal';
import { ReceiptFormModal } from '@/components/materials/ReceiptFormModal';
import { UsageFormModal } from '@/components/materials/UsageFormModal';
import { TransferFormModal } from '@/components/materials/TransferFormModal';
import { SupplierFormModal } from '@/components/materials/SupplierFormModal';

export default function MaterialsPage() {
  const [activeTab, setActiveTab] = useState<'catalog' | 'receipts' | 'usages' | 'transfers' | 'suppliers'>('catalog');
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [lowStockFilter, setLowStockFilter] = useState(false);

  // Data states
  const [materials, setMaterials] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({ totalMaterials: 0, totalStockValue: 0, lowStockCount: 0 });
  const [receipts, setReceipts] = useState<any[]>([]);
  const [usages, setUsages] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [materialModalOpen, setMaterialModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<any>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [usageModalOpen, setUsageModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Projects
      const projRes = await fetch('/api/projects');
      if (projRes.ok) {
        const p = await projRes.json();
        setProjects(p.projects || []);
      }

      // 2. Materials
      let matUrl = `/api/materials?category=${selectedCategory}&search=${encodeURIComponent(searchQuery)}`;
      if (selectedProjectId !== 'ALL') matUrl += `&projectId=${selectedProjectId}`;
      if (lowStockFilter) matUrl += `&lowStock=true`;

      const matRes = await fetch(matUrl);
      if (matRes.ok) {
        const m = await matRes.json();
        setMaterials(m.materials || []);
        setSummary(m.summary || { totalMaterials: 0, totalStockValue: 0, lowStockCount: 0 });
      }

      // 3. Receipts
      let recUrl = `/api/materials/receipts?`;
      if (selectedProjectId !== 'ALL') recUrl += `projectId=${selectedProjectId}`;
      const recRes = await fetch(recUrl);
      if (recRes.ok) {
        const r = await recRes.json();
        setReceipts(r.receipts || []);
      }

      // 4. Usages
      let useUrl = `/api/materials/usage?`;
      if (selectedProjectId !== 'ALL') useUrl += `projectId=${selectedProjectId}`;
      const useRes = await fetch(useUrl);
      if (useRes.ok) {
        const u = await useRes.json();
        setUsages(u.usages || []);
      }

      // 5. Transfers
      let trUrl = `/api/materials/transfers?`;
      if (selectedProjectId !== 'ALL') trUrl += `projectId=${selectedProjectId}`;
      const trRes = await fetch(trUrl);
      if (trRes.ok) {
        const t = await trRes.json();
        setTransfers(t.transfers || []);
      }

      // 6. Suppliers
      const supRes = await fetch('/api/materials/suppliers');
      if (supRes.ok) {
        const s = await supRes.json();
        setSuppliers(s.suppliers || []);
      }
    } catch (e) {
      console.error('Failed to load materials inventory:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedProjectId, selectedCategory, searchQuery, lowStockFilter]);

  const handleDeleteMaterial = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove '${name}' from inventory?`)) return;
    try {
      const res = await fetch(`/api/materials/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteSupplier = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete supplier '${name}'?`)) return;
    try {
      const res = await fetch(`/api/materials/suppliers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Export CSV
  const exportMaterialsCSV = () => {
    const headers = ['Material Code', 'Name', 'Category', 'Unit', 'Opening Stock', 'Received', 'Used', 'Available Stock', 'Min Stock Level', 'Purchase Rate (INR)', 'Stock Value (INR)', 'Status'];
    const rows = materials.map((m) => [
      `"${m.materialCode}"`,
      `"${m.name}"`,
      `"${m.category}"`,
      `"${m.unit}"`,
      m.openingStock,
      m.totalReceived,
      m.totalUsed,
      m.remainingStock,
      m.minimumStock,
      m.purchaseRate,
      m.stockValue,
      m.isLowStock ? 'LOW STOCK' : 'OPTIMAL',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `material_inventory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2.5">
            <Package className="w-7 h-7 text-amber-500" />
            Materials & Site Inventory
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time stock tracking across construction sites, inward deliveries, daily consumption & inter-project transfers
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={() => {
              setEditingMaterial(null);
              setMaterialModalOpen(true);
            }}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Material
          </Button>

          <Button
            onClick={() => setReceiptModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
          >
            <Truck className="w-4 h-4 mr-1.5" />
            Receive Stock (GRN)
          </Button>

          <Button
            onClick={() => setUsageModalOpen(true)}
            className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs"
          >
            <Hammer className="w-4 h-4 mr-1.5" />
            Log Daily Usage
          </Button>

          <Button
            onClick={() => setTransferModalOpen(true)}
            variant="outline"
            className="text-xs font-bold border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
          >
            <ArrowRightLeft className="w-4 h-4 mr-1.5" />
            Inter-Site Transfer
          </Button>

          <Button
            onClick={() => {
              setEditingSupplier(null);
              setSupplierModalOpen(true);
            }}
            variant="outline"
            className="text-xs font-medium border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            <Building2 className="w-4 h-4 mr-1.5" />
            New Supplier
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Catalog Items</span>
            <Package className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-slate-100 mt-2">{summary.totalMaterials}</div>
          <div className="text-xs text-slate-500 mt-1">Across 10 construction categories</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Stock Value</span>
            <IndianRupee className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-2">
            ₹{summary.totalStockValue.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-slate-500 mt-1">Valued at current purchase rates</div>
        </div>

        <div className={`border rounded-xl p-4 ${summary.lowStockCount > 0 ? 'bg-rose-950/20 border-rose-500/40' : 'bg-slate-900 border-slate-800'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-300 uppercase tracking-wider">Low Stock Alerts</span>
            <AlertTriangle className={`w-4 h-4 ${summary.lowStockCount > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-500'}`} />
          </div>
          <div className={`text-2xl font-black mt-2 ${summary.lowStockCount > 0 ? 'text-rose-400' : 'text-slate-100'}`}>
            {summary.lowStockCount}
          </div>
          <div className="text-xs text-slate-500 mt-1">Items at or below safety threshold</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Inward GRNs</span>
            <Truck className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-slate-100 mt-2">{receipts.length}</div>
          <div className="text-xs text-slate-500 mt-1">Recorded deliveries on sites</div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-800 space-x-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition flex items-center gap-2 ${
            activeTab === 'catalog'
              ? 'bg-slate-900 border-t-2 border-amber-500 text-amber-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          Inventory Stock Levels ({materials.length})
        </button>

        <button
          onClick={() => setActiveTab('receipts')}
          className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition flex items-center gap-2 ${
            activeTab === 'receipts'
              ? 'bg-slate-900 border-t-2 border-emerald-500 text-emerald-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Truck className="w-4 h-4" />
          Inward Receipts / GRN ({receipts.length})
        </button>

        <button
          onClick={() => setActiveTab('usages')}
          className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition flex items-center gap-2 ${
            activeTab === 'usages'
              ? 'bg-slate-900 border-t-2 border-sky-500 text-sky-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Hammer className="w-4 h-4" />
          Daily Consumption Logs ({usages.length})
        </button>

        <button
          onClick={() => setActiveTab('transfers')}
          className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition flex items-center gap-2 ${
            activeTab === 'transfers'
              ? 'bg-slate-900 border-t-2 border-indigo-500 text-indigo-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ArrowRightLeft className="w-4 h-4" />
          Inter-Project Transfers ({transfers.length})
        </button>

        <button
          onClick={() => setActiveTab('suppliers')}
          className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition flex items-center gap-2 ${
            activeTab === 'suppliers'
              ? 'bg-slate-900 border-t-2 border-purple-500 text-purple-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Suppliers Directory ({suppliers.length})
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Project Filter */}
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

          {/* Category Filter */}
          {activeTab === 'catalog' && (
            <div className="w-full sm:w-44">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:ring-1 focus:ring-amber-500"
              >
                <option value="ALL">All Categories</option>
                <option value="Cement">Cement</option>
                <option value="Sand">Sand</option>
                <option value="Steel">Steel</option>
                <option value="Bricks">Bricks</option>
                <option value="Tiles">Tiles</option>
                <option value="Paint">Paint</option>
                <option value="Electrical">Electrical</option>
                <option value="Plumbing">Plumbing</option>
                <option value="Hardware">Hardware</option>
                <option value="Other">Other</option>
              </select>
            </div>
          )}

          {/* Low stock toggle */}
          {activeTab === 'catalog' && (
            <button
              onClick={() => setLowStockFilter(!lowStockFilter)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold border transition flex items-center gap-1.5 ${
                lowStockFilter
                  ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                  : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Low Stock Only
            </button>
          )}

          {/* Search box */}
          <div className="relative w-full sm:w-60">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search code, name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg pl-9 pr-3 py-2 focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>

        {activeTab === 'catalog' && (
          <Button
            onClick={exportMaterialsCSV}
            variant="outline"
            className="text-xs border-slate-700 text-slate-300 hover:bg-slate-800 shrink-0 w-full md:w-auto"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export CSV
          </Button>
        )}
      </div>

      {/* TAB 1: CATALOG & INVENTORY STOCK LEVELS */}
      {activeTab === 'catalog' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Code & Name</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3 text-right">Opening</th>
                  <th className="py-3 px-3 text-right">Received</th>
                  <th className="py-3 px-3 text-right">Used</th>
                  <th className="py-3 px-3 text-right font-bold text-slate-200">Available Stock</th>
                  <th className="py-3 px-3 text-right">Min Level</th>
                  <th className="py-3 px-3 text-right">Rate</th>
                  <th className="py-3 px-3 text-right">Valuation</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={11} className="text-center py-10 text-slate-500">
                      Loading materials inventory...
                    </td>
                  </tr>
                ) : materials.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-12 text-slate-400">
                      No materials match the selected filters. Click "+ Add Material" to register items.
                    </td>
                  </tr>
                ) : (
                  materials.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-100">{m.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{m.materialCode}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] font-medium border border-slate-700">
                          {m.category}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-400">
                        {m.openingStock} {m.unit}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-emerald-400 font-medium">
                        +{m.totalReceived}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-rose-400 font-medium">
                        -{m.totalUsed}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-sm">
                        <span className={m.isLowStock ? 'text-rose-400' : 'text-slate-100'}>
                          {m.remainingStock} {m.unit}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-400">
                        {m.minimumStock} {m.unit}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-300">
                        ₹{m.purchaseRate}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                        ₹{m.stockValue.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {m.isLowStock ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[10px] font-bold">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            LOW STOCK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                            <CheckCircle2 className="w-3 h-3 shrink-0" />
                            OK
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            title="Edit Material"
                            onClick={() => {
                              setEditingMaterial(m);
                              setMaterialModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            title="Delete Material"
                            onClick={() => handleDeleteMaterial(m.id, m.name)}
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
      )}

      {/* TAB 2: INWARD RECEIPTS / GRN */}
      {activeTab === 'receipts' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-3">Project Site</th>
                  <th className="py-3 px-3">Material Item</th>
                  <th className="py-3 px-3">Supplier / Vendor</th>
                  <th className="py-3 px-3 text-right">Quantity</th>
                  <th className="py-3 px-3 text-right">Rate (₹)</th>
                  <th className="py-3 px-3 text-right font-bold text-slate-200">Total Cost</th>
                  <th className="py-3 px-4">Challan / Inv</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {receipts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-slate-400">
                      No material receipts recorded yet. Click "Receive Stock (GRN)" to log deliveries.
                    </td>
                  </tr>
                ) : (
                  receipts.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 text-slate-300 font-medium">
                        {new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-100">{r.project?.name}</div>
                        <div className="text-[11px] text-slate-500">{r.site?.name || 'General Site'}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-200">{r.material?.name}</div>
                        <span className="text-[11px] text-slate-500 font-mono">{r.material?.materialCode}</span>
                      </td>
                      <td className="py-3 px-3 text-slate-300">
                        {r.supplier?.name || 'Direct / Market Purchase'}
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: DAILY USAGE LOGS */}
      {activeTab === 'usages' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-3">Project Site</th>
                  <th className="py-3 px-3">Material</th>
                  <th className="py-3 px-3 text-right">Quantity Used</th>
                  <th className="py-3 px-4">Work Purpose / Task</th>
                  <th className="py-3 px-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {usages.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400">
                      No material consumption logs recorded yet. Click "Log Daily Usage" to record daily work consumption.
                    </td>
                  </tr>
                ) : (
                  usages.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 text-slate-300 font-medium">
                        {new Date(u.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-100">{u.project?.name}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-200">{u.material?.name}</div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-rose-400">
                        -{u.quantity} {u.material?.unit}
                      </td>
                      <td className="py-3 px-4 text-slate-100 font-medium">
                        {u.taskPurpose}
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {u.notes || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: INTER-PROJECT TRANSFERS */}
      {activeTab === 'transfers' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-3">Material</th>
                  <th className="py-3 px-3">Source Project (From)</th>
                  <th className="py-3 px-3">Destination Project (To)</th>
                  <th className="py-3 px-3 text-right font-bold text-slate-200">Quantity Transferred</th>
                  <th className="py-3 px-4">Transfer Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400">
                      No inter-site material transfers logged yet. Click "Inter-Site Transfer" to shift materials between projects.
                    </td>
                  </tr>
                ) : (
                  transfers.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 text-slate-300 font-medium">
                        {new Date(t.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-100">{t.material?.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{t.material?.materialCode}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/30 text-[11px] font-medium">
                          {t.sourceProject?.name}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[11px] font-medium">
                          {t.destinationProject?.name}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-indigo-400 text-sm">
                        {t.quantity} {t.material?.unit}
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {t.notes || 'Inter-site stock movement (No purchase expense created)'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: SUPPLIERS DIRECTORY */}
      {activeTab === 'suppliers' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Supplier / Vendor</th>
                  <th className="py-3 px-3">Contact Person</th>
                  <th className="py-3 px-3">Mobile & Email</th>
                  <th className="py-3 px-3">GSTIN</th>
                  <th className="py-3 px-3">Yard / Office Address</th>
                  <th className="py-3 px-3 text-center">Catalog Items</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-400">
                      No suppliers registered yet. Click "New Supplier" to add vendor contact cards.
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
                              setSupplierModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            title="Delete Supplier"
                            onClick={() => handleDeleteSupplier(s.id, s.name)}
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
      )}

      {/* MODALS */}
      <MaterialFormModal
        isOpen={materialModalOpen}
        onClose={() => setMaterialModalOpen(false)}
        onSuccess={fetchData}
        initialData={editingMaterial}
      />

      <ReceiptFormModal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        onSuccess={fetchData}
        defaultProjectId={selectedProjectId !== 'ALL' ? selectedProjectId : undefined}
      />

      <UsageFormModal
        isOpen={usageModalOpen}
        onClose={() => setUsageModalOpen(false)}
        onSuccess={fetchData}
        defaultProjectId={selectedProjectId !== 'ALL' ? selectedProjectId : undefined}
      />

      <TransferFormModal
        isOpen={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        onSuccess={fetchData}
        defaultSourceProjectId={selectedProjectId !== 'ALL' ? selectedProjectId : undefined}
      />

      <SupplierFormModal
        isOpen={supplierModalOpen}
        onClose={() => setSupplierModalOpen(false)}
        onSuccess={fetchData}
        initialData={editingSupplier}
      />
    </div>
  );
}
