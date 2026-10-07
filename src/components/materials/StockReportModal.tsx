'use client';

import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Building2,
  Package,
  IndianRupee,
  Truck,
  Printer,
  Download,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Layers,
  X,
  User,
  ArrowRightLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { extractVerificationInfo } from '@/lib/materials/verification';

interface StockReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  materials: any[];
  projects: any[];
  usages: any[];
  receipts: any[];
  transfers: any[];
}

export function StockReportModal({
  isOpen,
  onClose,
  materials,
  projects,
  usages,
  receipts,
  transfers,
}: StockReportModalProps) {
  const [selectedProjectId, setSelectedProjectId] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'site' | 'material'>('site'); // site-wise or material-wise

  // Calculate site-wise stock distribution
  const siteStockData = useMemo(() => {
    // Build map for each project
    return projects.map((p) => {
      // Find all usages dispatched to this project
      const projUsages = usages.filter((u) => u.projectId === p.id);
      // Find all direct receipts for this project (exclude transfer dispatches)
      const projReceipts = receipts.filter(
        (r) => r.projectId === p.id && r.paymentMethod !== 'TRANSFER' && !r.invoiceNumber?.startsWith('DISPATCH')
      );
      // Transfers in and out
      const projTransfersIn = transfers.filter((t) => t.destinationProjectId === p.id);
      const projTransfersOut = transfers.filter((t) => t.sourceProjectId === p.id);

      // Collect all material IDs that have touched this project
      const materialIdSet = new Set<string>();
      projUsages.forEach((u) => materialIdSet.add(u.materialId));
      projReceipts.forEach((r) => materialIdSet.add(r.materialId));
      projTransfersIn.forEach((t) => materialIdSet.add(t.materialId));
      projTransfersOut.forEach((t) => materialIdSet.add(t.materialId));

      const siteMaterials = Array.from(materialIdSet)
        .map((mId) => {
          const mat = materials.find((m) => m.id === mId) || {
            id: mId,
            name: 'Unknown Item',
            materialCode: '—',
            unit: 'units',
            category: 'General',
            purchaseRate: 0,
            minimumStock: 0,
          };

          // 1. Approved dispatches received at this site
          const approvedDispatches = projUsages
            .filter((u) => u.materialId === mId && u.taskPurpose === 'APPROVED')
            .reduce((sum, u) => sum + (u.quantity || 0), 0);

          // 2. Pending dispatches in-transit to this site
          const pendingDispatches = projUsages
            .filter((u) => u.materialId === mId && u.taskPurpose !== 'APPROVED')
            .reduce((sum, u) => sum + (u.quantity || 0), 0);

          // 3. Direct vendor purchase received at site
          const directReceived = projReceipts
            .filter((r) => r.materialId === mId)
            .reduce((sum, r) => sum + (r.quantity || 0), 0);

          // 4. Transfers in & out
          const transIn = projTransfersIn
            .filter((t) => t.materialId === mId)
            .reduce((sum, t) => sum + (t.quantity || 0), 0);
          const transOut = projTransfersOut
            .filter((t) => t.materialId === mId)
            .reduce((sum, t) => sum + (t.quantity || 0), 0);

          // Available Stock at Site
          const availableStock = Math.round(Math.max(0, approvedDispatches + directReceived + transIn - transOut) * 1000) / 1000;
          const rate = mat.purchaseRate || 0;
          const totalValue = Math.round(availableStock * rate * 100) / 100;

          // Find latest verification record if any
          const latestApprovedUsage = projUsages
            .filter((u) => u.materialId === mId && u.taskPurpose === 'APPROVED')
            .sort((a, b) => new Date(b.date || b.updatedAt).getTime() - new Date(a.date || a.updatedAt).getTime())[0];

          const verificationInfo = latestApprovedUsage
            ? extractVerificationInfo(latestApprovedUsage.notes)
            : null;

          return {
            material: mat,
            availableStock,
            pendingDispatches,
            approvedDispatches,
            directReceived,
            transIn,
            transOut,
            rate,
            totalValue,
            verificationInfo,
            isLowStock: availableStock > 0 && availableStock <= mat.minimumStock,
          };
        })
        .filter((item) => item.availableStock > 0 || item.pendingDispatches > 0);

      const totalSiteValue = siteMaterials.reduce((sum, item) => sum + item.totalValue, 0);
      const totalItemCount = siteMaterials.length;

      return {
        project: p,
        materials: siteMaterials,
        totalSiteValue,
        totalItemCount,
      };
    });
  }, [projects, materials, usages, receipts, transfers]);

  // Calculate material-wise comparison (Company godown vs all sites)
  const materialDistributionData = useMemo(() => {
    return materials.map((m) => {
      // Dispatches of this material to any site
      const allDispatches = usages.filter((u) => u.materialId === m.id);
      const totalDispatched = allDispatches.reduce((sum, u) => sum + (u.quantity || 0), 0);
      const totalApprovedDispatches = allDispatches.filter((u) => u.taskPurpose === 'APPROVED').reduce((sum, u) => sum + (u.quantity || 0), 0);
      const totalPendingDispatches = allDispatches.filter((u) => u.taskPurpose !== 'APPROVED').reduce((sum, u) => sum + (u.quantity || 0), 0);

      // Remaining Company Godown Stock
      const godownStock = Math.round(Math.max(0, (m.openingStock || 0) - totalDispatched) * 1000) / 1000;
      const godownValue = Math.round(godownStock * (m.purchaseRate || 0) * 100) / 100;

      // Breakdown per site for this material
      const siteBreakdown = projects
        .map((p) => {
          const pApproved = allDispatches.filter((u) => u.projectId === p.id && u.taskPurpose === 'APPROVED').reduce((sum, u) => sum + (u.quantity || 0), 0);
          const pPending = allDispatches.filter((u) => u.projectId === p.id && u.taskPurpose !== 'APPROVED').reduce((sum, u) => sum + (u.quantity || 0), 0);
          const pDirect = receipts.filter((r) => r.projectId === p.id && r.materialId === m.id && r.paymentMethod !== 'TRANSFER' && !r.invoiceNumber?.startsWith('DISPATCH')).reduce((sum, r) => sum + (r.quantity || 0), 0);
          const pTransIn = transfers.filter((t) => t.destinationProjectId === p.id && t.materialId === m.id).reduce((sum, t) => sum + (t.quantity || 0), 0);
          const pTransOut = transfers.filter((t) => t.sourceProjectId === p.id && t.materialId === m.id).reduce((sum, t) => sum + (t.quantity || 0), 0);
          const pStock = Math.round(Math.max(0, pApproved + pDirect + pTransIn - pTransOut) * 1000) / 1000;

          return {
            projectName: p.name,
            projectCode: p.projectCode,
            stock: pStock,
            pending: pPending,
            value: Math.round(pStock * (m.purchaseRate || 0) * 100) / 100,
          };
        })
        .filter((sb) => sb.stock > 0 || sb.pending > 0);

      const totalAcrossSites = siteBreakdown.reduce((sum, sb) => sum + sb.stock, 0);

      return {
        material: m,
        openingStock: m.openingStock || 0,
        godownStock,
        godownValue,
        totalAcrossSites,
        totalPendingDispatches,
        siteBreakdown,
      };
    });
  }, [materials, usages, receipts, transfers, projects]);

  // Filtered views
  const filteredSiteData = useMemo(() => {
    return siteStockData
      .filter((sd) => {
        if (selectedProjectId !== 'ALL' && sd.project.id !== selectedProjectId) return false;
        return true;
      })
      .map((sd) => {
        const filteredMats = sd.materials.filter((item) => {
          if (selectedCategory !== 'ALL' && item.material.category !== selectedCategory) return false;
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            return (
              item.material.name?.toLowerCase().includes(q) ||
              item.material.materialCode?.toLowerCase().includes(q)
            );
          }
          return true;
        });

        return {
          ...sd,
          materials: filteredMats,
        };
      })
      .filter((sd) => sd.materials.length > 0 || selectedProjectId === sd.project.id);
  }, [siteStockData, selectedProjectId, selectedCategory, searchQuery]);

  // Overall KPIs
  const totalSitesWithStock = siteStockData.filter((sd) => sd.materials.length > 0).length;
  const totalStockValueAtSites = siteStockData.reduce((sum, sd) => sum + sd.totalSiteValue, 0);
  const totalGodownValue = materialDistributionData.reduce((sum, md) => sum + md.godownValue, 0);

  // Categories list
  const categories = Array.from(new Set(materials.map((m) => m.category || 'General')));

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ['Site / Project', 'Project Code', 'Material Name', 'Code', 'Category', 'Available Stock Qty', 'Unit', 'Rate (INR)', 'Total Value (INR)', 'Pending In-Transit', 'Verified By Supervisor'];
    const rows: any[] = [];

    siteStockData.forEach((sd) => {
      sd.materials.forEach((item) => {
        rows.push([
          `"${sd.project.name}"`,
          `"${sd.project.projectCode}"`,
          `"${item.material.name}"`,
          `"${item.material.materialCode}"`,
          `"${item.material.category}"`,
          item.availableStock,
          `"${item.material.unit}"`,
          item.rate,
          item.totalValue,
          item.pendingDispatches,
          `"${item.verificationInfo?.verifierName || 'Direct'}"`,
        ]);
      });
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Site_Materials_Stock_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Header Bar */}
        <div className="p-4 sm:p-5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-slate-950 shadow-md shadow-emerald-500/20">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-100 flex items-center gap-2">
                Site-Wise Material Stock Report
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time stock levels, quantities, and valuation across all project sites
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleExportCSV}
              variant="outline"
              size="sm"
              className="text-xs border-slate-700 text-slate-300 hover:bg-slate-800 hidden sm:flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              CSV Export
            </Button>
            <Button
              onClick={handlePrint}
              variant="outline"
              size="sm"
              className="text-xs border-slate-700 text-slate-300 hover:bg-slate-800 hidden sm:flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Report
            </Button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="p-4 bg-slate-900/90 border-b border-slate-800/80 grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-sky-400" /> Sites With Stock
              </div>
              <div className="text-xl font-black text-sky-400 mt-1">
                {totalSitesWithStock} <span className="text-xs text-slate-500 font-normal">sites</span>
              </div>
              <div className="text-[10px] text-slate-500">Materials active at construction sites</div>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <IndianRupee className="w-3.5 h-3.5 text-emerald-400" /> Stock Value at Sites
              </div>
              <div className="text-xl font-black text-emerald-400 mt-1">
                ₹{totalStockValueAtSites.toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-slate-500">Total physical materials at sites</div>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Package className="w-3.5 h-3.5 text-amber-400" /> Company Godown Value
              </div>
              <div className="text-xl font-black text-amber-400 mt-1">
                ₹{totalGodownValue.toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-slate-500">In-hand stock at main warehouse</div>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-purple-400" /> Total Enterprise Stock
              </div>
              <div className="text-xl font-black text-purple-400 mt-1">
                ₹{(totalStockValueAtSites + totalGodownValue).toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-slate-500">Warehouse + All site inventories</div>
            </div>
          </div>
        </div>

        {/* View Mode Tabs & Filter Controls */}
        <div className="p-3.5 bg-slate-950/60 border-b border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={() => setViewMode('site')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === 'site'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              Site-Wise Breakdown
            </button>
            <button
              onClick={() => setViewMode('material')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === 'material'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              Material-Wise Distribution
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Project Filter */}
            <div className="w-full sm:w-48">
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500"
              >
                <option value="ALL">🏢 All Construction Sites</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.projectCode})
                  </option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div className="w-full sm:w-36">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500"
              >
                <option value="ALL">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-48">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
              <input
                type="text"
                placeholder="Search material..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg pl-8 pr-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Scrollable Report Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* VIEW MODE 1: SITE-WISE BREAKDOWN */}
          {viewMode === 'site' && (
            <div className="space-y-4">
              {filteredSiteData.length === 0 ? (
                <div className="text-center py-16 bg-slate-950/40 rounded-xl border border-slate-800 text-slate-400">
                  <Building2 className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="font-semibold">No material stock found matching your filter.</p>
                  <p className="text-xs text-slate-500 mt-1">Sites par abhi koi material uplabdh nahi hai.</p>
                </div>
              ) : (
                filteredSiteData.map((sd) => (
                  <div
                    key={sd.project.id}
                    className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-sm"
                  >
                    {/* Site Card Header */}
                    <div className="p-3.5 bg-slate-900/80 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                            <span>{sd.project.name}</span>
                            <span className="font-mono text-xs text-sky-400 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800/60">
                              {sd.project.projectCode}
                            </span>
                          </h3>
                          {sd.project.location && (
                            <div className="text-[11px] text-slate-400">{sd.project.location}</div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs font-mono">
                        <div>
                          <span className="text-slate-500 uppercase text-[10px] block">Materials at Site:</span>
                          <span className="font-bold text-slate-200">{sd.materials.length} Items</span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-500 uppercase text-[10px] block">Total Valuation:</span>
                          <span className="font-black text-emerald-400 text-sm">
                            ₹{sd.totalSiteValue.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Site Materials Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800/80 bg-slate-950 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                            <th className="py-2.5 px-4">Material Name & Code</th>
                            <th className="py-2.5 px-3">Category</th>
                            <th className="py-2.5 px-3 text-right">Available at Site</th>
                            <th className="py-2.5 px-3 text-right">Pending Arrival</th>
                            <th className="py-2.5 px-3 text-right">Rate (₹)</th>
                            <th className="py-2.5 px-3 text-right">Site Stock Value</th>
                            <th className="py-2.5 px-4">Supervisor Verification</th>
                            <th className="py-2.5 px-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                          {sd.materials.map((item) => (
                            <tr key={item.material.id} className="hover:bg-slate-900/40 transition">
                              <td className="py-2.5 px-4">
                                <div className="font-bold text-slate-200">{item.material.name}</div>
                                <span className="font-mono text-[10px] text-slate-500">{item.material.materialCode}</span>
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="px-2 py-0.5 rounded text-[10px] bg-slate-900 text-slate-300 border border-slate-800">
                                  {item.material.category || 'General'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-400 text-sm">
                                {item.availableStock} {item.material.unit}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono">
                                {item.pendingDispatches > 0 ? (
                                  <span className="text-amber-400 font-bold">
                                    +{item.pendingDispatches} {item.material.unit}
                                  </span>
                                ) : (
                                  <span className="text-slate-600">—</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                                ₹{item.rate}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-black text-amber-400 text-sm">
                                ₹{item.totalValue.toLocaleString('en-IN')}
                              </td>
                              <td className="py-2.5 px-4 text-slate-300 text-[11px]">
                                {item.verificationInfo ? (
                                  <div className="flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    <div>
                                      <div className="font-semibold text-slate-200">
                                        {item.verificationInfo.verifierName}
                                      </div>
                                      <div className="text-[10px] text-slate-400">
                                        {item.verificationInfo.displayDate || 'Verified at site'}
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-slate-500 italic">Direct / Inward Log</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {item.availableStock > 0 ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                    <CheckCircle2 className="w-3 h-3" />
                                    In Stock
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                    <Clock className="w-3 h-3 animate-pulse" />
                                    In-Transit
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* VIEW MODE 2: MATERIAL-WISE DISTRIBUTION */}
          {viewMode === 'material' && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4">Material Item</th>
                      <th className="py-3 px-3">Category</th>
                      <th className="py-3 px-3 text-right">Company Total Stock</th>
                      <th className="py-3 px-3 text-right text-emerald-400 font-bold">Godown In-Hand Stock</th>
                      <th className="py-3 px-3 text-right text-sky-400 font-bold">Total on Sites</th>
                      <th className="py-3 px-4">Breakdown by Site</th>
                      <th className="py-3 px-3 text-right">Godown Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {materialDistributionData
                      .filter((md) => {
                        if (selectedCategory !== 'ALL' && md.material.category !== selectedCategory) return false;
                        if (searchQuery.trim()) {
                          const q = searchQuery.toLowerCase();
                          return (
                            md.material.name?.toLowerCase().includes(q) ||
                            md.material.materialCode?.toLowerCase().includes(q)
                          );
                        }
                        return true;
                      })
                      .map((md) => (
                        <tr key={md.material.id} className="hover:bg-slate-900/40 transition">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-100">{md.material.name}</div>
                            <span className="font-mono text-[10px] text-slate-500">{md.material.materialCode}</span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] bg-slate-900 text-slate-300 border border-slate-800">
                              {md.material.category || 'General'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-300">
                            {md.openingStock} {md.material.unit}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-black text-emerald-400 text-sm">
                            {md.godownStock} {md.material.unit}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-black text-sky-400 text-sm">
                            {md.totalAcrossSites} {md.material.unit}
                          </td>
                          <td className="py-3 px-4">
                            {md.siteBreakdown.length === 0 ? (
                              <span className="text-slate-600 italic">No stock currently on sites</span>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {md.siteBreakdown.map((sb, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px]"
                                  >
                                    <span className="text-slate-300 font-semibold">{sb.projectName}:</span>
                                    <span className="text-sky-400 font-mono font-bold">
                                      {sb.stock} {md.material.unit}
                                    </span>
                                    {sb.pending > 0 && (
                                      <span className="text-[10px] text-amber-400">(+{sb.pending} pending)</span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-black text-amber-400">
                            ₹{md.godownValue.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div>
            Real-time synchronization with Site Dispatch & Supervisor Verification logs.
          </div>
          <Button onClick={onClose} className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs">
            Close Report
          </Button>
        </div>
      </div>
    </div>
  );
}
