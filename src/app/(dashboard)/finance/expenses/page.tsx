'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Receipt,
  Plus,
  Edit2,
  Trash2,
  IndianRupee,
  RefreshCw,
  Building2,
  AlertTriangle,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { ExpenseFormModal } from '@/components/finance/ExpenseFormModal';
import { formatINR } from '@/lib/calculations';
import { clsx } from 'clsx';

export default function ExpensesPage() {
  const searchParams = useSearchParams();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({
    totalRecords: 0,
    totalAmount: 0,
    categoryTotals: {},
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [deletingExpense, setDeletingExpense] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setIsModalOpen(true);
    }
  }, [searchParams]);

  const fetchExpenses = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const url =
        selectedCategory && selectedCategory !== 'ALL'
          ? `/api/finance/expenses?category=${selectedCategory}`
          : '/api/finance/expenses';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load expenses');
      const data = await res.json();
      setExpenses(data.expenses || []);
      setSummary(data.summary || {});
    } catch (err: any) {
      setError(err.message || 'Error fetching expenses');
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const handleDeleteConfirm = async () => {
    if (!deletingExpense) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/finance/expenses/${deletingExpense.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to archive expense');
      setDeletingExpense(null);
      fetchExpenses();
    } catch (err: any) {
      alert(err.message || 'Error deleting expense');
    } finally {
      setIsDeleting(false);
    }
  };

  const categories = [
    'ALL',
    'FUEL',
    'EQUIPMENT',
    'TRANSPORT',
    'FOOD',
    'MATERIAL',
    'RENT',
    'ELECTRICITY',
    'LABOUR',
    'MISCELLANEOUS',
    'OTHER',
  ];

  const columns: Column<any>[] = [
    {
      header: 'Date',
      cell: (item) => (
        <span className="font-mono text-xs text-slate-400">
          {new Date(item.date).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: 'Category',
      cell: (item) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-200 border border-slate-700">
          {item.category}
        </span>
      ),
    },
    {
      header: 'Description / Details',
      cell: (item) => (
        <div className="text-xs">
          <p className="font-semibold text-white">{item.description}</p>
          <div className="flex items-center gap-2 mt-0.5 text-slate-400 text-[11px]">
            {item.vendorName && <span>Vendor: {item.vendorName}</span>}
            {item.paidBy && (
              <>
                <span>•</span>
                <span>Paid by: {item.paidBy}</span>
              </>
            )}
            <span>•</span>
            <span className="uppercase">{item.paymentMethod}</span>
          </div>
        </div>
      ),
    },
    {
      header: 'Project / Site',
      cell: (item) => (
        <div className="text-xs text-slate-300">
          <p className="font-medium text-amber-400">{item.project?.name || 'General Overhead'}</p>
          {item.site?.name && <p className="text-[11px] text-slate-500">Site: {item.site.name}</p>}
        </div>
      ),
    },
    {
      header: 'Amount',
      className: 'text-right',
      cell: (item) => (
        <div className="text-right font-bold text-sm text-rose-400">
          {formatINR(item.amount)}
        </div>
      ),
    },
    {
      header: 'Actions',
      className: 'text-right',
      cell: (item) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-slate-400 hover:text-white"
            onClick={() => {
              setEditingExpense(item);
              setIsModalOpen(true);
            }}
            title="Edit Expense"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-slate-400 hover:text-rose-400"
            onClick={() => setDeletingExpense(item)}
            title="Archive Expense"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 text-amber-500" />
            Site & Project Expenses
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Record direct site costs (Fuel, Transport, Equipment Rent, Materials) updating actual project costs
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" onClick={fetchExpenses} isLoading={isLoading}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Refresh
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setEditingExpense(null);
              setIsModalOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Expense
          </Button>
        </div>
      </div>

      {/* KPI Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Total Site Expenses
          </p>
          <p className="mt-1 text-2xl font-bold text-rose-400">
            {formatINR(summary.totalAmount)}
          </p>
        </div>
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
            Fuel & Equipment Rent
          </p>
          <p className="mt-1 text-2xl font-bold text-amber-400">
            {formatINR(
              (summary.categoryTotals?.FUEL || 0) + (summary.categoryTotals?.EQUIPMENT || 0)
            )}
          </p>
        </div>
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl col-span-2 sm:col-span-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Total Expense Vouchers
          </p>
          <p className="mt-1 text-2xl font-bold text-white">{summary.totalRecords || 0}</p>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-800/80 scrollbar-none">
        {categories.map((cat) => {
          const total = cat === 'ALL' ? summary.totalAmount : summary.categoryTotals?.[cat] || 0;
          const isActive = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors',
                isActive
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              )}
            >
              <span>{cat}</span>
              {total > 0 && (
                <span
                  className={clsx(
                    'px-1.5 py-0.2 rounded-full text-[10px] font-bold',
                    isActive ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-400'
                  )}
                >
                  {formatINR(total)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* DataTable */}
      <DataTable
        data={expenses}
        columns={columns}
        keyExtractor={(e) => e.id}
        searchPlaceholder="Search expense description, vendor, or paid by..."
        emptyTitle="No expenses recorded"
        emptyDescription="Record site expenses (fuel, machinery, transport) to track real project costs."
        emptyActionLabel="Record First Expense"
        onEmptyAction={() => {
          setEditingExpense(null);
          setIsModalOpen(true);
        }}
      />

      {/* Expense Modal */}
      <ExpenseFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchExpenses}
        initialData={editingExpense}
      />

      {/* Delete Confirmation Modal (Prompt Section 60) */}
      <Modal
        isOpen={Boolean(deletingExpense)}
        onClose={() => setDeletingExpense(null)}
        title="Archive Expense Record"
        description="Are you sure you want to delete this record? This will affect project cost and financial reports."
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>
              Expense: <strong>{deletingExpense?.description}</strong> ({formatINR(deletingExpense?.amount)})
            </span>
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <Button variant="outline" size="sm" onClick={() => setDeletingExpense(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" isLoading={isDeleting} onClick={handleDeleteConfirm}>
              Confirm Deletion
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
