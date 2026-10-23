'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Wallet,
  Building2,
  FolderKanban,
  Users,
  Receipt,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Folder,
  Send,
  ArrowLeft,
  RefreshCw,
  Loader2,
  Sparkles,
  Tag,
  X,
  FileText,
} from 'lucide-react';
import { formatINR } from '@/lib/calculations';

export interface SiteFolderWorkerItem {
  id: string;
  workerId: string;
  workerName: string;
  workerCode?: string;
  category: string;
  amount: number;
  remarks?: string;
}

export interface SiteFolderExpenseItem {
  id: string;
  category: string;
  description: string;
  vendor?: string;
  amount: number;
}

export interface SiteFolder {
  id: string;
  projectId?: string;
  siteId?: string;
  projectName: string;
  siteName: string;
  workers: SiteFolderWorkerItem[];
  expenses: SiteFolderExpenseItem[];
}

const STORAGE_KEY = 'multisite_send_money_draft_v1';

const DEFAULT_EXPENSE_CATEGORIES = [
  'Site Materials / Hardware',
  'Dinner',
  'Petrol',
  'Fuel & Travel',
  'Food & Refreshments',
  'Tools & Equipment',
  'Site Maintenance & Repairs',
  'Worker Food & Tea',
  'Office & Printing',
  'Logistics & Transport',
  'Labour Wages / Kharcha',
  'Miscellaneous',
];

const DEFAULT_WORKER_REASONS = [
  'Salary / Wages',
  'Labour Advance',
  'Worker Food & Tea (Kharcha)',
  'Worker Travel / Petrol',
  'Worker Emergency / Medical',
  'Worker Grocery',
];

