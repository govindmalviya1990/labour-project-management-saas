'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Building,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Loader2,
  AlertCircle,
  CreditCard,
} from 'lucide-react';
import { formatINR } from '@/lib/calculations';

interface BankAccountItem {
  id: string;
  name: string;
  bankName: string;
  accountLast4?: string | null;
  openingBalance: number;
  balance: number;
  totalInflow: number;
  totalOutflow: number;
  transactionCount: number;
  isActive: boolean;
}

interface BankAccountManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export function BankAccountManageModal({
  isOpen,
  onClose,
  onUpdated,
}: BankAccountManageModalProps) {
  const [accounts, setAccounts] = useState<BankAccountItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New account form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBankName, setNewBankName] = useState('');
  const [newLast4, setNewLast4] = useState('');
  const [newOpening, setNewOpening] = useState('0');
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editBankName, setEditBankName] = useState('');
  const [editLast4, setEditLast4] = useState('');

  const fetchAccounts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/finance/bank-accounts');
      if (!res.ok) throw new Error('Failed to load bank accounts');
      const data = await res.json();
      setAccounts(data.bankAccounts || []);
    } catch (err: any) {
      setError(err.message || 'Error loading bank accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAccounts();
      setShowAddForm(false);
      setEditingId(null);
    }
  }, [isOpen]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newBankName.trim()) {
      setError('Account name and bank name are required');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/finance/bank-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          bankName: newBankName.trim(),
          accountLast4: newLast4.trim() || null,
          openingBalance: parseFloat(newOpening) || 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create bank account');

      setNewName('');
      setNewBankName('');
      setNewLast4('');
      setNewOpening('0');
      setShowAddForm(false);
      fetchAccounts();
      onUpdated();
    } catch (err: any) {
      setError(err.message || 'Error adding bank account');
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = (acc: BankAccountItem) => {
    setEditingId(acc.id);
    setEditName(acc.name);
    setEditBankName(acc.bankName);
    setEditLast4(acc.accountLast4 || '');
  };

  const handleSaveEdit = async (id: string) => {
    try {
      const res = await fetch(`/api/finance/bank-accounts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          bankName: editBankName.trim(),
          accountLast4: editLast4.trim() || null,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to update account');
      }

      setEditingId(null);
      fetchAccounts();
      onUpdated();
    } catch (err: any) {
      alert(err.message || 'Update failed');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove bank account "${name}"?`)) return;

    try {
      const res = await fetch(`/api/finance/bank-accounts/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to delete account');
      }
      fetchAccounts();
      onUpdated();
    } catch (err: any) {
      alert(err.message || 'Delete failed');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Company Bank Accounts"
      description="View, add, and manage company bank accounts. Balances are dynamically derived from transactions."
      size="lg"
    >
      <div className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 text-sm text-rose-400 bg-rose-950/40 border border-rose-800 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Top Action Bar */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400">
            Registered Bank Accounts ({accounts.length})
          </span>
          {!showAddForm && (
            <Button
              size="sm"
              onClick={() => setShowAddForm(true)}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              + Add Bank Account
            </Button>
          )}
        </div>

        {/* Add Account Inline Form */}
        {showAddForm && (
          <form
            onSubmit={handleCreate}
            className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-amber-500/30 space-y-3"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Building className="w-4 h-4 text-amber-500" />
                New Bank Account Details
              </span>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Account Nickname (e.g. HDFC Current) *
                </label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Main Operations Account"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Bank Name *
                </label>
                <Input
                  value={newBankName}
                  onChange={(e) => setNewBankName(e.target.value)}
                  placeholder="e.g. HDFC Bank, ICICI Bank, SBI"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Last 4 Digits of Account No. (Optional)
                </label>
                <Input
                  maxLength={4}
                  value={newLast4}
                  onChange={(e) => setNewLast4(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 4821"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Opening Balance (₹)
                </label>
                <Input
                  type="number"
                  step="any"
                  value={newOpening}
                  onChange={(e) => setNewOpening(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                Save Bank Account
              </Button>
            </div>
          </form>
        )}

        {/* Bank Accounts List */}
        {loading ? (
          <div className="flex items-center justify-center py-10 text-slate-400 text-xs">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Loading accounts...
          </div>
        ) : accounts.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-800 rounded-xl">
            No bank accounts configured yet. Add your first bank account to track overall money position.
          </div>
        ) : (
          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {accounts.map((acc) => {
              const isEditing = editingId === acc.id;
              return (
                <div
                  key={acc.id}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20 shrink-0">
                      <CreditCard className="w-4 h-4" />
                    </div>

                    {isEditing ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Account Name"
                          className="h-8 text-xs w-36"
                        />
                        <Input
                          value={editBankName}
                          onChange={(e) => setEditBankName(e.target.value)}
                          placeholder="Bank Name"
                          className="h-8 text-xs w-32"
                        />
                        <Input
                          maxLength={4}
                          value={editLast4}
                          onChange={(e) => setEditLast4(e.target.value.replace(/\D/g, ''))}
                          placeholder="Last 4"
                          className="h-8 text-xs w-20"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(acc.id)}
                          className="p-1.5 text-emerald-400 hover:text-emerald-300 rounded hover:bg-slate-800"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="p-1.5 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900 dark:text-white">
                            {acc.name}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                            {acc.bankName} {acc.accountLast4 ? `(***${acc.accountLast4})` : ''}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          Opening: {formatINR(acc.openingBalance)} • {acc.transactionCount} entries
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-slate-800">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                        Live Balance
                      </span>
                      <span className="text-sm sm:text-base font-extrabold text-blue-600 dark:text-blue-400">
                        {formatINR(acc.balance)}
                      </span>
                    </div>

                    {!isEditing && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(acc)}
                          className="p-1.5 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-200 dark:hover:bg-slate-800"
                          title="Edit Account"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(acc.id, acc.name)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-200 dark:hover:bg-slate-800"
                          title="Remove Account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
