'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  IndianRupee,
  Plus,
  Calendar,
  Building2,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Edit2,
  FileText,
  Wallet,
  CreditCard,
  Layers,
  User,
  Users,
  Receipt,
  ArrowDownLeft,
  ArrowRightLeft,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { MetricCard } from '@/components/ui/MetricCard';
import { formatINR } from '@/lib/calculations';
import { BankAccountManageModal } from '@/components/finance/BankAccountManageModal';

interface ProjectSite {
  id: string;
  name: string;
  supervisorName?: string;
}

interface Project {
  id: string;
  name: string;
  projectCode: string;
  clientName?: string;
  projectValue?: number;
  sites?: ProjectSite[];
}

interface ProjectReceipt {
  id: string;
  organizationId: string;
  projectId: string;
  siteId?: string | null;
  receivedById: string;
  clientName: string;
  amount: number;
  date: string;
  paymentMethod: string;
  receivedIn?: string | null;
  bankAccountId?: string | null;
  reference?: string | null;
  purpose: string;
  notes?: string | null;
  createdAt: string;
  project?: {
    id: string;
    name: string;
    projectCode: string;
    projectValue?: number;
  };
  site?: {
    id: string;
    name: string;
  } | null;
  receivedBy?: {
    id: string;
    name: string;
    email?: string;
  };
}

interface PartnerOption {
  id: string;
  name: string;
  email?: string;
  role: string;
  currentBalance?: number;
}

