'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search, Check, Plus, Loader2, AlertCircle, X } from 'lucide-react';

export interface PurposeItem {
  id: string;
  name: string;
  type: string;
  isSystem: boolean;
}

interface SearchablePurposeSelectProps {
  type: 'TRANSFER' | 'EXPENSE';
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
}

export function SearchablePurposeSelect({
  type,
  value,
  onChange,
  label = 'Purpose / Reason',
  required = false,
  placeholder = 'Select purpose...',
  className = '',
}: SearchablePurposeSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [reasons, setReasons] = useState<PurposeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newReasonName, setNewReasonName] = useState('');
  const [savingNew, setSavingNew] = useState(false);
  const [addError, setAddError] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const newReasonInputRef = useRef<HTMLInputElement>(null);

  // Fetch reasons from backend
  const fetchReasons = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reasons?type=${type}`);
      if (res.ok) {
        const data = await res.json();
        setReasons(data.reasons || []);
      }
    } catch (e) {
      console.error('Failed to fetch purpose options:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReasons();
  }, [type]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsAddingNew(false);
        setAddError('');
        setSearch('');
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search when dropdown opens
  useEffect(() => {
    if (isOpen && !isAddingNew) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, isAddingNew]);

  // Focus new reason input when adding
  useEffect(() => {
    if (isAddingNew) {
      setTimeout(() => {
        newReasonInputRef.current?.focus();
      }, 50);
    }
  }, [isAddingNew]);

  const handleSelect = (item: PurposeItem) => {
    onChange(item.name);
    setIsOpen(false);
    setSearch('');
    setIsAddingNew(false);
    setAddError('');
  };

  const handleSaveNewReason = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    const trimmed = newReasonName.trim();

    if (!trimmed || trimmed.length < 2 || trimmed.length > 50) {
      setAddError('Reason name must be 2 to 50 characters');
      return;
    }

    setSavingNew(true);
    try {
      const res = await fetch('/api/reasons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, type }),
      });

      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error || 'Failed to save reason');
        setSavingNew(false);
        return;
      }

      const created = data.reason;
      setReasons((prev) => [...prev, created]);
      onChange(created.name);
      setNewReasonName('');
      setIsAddingNew(false);
      setIsOpen(false);
      setSearch('');
    } catch (err: any) {
      setAddError(err.message || 'Error saving reason');
    } finally {
      setSavingNew(false);
    }
  };

  // Find display text for currently selected value
  // Checks by exact match or normalized matching
  const selectedItem = reasons.find(
    (r) =>
      r.name.toLowerCase() === (value || '').toLowerCase() ||
      (r.name === 'Worker Advance' && value === 'ADVANCE') ||
      (r.name === 'Salary Payout' && value === 'SALARY') ||
      (r.name === 'Site Daily Expenses & Petty Cash' && value === 'SITE_EXPENSE') ||
      (r.name === 'Partner Drawing' && value === 'PERSONAL_DRAWING') ||
      (r.name === 'Internal Settlement' && value === 'SETTLEMENT') ||
      (r.name === 'Other' && value === 'OTHER')
  );

  const displayText = selectedItem ? selectedItem.name : value || placeholder;

  // Filter reasons by search query
  const filteredReasons = reasons.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
          {label} {required && <span className="text-rose-400">*</span>}
        </label>
      )}

      {/* Main Trigger Button with Large Mobile Touch Target */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full min-h-[44px] h-11 sm:h-10 px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 flex items-center justify-between text-left text-sm focus:outline-none focus:border-amber-500 hover:border-slate-600 transition-colors"
      >
        <span className={`truncate ${!value ? 'text-slate-500' : 'text-slate-100 font-medium'}`}>
          {displayText}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 ml-2 shrink-0 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Search Box */}
          <div className="p-2 border-b border-slate-800 bg-slate-950 flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search or type reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-sm text-slate-200 placeholder-slate-500 focus:outline-none h-8 px-1"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-slate-400 hover:text-slate-200 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Options List with High-Touch Target Items */}
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/50 p-1">
            {loading && reasons.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                <span>Loading reasons...</span>
              </div>
            ) : filteredReasons.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                No matching reason found
              </div>
            ) : (
              filteredReasons.map((item) => {
                const isSelected =
                  (value || '').toLowerCase() === item.name.toLowerCase() ||
                  (item.name === 'Worker Advance' && value === 'ADVANCE') ||
                  (item.name === 'Salary Payout' && value === 'SALARY') ||
                  (item.name === 'Site Daily Expenses & Petty Cash' && value === 'SITE_EXPENSE') ||
                  (item.name === 'Partner Drawing' && value === 'PERSONAL_DRAWING') ||
                  (item.name === 'Internal Settlement' && value === 'SETTLEMENT') ||
                  (item.name === 'Other' && value === 'OTHER');

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item)}
                    className={`w-full min-h-[44px] px-3.5 py-2.5 text-left text-sm rounded-lg flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-amber-500/20 text-amber-300 font-semibold'
                        : 'text-slate-200 hover:bg-slate-800/80 active:bg-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="truncate">{item.name}</span>
                      {item.isSystem && (
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 shrink-0">
                          System
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-amber-400 shrink-0 ml-2" />}
                  </button>
                );
              })
            )}
          </div>

          {/* Bottom Section: "+ Add New Reason" or Inline Add Input */}
          <div className="p-2 border-t border-slate-800 bg-slate-950/80">
            {!isAddingNew ? (
              <button
                type="button"
                onClick={() => {
                  setIsAddingNew(true);
                  setNewReasonName(search.trim());
                  setAddError('');
                }}
                className="w-full min-h-[44px] px-3 py-2 text-sm font-semibold rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>+ Add New Reason</span>
              </button>
            ) : (
              <form onSubmit={handleSaveNewReason} className="space-y-2 p-1">
                <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Add New Reason ({type === 'TRANSFER' ? 'Give Money' : 'Expense'})</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingNew(false);
                      setAddError('');
                    }}
                    className="text-slate-400 hover:text-slate-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {addError && (
                  <div className="flex items-center gap-1.5 p-2 bg-rose-500/10 border border-rose-500/30 rounded text-rose-400 text-xs">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{addError}</span>
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    ref={newReasonInputRef}
                    type="text"
                    required
                    minLength={2}
                    maxLength={50}
                    placeholder="e.g. Dinner, Tool Rent..."
                    value={newReasonName}
                    onChange={(e) => setNewReasonName(e.target.value)}
                    className="flex-1 min-h-[40px] px-3 text-sm rounded-lg bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="submit"
                    disabled={savingNew}
                    className="min-h-[40px] px-4 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-1 shrink-0 transition-colors disabled:opacity-50"
                  >
                    {savingNew ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    Save
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
