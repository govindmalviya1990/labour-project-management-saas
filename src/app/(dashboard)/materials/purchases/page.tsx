'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  FileText,
  CreditCard,
  Building2,
  FileBarChart,
  Plus,
  Search,
  Filter,
  Download,
  Printer,
  Trash2,
  Edit2,
  RotateCcw,
  Clock,
  ArrowUpDown,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Receipt,
  Layers,
  ShoppingBag,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatINR } from '@/lib/calculations';
import { AddPurchaseBillModal } from '@/components/purchases/AddPurchaseBillModal';
import { RecordSupplierPaymentModal } from '@/components/purchases/RecordSupplierPaymentModal';
import { SupplierLedgerModal } from '@/components/purchases/SupplierLedgerModal';
import { AddPurchaseReturnModal } from '@/components/purchases/AddPurchaseReturnModal';

type TabType = 'BILLS' | 'PAYMENTS' | 'SUPPLIERS' | 'REPORTS';

export default function PurchasesPage() {
  const [activeTab, setActiveTab] = useState<TabType>('BILLS');

  // Metadata / Counts
  const [bills, setBills] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [supplierOverallSummary, setSupplierOverallSummary] = useState<any>(null);
  const [reportsData, setReportsData] = useState<any>(null);

  // Loading & Error states
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState('');
  const [period, setPeriod] = useState<'today' | 'weekly' | 'monthly' | 'custom' | 'all'>('monthly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals state
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<any>(null);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [preSelectedSupplierId, setPreSelectedSupplierId] = useState<string>('');
  const [preSelectedBillId, setPreSelectedBillId] = useState<string>('');

  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnBill, setReturnBill] = useState<any>(null);

  const [ledgerSupplierId, setLedgerSupplierId] = useState<string>('');
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);

  // Delete Confirmation Modal State
  const [deletingItem, setDeletingItem] = useState<{
    type: 'BILL' | 'PAYMENT' | 'RETURN' | 'SUPPLIER';
    id: string;
    title: string;
  } | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Suppliers sort state
  const [supplierSortField, setSupplierSortField] = useState<'name' | 'totalPurchased' | 'totalPaid' | 'remainingBalance'>('remainingBalance');
  const [supplierSortAsc, setSupplierSortAsc] = useState(false);

  // Load active tab data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      if (activeTab === 'BILLS') {
        let url = `/api/purchases/bills?period=${period}`;
        if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
        if (statusFilter !== 'ALL') url += `&status=${statusFilter}`;
        if (selectedSupplierFilter) url += `&supplierId=${selectedSupplierFilter}`;
        if (startDate && endDate) url += `&startDate=${startDate}&endDate=${endDate}`;

        const [resBills, resPayments, resSuppliers] = await Promise.all([
          fetch(url),
          fetch(`/api/purchases/payments?period=${period}${selectedSupplierFilter ? `&supplierId=${selectedSupplierFilter}` : ''}`),
          fetch(`/api/purchases/suppliers`),
        ]);

        if (!resBills.ok) throw new Error('Failed to load purchase bills');
        const dBills = await resBills.json();
        setBills(dBills.bills || []);

        if (resPayments.ok) {
          const dPayments = await resPayments.json();
          setPayments(dPayments.payments || []);
        }
        if (resSuppliers.ok) {
          const dSuppliers = await resSuppliers.json();
          setSuppliers(dSuppliers.suppliers || []);
          setSupplierOverallSummary(dSuppliers.summary || null);
        }
      } else if (activeTab === 'PAYMENTS') {
        let url = `/api/purchases/payments?period=${period}`;
        if (selectedSupplierFilter) url += `&supplierId=${selectedSupplierFilter}`;
        if (startDate && endDate) url += `&startDate=${startDate}&endDate=${endDate}`;

        const [resPayments, resBills] = await Promise.all([
          fetch(url),
          fetch(`/api/purchases/bills?period=${period}${selectedSupplierFilter ? `&supplierId=${selectedSupplierFilter}` : ''}`),
        ]);

        if (!resPayments.ok) throw new Error('Failed to load supplier payments');
        const d = await resPayments.json();
        setPayments(d.payments || []);

        if (resBills.ok) {
          const dBills = await resBills.json();
          setBills(dBills.bills || []);
        }
      } else if (activeTab === 'SUPPLIERS') {
        let url = `/api/purchases/suppliers`;
        if (searchQuery) url += `?search=${encodeURIComponent(searchQuery)}`;

        const [resSuppliers, resBills] = await Promise.all([
          fetch(url),
          fetch(`/api/purchases/bills?period=${period}`),
        ]);

        if (!resSuppliers.ok) throw new Error('Failed to load suppliers');
        const d = await resSuppliers.json();
        setSuppliers(d.suppliers || []);
        setSupplierOverallSummary(d.summary || null);

        if (resBills.ok) {
          const dBills = await resBills.json();
          setBills(dBills.bills || []);
        }
      } else if (activeTab === 'REPORTS') {
        let url = `/api/purchases/reports?period=${period}`;
        if (startDate && endDate) url += `&startDate=${startDate}&endDate=${endDate}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to load purchase reports');
        const d = await res.json();
        setReportsData(d);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading purchases data');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, period, searchQuery, statusFilter, selectedSupplierFilter, startDate, endDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Delete
  const handleConfirmDelete = async () => {
    if (!deletingItem) return;
    if (!deleteReason.trim()) {
      setDeleteError('Please provide a mandatory reason for deletion');
      return;
    }

    setIsSubmittingDelete(true);
    setDeleteError('');
    try {
      let url = '';
      if (deletingItem.type === 'BILL') {
        url = `/api/purchases/bills/${deletingItem.id}`;
      } else if (deletingItem.type === 'PAYMENT') {
        url = `/api/purchases/payments/${deletingItem.id}`;
      } else if (deletingItem.type === 'RETURN') {
        url = `/api/purchases/returns/${deletingItem.id}`;
      }

      const res = await fetch(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteReason: deleteReason.trim() }),
      });

      const d = await res.json();
      if (!res.ok) {
        throw new Error(d.error || 'Failed to delete record');
      }

      setSuccessMessage(d.message || 'Deleted successfully');
      setDeletingItem(null);
      setDeleteReason('');
      loadData();
    } catch (err: any) {
      setDeleteError(err.message || 'Something went wrong while deleting');
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  // Sorted suppliers
  const sortedSuppliers = useMemo(() => {
    return [...suppliers].sort((a, b) => {
      let aVal = a[supplierSortField];
      let bVal = b[supplierSortField];
      if (typeof aVal === 'string') {
        return supplierSortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return supplierSortAsc ? aVal - bVal : bVal - aVal;
    });
  }, [suppliers, supplierSortField, supplierSortAsc]);

  // Export report or bills to CSV
  const handleExportBillsCSV = () => {
    if (bills.length === 0) return;
    const headers = ['Date', 'Bill No', 'Supplier', 'Project', 'Subtotal', 'GST', 'Total', 'Paid', 'Return', 'Due', 'Status'];
    const rows = bills.map((b) => [
      `"${new Date(b.billDate).toISOString().split('T')[0]}"`,
      `"${b.billNumber || ''}"`,
      `"${b.supplier?.name || ''}"`,
      `"${b.project?.name || 'No project'}"`,
      b.subtotal || 0,
      b.gstAmount || 0,
      b.totalAmount || 0,
      b.derivedPaidAmount || 0,
      b.derivedReturnAmount || 0,
      b.derivedNetDue ?? b.derivedDueAmount ?? 0,
      `"${b.derivedStatus || b.status}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Purchase_Bills_${period}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/materials" className="text-xs text-slate-400 hover:text-purple-400 flex items-center gap-1">
              &larr; Back to Materials Hub
            </Link>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <Building2 className="w-7 h-7 text-purple-600" />
            Purchases &amp; Supplier Ledger
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Track material inward bills, supplier running balances, single &amp; bulk payments, and aging breakdown.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            onClick={() => {
              setEditingBill(null);
              setIsBillModalOpen(true);
            }}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Purchase Bill
          </Button>

          <Button
            type="button"
            onClick={() => {
              setPreSelectedSupplierId('');
              setPreSelectedBillId('');
              setIsPaymentModalOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
          >
            <CreditCard className="w-4 h-4" />
            Pay Supplier
          </Button>
        </div>
      </div>

      {successMessage && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs font-bold">
          <span>{successMessage}</span>
          <button type="button" onClick={() => setSuccessMessage('')} className="text-emerald-500 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-bold">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} className="text-rose-500 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* 4 Main Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('BILLS')}
          className={`py-2.5 px-4 text-xs font-bold whitespace-nowrap border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'BILLS'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          Purchase Bills ({bills.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('PAYMENTS')}
          className={`py-2.5 px-4 text-xs font-bold whitespace-nowrap border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'PAYMENTS'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Payments History ({payments.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('SUPPLIERS')}
          className={`py-2.5 px-4 text-xs font-bold whitespace-nowrap border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'SUPPLIERS'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Suppliers Ledger ({suppliers.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('REPORTS')}
          className={`py-2.5 px-4 text-xs font-bold whitespace-nowrap border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'REPORTS'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <FileBarChart className="w-4 h-4" />
          Purchase Reports
        </button>
      </div>

      {/* Filter Bar (Period, Search, Date Range) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            {(['today', 'weekly', 'monthly', 'all'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 text-xs font-bold rounded-lg uppercase tracking-wider transition-all ${
                  period === p
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {activeTab === 'BILLS' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-none text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              <option value="ALL">All Status</option>
              <option value="UNPAID">Unpaid</option>
              <option value="PARTIAL">Partially Paid</option>
              <option value="PAID">Fully Paid</option>
            </select>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search bill #, supplier, material..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-none text-xs text-slate-900 dark:text-white"
            />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadData}
            className="text-xs font-semibold p-2"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* TAB 1: BILLS TAB */}
      {activeTab === 'BILLS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Bills List ({bills.length})
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportBillsCSV}
              className="text-xs font-bold flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" /> Export Bills CSV
            </Button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-3.5">Bill Date</th>
                  <th className="py-3 px-3.5">Bill / Challan #</th>
                  <th className="py-3 px-3.5">Supplier</th>
                  <th className="py-3 px-3.5">Project / Site</th>
                  <th className="py-3 px-3.5 text-right">Subtotal</th>
                  <th className="py-3 px-3.5 text-right">GST</th>
                  <th className="py-3 px-3.5 text-right">Total (₹)</th>
                  <th className="py-3 px-3.5 text-right">Paid</th>
                  <th className="py-3 px-3.5 text-right">Due (₹)</th>
                  <th className="py-3 px-3.5 text-center">Status</th>
                  <th className="py-3 px-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={11} className="py-10 text-center text-slate-400">
                      Loading bills...
                    </td>
                  </tr>
                ) : bills.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-10 text-center text-slate-400">
                      No purchase bills found for this period. Click &quot;New Purchase Bill&quot; to record one.
                    </td>
                  </tr>
                ) : (
                  bills.map((bill) => (
                    <tr key={bill.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3.5 whitespace-nowrap text-slate-500">
                        {new Date(bill.billDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-2.5 px-3.5 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {bill.billNumber || 'No #'}
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setLedgerSupplierId(bill.supplierId);
                            setIsLedgerModalOpen(true);
                          }}
                          className="font-semibold text-purple-600 dark:text-purple-400 hover:underline"
                        >
                          {bill.supplier?.name}
                        </button>
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap text-slate-600 dark:text-slate-400">
                        {bill.project?.name || 'No project'}
                        {bill.site ? ` • ${bill.site.name}` : ''}
                      </td>
                      <td className="py-2.5 px-3.5 font-mono text-right text-slate-600 dark:text-slate-400">
                        {formatINR(bill.subtotal)}
                      </td>
                      <td className="py-2.5 px-3.5 font-mono text-right text-slate-600 dark:text-slate-400">
                        {bill.gstAmount > 0 ? formatINR(bill.gstAmount) : '-'}
                      </td>
                      <td className="py-2.5 px-3.5 font-mono font-bold text-right text-slate-900 dark:text-white">
                        {formatINR(bill.totalAmount)}
                      </td>
                      <td className="py-2.5 px-3.5 font-mono text-right text-emerald-600 dark:text-emerald-400">
                        {formatINR(bill.derivedPaidAmount || 0)}
                      </td>
                      <td className="py-2.5 px-3.5 font-mono font-bold text-right text-purple-600 dark:text-purple-400">
                        {formatINR(bill.derivedNetDue ?? bill.derivedDueAmount ?? bill.totalAmount)}
                      </td>
                      <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            bill.derivedStatus === 'PAID'
                              ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                              : bill.derivedStatus === 'PARTIAL'
                              ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                          }`}
                        >
                          {bill.derivedStatus || bill.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {bill.derivedStatus !== 'PAID' && (
                            <button
                              type="button"
                              onClick={() => {
                                setPreSelectedSupplierId(bill.supplierId);
                                setPreSelectedBillId(bill.id);
                                setIsPaymentModalOpen(true);
                              }}
                              className="px-2 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 text-[10px] font-bold"
                              title="Pay this bill"
                            >
                              Pay
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setReturnBill(bill);
                              setIsReturnModalOpen(true);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-amber-500"
                            title="Return Items"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingBill(bill);
                              setIsBillModalOpen(true);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-purple-500"
                            title="Edit Bill"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeletingItem({
                                type: 'BILL',
                                id: bill.id,
                                title: `Bill #${bill.billNumber || 'No #'} (${bill.supplier?.name})`,
                              });
                              setDeleteReason('');
                              setDeleteError('');
                            }}
                            className="p-1 rounded text-slate-400 hover:text-rose-500"
                            title="Delete Bill"
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

      {/* TAB 2: PAYMENTS TAB */}
      {activeTab === 'PAYMENTS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Payments History ({payments.length})
            </span>
            <Button
              type="button"
              onClick={() => {
                setPreSelectedSupplierId('');
                setPreSelectedBillId('');
                setIsPaymentModalOpen(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> New Supplier Payment
            </Button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-3.5">Payment Date</th>
                  <th className="py-3 px-3.5">Supplier</th>
                  <th className="py-3 px-3.5">Source Account</th>
                  <th className="py-3 px-3.5">Payment Method</th>
                  <th className="py-3 px-3.5">Allocated Bill</th>
                  <th className="py-3 px-3.5">Ref / UTR</th>
                  <th className="py-3 px-3.5 text-right">Amount (₹)</th>
                  <th className="py-3 px-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400">
                      Loading payments...
                    </td>
                  </tr>
                ) : payments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400">
                      No supplier payments found for this period. Click &quot;Pay Supplier&quot; to record one.
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3.5 whitespace-nowrap text-slate-500">
                        {new Date(p.date).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-2.5 px-3.5 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setLedgerSupplierId(p.supplierId);
                            setIsLedgerModalOpen(true);
                          }}
                          className="hover:underline text-purple-600 dark:text-purple-400"
                        >
                          {p.supplier?.name}
                        </button>
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            p.sourceType === 'PARTNER'
                              ? 'bg-indigo-500/10 text-indigo-600'
                              : 'bg-sky-500/10 text-sky-600'
                          }`}
                        >
                          {p.sourceType === 'PARTNER' ? `Partner Wallet` : `Bank Account`}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap font-semibold">
                        {p.method}
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap text-slate-500">
                        {p.bill ? `Bill #${p.bill.billNumber || 'No #'}` : 'Advance / On Account'}
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap text-slate-500">
                        {p.reference || '-'}
                      </td>
                      <td className="py-2.5 px-3.5 font-mono font-black text-right text-emerald-600 dark:text-emerald-400">
                        {formatINR(p.amount)}
                      </td>
                      <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setDeletingItem({
                              type: 'PAYMENT',
                              id: p.id,
                              title: `Payment ${formatINR(p.amount)} to ${p.supplier?.name}`,
                            });
                            setDeleteReason('');
                            setDeleteError('');
                          }}
                          className="p-1 rounded text-slate-400 hover:text-rose-500"
                          title="Delete Payment (Restores Source Balance)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SUPPLIERS LEDGER TAB */}
      {activeTab === 'SUPPLIERS' && (
        <div className="space-y-4">
          {/* Supplier Overall Summary Cards */}
          {supplierOverallSummary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Purchased</span>
                <span className="text-base font-black font-mono text-slate-900 dark:text-white">
                  {formatINR(supplierOverallSummary.totalPurchased)}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Suppliers: {suppliers.length}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Paid</span>
                <span className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">
                  {formatINR(supplierOverallSummary.totalPaid)}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Outstanding Balance</span>
                <span className="text-base font-black font-mono text-purple-600 dark:text-purple-400">
                  {formatINR(supplierOverallSummary.totalRemaining)}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-purple-700 dark:text-purple-300 block">
                  Aging 90+ Days Due
                </span>
                <span className="text-base font-black font-mono text-rose-600">
                  {formatINR(supplierOverallSummary.aging?.bracket90Plus || 0)}
                </span>
                <span className="text-[10px] text-purple-600/80 block mt-0.5">Overdue Bills</span>
              </div>
            </div>
          )}

          {/* Suppliers Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th
                    className="py-3 px-3.5 cursor-pointer hover:bg-slate-200/50"
                    onClick={() => {
                      setSupplierSortField('name');
                      setSupplierSortAsc(!supplierSortAsc);
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <span>Supplier Name</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-3 px-3.5">Mobile</th>
                  <th className="py-3 px-3.5 text-right">Opening Bal</th>
                  <th
                    className="py-3 px-3.5 text-right cursor-pointer hover:bg-slate-200/50"
                    onClick={() => {
                      setSupplierSortField('totalPurchased');
                      setSupplierSortAsc(!supplierSortAsc);
                    }}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Total Purchased</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    className="py-3 px-3.5 text-right cursor-pointer hover:bg-slate-200/50"
                    onClick={() => {
                      setSupplierSortField('totalPaid');
                      setSupplierSortAsc(!supplierSortAsc);
                    }}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Total Paid</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    className="py-3 px-3.5 text-right cursor-pointer hover:bg-slate-200/50"
                    onClick={() => {
                      setSupplierSortField('remainingBalance');
                      setSupplierSortAsc(!supplierSortAsc);
                    }}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Remaining Balance</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-3 px-3.5 text-center">Aging (0-30 / 31-60 / 61-90 / 90+)</th>
                  <th className="py-3 px-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400">
                      Loading suppliers...
                    </td>
                  </tr>
                ) : sortedSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400">
                      No suppliers found. Click &quot;New Purchase Bill&quot; to add a supplier inline.
                    </td>
                  </tr>
                ) : (
                  sortedSuppliers.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3.5 whitespace-nowrap font-bold text-slate-900 dark:text-white">
                        {s.name}
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap text-slate-500">
                        {s.mobile || '-'}
                      </td>
                      <td className="py-2.5 px-3.5 font-mono text-right text-slate-500">
                        {s.openingBalance ? formatINR(s.openingBalance) : '-'}
                      </td>
                      <td className="py-2.5 px-3.5 font-mono text-right text-slate-900 dark:text-white">
                        {formatINR(s.totalPurchased)}
                      </td>
                      <td className="py-2.5 px-3.5 font-mono text-right text-emerald-600 dark:text-emerald-400">
                        {formatINR(s.totalPaid)}
                      </td>
                      <td className="py-2.5 px-3.5 font-mono font-black text-right text-purple-600 dark:text-purple-400">
                        {formatINR(s.remainingBalance)}
                      </td>
                      <td className="py-2.5 px-3.5 text-center whitespace-nowrap text-[10px] font-mono">
                        <span className="text-slate-600 dark:text-slate-400">{formatINR(s.aging?.bracket0To30 || 0)}</span> /{' '}
                        <span className="text-amber-600">{formatINR(s.aging?.bracket31To60 || 0)}</span> /{' '}
                        <span className="text-orange-600">{formatINR(s.aging?.bracket61To90 || 0)}</span> /{' '}
                        <span className="text-rose-600 font-bold">{formatINR(s.aging?.bracket90Plus || 0)}</span>
                      </td>
                      <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setLedgerSupplierId(s.id);
                              setIsLedgerModalOpen(true);
                            }}
                            className="text-xs font-bold py-1 px-2 text-purple-600 hover:text-purple-700"
                          >
                            Statement
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              setPreSelectedSupplierId(s.id);
                              setPreSelectedBillId('');
                              setIsPaymentModalOpen(true);
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-1 px-2"
                          >
                            Pay
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
      )}

      {/* TAB 4: REPORTS TAB */}
      {activeTab === 'REPORTS' && reportsData && (
        <div className="space-y-6">
          {/* Summary Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-bold uppercase text-slate-500 block">Total Purchases In Period</span>
              <span className="text-xl font-black font-mono text-purple-600 dark:text-purple-400">
                {formatINR(reportsData.summary?.totalPurchases || 0)}
              </span>
              <span className="text-xs text-slate-400 block mt-1">
                Bills: {reportsData.summary?.billsCount || 0}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-bold uppercase text-slate-500 block">Total Payments In Period</span>
              <span className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                {formatINR(reportsData.summary?.totalPayments || 0)}
              </span>
              <span className="text-xs text-slate-400 block mt-1">
                Payments: {reportsData.summary?.paymentsCount || 0}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs font-bold uppercase text-slate-500 block">Returns In Period</span>
              <span className="text-xl font-black font-mono text-amber-600 dark:text-amber-400">
                {formatINR(reportsData.summary?.totalReturns || 0)}
              </span>
              <span className="text-xs text-slate-400 block mt-1">
                Returns: {reportsData.summary?.returnsCount || 0}
              </span>
            </div>
          </div>

          {/* Supplier-wise breakdown table */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-purple-500" />
              Supplier-Wise Breakdown
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                  <tr>
                    <th className="py-2.5 px-3">Supplier</th>
                    <th className="py-2.5 px-3 text-right">Bills Count</th>
                    <th className="py-2.5 px-3 text-right">Purchased (₹)</th>
                    <th className="py-2.5 px-3 text-right">Paid (₹)</th>
                    <th className="py-2.5 px-3 text-right">Returns (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {reportsData.bySupplier?.map((row: any) => (
                    <tr key={row.supplierId}>
                      <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white">
                        {row.supplierName}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-500">{row.billsCount}</td>
                      <td className="py-2 px-3 font-mono font-bold text-right text-purple-600 dark:text-purple-400">
                        {formatINR(row.purchasedAmount)}
                      </td>
                      <td className="py-2 px-3 font-mono text-right text-emerald-600">
                        {formatINR(row.paidAmount)}
                      </td>
                      <td className="py-2 px-3 font-mono text-right text-amber-600">
                        {formatINR(row.returnAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Material-wise breakdown table */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <ShoppingBag className="w-4 h-4 text-amber-500" />
              Material-Wise Purchases
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                  <tr>
                    <th className="py-2.5 px-3">Material Name</th>
                    <th className="py-2.5 px-3 text-right">Total Quantity</th>
                    <th className="py-2.5 px-3 text-right">Total Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {reportsData.byMaterial?.map((row: any, idx: number) => (
                    <tr key={idx}>
                      <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white">
                        {row.materialName}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        {row.totalQuantity} {row.unit}
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-right text-slate-900 dark:text-white">
                        {formatINR(row.totalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      <AddPurchaseBillModal
        isOpen={isBillModalOpen}
        onClose={() => setIsBillModalOpen(false)}
        onSuccess={() => {
          setSuccessMessage('Purchase bill saved successfully!');
          loadData();
        }}
        initialBill={editingBill}
      />

      <RecordSupplierPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSuccess={() => {
          setSuccessMessage('Supplier payment recorded successfully!');
          loadData();
        }}
        preSelectedSupplierId={preSelectedSupplierId}
        preSelectedBillId={preSelectedBillId}
      />

      <AddPurchaseReturnModal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        onSuccess={() => {
          setSuccessMessage('Purchase return recorded successfully!');
          loadData();
        }}
        preSelectedBill={returnBill}
      />

      {ledgerSupplierId && (
        <SupplierLedgerModal
          isOpen={isLedgerModalOpen}
          onClose={() => {
            setIsLedgerModalOpen(false);
            setLedgerSupplierId('');
          }}
          supplierId={ledgerSupplierId}
          onOpenNewBill={(supId) => {
            setIsLedgerModalOpen(false);
            setEditingBill(null);
            setIsBillModalOpen(true);
          }}
          onOpenNewPayment={(supId) => {
            setIsLedgerModalOpen(false);
            setPreSelectedSupplierId(supId);
            setPreSelectedBillId('');
            setIsPaymentModalOpen(true);
          }}
        />
      )}

      {/* Delete Confirmation Modal (with Mandatory Reason) */}
      <Modal
        isOpen={!!deletingItem}
        onClose={() => setDeletingItem(null)}
        title="Confirm Deletion"
        description="This action will soft-delete the record and update financial balances atomically."
        size="md"
      >
        <div className="space-y-4">
          {deleteError && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{deleteError}</span>
            </div>
          )}

          <p className="text-xs text-slate-600 dark:text-slate-300">
            Are you sure you want to delete <span className="font-bold">{deletingItem?.title}</span>?
          </p>

          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
              Reason for Deletion * (Mandatory for Audit Log)
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Duplicate entry, incorrect supplier selected"
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeletingItem(null)}
              disabled={isSubmittingDelete}
              className="text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isSubmittingDelete || !deleteReason.trim()}
              onClick={handleConfirmDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
            >
              {isSubmittingDelete ? 'Deleting...' : 'Confirm Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