export default function HisaabPage() {
  const [receipts, setReceipts] = useState<ProjectReceipt[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Filters
  const [period, setPeriod] = useState<'today' | 'weekly' | 'monthly' | 'custom' | 'all'>('monthly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('ALL');
  const [selectedPartnerFilter, setSelectedPartnerFilter] = useState('ALL');
  const [selectedMethod, setSelectedMethod] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State for New Receipt
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBankManageModalOpen, setIsBankManageModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Form Fields
  const [formData, setFormData] = useState({
    projectId: '',
    siteId: '',
    receivedById: '',
    clientName: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'CASH',
    receivedIn: 'WALLET',
    bankAccountId: '',
    purpose: 'RUNNING_BILL',
    reference: '',
    notes: '',
  });

  // Edit Modal State
  const [editingReceipt, setEditingReceipt] = useState<ProjectReceipt | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editFormError, setEditFormError] = useState('');

  // Delete State
  const [deletingReceipt, setDeletingReceipt] = useState<ProjectReceipt | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Auto-clear success message after 4 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Load Bank Accounts helper
  const loadBankAccounts = useCallback(async () => {
    try {
      const bankRes = await fetch('/api/finance/bank-accounts');
      if (bankRes.ok) {
        const bData = await bankRes.json();
        const accounts = bData.bankAccounts || [];
        setBankAccounts(accounts);
        return accounts;
      }
    } catch (err) {
      console.error('Failed to load bank accounts:', err);
    }
    return [];
  }, []);

  // Load Partners helper
  const loadPartners = useCallback(async () => {
    try {
      const res = await fetch('/api/finance/partner-hisaab');
      if (res.ok) {
        const data = await res.json();
        const pList: PartnerOption[] = (data.partners || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          email: p.email,
          role: p.role,
          currentBalance: p.currentBalance,
        }));
        setPartners(pList);
        return pList;
      }
    } catch (err) {
      console.error('Failed to load partners:', err);
    }
    return [];
  }, []);

  // Handle bank accounts updated callback (e.g. from BankAccountManageModal)
  const handleBankAccountsUpdated = async () => {
    const accounts = await loadBankAccounts();
    // Auto-select latest account if in Add Modal with no selection
    if (accounts.length > 0 && !formData.bankAccountId) {
      setFormData((prev) => ({ ...prev, bankAccountId: accounts[accounts.length - 1].id }));
    }
  };

  // Load Projects, Bank Accounts and Partners on mount
  useEffect(() => {
    const loadPrerequisites = async () => {
      try {
        const [projRes, , pList] = await Promise.all([
          fetch('/api/projects'),
          loadBankAccounts(),
          loadPartners(),
        ]);

        if (projRes.ok) {
          const data = await projRes.json();
          setProjects(data.projects || []);
        }

        if (pList && pList.length > 0) {
          setFormData((prev) => ({
            ...prev,
            receivedById: prev.receivedById || pList[0].id,
          }));
        }
      } catch (err) {
        console.error('Failed to load projects/accounts/partners:', err);
      }
    };

    loadPrerequisites();
  }, [loadBankAccounts, loadPartners]);

  // Fetch Receipts with filters
  const fetchReceipts = useCallback(async () => {
    setIsRefreshing(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (selectedProjectId !== 'ALL') params.set('projectId', selectedProjectId);
      if (selectedPartnerFilter !== 'ALL') params.set('receivedById', selectedPartnerFilter);

      // Period dates
      const now = new Date();
      if (period === 'today') {
        const todayStr = now.toISOString().split('T')[0];
        params.set('startDate', todayStr + 'T00:00:00.000Z');
        params.set('endDate', todayStr + 'T23:59:59.999Z');
      } else if (period === 'weekly') {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 6);
        params.set('startDate', weekAgo.toISOString().split('T')[0] + 'T00:00:00.000Z');
        params.set('endDate', now.toISOString().split('T')[0] + 'T23:59:59.999Z');
      } else if (period === 'monthly') {
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        params.set('startDate', firstDay.toISOString().split('T')[0] + 'T00:00:00.000Z');
        params.set('endDate', now.toISOString().split('T')[0] + 'T23:59:59.999Z');
      } else if (period === 'custom') {
        if (startDate) params.set('startDate', startDate + 'T00:00:00.000Z');
        if (endDate) params.set('endDate', endDate + 'T23:59:59.999Z');
      }

      if (searchQuery.trim()) {
        params.set('search', searchQuery.trim());
      }

      const res = await fetch(`/api/finance/receipts?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to load payment receipts');
      }
      const data = await res.json();
      setReceipts(data.receipts || []);
    } catch (err: any) {
      setError(err.message || 'Error fetching receipts');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedProjectId, selectedPartnerFilter, period, startDate, endDate, searchQuery]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  // Handle Project Selection in New Receipt Form (auto-populate clientName)
  const handleProjectSelect = (pId: string) => {
    const selectedProj = projects.find((p) => p.id === pId);
    setFormData((prev) => ({
      ...prev,
      projectId: pId,
      siteId: '',
      clientName: selectedProj?.clientName || prev.clientName,
    }));
  };

  // Filtered Receipts based on in-memory Payment Method filter
  const displayedReceipts = useMemo(() => {
    return receipts.filter((r) => {
      if (selectedMethod !== 'ALL' && r.paymentMethod !== selectedMethod) {
        return false;
      }
      return true;
    });
  }, [receipts, selectedMethod]);

  // Summary Metrics
  const totalAmountReceived = useMemo(() => {
    return displayedReceipts.reduce((sum, r) => sum + (r.amount || 0), 0);
  }, [displayedReceipts]);

  const uniqueSitesCount = useMemo(() => {
    const siteSet = new Set<string>();
    displayedReceipts.forEach((r) => {
      if (r.projectId) siteSet.add(r.projectId);
    });
    return siteSet.size;
  }, [displayedReceipts]);

  const cashReceiptsTotal = useMemo(() => {
    return displayedReceipts
      .filter((r) => r.paymentMethod === 'CASH')
      .reduce((sum, r) => sum + (r.amount || 0), 0);
  }, [displayedReceipts]);

  const bankReceiptsTotal = useMemo(() => {
    return displayedReceipts
      .filter((r) => r.paymentMethod !== 'CASH')
      .reduce((sum, r) => sum + (r.amount || 0), 0);
  }, [displayedReceipts]);

  // Selected Project Object for sub-site options
  const currentProjectObj = useMemo(() => {
    return projects.find((p) => p.id === formData.projectId);
  }, [projects, formData.projectId]);

  // Handle Create Receipt Submit
  const handleCreateReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.projectId) {
      setFormError('Please select a project or construction site.');
      return;
    }
    if (!formData.clientName.trim()) {
      setFormError('Please enter the client / payer name.');
      return;
    }
    const parsedAmount = parseFloat(formData.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError('Please enter a valid amount greater than ₹0.');
      return;
    }
    if (!formData.date) {
      setFormError('Please select the payment received date.');
      return;
    }

    if (formData.receivedIn === 'WALLET' && !formData.receivedById) {
      setFormError('Please select the partner / cash holder who received the payment.');
      return;
    }

    if (formData.receivedIn === 'BANK' && !formData.bankAccountId) {
      setFormError('Please select the bank account where funds were received.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/finance/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: formData.projectId,
          siteId: formData.siteId || null,
          receivedById: formData.receivedById || undefined,
          clientName: formData.clientName.trim(),
          amount: parsedAmount,
          date: formData.date,
          paymentMethod: formData.paymentMethod,
          receivedIn: formData.receivedIn,
          bankAccountId: formData.receivedIn === 'BANK' ? formData.bankAccountId : null,
          purpose: formData.purpose,
          reference: formData.reference.trim() || null,
          notes: formData.notes.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to record payment received');
      }

      setSuccessMessage('Payment receipt recorded successfully!');
      setIsAddModalOpen(false);
      // Reset form
      setFormData({
        projectId: '',
        siteId: '',
        receivedById: partners.length > 0 ? partners[0].id : '',
        clientName: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        paymentMethod: 'CASH',
        receivedIn: 'WALLET',
        bankAccountId: '',
        purpose: 'RUNNING_BILL',
        reference: '',
        notes: '',
      });
      fetchReceipts();
      loadPartners();
    } catch (err: any) {
      setFormError(err.message || 'Error recording receipt');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (receipt: ProjectReceipt) => {
    setEditingReceipt(receipt);
    setEditFormError('');
    setIsEditModalOpen(true);
  };

  // Handle Edit Submit
  const handleUpdateReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReceipt) return;
    setEditFormError('');

    const parsedAmount = parseFloat(String(editingReceipt.amount));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setEditFormError('Please enter a valid amount greater than ₹0.');
      return;
    }

    setIsUpdating(true);
    try {
      const res = await fetch(`/api/finance/receipts/${editingReceipt.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: editingReceipt.clientName,
          amount: parsedAmount,
          date: editingReceipt.date,
          paymentMethod: editingReceipt.paymentMethod,
          purpose: editingReceipt.purpose,
          reference: editingReceipt.reference || null,
          notes: editingReceipt.notes || null,
          siteId: editingReceipt.siteId || null,
          receivedById: editingReceipt.receivedById || null,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to update receipt');
      }

      setSuccessMessage('Payment receipt updated successfully!');
      setIsEditModalOpen(false);
      setEditingReceipt(null);
      fetchReceipts();
      loadPartners();
    } catch (err: any) {
      setEditFormError(err.message || 'Error updating receipt');
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle Delete Submit
  const handleDeleteReceipt = async () => {
    if (!deletingReceipt) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/finance/receipts/${deletingReceipt.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to delete receipt');
      }
      setSuccessMessage('Payment receipt removed successfully!');
      setDeletingReceipt(null);
      fetchReceipts();
    } catch (err: any) {
      alert(err.message || 'Failed to delete receipt');
    } finally {
      setIsDeleting(false);
    }
  };

  const getPurposeLabel = (purpose: string) => {
    switch (purpose) {
      case 'RUNNING_BILL':
        return 'Running Bill / RA Bill';
      case 'ADVANCE':
        return 'Advance Payment';
      case 'FINAL_PAYMENT':
        return 'Final Settlement';
      case 'RETENTION':
        return 'Retention Release';
      default:
        return purpose || 'Payment';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Hisaab — Payment Received
                </h1>
                <span className="text-[11px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                  Site Inflow
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Record and manage incoming client payments received from construction sites and projects
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Submenu Switcher */}
          <div className="inline-flex rounded-xl p-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 mr-1">
            <div className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-600 text-white shadow-sm flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5" />
              Receive Payment
            </div>
            <Link
              href="/hisaab/partners"
              className="px-3 py-1 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all flex items-center gap-1.5"
            >
              <Users className="w-3.5 h-3.5 text-indigo-500" />
              Partner Hisaab
            </Link>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsBankManageModalOpen(true)}
            className="text-xs border-sky-500/30 text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 font-medium"
          >
            <Building2 className="w-3.5 h-3.5 mr-1.5 text-sky-500 dark:text-sky-400" />
            Bank Accounts ({bankAccounts.length})
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={fetchReceipts}
            disabled={isRefreshing}
            className="text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20"
            onClick={() => {
              setFormError('');
              setIsAddModalOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Receive Payment
          </Button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {successMessage && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 4 Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Payments Received"
          value={formatINR(totalAmountReceived)}
          subtitle={`${displayedReceipts.length} total entries`}
          icon={<IndianRupee className="w-5 h-5 text-emerald-500" />}
          variant="emerald"
        />
        <MetricCard
          title="Cash Received (Hand / Wallet)"
          value={formatINR(cashReceiptsTotal)}
          subtitle="Collected at site in cash"
          icon={<Wallet className="w-5 h-5 text-amber-500" />}
          variant="amber"
        />
        <MetricCard
          title="Bank & UPI Transfers"
          value={formatINR(bankReceiptsTotal)}
          subtitle="Direct account credits"
          icon={<CreditCard className="w-5 h-5 text-blue-500" />}
          variant="blue"
        />
        <MetricCard
          title="Contributing Sites"
          value={uniqueSitesCount}
          subtitle="Active project locations"
          icon={<Building2 className="w-5 h-5 text-indigo-500" />}
          variant="blue"
        />
      </div>

      {/* Filter Toolbar (Period, Site, Payment Mode, Search) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-4">
        {/* Row 1: Period Tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Filter By Period:
            </span>
          </div>

          <div className="inline-flex rounded-xl p-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 overflow-x-auto">
            <button
              type="button"
              onClick={() => setPeriod('today')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                period === 'today'
                  ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setPeriod('weekly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                period === 'weekly'
                  ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Weekly
            </button>
            <button
              type="button"
              onClick={() => setPeriod('monthly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                period === 'monthly'
                  ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => {
                setPeriod('custom');
                if (!startDate) {
                  const now = new Date();
                  const weekAgo = new Date(now);
                  weekAgo.setDate(weekAgo.getDate() - 14);
                  setStartDate(weekAgo.toISOString().split('T')[0]);
                  setEndDate(now.toISOString().split('T')[0]);
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                period === 'custom'
                  ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Custom Date
            </button>
            <button
              type="button"
              onClick={() => setPeriod('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                period === 'all'
                  ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All Time
            </button>
          </div>
        </div>

        {/* Custom Date Pickers */}
        {period === 'custom' && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <Button
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs"
              onClick={fetchReceipts}
            >
              Apply Filter
            </Button>
          </div>
        )}

        {/* Row 2: Secondary Dropdown & Search Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          {/* Project Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Filter Site / Project
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">All Sites &amp; Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.projectCode})
                </option>
              ))}
            </select>
          </div>

          {/* Partner Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Filter Partner / Recipient
            </label>
            <select
              value={selectedPartnerFilter}
              onChange={(e) => setSelectedPartnerFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">All Partners &amp; Cash Holders</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.role})
                </option>
              ))}
            </select>
          </div>

          {/* Payment Method Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Payment Mode
            </label>
            <select
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">All Payment Modes</option>
              <option value="CASH">Cash Payment</option>
              <option value="BANK">Bank Transfer (NEFT/RTGS)</option>
              <option value="UPI">UPI Payment</option>
              <option value="CHEQUE">Cheque</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          {/* Search Input */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Search by Client / Notes / Ref
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
          </div>
        </div>
      </div>

      {/* Receipts Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
          <div className="flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-emerald-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Site Payment Receipts Ledger ({displayedReceipts.length})
            </h2>
          </div>
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
            Total Inflow: {formatINR(totalAmountReceived)}
          </span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400 space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-500" />
            <p className="text-xs">Loading received payments...</p>
          </div>
        ) : displayedReceipts.length === 0 ? (
          <div className="p-12 text-center">
            <div className="inline-flex p-3 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mb-3">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              No Payment Receipts Found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              No payment receipts match your current filters. Click below to record a payment received from a site.
            </p>
            <Button
              size="sm"
              className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
              onClick={() => {
                setFormError('');
                setIsAddModalOpen(true);
              }}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Receive New Payment
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-950/20 font-semibold">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Site / Project</th>
                  <th className="py-3 px-4">Client / Party</th>
                  <th className="py-3 px-4 text-right">Amount Received</th>
                  <th className="py-3 px-3">Mode &amp; Ref</th>
                  <th className="py-3 px-3">Purpose</th>
                  <th className="py-3 px-3">Received By</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {displayedReceipts.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 text-slate-800 dark:text-slate-200 font-medium whitespace-nowrap">
                      {new Date(r.date).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">
                          {r.project?.name || 'Unknown Project'}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                          <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">
                            {r.project?.projectCode}
                          </span>
                          {r.site?.name && (
                            <>
                              <span>•</span>
                              <span className="text-amber-600 dark:text-amber-400 font-medium">
                                Site: {r.site.name}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-800 dark:text-slate-200 font-semibold">
                      {r.clientName}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <span className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400">
                        {formatINR(r.amount)}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="space-y-0.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.paymentMethod === 'CASH'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              : r.paymentMethod === 'UPI'
                              ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                              : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          }`}
                        >
                          {r.paymentMethod}
                        </span>
                        {r.reference && (
                          <p className="text-[10px] text-slate-500 truncate max-w-[120px]">
                            Ref: {r.reference}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-[11px] text-slate-600 dark:text-slate-300">
                        {getPurposeLabel(r.purpose)}
                      </span>
                      {r.notes && (
                        <p className="text-[10px] text-slate-400 italic truncate max-w-[150px]">
                          {r.notes}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3 h-3 text-slate-400" />
                        <span>{r.receivedBy?.name || 'Partner / Admin'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <Link
                          href="/hisaab/partners"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10 transition-colors"
                          title="Transfer to Partner"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => openEditModal(r)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-500/10 transition-colors"
                          title="Edit Receipt"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingReceipt(r)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                          title="Delete Receipt"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: RECORD NEW PAYMENT RECEIVED */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Record Payment Received"
        description="Enter incoming client payment details received for a construction site or project."
        size="lg"
      >
        <form onSubmit={handleCreateReceipt} className="space-y-4">
          {formError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 text-rose-500 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Project Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Project / Main Site <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={formData.projectId}
                onChange={(e) => handleProjectSelect(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">-- Select Project / Site --</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.projectCode})
                  </option>
                ))}
              </select>
            </div>

            {/* Sub-site Selection (if project has sites) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Specific Sub-Site (Optional)
              </label>
              <select
                value={formData.siteId}
                onChange={(e) => setFormData({ ...formData, siteId: e.target.value })}
                disabled={!currentProjectObj?.sites || currentProjectObj.sites.length === 0}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
              >
                <option value="">
                  {currentProjectObj?.sites && currentProjectObj.sites.length > 0
                    ? '-- All / Entire Project Site --'
                    : 'No sub-sites defined'}
                </option>
                {currentProjectObj?.sites?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Client / Party Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Received From (Client / Party) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Acme Builder / John Doe"
                value={formData.clientName}
                onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Amount Received */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Amount Received (₹) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">₹</span>
                <input
                  type="number"
                  required
                  step="any"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full pl-7 pr-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Receipt Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Payment Mode <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.paymentMethod}
                onChange={(e) => {
                  const method = e.target.value;
                  setFormData({
                    ...formData,
                    paymentMethod: method,
                    receivedIn: method === 'CASH' ? 'WALLET' : 'BANK',
                  });
                }}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="CASH">Cash Payment</option>
                <option value="BANK">Bank Transfer (NEFT/RTGS/IMPS)</option>
                <option value="UPI">UPI / GooglePay / PhonePe</option>
                <option value="CHEQUE">Cheque</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            {/* Purpose */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Payment Purpose
              </label>
              <select
                value={formData.purpose}
                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="RUNNING_BILL">Running Bill / RA Bill</option>
                <option value="ADVANCE">Advance for Work</option>
                <option value="FINAL_PAYMENT">Final Settlement</option>
                <option value="RETENTION">Retention Money</option>
                <option value="OTHER">Other Purpose</option>
              </select>
            </div>
          </div>

          {/* Deposit Account: Wallet or Bank Account */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Deposit Into:
              </label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer font-medium">
                  <input
                    type="radio"
                    name="receivedIn"
                    value="WALLET"
                    checked={formData.receivedIn === 'WALLET'}
                    onChange={() => setFormData({ ...formData, receivedIn: 'WALLET' })}
                    className="accent-emerald-500"
                  />
                  <span>Partner / Hand Cash</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer font-medium">
                  <input
                    type="radio"
                    name="receivedIn"
                    value="BANK"
                    checked={formData.receivedIn === 'BANK'}
                    onChange={() => setFormData({ ...formData, receivedIn: 'BANK' })}
                    className="accent-emerald-500"
                  />
                  <span>Company Bank Account</span>
                </label>
              </div>
            </div>

            {formData.receivedIn === 'WALLET' ? (
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Received By Partner / Cash Holder <span className="text-rose-500">*</span>
                  </label>
                  <Link
                    href="/hisaab/partners"
                    className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                    target="_blank"
                  >
                    <Users className="w-3 h-3" /> View Partner Wallets
                  </Link>
                </div>
                <select
                  required={formData.receivedIn === 'WALLET'}
                  value={formData.receivedById}
                  onChange={(e) => setFormData({ ...formData, receivedById: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                >
                  <option value="">-- Select Partner / Hand Cash Holder --</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.role}) {p.currentBalance !== undefined ? `• Cash Bal: ${formatINR(p.currentBalance)}` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Payment will be credited directly to this partner&apos;s wallet and will reflect in their Partner Hisaab and Dashboard.
                </p>
              </div>
            ) : (
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Select Bank Account <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsBankManageModalOpen(true)}
                      className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-500 flex items-center gap-1 hover:underline"
                    >
                      <Plus className="w-3 h-3" /> Add Bank Account
                    </button>
                  </div>

                  {bankAccounts.length === 0 ? (
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 flex items-center justify-between gap-2">
                      <span>No bank accounts found.</span>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setIsBankManageModalOpen(true)}
                        className="text-xs h-7 px-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shrink-0"
                      >
                        <Plus className="w-3 h-3 mr-1" /> Add Account Now
                      </Button>
                    </div>
                  ) : (
                    <select
                      required={formData.receivedIn === 'BANK'}
                      value={formData.bankAccountId}
                      onChange={(e) => setFormData({ ...formData, bankAccountId: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">-- Select Bank Account --</option>
                      {bankAccounts.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.bankName} - {b.name} {b.accountLast4 ? `(..${b.accountLast4})` : ''} • Bal: {formatINR(b.balance ?? b.openingBalance ?? 0)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Handled By Partner (Optional)
                  </label>
                  <select
                    value={formData.receivedById}
                    onChange={(e) => setFormData({ ...formData, receivedById: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Select Partner (Optional) --</option>
                    {partners.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Reference No / Cheque No */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Reference / Cheque / Txn ID
              </label>
              <input
                type="text"
                placeholder="e.g. CHQ-882190 or UPI-4091823"
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Notes &amp; Remarks
              </label>
              <input
                type="text"
                placeholder="e.g. Received part payment for plaster & epoxy"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Saving Receipt...
                </>
              ) : (
                'Save Payment Receipt'
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: EDIT PAYMENT RECEIPT */}
      {editingReceipt && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingReceipt(null);
          }}
          title="Edit Payment Receipt"
          description="Update details of this payment entry."
          size="md"
        >
          <form onSubmit={handleUpdateReceipt} className="space-y-4">
            {editFormError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 text-rose-500 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editFormError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Project: <strong className="text-slate-900 dark:text-white">{editingReceipt.project?.name}</strong>
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Client / Party Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={editingReceipt.clientName}
                onChange={(e) => setEditingReceipt({ ...editingReceipt, clientName: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Amount Received (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={editingReceipt.amount}
                  onChange={(e) => setEditingReceipt({ ...editingReceipt, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={new Date(editingReceipt.date).toISOString().split('T')[0]}
                  onChange={(e) => setEditingReceipt({ ...editingReceipt, date: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Mode
                </label>
                <select
                  value={editingReceipt.paymentMethod}
                  onChange={(e) => setEditingReceipt({ ...editingReceipt, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="CASH">Cash</option>
                  <option value="BANK">Bank Transfer</option>
                  <option value="UPI">UPI</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Purpose
                </label>
                <select
                  value={editingReceipt.purpose}
                  onChange={(e) => setEditingReceipt({ ...editingReceipt, purpose: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="RUNNING_BILL">Running Bill / RA Bill</option>
                  <option value="ADVANCE">Advance</option>
                  <option value="FINAL_PAYMENT">Final Settlement</option>
                  <option value="RETENTION">Retention</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Received By (Partner / Cash Holder)
              </label>
              <select
                value={editingReceipt.receivedById || ''}
                onChange={(e) => setEditingReceipt({ ...editingReceipt, receivedById: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.role}) {p.currentBalance !== undefined ? `• Cash Bal: ${formatINR(p.currentBalance)}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Reference / Txn ID
              </label>
              <input
                type="text"
                value={editingReceipt.reference || ''}
                onChange={(e) => setEditingReceipt({ ...editingReceipt, reference: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Notes &amp; Remarks
              </label>
              <input
                type="text"
                value={editingReceipt.notes || ''}
                onChange={(e) => setEditingReceipt({ ...editingReceipt, notes: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingReceipt(null);
                }}
                disabled={isUpdating}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                disabled={isUpdating}
              >
                {isUpdating ? 'Saving...' : 'Update Receipt'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 3: DELETE CONFIRMATION */}
      {deletingReceipt && (
        <Modal
          isOpen={Boolean(deletingReceipt)}
          onClose={() => setDeletingReceipt(null)}
          title="Delete Payment Receipt"
          description="Are you sure you want to remove this payment entry? This will adjust project received balances."
          size="sm"
        >
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
              <p>
                Receipt from: <strong>{deletingReceipt.clientName}</strong>
              </p>
              <p className="mt-1">
                Amount: <strong>{formatINR(deletingReceipt.amount)}</strong>
              </p>
              <p className="mt-1">
                Site: <strong>{deletingReceipt.project?.name}</strong>
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeletingReceipt(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
                onClick={handleDeleteReceipt}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 4: MANAGE BANK ACCOUNTS */}
      <BankAccountManageModal
        isOpen={isBankManageModalOpen}
        onClose={() => setIsBankManageModalOpen(false)}
        onUpdated={handleBankAccountsUpdated}
      />
    </div>
  );
}