export function MultiSiteSendMoney() {
  const router = useRouter();

  // Data State from Backend
  const [isLoading, setIsLoading] = useState(true);
  const [partners, setPartners] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [purposeOptions, setPurposeOptions] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  // Source Selection
  const [sourceType, setSourceType] = useState<'PARTNER' | 'BANK'>('PARTNER');
  const [sourceId, setSourceId] = useState<string>('');
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [batchReference, setBatchReference] = useState<string>('');

  // Site Builder State (Current Active Site before packaging)
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [builderTab, setBuilderTab] = useState<'WORKER' | 'EXPENSE'>('WORKER');

  // Active Site Items
  const [currentSiteWorkers, setCurrentSiteWorkers] = useState<SiteFolderWorkerItem[]>([]);
  const [currentSiteExpenses, setCurrentSiteExpenses] = useState<SiteFolderExpenseItem[]>([]);
  const [siteBuilderError, setSiteBuilderError] = useState<string>('');

  // Active Worker Input
  const [workerInputId, setWorkerInputId] = useState<string>('');
  const [workerReasonSelect, setWorkerReasonSelect] = useState<string>('Salary / Wages');
  const [customWorkerReason, setCustomWorkerReason] = useState<string>('');
  const [workerAmountInput, setWorkerAmountInput] = useState<string>('');
  const [workerRemarksInput, setWorkerRemarksInput] = useState<string>('');
  const [isSavingCustomWorkerReason, setIsSavingCustomWorkerReason] = useState(false);
  const [customWorkerReasonError, setCustomWorkerReasonError] = useState('');

  // Active Expense Input
  const [expenseCategorySelect, setExpenseCategorySelect] = useState<string>('Site Materials / Hardware');
  const [customCategoryName, setCustomCategoryName] = useState<string>('');
  const [expenseDescriptionInput, setExpenseDescriptionInput] = useState<string>('');
  const [expenseVendorInput, setExpenseVendorInput] = useState<string>('');
  const [expenseAmountInput, setExpenseAmountInput] = useState<string>('');
  const [isSavingCustomCategory, setIsSavingCustomCategory] = useState(false);
  const [customCategoryError, setCustomCategoryError] = useState('');

  // Packaged Folders
  const [siteFolders, setSiteFolders] = useState<SiteFolder[]>([]);
  const [expandedFolderId, setExpandedFolderId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);

  // Draft banner notification
  const [hasDraftNotice, setHasDraftNotice] = useState<boolean>(false);
  const [draftNoticeCount, setDraftNoticeCount] = useState<number>(0);

  // Submit State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>('');
  const [submitSuccess, setSubmitSuccess] = useState<string>('');

  // Fetch Core Reference Data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/finance/partner-hisaab?period=today');
      if (res.ok) {
        const data = await res.json();
        setPartners(data.partners || []);
        setBankAccounts(data.bankAccounts || []);
        setProjects(data.projects || []);
        setWorkers(data.workers || []);
        setPurposeOptions(data.purposeOptions || []);
        if (data.currentUserId) setCurrentUserId(data.currentUserId);

        // Smart default for sourceId
        if (!sourceId) {
          const selfPartner = (data.partners || []).find((p: any) => p.id === data.currentUserId);
          if (selfPartner) {
            setSourceId(selfPartner.id);
            setSourceType('PARTNER');
          } else if (data.partners && data.partners.length > 0) {
            setSourceId(data.partners[0].id);
          }
        }
      }
    } catch (e) {
      console.error('Failed to load partner hisaab reference data:', e);
    } finally {
      setIsLoading(false);
    }
  }, [sourceId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Check LocalStorage Draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.folders) && parsed.folders.length > 0) {
          setHasDraftNotice(true);
          setDraftNoticeCount(parsed.folders.length);
        }
      }
    } catch (e) {
      // ignore
    }
  }, []);

  // Save to LocalStorage whenever folders change
  useEffect(() => {
    try {
      if (siteFolders.length > 0) {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            sourceType,
            sourceId,
            date,
            paymentMethod,
            folders: siteFolders,
            savedAt: new Date().toISOString(),
          })
        );
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      // ignore
    }
  }, [siteFolders, sourceType, sourceId, date, paymentMethod]);

  // Restore Draft
  const handleRestoreDraft = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.folders && Array.isArray(parsed.folders)) {
          setSiteFolders(parsed.folders);
          if (parsed.sourceType) setSourceType(parsed.sourceType);
          if (parsed.sourceId) setSourceId(parsed.sourceId);
          if (parsed.date) setDate(parsed.date);
          if (parsed.paymentMethod) setPaymentMethod(parsed.paymentMethod);
          setHasDraftNotice(false);
        }
      }
    } catch (e) {
      console.error('Failed to restore draft:', e);
    }
  };

  // Discard Draft
  const handleDiscardDraft = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setHasDraftNotice(false);
    } catch (e) {
      // ignore
    }
  };

  // Available Categories derivation
  const availableExpenseCategories = useMemo(() => {
    const customCats = purposeOptions.filter((p) => p.type === 'EXPENSE').map((p) => p.name);
    return Array.from(new Set([...DEFAULT_EXPENSE_CATEGORIES, ...customCats]));
  }, [purposeOptions]);

  const availableWorkerReasons = useMemo(() => {
    const customReasons = purposeOptions
      .filter((p) => p.type === 'TRANSFER' || p.type === 'EXPENSE')
      .map((p) => p.name);
    return Array.from(new Set([...DEFAULT_WORKER_REASONS, ...customReasons]));
  }, [purposeOptions]);

  // Source Available Balance
  const sourceAvailableBalance = useMemo(() => {
    if (sourceType === 'PARTNER') {
      const p = partners.find((x) => x.id === sourceId);
      return p?.currentBalance ?? 0;
    } else {
      const b = bankAccounts.find((x) => x.id === sourceId);
      return b?.balance ?? 0;
    }
  }, [sourceType, sourceId, partners, bankAccounts]);

  // Selected project details
  const currentProject = useMemo(() => {
    return projects.find((p) => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  const currentSite = useMemo(() => {
    if (!currentProject) return null;
    return currentProject.sites?.find((s: any) => s.id === selectedSiteId) || null;
  }, [currentProject, selectedSiteId]);

  // Grand Total Calculation
  const grandTotal = useMemo(() => {
    let sum = 0;
    for (const folder of siteFolders) {
      for (const w of folder.workers) sum += w.amount;
      for (const e of folder.expenses) sum += e.amount;
    }
    // Also include current builder un-packaged items if any
    for (const w of currentSiteWorkers) sum += w.amount;
    for (const e of currentSiteExpenses) sum += e.amount;
    return Math.round(sum * 100) / 100;
  }, [siteFolders, currentSiteWorkers, currentSiteExpenses]);

  const remainingBalance = Math.round((sourceAvailableBalance - grandTotal) * 100) / 100;
  const isBalanceExceeded = grandTotal > sourceAvailableBalance;

  // Custom Category Save Handlers
  const handleSaveCustomExpenseCategory = async () => {
    const trimmed = customCategoryName.trim();
    setCustomCategoryError('');
    if (!trimmed || trimmed.length < 2 || trimmed.length > 50) {
      setCustomCategoryError('Category name must be between 2 and 50 characters.');
      return;
    }
    const existing = availableExpenseCategories.find((c) => c.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      setExpenseCategorySelect(existing);
      setCustomCategoryName('');
      return;
    }

    setIsSavingCustomCategory(true);
    try {
      const res = await fetch('/api/reasons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, type: 'EXPENSE' }),
      });
      const data = await res.json();
      if (!res.ok && !data.error?.includes('already exists')) {
        throw new Error(data.error || 'Failed to save custom category');
      }
      const created = data.reason || { id: `custom_${Date.now()}`, name: trimmed, type: 'EXPENSE' };
      setPurposeOptions((prev) => [...prev, created]);
      setExpenseCategorySelect(created.name);
      setCustomCategoryName('');
    } catch (err: any) {
      setCustomCategoryError(err.message || 'Error saving category');
    } finally {
      setIsSavingCustomCategory(false);
    }
  };

  const handleSaveCustomWorkerReason = async () => {
    const trimmed = customWorkerReason.trim();
    setCustomWorkerReasonError('');
    if (!trimmed || trimmed.length < 2 || trimmed.length > 50) {
      setCustomWorkerReasonError('Reason name must be between 2 and 50 characters.');
      return;
    }
    const existing = availableWorkerReasons.find((c) => c.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      setWorkerReasonSelect(existing);
      setCustomWorkerReasonError('');
      return;
    }

    setIsSavingCustomWorkerReason(true);
    try {
      const res = await fetch('/api/reasons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, type: 'TRANSFER' }),
      });
      const data = await res.json();
      if (!res.ok && !data.error?.includes('already exists')) {
        throw new Error(data.error || 'Failed to save custom reason');
      }
      const created = data.reason || { id: `custom_${Date.now()}`, name: trimmed, type: 'TRANSFER' };
      setPurposeOptions((prev) => [...prev, created]);
      setWorkerReasonSelect(created.name);
      setCustomWorkerReasonError('');
    } catch (err: any) {
      setCustomWorkerReasonError(err.message || 'Error saving reason');
    } finally {
      setIsSavingCustomWorkerReason(false);
    }
  };

  // Add Worker to Current Site
  const handleAddWorkerToCurrentSite = () => {
    setSiteBuilderError('');
    if (!workerInputId) {
      setSiteBuilderError('Please select a worker / labour.');
      return;
    }
    const amt = parseFloat(workerAmountInput);
    if (isNaN(amt) || amt <= 0) {
      setSiteBuilderError('Please enter a valid amount greater than ₹0.');
      return;
    }

    const workerObj = workers.find((w) => w.id === workerInputId);
    if (!workerObj) {
      setSiteBuilderError('Selected worker not found.');
      return;
    }

    const finalCategory =
      workerReasonSelect === '__CUSTOM__' ? customWorkerReason.trim() : workerReasonSelect;
    if (!finalCategory) {
      setSiteBuilderError('Please enter a category or reason.');
      return;
    }

    const newItem: SiteFolderWorkerItem = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      workerId: workerObj.id,
      workerName: workerObj.name,
      workerCode: workerObj.workerCode,
      category: finalCategory,
      amount: Math.round(amt * 100) / 100,
      remarks: workerRemarksInput.trim() || undefined,
    };

    setCurrentSiteWorkers((prev) => [...prev, newItem]);
    setWorkerAmountInput('');
    setWorkerRemarksInput('');
    setWorkerInputId('');
  };

  // Add Expense to Current Site
  const handleAddExpenseToCurrentSite = () => {
    setSiteBuilderError('');
    const amt = parseFloat(expenseAmountInput);
    if (isNaN(amt) || amt <= 0) {
      setSiteBuilderError('Please enter a valid amount greater than ₹0.');
      return;
    }

    const finalCategory =
      expenseCategorySelect === '__CUSTOM__' ? customCategoryName.trim() : expenseCategorySelect;
    if (!finalCategory) {
      setSiteBuilderError('Please enter a valid category name.');
      return;
    }

    const newItem: SiteFolderExpenseItem = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      category: finalCategory,
      description: expenseDescriptionInput.trim() || finalCategory,
      vendor: expenseVendorInput.trim() || undefined,
      amount: Math.round(amt * 100) / 100,
    };

    setCurrentSiteExpenses((prev) => [...prev, newItem]);
    setExpenseAmountInput('');
    setExpenseDescriptionInput('');
    setExpenseVendorInput('');
  };

  // Package Active Site into a Folder
  const handlePackageCurrentSiteIntoFolder = () => {
    setSiteBuilderError('');
    if (currentSiteWorkers.length === 0 && currentSiteExpenses.length === 0) {
      setSiteBuilderError('Please add at least one worker payment or site expense before saving this folder.');
      return;
    }

    let pName = currentProject ? currentProject.name : 'General / Headquarter';
    let sName = currentSite ? currentSite.name : currentProject ? 'All Sites' : 'Head Office';

    const newFolder: SiteFolder = {
      id: editingFolderId || `folder_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      projectId: selectedProjectId || undefined,
      siteId: selectedSiteId || undefined,
      projectName: pName,
      siteName: sName,
      workers: [...currentSiteWorkers],
      expenses: [...currentSiteExpenses],
    };

    if (editingFolderId) {
      setSiteFolders((prev) => prev.map((f) => (f.id === editingFolderId ? newFolder : f)));
      setEditingFolderId(null);
    } else {
      setSiteFolders((prev) => [...prev, newFolder]);
    }

    // Reset Builder
    setCurrentSiteWorkers([]);
    setCurrentSiteExpenses([]);
    setSelectedProjectId('');
    setSelectedSiteId('');
    setSiteBuilderError('');
  };

  // Edit an existing folder (Pulls it back into the builder)
  const handleEditFolder = (folderId: string) => {
    const f = siteFolders.find((x) => x.id === folderId);
    if (!f) return;

    if (currentSiteWorkers.length > 0 || currentSiteExpenses.length > 0) {
      if (!confirm('You have unsaved entries in the current site builder. Do you want to replace them with this folder?')) {
        return;
      }
    }

    setSelectedProjectId(f.projectId || '');
    setSelectedSiteId(f.siteId || '');
    setCurrentSiteWorkers(f.workers);
    setCurrentSiteExpenses(f.expenses);
    setEditingFolderId(f.id);

    // Scroll to builder
    window.scrollTo({ top: 350, behavior: 'smooth' });
  };

  // Delete an existing folder
  const handleDeleteFolder = (folderId: string) => {
    if (confirm('Are you sure you want to remove this site folder from the batch?')) {
      setSiteFolders((prev) => prev.filter((f) => f.id !== folderId));
      if (editingFolderId === folderId) {
        setEditingFolderId(null);
        setCurrentSiteWorkers([]);
        setCurrentSiteExpenses([]);
      }
    }
  };

  // Master Final Submission
  const handleFinalSubmitAll = async () => {
    setSubmitError('');
    setSubmitSuccess('');

    // If user has un-packaged items in builder, prompt them to save first
    if (currentSiteWorkers.length > 0 || currentSiteExpenses.length > 0) {
      setSubmitError(
        'You have items in the current site builder that are not yet packaged into a folder. Please click "Save as Site Folder" first!'
      );
      return;
    }

    if (siteFolders.length === 0) {
      setSubmitError('Please create and save at least one site folder before confirming.');
      return;
    }

    if (!sourceId) {
      setSubmitError('Please select a valid paying source (Partner Cash or Bank).');
      return;
    }

    if (isBalanceExceeded) {
      setSubmitError(
        `Total amount (${formatINR(grandTotal)}) exceeds available source balance (${formatINR(sourceAvailableBalance)}).`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        sourceType,
        sourceId,
        method: paymentMethod,
        date,
        reference: batchReference || undefined,
        folders: siteFolders.map((f) => ({
          projectId: f.projectId || undefined,
          siteId: f.siteId || undefined,
          siteName: `${f.projectName} - ${f.siteName}`,
          workers: f.workers.map((w) => ({
            workerId: w.workerId,
            category: w.category,
            amount: w.amount,
            remarks: w.remarks || undefined,
          })),
          expenses: f.expenses.map((e) => ({
            category: e.category,
            description: e.description,
            vendor: e.vendor || undefined,
            amount: e.amount,
          })),
        })),
      };

      const res = await fetch('/api/finance/send-money/multi-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to post multi-site entries');
      }

      setSubmitSuccess(resData.message || 'All site folders successfully posted to accounts!');
      setSiteFolders([]);
      localStorage.removeItem(STORAGE_KEY);
      loadData(); // refresh balances
    } catch (err: any) {
      setSubmitError(err.message || 'Something went wrong while posting entries');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-28">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/hisaab/partners"
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
            title="Back to Partner Hisaab"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Send className="w-6 h-6 text-emerald-500" />
              Send Money &amp; Multi-Site Daily Sheet
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Record worker salaries and site expenses folder-by-folder, then post all in one click.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Balances
          </button>
          <Link
            href="/hisaab/partners"
            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200"
          >
            Partner Hisaab
          </Link>
        </div>
      </div>

      {/* Draft Recovery Notification Banner */}
      {hasDraftNotice && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-xs sm:text-sm font-bold text-amber-900 dark:text-amber-200">
                Unsaved Multi-Site Draft Found ({draftNoticeCount} site folder(s))
              </p>
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                A previous session was automatically saved on this device. Would you like to restore it?
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleRestoreDraft}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm transition-colors"
            >
              Restore Draft
            </button>
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-300"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {submitSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-emerald-800 dark:text-emerald-300 text-sm font-bold">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />
            <span>{submitSuccess}</span>
          </div>
          <Link
            href="/hisaab/partners"
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
          >
            View in Ledger →
          </Link>
        </div>
      )}

      {/* Section 1: Paying Source & Global Settings */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Wallet className="w-4 h-4 text-emerald-500" />
            Step 1: Paying Source Account &amp; Date
          </span>
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <span className="text-slate-500">Available:</span>
            <span
              className={`font-mono px-2 py-0.5 rounded-md ${
                sourceAvailableBalance > 0
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-500/10 text-rose-600'
              }`}
            >
              {formatINR(sourceAvailableBalance)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Source Type Toggle */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
              Source Type:
            </label>
            <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setSourceType('PARTNER');
                  if (partners.length > 0) setSourceId(partners[0].id);
                }}
                className={`py-1.5 rounded-lg transition-all ${
                  sourceType === 'PARTNER'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Partner Cash
              </button>
              <button
                type="button"
                onClick={() => {
                  setSourceType('BANK');
                  if (bankAccounts.length > 0) setSourceId(bankAccounts[0].id);
                }}
                className={`py-1.5 rounded-lg transition-all ${
                  sourceType === 'BANK'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Company Bank
              </button>
            </div>
          </div>

          {/* Source Account Dropdown */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
              {sourceType === 'PARTNER' ? 'Select Partner Wallet:' : 'Select Company Bank:'}
            </label>
            <select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {sourceType === 'PARTNER'
                ? partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Cash: {formatINR(p.currentBalance)})
                    </option>
                  ))
                : bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} - {b.name} (Bal: {formatINR(b.balance)})
                    </option>
                  ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
              Payment Date:
            </label>
            <input
              type="date"
              value={date}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Payment Method */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
              Payment Mode:
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="CASH">Cash in Hand</option>
              <option value="ONLINE">UPI / Online / GPay</option>
              <option value="BANK_TRANSFER">NEFT / RTGS / IMPS</option>
              <option value="CHEQUE">Cheque</option>
            </select>
          </div>
        </div>
      </div>

      {/* Section 2: Packaged Site Folders (The User's Vision!) */}
      {siteFolders.length > 0 && (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Folder className="w-4 h-4 text-amber-500" />
              Saved Site Folders ({siteFolders.length} Ready to Confirm)
            </span>
            <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
              Packaged Total: {formatINR(siteFolders.reduce((sum, f) => sum + f.workers.reduce((s, w) => s + w.amount, 0) + f.expenses.reduce((s, e) => s + e.amount, 0), 0))}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {siteFolders.map((folder, idx) => {
              const folderWorkersSum = folder.workers.reduce((s, w) => s + w.amount, 0);
              const folderExpensesSum = folder.expenses.reduce((s, e) => s + e.amount, 0);
              const folderTotal = Math.round((folderWorkersSum + folderExpensesSum) * 100) / 100;
              const isExpanded = expandedFolderId === folder.id;

              return (
                <div
                  key={folder.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between gap-3 shadow-xs"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                          <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                          <span>{folder.projectName}</span>
                          <span className="text-slate-400">•</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{folder.siteName}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Folder #{idx + 1} • {folder.workers.length} Worker(s), {folder.expenses.length} Expense(s)
                        </p>
                      </div>
                      <span className="text-sm font-mono font-black text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
                        {formatINR(folderTotal)}
                      </span>
                    </div>

                    {/* Breakdown Pill */}
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                      <span>Labour: {formatINR(folderWorkersSum)}</span>
                      <span>•</span>
                      <span>Expenses: {formatINR(folderExpensesSum)}</span>
                    </div>

                    {/* Collapsible item details */}
                    {isExpanded && (
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5 text-xs max-h-48 overflow-y-auto">
                        {folder.workers.map((w) => (
                          <div key={w.id} className="flex items-center justify-between py-0.5 text-slate-700 dark:text-slate-300">
                            <span className="truncate">
                              👷 {w.workerName} ({w.category})
                            </span>
                            <span className="font-mono font-semibold shrink-0">{formatINR(w.amount)}</span>
                          </div>
                        ))}
                        {folder.expenses.map((e) => (
                          <div key={e.id} className="flex items-center justify-between py-0.5 text-slate-700 dark:text-slate-300">
                            <span className="truncate">
                              📝 {e.description} ({e.category})
                            </span>
                            <span className="font-mono font-semibold shrink-0">{formatINR(e.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Folder Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => setExpandedFolderId(isExpanded ? null : folder.id)}
                      className="text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 flex items-center gap-1"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5" /> Collapse
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5" /> View {folder.workers.length + folder.expenses.length} Entries
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditFolder(folder.id)}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-white dark:hover:bg-slate-900"
                        title="Edit Folder"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteFolder(folder.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-white dark:hover:bg-slate-900"
                        title="Delete Folder"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section 3: Active Site Builder (Where user enters items for Site 1, Site 2, etc.) */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border-2 border-dashed border-emerald-500/30 dark:border-emerald-500/20 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <span className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-emerald-500" />
            {editingFolderId ? 'Editing Site Folder' : 'Step 2: Add Entries for a Site & Save Folder'}
          </span>
          {editingFolderId && (
            <button
              type="button"
              onClick={() => {
                setEditingFolderId(null);
                setCurrentSiteWorkers([]);
                setCurrentSiteExpenses([]);
              }}
              className="text-xs text-rose-500 font-bold hover:underline"
            >
              Cancel Edit
            </button>
          )}
        </div>

        {/* Site & Project Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
              Select Project:
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => {
                const pId = e.target.value;
                setSelectedProjectId(pId);
                const proj = projects.find((x) => x.id === pId);
                setSelectedSiteId(proj?.sites?.[0]?.id || '');
              }}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">-- No Specific Project (General / Office) --</option>
              {projects.map((pr) => (
                <option key={pr.id} value={pr.id}>
                  {pr.name} ({pr.projectCode})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
              Select Specific Site:
            </label>
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              disabled={!currentProject || !currentProject.sites || currentProject.sites.length === 0}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
            >
              <option value="">-- All Sites / Main Site --</option>
              {currentProject?.sites?.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabs: Add Worker Payment vs Add Site Expense */}
        <div className="pt-2">
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
            <button
              type="button"
              onClick={() => setBuilderTab('WORKER')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                builderTab === 'WORKER'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              1. Add Worker Payment
            </button>
            <button
              type="button"
              onClick={() => setBuilderTab('EXPENSE')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                builderTab === 'EXPENSE'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              2. Add Site Expense
            </button>
          </div>

          {/* Worker Form Area */}
          {builderTab === 'WORKER' && (
            <div className="pt-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Select Worker / Labour:
                  </label>
                  <select
                    value={workerInputId}
                    onChange={(e) => setWorkerInputId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Choose Worker --</option>
                    {workers.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} {w.workerCode ? `(${w.workerCode})` : ''} {w.category ? `• ${w.category}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Payment Reason / Category:
                  </label>
                  <select
                    value={workerReasonSelect}
                    onChange={(e) => setWorkerReasonSelect(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {availableWorkerReasons.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                    <option value="__CUSTOM__" className="font-bold text-emerald-600">
                      + Add Custom Reason...
                    </option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Amount (₹):
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      placeholder="e.g. 500"
                      value={workerAmountInput}
                      onChange={(e) => setWorkerAmountInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddWorkerToCurrentSite();
                        }
                      }}
                      className="w-full pl-7 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Inline Custom Worker Reason creator */}
              {workerReasonSelect === '__CUSTOM__' && (
                <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/30 flex items-center gap-2">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Enter custom reason (e.g. Bonus, Overtime)"
                    value={customWorkerReason}
                    onChange={(e) => setCustomWorkerReason(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleSaveCustomWorkerReason}
                    disabled={isSavingCustomWorkerReason}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs shrink-0"
                  >
                    {isSavingCustomWorkerReason ? 'Saving...' : 'Add & Select'}
                  </button>
                  {customWorkerReasonError && (
                    <span className="text-[11px] text-rose-500 font-semibold">{customWorkerReasonError}</span>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={handleAddWorkerToCurrentSite}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  + Add Worker to Site List
                </button>
              </div>
            </div>
          )}

          {/* Expense Form Area */}
          {builderTab === 'EXPENSE' && (
            <div className="pt-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Expense Category:
                  </label>
                  <select
                    value={expenseCategorySelect}
                    onChange={(e) => setExpenseCategorySelect(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {availableExpenseCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value="__CUSTOM__" className="font-bold text-amber-600">
                      + Add Custom Category...
                    </option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Description:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Petrol for site visit, cement bags"
                    value={expenseDescriptionInput}
                    onChange={(e) => setExpenseDescriptionInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Amount (₹):
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      placeholder="e.g. 350"
                      value={expenseAmountInput}
                      onChange={(e) => setExpenseAmountInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddExpenseToCurrentSite();
                        }
                      }}
                      className="w-full pl-7 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Inline Custom Expense Category creator */}
              {expenseCategorySelect === '__CUSTOM__' && (
                <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/30 flex items-center gap-2">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Enter category name (e.g. Generator Fuel)"
                    value={customCategoryName}
                    onChange={(e) => setCustomCategoryName(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={handleSaveCustomExpenseCategory}
                    disabled={isSavingCustomCategory}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-bold text-xs shrink-0"
                  >
                    {isSavingCustomCategory ? 'Saving...' : 'Add & Select'}
                  </button>
                  {customCategoryError && (
                    <span className="text-[11px] text-rose-500 font-semibold">{customCategoryError}</span>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={handleAddExpenseToCurrentSite}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  + Add Expense to Site List
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Builder Error Banner */}
        {siteBuilderError && (
          <p className="text-xs text-rose-500 font-bold bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {siteBuilderError}
          </p>
        )}

        {/* Live Active Site Items Table */}
        {(currentSiteWorkers.length > 0 || currentSiteExpenses.length > 0) && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Items added for {currentProject ? currentProject.name : 'Current Site'} ({currentSiteWorkers.length + currentSiteExpenses.length} items):
              </span>
              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                Subtotal: {formatINR(currentSiteWorkers.reduce((s, w) => s + w.amount, 0) + currentSiteExpenses.reduce((s, e) => s + e.amount, 0))}
              </span>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {currentSiteWorkers.map((w, i) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-600">👷 {w.workerName}</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-500">{w.category}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold">{formatINR(w.amount)}</span>
                    <button
                      type="button"
                      onClick={() => setCurrentSiteWorkers((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-slate-400 hover:text-rose-500"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {currentSiteExpenses.map((e, i) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-600">📝 {e.description}</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-500">{e.category}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold">{formatINR(e.amount)}</span>
                    <button
                      type="button"
                      onClick={() => setCurrentSiteExpenses((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-slate-400 hover:text-rose-500"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Packaging Button */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-500">
                Done with this site? Click to package into folder and continue to next site.
              </span>
              <button
                type="button"
                onClick={handlePackageCurrentSiteIntoFolder}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs flex items-center gap-2 shadow-md transition-all animate-pulse"
              >
                <Folder className="w-4 h-4" />
                📁 Save as Site Folder ({formatINR(currentSiteWorkers.reduce((s, w) => s + w.amount, 0) + currentSiteExpenses.reduce((s, e) => s + e.amount, 0))})
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Section 4: Master Bottom Sticky Bar (Confirm All) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 p-4 shadow-xl">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Total Sites &amp; Items
              </span>
              <span className="text-sm font-black text-slate-800 dark:text-slate-200">
                {siteFolders.length} Site Folder(s)
              </span>
            </div>

            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Grand Total Amount
              </span>
              <span className="text-base sm:text-lg font-mono font-black text-slate-900 dark:text-white">
                {formatINR(grandTotal)}
              </span>
            </div>

            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />

            <div className="hidden sm:block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Remaining Wallet Balance
              </span>
              <span
                className={`text-sm font-mono font-bold ${
                  remainingBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'
                }`}
              >
                {formatINR(remainingBalance)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {submitError && (
              <span className="text-xs text-rose-500 font-bold max-w-xs truncate" title={submitError}>
                {submitError}
              </span>
            )}
            <button
              type="button"
              disabled={isSubmitting || siteFolders.length === 0 || isBalanceExceeded}
              onClick={handleFinalSubmitAll}
              className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-sm flex items-center gap-2 shadow-lg transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Posting All Sites...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm &amp; Post All ({siteFolders.length} Folders)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
