'use client';

import React, { useState, useEffect } from 'react';
import {
  Building2,
  FileText,
  Calendar,
  CreditCard,
  Printer,
  Download,
  AlertCircle,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  ShoppingBag,
  RotateCcw,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { formatINR } from '@/lib/calculations';

interface SupplierLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplierId: string;
  onOpenNewBill?: (supplierId: string) => void;
  onOpenNewPayment?: (supplierId: string) => void;
}

export function SupplierLedgerModal({
  isOpen,
  onClose,
  supplierId,
  onOpenNewBill,
  onOpenNewPayment,
}: SupplierLedgerModalProps) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchStatement = async () => {
    if (!supplierId) return;
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/purchases/suppliers/${supplierId}`);
      if (!res.ok) {
        throw new Error('Failed to load supplier statement');
      }
      const d = await res.json();
      setData(d);
    } catch (err: any) {
      setError(err.message || 'Error loading statement');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && supplierId) {
      fetchStatement();
    }
  }, [isOpen, supplierId]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!data || !data.statement) return;
    const headers = ['Date', 'Type', 'Reference', 'Description', 'Purchased / Due (Debit)', 'Paid (Credit)', 'Running Balance'];
    const rows = data.statement.map((s: any) => [
      `"${s.date}"`,
      `"${s.type}"`,
      `"${s.reference || ''}"`,
      `"${(s.description || '').replace(/"/g, '""')}"`,
      s.debit || 0,
      s.credit || 0,
      s.balance || 0,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Supplier_Ledger_${data.supplier?.name || 'Statement'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const supplier = data?.supplier;
  const summary = data?.summary;
  const aging = data?.aging;
  const statement = data?.statement || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={supplier ? `${supplier.name} - Ledger & Statement` : 'Supplier Ledger'}
      description="Complete running-balance statement, bills, returns, and payments history"
      size="2xl"
    >
      <div className="space-y-4">
        {isLoading && (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <RefreshCw className="w-6 h-6 text-purple-500 animate-spin mb-2" />
            <p className="text-xs font-semibold text-slate-500">Loading supplier ledger statement...</p>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!isLoading && supplier && summary && (
          <>
            {/* 1. Supplier Header Card */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-purple-500" />
                    {supplier.name}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      summary.remainingBalance <= 0
                        ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                    }`}
                  >
                    {summary.status}
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                  {supplier.mobile && <span>Mobile: {supplier.mobile}</span>}
                  {supplier.gstNumber && <span>GST: {supplier.gstNumber}</span>}
                  {supplier.address && <span>Address: {supplier.address}</span>}
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleExportCSV}
                  className="text-xs font-bold flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" /> CSV Export
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                  className="text-xs font-bold flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" /> Print
                </Button>
              </div>
            </div>

            {/* 2. Key Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Purchased</span>
                <span className="text-sm font-black font-mono text-slate-900 dark:text-white">
                  {formatINR(summary.totalBills)}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Bills: {data.billsCount || 0}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Paid</span>
                <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                  {formatINR(summary.totalPayments)}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Payments: {data.paymentsCount || 0}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Returns</span>
                <span className="text-sm font-black font-mono text-amber-600 dark:text-amber-400">
                  {formatINR(summary.totalReturns)}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Returns: {data.returnsCount || 0}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <span className="text-[10px] uppercase font-bold text-purple-700 dark:text-purple-300 block">
                  Remaining Balance
                </span>
                <span className="text-base font-black font-mono text-purple-700 dark:text-purple-300">
                  {formatINR(summary.remainingBalance)}
                </span>
                <span className="text-[10px] text-purple-600/80 dark:text-purple-400/80 block mt-0.5">
                  {summary.remainingBalance > 0 ? 'We Owe Supplier' : summary.remainingBalance < 0 ? 'Supplier Advance' : 'Settled'}
                </span>
              </div>
            </div>

            {/* 3. Aging Breakdown Cards (0-30, 31-60, 61-90, 90+ days) */}
            {aging && summary.remainingBalance > 0 && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-purple-500" />
                  Bill Aging Breakdown (Unpaid Age)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                    <span className="text-[10px] font-bold text-slate-500 block">0 - 30 Days</span>
                    <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                      {formatINR(aging.bracket0To30)}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                    <span className="text-[10px] font-bold text-slate-500 block">31 - 60 Days</span>
                    <span className="text-xs font-mono font-bold text-amber-600">
                      {formatINR(aging.bracket31To60)}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                    <span className="text-[10px] font-bold text-slate-500 block">61 - 90 Days</span>
                    <span className="text-xs font-mono font-bold text-orange-600">
                      {formatINR(aging.bracket61To90)}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                    <span className="text-[10px] font-bold text-slate-500 block">90+ Days</span>
                    <span className="text-xs font-mono font-bold text-rose-600">
                      {formatINR(aging.bracket90Plus)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 4. Chronological Running-Balance Statement Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Running-Balance Statement ({statement.length} entries)
                </span>
                <div className="flex items-center gap-2">
                  {onOpenNewBill && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => onOpenNewBill(supplier.id)}
                      className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-1"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> New Bill
                    </Button>
                  )}
                  {onOpenNewPayment && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => onOpenNewPayment(supplier.id)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-1"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Pay Supplier
                    </Button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-bold sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Ref / Bill #</th>
                      <th className="py-2.5 px-3">Particulars / Description</th>
                      <th className="py-2.5 px-3 text-right">Debit (+)</th>
                      <th className="py-2.5 px-3 text-right">Credit (-)</th>
                      <th className="py-2.5 px-3 text-right">Balance (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {statement.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-400">
                          No transactions recorded for this supplier yet.
                        </td>
                      </tr>
                    ) : (
                      statement.map((item: any) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                          <td className="py-2 px-3 whitespace-nowrap text-slate-500">
                            {new Date(item.date).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                item.type === 'BILL'
                                  ? 'bg-purple-500/10 text-purple-600'
                                  : item.type === 'PAYMENT'
                                  ? 'bg-emerald-500/10 text-emerald-600'
                                  : item.type === 'RETURN'
                                  ? 'bg-amber-500/10 text-amber-600'
                                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600'
                              }`}
                            >
                              {item.type}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                            {item.reference || '-'}
                          </td>
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                            {item.description}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-right text-purple-600 dark:text-purple-400">
                            {item.debit > 0 ? formatINR(item.debit) : '-'}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-right text-emerald-600 dark:text-emerald-400">
                            {item.credit > 0 ? formatINR(item.credit) : '-'}
                          </td>
                          <td className="py-2 px-3 font-mono font-black text-right text-slate-900 dark:text-white">
                            {formatINR(item.balance)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="text-xs font-semibold"
          >
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
