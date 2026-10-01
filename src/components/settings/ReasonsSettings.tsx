'use client';

import React, { useState, useEffect } from 'react';
import { Tag, Plus, Pencil, Trash2, Check, X, Loader2, AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface PurposeOptionItem {
  id: string;
  name: string;
  type: string;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
}

export function ReasonsSettings() {
  const [activeTab, setActiveTab] = useState<'TRANSFER' | 'EXPENSE'>('TRANSFER');
  const [reasons, setReasons] = useState<PurposeOptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string>('OWNER');

  // Add state
  const [newName, setNewName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editError, setEditError] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchSession();
  }, []);

  useEffect(() => {
    fetchReasons();
  }, [activeTab]);

  const fetchSession = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setCurrentUserRole(data.user?.role || 'OWNER');
      }
    } catch (e) {
      console.error('Failed to fetch user session:', e);
    }
  };

  const fetchReasons = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reasons?type=${activeTab}`);
      if (res.ok) {
        const data = await res.json();
        setReasons(data.reasons || []);
      }
    } catch (e) {
      console.error('Failed to fetch reasons:', e);
    } finally {
      setLoading(false);
    }
  };

  const isOwnerOrPartner = ['OWNER', 'PARTNER', 'MANAGER'].includes(
    currentUserRole.toUpperCase()
  );

  const handleAddReason = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    setAddSuccess('');

    const trimmed = newName.trim();
    if (!trimmed || trimmed.length < 2 || trimmed.length > 50) {
      setAddError('Reason name must be 2 to 50 characters');
      return;
    }

    setIsAdding(true);
    try {
      const res = await fetch('/api/reasons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, type: activeTab }),
      });

      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error || 'Failed to add reason');
        setIsAdding(false);
        return;
      }

      setAddSuccess(`Reason "${trimmed}" created successfully!`);
      setNewName('');
      setTimeout(() => setAddSuccess(''), 3000);
      fetchReasons();
    } catch (err: any) {
      setAddError(err.message || 'Error creating reason');
    } finally {
      setIsAdding(false);
    }
  };

  const handleStartEdit = (item: PurposeOptionItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditError('');
  };

  const handleSaveEdit = async (id: string) => {
    setEditError('');
    const trimmed = editName.trim();
    if (!trimmed || trimmed.length < 2 || trimmed.length > 50) {
      setEditError('Reason name must be 2 to 50 characters');
      return;
    }

    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/reasons/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });

      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error || 'Failed to update reason');
        setIsSavingEdit(false);
        return;
      }

      setEditingId(null);
      fetchReasons();
    } catch (err: any) {
      setEditError(err.message || 'Error updating reason');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (
      !confirm(
        `Are you sure you want to delete reason "${name}"? Previous transactions with this reason will still retain their label.`
      )
    ) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/reasons/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to delete reason');
        return;
      }
      fetchReasons();
    } catch (e: any) {
      alert(e.message || 'Error deleting reason');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <div>
        <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2 pb-1">
          <Tag className="w-4 h-4 text-amber-400" /> Custom Reasons &amp; Categories
        </h2>
        <p className="text-xs text-slate-400">
          Manage purpose reasons for Give Money transfers and Daily Expense entries. System reasons are protected for financial integrity.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('TRANSFER')}
          className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'TRANSFER'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          💸 Give Money (Transfer Reasons)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('EXPENSE')}
          className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'EXPENSE'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          🧾 Daily Expenses (Categories)
        </button>
      </div>

      {/* Add New Reason Form */}
      <form onSubmit={handleAddReason} className="space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={`Add new ${activeTab === 'TRANSFER' ? 'transfer' : 'expense'} reason (e.g. Dinner, Site Tools)...`}
              minLength={2}
              maxLength={50}
              required
            />
          </div>
          <Button
            type="submit"
            disabled={isAdding}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shrink-0"
          >
            {isAdding ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
            ) : (
              <Plus className="w-4 h-4 mr-1.5" />
            )}
            Add Reason
          </Button>
        </div>

        {addError && (
          <div className="flex items-center gap-1.5 p-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg text-xs">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{addError}</span>
          </div>
        )}

        {addSuccess && (
          <div className="flex items-center gap-1.5 p-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>{addSuccess}</span>
          </div>
        )}
      </form>

      {/* Reasons List */}
      <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/60 divide-y divide-slate-800">
        {loading ? (
          <div className="p-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
            <span>Loading reasons...</span>
          </div>
        ) : reasons.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            No reasons found.
          </div>
        ) : (
          reasons.map((item) => {
            const isEditing = editingId === item.id;

            return (
              <div
                key={item.id}
                className="p-3 flex items-center justify-between gap-3 text-xs"
              >
                {isEditing ? (
                  <div className="flex-1 flex flex-col sm:flex-row items-start sm:items-center gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      minLength={2}
                      maxLength={50}
                      className="flex-1 min-h-[36px] px-2.5 bg-slate-900 border border-slate-700 rounded-md text-slate-100 text-xs focus:outline-none focus:border-amber-500"
                    />
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(item.id)}
                        disabled={isSavingEdit}
                        className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-md flex items-center gap-1"
                      >
                        {isSavingEdit ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Check className="w-3 h-3" />
                        )}
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setEditError('');
                        }}
                        className="px-2 py-1.5 text-slate-400 hover:text-slate-200"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {editError && (
                      <span className="text-[11px] text-rose-400">{editError}</span>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-semibold text-slate-200 truncate">
                        {item.name}
                      </span>
                      {item.isSystem ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                          <Lock className="w-2.5 h-2.5" /> System Fixed
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          Custom
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {item.isSystem ? (
                        <span className="text-[11px] text-slate-500 italic pr-1">
                          Protected
                        </span>
                      ) : (
                        <>
                          {isOwnerOrPartner && (
                            <button
                              type="button"
                              onClick={() => handleStartEdit(item)}
                              title="Rename reason"
                              className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-md transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isOwnerOrPartner && (
                            <button
                              type="button"
                              onClick={() => handleDelete(item.id, item.name)}
                              disabled={deletingId === item.id}
                              title="Delete reason"
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-md transition-colors"
                            >
                              {deletingId === item.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                          {!isOwnerOrPartner && (
                            <span className="text-[10px] text-slate-500">
                              Active
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
