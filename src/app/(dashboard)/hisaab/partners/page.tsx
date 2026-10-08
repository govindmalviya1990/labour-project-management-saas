'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Users,
  UserCheck,
  ArrowRightLeft,
  IndianRupee,
  Plus,
  Calendar,
  Building2,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  FileText,
  CreditCard,
  Shield,
  ChevronRight,
  X,
  Send,
  Landmark,
  User,
  Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { MetricCard } from '@/components/ui/MetricCard';
import { formatINR } from '@/lib/calculations';

interface PartnerSummaryItem {
  id: string;
  name: string;
  email: string;
  mobile?: string;
  role: string;
  currentBalance: number;
  totalCredits: number;
  totalDebits: number;
  period: {
    receiptsTotal: number;
    receiptsCount: number;
    transfersInTotal: number;
    transfersInCount: number;
    transfersOutTotal: number;
    transfersOutCount: number;
    expensesTotal: number;
    expensesCount: number;
  };
}

interface LedgerEntry {
  id: string;
  rawId: string;
  date: string;
  type: 'RECEIPT' | 'TRANSFER_IN' | 'BANK_WITHDRAWAL' | 'TRANSFER_OUT' | 'EXPENSE' | 'BANK_DEPOSIT';
  categoryLabel: string;
  title: string;
  subtitle?: string;
  credit: number;
  debit: number;
  paymentMethod: string;
  receivedIn?: string;
  reference?: string;
  notes?: string;
}

interface RecentReceipt {
  id: string;
  clientName: string;
  amount: number;
  date: string;
  paymentMethod: string;
  project?: { id: string; name: string };
  site?: { id: string; name: string };
  receivedBy?: { id: string; name: string };
}

interface ProjectItem {
  id: string;
  name: string;
  projectCode: string;
  sites: { id: string; name: string }[];
}

interface WorkerItem {
  id: string;
  name: string;
  workerCode?: string;
  category?: string;
  mobile?: string;
}

interface PurposeOptionItem {
  id: string;
  name: string;
  type: string;
}

const DEFAULT_EXPENSE_CATEGORIES = [
  'Food & Refreshments',
  'Fuel & Travel',
  'Site Materials / Hardware',
  'Tools & Equipment',
  'Site Maintenance & Repairs',
  'Worker Food & Tea',
  'Office & Printing',
  'Logistics & Transport',
  'Labour Wages / Kharcha',
  'Miscellaneous',
];

export default function PartnerHisaabPage() {
  const [partners, setPartners] = useState<PartnerSummaryItem[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('ALL');
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [recentReceipts, setRecentReceipts] = useState<RecentReceipt[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [totalBankBalance, setTotalBankBalance] = useState<number>(0);
  const [bankSummary, setBankSummary] = useState<any>(null);
  const [workers, setWorkers] = useState<WorkerItem[]>([]);
  const [purposeOptions, setPurposeOptions] = useState<PurposeOptionItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Period Filters
  const [period, setPeriod] = useState<'today' | 'weekly' | 'monthly' | 'custom' | 'all'>('monthly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [ledgerSearchQuery, setLedgerSearchQuery] = useState('');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState('ALL');

  // Send Money Modal State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);
  const [transferError, setTransferError] = useState('');

  // Send Money Form State
  const [sendMoneyForm, setSendMoneyForm] = useState({
    sourceType: 'PARTNER' as 'PARTNER' | 'BANK',
    sourceId: '',
    destinationType: 'TO_PARTNER' as 'TO_PARTNER' | 'INTERNAL_BANK_DEPOSIT' | 'TO_WORKER' | 'SELF_EXPENSE',
    // Destination 1: Partner
    toPartnerId: '',
    transferSourceType: 'DIRECT' as 'DIRECT' | 'FROM_RECEIPT',
    receiptId: '',
    // Destination 2: Bank Deposit
    toBankAccountId: '',
    // Destination 3: Worker
    toWorkerId: '',
    workerReasonSelect: 'Salary / Wages',
    customWorkerReason: '',
    // Destination 4: Self Expense
    expenseCategorySelect: 'Site Materials / Hardware',
    customCategoryName: '',
    expenseDescription: '',
    vendorName: '',
    // Common
    amount: '',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'CASH',
    purpose: 'PARTNER_TRANSFER',
    projectId: '',
    siteId: '',
    reference: '',
    notes: '',
  });

  // Auto-clear success notification
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Load Partner Hisaab Data
  const loadPartnerHisaab = useCallback(async () => {
    setIsRefreshing(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (selectedPartnerId) params.set('partnerId', selectedPartnerId);
      if (period) params.set('period', period);
      if (period === 'custom') {
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
      }

      const res = await fetch(`/api/finance/partner-hisaab?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load partner hisaab data');
      }

      setPartners(data.partners || []);
      setLedger(data.ledger || []);
      setRecentReceipts(data.recentReceipts || []);
      setProjects(data.projects || []);
      setBankAccounts(data.bankAccounts || []);
      setTotalBankBalance(data.totalBankBalance || 0);
      setBankSummary(data.bankSummary || null);
      setWorkers(data.workers || []);
      setPurposeOptions(data.purposeOptions || []);
      if (data.currentUserId) setCurrentUserId(data.currentUserId);
    } catch (err: any) {
      setError(err.message || 'Error loading data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedPartnerId, period, startDate, endDate]);

  useEffect(() => {
    loadPartnerHisaab();
  }, [loadPartnerHisaab]);

  // Categorization of selected view
  const isAllSelected = selectedPartnerId === 'ALL';
  const isBankSelected = selectedPartnerId.startsWith('BANK');
  const selectedBankAccount = useMemo(() => {
    if (!isBankSelected || selectedPartnerId === 'BANK_ALL') return null;
    const bankId = selectedPartnerId.replace('BANK_', '');
    return bankAccounts.find((b) => b.id === bankId) || null;
  }, [isBankSelected, selectedPartnerId, bankAccounts]);

  const selectedPartner = useMemo(() => {
    if (isAllSelected || isBankSelected) return null;
    return partners.find((p) => p.id === selectedPartnerId) || null;
  }, [partners, selectedPartnerId, isAllSelected, isBankSelected]);

  // Combined Totals when "ALL" is selected
  const allPartnersTotals = useMemo(() => {
    return partners.reduce(
      (acc, p) => {
        acc.totalCash += p.currentBalance || 0;
        acc.receipts += p.period.receiptsTotal || 0;
        acc.transfersIn += p.period.transfersInTotal || 0;
        acc.transfersOut += p.period.transfersOutTotal || 0;
        acc.expenses += p.period.expensesTotal || 0;
        return acc;
      },
      { totalCash: 0, receipts: 0, transfersIn: 0, transfersOut: 0, expenses: 0 }
    );
  }, [partners]);

  // Filtered Ledger entries
  const displayedLedger = useMemo(() => {
    return ledger.filter((item) => {
      if (ledgerTypeFilter !== 'ALL' && item.type !== ledgerTypeFilter) {
        return false;
      }
      if (ledgerSearchQuery.trim()) {
        const query = ledgerSearchQuery.toLowerCase();
        const matchesTitle = item.title?.toLowerCase().includes(query);
        const matchesSubtitle = item.subtitle?.toLowerCase().includes(query);
        const matchesRef = item.reference?.toLowerCase().includes(query);
        const matchesNotes = item.notes?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesSubtitle && !matchesRef && !matchesNotes) {
          return false;
        }
      }
      return true;
    });
  }, [ledger, ledgerTypeFilter, ledgerSearchQuery]);

  // Computed categories from system presets + custom DB purposeOptions
  const availableExpenseCategories = useMemo(() => {
    const customCats = purposeOptions
      .filter((p) => p.type === 'EXPENSE')
      .map((p) => p.name);
    return Array.from(new Set([...DEFAULT_EXPENSE_CATEGORIES, ...customCats]));
  }, [purposeOptions]);

  // Computed source account available balance
  const sourceAvailableBalance = useMemo(() => {
    if (sendMoneyForm.sourceType === 'PARTNER') {
      const partner = partners.find((p) => p.id === sendMoneyForm.sourceId);
      return partner?.currentBalance ?? 0;
    } else {
      const bank = bankAccounts.find((b) => b.id === sendMoneyForm.sourceId);
      return bank?.balance ?? 0;
    }
  }, [sendMoneyForm.sourceType, sendMoneyForm.sourceId, partners, bankAccounts]);

  // Open Send Money Modal with smart defaults
  const openSendMoneyModal = (opts?: {
    defaultSourceType?: 'PARTNER' | 'BANK';
    defaultSourceId?: string;
    defaultDestType?: 'TO_PARTNER' | 'INTERNAL_BANK_DEPOSIT' | 'TO_WORKER' | 'SELF_EXPENSE';
    defaultTargetPartnerId?: string;
  }) => {
    setTransferError('');

    let srcType: 'PARTNER' | 'BANK' = opts?.defaultSourceType || (isBankSelected ? 'BANK' : 'PARTNER');
    let srcId: string = opts?.defaultSourceId || '';

    if (!srcId) {
      if (srcType === 'BANK') {
        srcId = selectedBankAccount?.id || (bankAccounts[0]?.id || '');
      } else {
        if (selectedPartner) {
          srcId = selectedPartner.id;
        } else if (currentUserId && partners.some((p) => p.id === currentUserId)) {
          srcId = currentUserId;
        } else if (partners.length > 0) {
          srcId = partners[0].id;
        }
      }
    }

    const destType: 'TO_PARTNER' | 'INTERNAL_BANK_DEPOSIT' | 'TO_WORKER' | 'SELF_EXPENSE' =
      opts?.defaultDestType || 'TO_PARTNER';

    let toPartId = opts?.defaultTargetPartnerId || '';
    if (!toPartId) {
      const otherPartner = partners.find((p) => p.id !== srcId);
      if (otherPartner) toPartId = otherPartner.id;
    }

    let toBankId = '';
    if (bankAccounts.length > 0) {
      const targetBank = bankAccounts.find((b) => b.id !== srcId) || bankAccounts[0];
      toBankId = targetBank.id;
    }

    const toWorkId = workers.length > 0 ? workers[0].id : '';

    setSendMoneyForm({
      sourceType: srcType,
      sourceId: srcId,
      destinationType: destType,
      toPartnerId: toPartId,
      transferSourceType: 'DIRECT',
      receiptId: '',
      toBankAccountId: toBankId,
      toWorkerId: toWorkId,
      workerReasonSelect: 'Salary / Wages',
      customWorkerReason: '',
      expenseCategorySelect: 'Site Materials / Hardware',
      customCategoryName: '',
      expenseDescription: '',
      vendorName: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      paymentMethod: srcType === 'BANK' ? 'BANK' : 'CASH',
      purpose: 'PARTNER_TRANSFER',
      projectId: '',
      siteId: '',
      reference: '',
      notes: '',
    });

    setIsTransferModalOpen(true);
  };

  // When selecting a receipt in the Send Money form, auto-fill amount & details
  const handleReceiptSelection = (rcptId: string) => {
    const rcpt = recentReceipts.find((r) => r.id === rcptId);
    if (rcpt) {
      setSendMoneyForm((prev) => ({
        ...prev,
        receiptId: rcpt.id,
        amount: String(rcpt.amount),
        projectId: rcpt.project?.id || prev.projectId,
        paymentMethod: rcpt.paymentMethod || prev.paymentMethod,
        notes: `Transfer of client payment received from ${rcpt.clientName} (${rcpt.project?.name || ''})`,
      }));
    } else {
      setSendMoneyForm((prev) => ({ ...prev, receiptId: '' }));
    }
  };

  // Submit Send Money Transaction
  const handleSendMoneySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransferError('');

    const parsedAmount = parseFloat(sendMoneyForm.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setTransferError('Please enter a valid amount greater than ₹0.');
      return;
    }

    if (!sendMoneyForm.date) {
      setTransferError('Please select a date.');
      return;
    }

    if (!sendMoneyForm.sourceId) {
      setTransferError('Please select the paying source (Partner wallet or Bank account).');
      return;
    }

    // Destination-specific validation
    let finalWorkerReason = '';
    if (sendMoneyForm.destinationType === 'TO_WORKER') {
      if (!sendMoneyForm.toWorkerId) {
        setTransferError('Please select the worker to pay.');
        return;
      }
      finalWorkerReason =
        sendMoneyForm.workerReasonSelect === 'CUSTOM'
          ? sendMoneyForm.customWorkerReason.trim()
          : sendMoneyForm.workerReasonSelect;
      if (!finalWorkerReason) {
        setTransferError('Please specify the payment reason for the worker.');
        return;
      }
    }

    let finalExpenseCategory = '';
    if (sendMoneyForm.destinationType === 'SELF_EXPENSE') {
      finalExpenseCategory =
        sendMoneyForm.expenseCategorySelect === 'CUSTOM'
          ? sendMoneyForm.customCategoryName.trim()
          : sendMoneyForm.expenseCategorySelect;
      if (!finalExpenseCategory) {
        setTransferError('Please select or specify an expense category.');
        return;
      }
    }

    if (sendMoneyForm.destinationType === 'TO_PARTNER') {
      if (!sendMoneyForm.toPartnerId) {
        setTransferError('Please select the recipient partner or owner.');
        return;
      }
      if (sendMoneyForm.sourceType === 'PARTNER' && sendMoneyForm.sourceId === sendMoneyForm.toPartnerId) {
        setTransferError('Source and recipient partner cannot be the same person.');
        return;
      }
    }

    if (sendMoneyForm.destinationType === 'INTERNAL_BANK_DEPOSIT') {
      if (!sendMoneyForm.toBankAccountId) {
        setTransferError('Please select the target bank account for deposit/transfer.');
        return;
      }
      if (sendMoneyForm.sourceType === 'BANK' && sendMoneyForm.sourceId === sendMoneyForm.toBankAccountId) {
        setTransferError('Source and destination bank accounts cannot be the same.');
        return;
      }
    }

    setIsSubmittingTransfer(true);
    try {
      const payload = {
        sourceType: sendMoneyForm.sourceType,
        sourceId: sendMoneyForm.sourceId,
        destinationType: sendMoneyForm.destinationType,
        toPartnerId: sendMoneyForm.toPartnerId,
        toBankAccountId: sendMoneyForm.toBankAccountId,
        toWorkerId: sendMoneyForm.toWorkerId,
        workerReason: finalWorkerReason,
        expenseCategory: finalExpenseCategory,
        expenseDescription: sendMoneyForm.expenseDescription.trim() || undefined,
        vendorName: sendMoneyForm.vendorName.trim() || undefined,
        amount: parsedAmount,
        date: sendMoneyForm.date,
        paymentMethod: sendMoneyForm.paymentMethod,
        purpose: sendMoneyForm.purpose,
        projectId: sendMoneyForm.projectId || null,
        siteId: sendMoneyForm.siteId || null,
        receiptId: sendMoneyForm.transferSourceType === 'FROM_RECEIPT' ? sendMoneyForm.receiptId || null : null,
        reference: sendMoneyForm.reference.trim() || null,
        notes: sendMoneyForm.notes.trim() || null,
      };

      const res = await fetch('/api/finance/partner-hisaab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to process transaction');
      }

      setSuccessMessage(data.message || 'Payment successfully processed!');
      setIsTransferModalOpen(false);
      loadPartnerHisaab();
    } catch (err: any) {
      setTransferError(err.message || 'Error processing transaction');
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/10 to-indigo-600/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Partner Hisaab
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 uppercase tracking-wider">
                Cash Ledger &amp; Transfers
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Check individual hisaab of each owner &amp; partner, and transfer received client payments to partners
            </p>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Partner / Owner / Bank Selector Dropdown */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <label htmlFor="partner-hisaab-select" className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                Select Partner / Owner / Bank:
              </label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Choose an account, partner, or bank to inspect their hisaab &amp; statement
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:min-w-[340px]">
            <select
              id="partner-hisaab-select"
              value={selectedPartnerId}
              onChange={(e) => setSelectedPartnerId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm cursor-pointer"
            >
              <option value="ALL">
                All Partners &amp; Owners (Total Cash: {formatINR(allPartnersTotals.totalCash)})
              </option>

              {/* Bank Account Option - shown only once */}
              {bankAccounts.length <= 1 ? (
                <option value={bankAccounts[0] ? `BANK_${bankAccounts[0].id}` : 'BANK_ALL'}>
                  Bank: {bankAccounts[0]?.bankName || 'Company Bank'}{
                    bankAccounts[0]?.name &&
                    bankAccounts[0].name.toLowerCase() !== (bankAccounts[0].bankName || '').toLowerCase()
                      ? ` - ${bankAccounts[0].name}`
                      : ''
                  }{bankAccounts[0]?.accountLast4 ? ` (..${bankAccounts[0].accountLast4})` : ''} • Bal: {formatINR(bankAccounts[0]?.balance ?? totalBankBalance)}
                </option>
              ) : (
                <optgroup label="Company Bank Accounts">
                  <option value="BANK_ALL">
                    All Bank Accounts (Total: {formatINR(totalBankBalance)})
                  </option>
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={`BANK_${b.id}`}>
                      {b.bankName}{
                        b.name && b.name.toLowerCase() !== b.bankName.toLowerCase() ? ` - ${b.name}` : ''
                      }{b.accountLast4 ? ` (..${b.accountLast4})` : ''} • Bal: {formatINR(b.balance)}
                    </option>
                  ))}
                </optgroup>
              )}

              <optgroup label="Individual Partners &amp; Owners">
                {partners.map((p) => {
                  const hasRoleInName = p.name.toLowerCase().includes(p.role.toLowerCase());
                  return (
                    <option key={p.id} value={p.id}>
                      {p.name}{hasRoleInName ? '' : ` (${p.role})`} • Cash Bal: {formatINR(p.currentBalance)}
                    </option>
                  );
                })}
              </optgroup>
            </select>

            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shrink-0 shadow-sm"
              onClick={() => openSendMoneyModal()}
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              Send Money
            </Button>
          </div>
        </div>
      </div>

      {/* 3. Period Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-4">
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
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3 animate-fade-in">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">From Date:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">To Date:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <Button
              size="sm"
              onClick={loadPartnerHisaab}
              className="text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
            >
              Apply Filter
            </Button>
          </div>
        )}
      </div>

      {/* 4. Metric KPI Cards */}
      {selectedPartner ? (
        // 1) INDIVIDUAL PARTNER VIEW: ONLY this partner's metrics! NO bank balance shown!
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title={`${selectedPartner.name}'s Cash Balance`}
            value={formatINR(selectedPartner.currentBalance)}
            subtitle="Current live balance in hand"
            icon={<Wallet className="w-5 h-5 text-emerald-500" />}
            variant="emerald"
          />
          <MetricCard
            title="Transfers Received"
            value={formatINR(selectedPartner.period.transfersInTotal)}
            subtitle={`${selectedPartner.period.transfersInCount} transfer(s) received`}
            icon={<ArrowDownLeft className="w-5 h-5 text-sky-500" />}
            variant="blue"
          />
          <MetricCard
            title="Site Expenses Paid"
            value={formatINR(selectedPartner.period.expensesTotal)}
            subtitle={`${selectedPartner.period.expensesCount} expense entries on site`}
            icon={<CreditCard className="w-5 h-5 text-amber-500" />}
            variant="amber"
          />
          <MetricCard
            title="Transfers Out / Given"
            value={formatINR(selectedPartner.period.transfersOutTotal)}
            subtitle={`${selectedPartner.period.transfersOutCount} transfer(s) passed to others`}
            icon={<ArrowUpRight className="w-5 h-5 text-indigo-500" />}
            variant="blue"
          />
        </div>
      ) : isBankSelected ? (
        // 2) BANK VIEW: ONLY bank-related metrics!
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title={selectedBankAccount ? `${selectedBankAccount.bankName} Balance` : 'Total Bank Balance'}
            value={formatINR(bankSummary?.selectedBankBalance ?? (selectedBankAccount?.balance ?? totalBankBalance))}
            subtitle={selectedBankAccount ? `${selectedBankAccount.name} (..${selectedBankAccount.accountLast4 || ''})` : `Available across ${bankAccounts.length} company bank account(s)`}
            icon={<Building2 className="w-5 h-5 text-sky-500" />}
            variant="blue"
          />
          <MetricCard
            title="Bank Inflow & Deposits"
            value={formatINR(bankSummary?.periodInflow ?? 0)}
            subtitle="Client receipts & deposits in period"
            icon={<ArrowDownLeft className="w-5 h-5 text-emerald-500" />}
            variant="emerald"
          />
          <MetricCard
            title="Transfers to Partners"
            value={formatINR(bankSummary?.periodToPartner ?? 0)}
            subtitle="Funds transferred to partner wallets"
            icon={<ArrowRightLeft className="w-5 h-5 text-indigo-500" />}
            variant="blue"
          />
          <MetricCard
            title="Direct Bank Payments"
            value={formatINR((bankSummary?.periodPayments ?? 0) + (bankSummary?.periodWithdrawals ?? 0))}
            subtitle={`Vendor: ${formatINR(bankSummary?.periodPayments ?? 0)} • Cash Out: ${formatINR(bankSummary?.periodWithdrawals ?? 0)}`}
            icon={<CreditCard className="w-5 h-5 text-amber-500" />}
            variant="amber"
          />
        </div>
      ) : (
        // 3) ALL PARTNERS & OWNERS OVERVIEW: Summary cards (Total Remaining Balance, Bank Balance, Cash in Hand, Expenses)
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Remaining Balance (Cash + Bank)"
            value={formatINR(allPartnersTotals.totalCash + totalBankBalance)}
            subtitle={`Cash: ${formatINR(allPartnersTotals.totalCash)} • Bank: ${formatINR(totalBankBalance)}`}
            icon={<Wallet className="w-5 h-5 text-emerald-500" />}
            variant="emerald"
          />
          <MetricCard
            title="Total Bank Balance"
            value={formatINR(totalBankBalance)}
            subtitle={`Available across ${bankAccounts.length} company bank account(s)`}
            icon={<Building2 className="w-5 h-5 text-sky-500" />}
            variant="blue"
          />
          <MetricCard
            title="Total Partners Cash in Hand"
            value={formatINR(allPartnersTotals.totalCash)}
            subtitle={`Held across ${partners.length} partners & owners`}
            icon={<Users className="w-5 h-5 text-indigo-500" />}
            variant="blue"
          />
          <MetricCard
            title="Total Partner Site Expenses"
            value={formatINR(allPartnersTotals.expenses)}
            subtitle="Paid from partner wallets & sites"
            icon={<CreditCard className="w-5 h-5 text-amber-500" />}
            variant="amber"
          />
        </div>
      )}

      {/* 5. Main Content: ALL PARTNERS SUMMARY or BANK LEDGER or INDIVIDUAL PARTNER LEDGER */}
      {isAllSelected ? (
        // VIEW A: ALL PARTNERS LIST & SUMMARY TABLE + COMPANY BANK ACCOUNTS
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-500" />
                  All Partners &amp; Owners Summary Matrix
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Click on any partner to view their detailed transaction statement or transfer money
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => openSendMoneyModal()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
              >
                <Send className="w-3.5 h-3.5 mr-1" />
                Send Money
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Partner / Owner</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4 text-right">Cash in Hand (Live)</th>
                    <th className="py-3 px-4 text-right">Direct Site Receipts</th>
                    <th className="py-3 px-4 text-right">Transfers In</th>
                    <th className="py-3 px-4 text-right">Transfers Out</th>
                    <th className="py-3 px-4 text-right">Site Expenses</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {partners.map((p) => {
                    const isPositive = p.currentBalance >= 0;
                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                        onClick={() => setSelectedPartnerId(p.id)}
                      >
                        <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-xs">
                              {p.name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-bold">{p.name}</div>
                              {p.mobile && <div className="text-[11px] text-slate-400">{p.mobile}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            p.role === 'OWNER'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                              : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                          }`}>
                            {p.role}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-sm">
                          <span className={isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                            {formatINR(p.currentBalance)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-slate-600 dark:text-slate-400">
                          {formatINR(p.period.receiptsTotal)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-sky-600 dark:text-sky-400">
                          +{formatINR(p.period.transfersInTotal)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-amber-600 dark:text-amber-400">
                          -{formatINR(p.period.transfersOutTotal)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-rose-600 dark:text-rose-400">
                          -{formatINR(p.period.expensesTotal)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedPartnerId(p.id)}
                              className="text-xs h-7 px-2.5"
                            >
                              Check Hisaab
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => openSendMoneyModal({ defaultSourceType: 'PARTNER', defaultSourceId: p.id })}
                              className="text-xs h-7 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center"
                            >
                              <Send className="w-3 h-3 mr-1" />
                              Send Money
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Company Bank Accounts Overview */}
          {bankAccounts.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-sky-500" />
                    Company Bank Accounts Overview
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Live balance across all active company bank accounts (Total: {formatINR(totalBankBalance)})
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedPartnerId('BANK_ALL')}
                  className="text-xs font-semibold"
                >
                  View Bank Ledger &rarr;
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                      <th className="py-3 px-4">Bank Name</th>
                      <th className="py-3 px-4">Account Name</th>
                      <th className="py-3 px-4">Account Last 4</th>
                      <th className="py-3 px-4 text-right">Available Balance</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {bankAccounts.map((b) => (
                      <tr
                        key={b.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                        onClick={() => setSelectedPartnerId(`BANK_${b.id}`)}
                      >
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-sky-500" />
                          {b.bankName}
                        </td>
                        <td className="py-3.5 px-4">{b.name}</td>
                        <td className="py-3.5 px-4 font-mono">{b.accountLast4 ? `..${b.accountLast4}` : '—'}</td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-sm text-sky-600 dark:text-sky-400">
                          {formatINR(b.balance)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPartnerId(`BANK_${b.id}`);
                            }}
                            className="text-xs h-7 px-2.5"
                          >
                            Check Bank Hisaab
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        // VIEW B & C: SELECTED PARTNER or BANK DETAILED LEDGER
        <div className="space-y-4">
          {/* Header Banner */}
          {isBankSelected ? (
            <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-600 text-white font-bold flex items-center justify-center text-sm shadow-md">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      {selectedBankAccount ? `${selectedBankAccount.bankName} (${selectedBankAccount.name}) Statement` : 'Company Bank Accounts Ledger'}
                    </h2>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-700 dark:text-sky-300">
                      BANK ACCOUNT
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Available Bank Balance: <strong className="font-mono text-sky-600 dark:text-sky-400">{formatINR(bankSummary?.selectedBankBalance ?? (selectedBankAccount?.balance ?? totalBankBalance))}</strong>
                    {selectedBankAccount?.accountLast4 ? ` • A/C: ..${selectedBankAccount.accountLast4}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedPartnerId('ALL')}
                  className="text-xs"
                >
                  &larr; View All Summary
                </Button>
                <Button
                  size="sm"
                  onClick={() => openSendMoneyModal({ defaultSourceType: 'BANK', defaultSourceId: selectedBankAccount?.id })}
                  className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  Send Money
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-md">
                  {selectedPartner?.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      {selectedPartner?.name}&apos;s Hisaab Statement
                    </h2>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-700 dark:text-indigo-300">
                      {selectedPartner?.role}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Current Balance: <strong className="font-mono text-emerald-600 dark:text-emerald-400">{formatINR(selectedPartner?.currentBalance)}</strong>
                    {selectedPartner?.mobile ? ` • Mobile: ${selectedPartner.mobile}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedPartnerId('ALL')}
                  className="text-xs"
                >
                  &larr; View All Partners
                </Button>
                <Button
                  size="sm"
                  onClick={() => openSendMoneyModal({ defaultSourceType: 'PARTNER', defaultSourceId: selectedPartner?.id })}
                  className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  Send Money
                </Button>
              </div>
            </div>
          )}

          {/* Ledger Toolbar (Search & Filter) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Type Filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setLedgerTypeFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 ${
                  ledgerTypeFilter === 'ALL'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                All Entries ({ledger.length})
              </button>
              <button
                type="button"
                onClick={() => setLedgerTypeFilter('RECEIPT')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 ${
                  ledgerTypeFilter === 'RECEIPT'
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {isBankSelected ? 'Client Receipts in Bank' : 'Client Receipts'}
              </button>
              {isBankSelected ? (
                <>
                  <button
                    type="button"
                    onClick={() => setLedgerTypeFilter('BANK_DEPOSIT')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 ${
                      ledgerTypeFilter === 'BANK_DEPOSIT'
                        ? 'bg-sky-600 text-white font-bold'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Bank Deposits
                  </button>
                  <button
                    type="button"
                    onClick={() => setLedgerTypeFilter('TRANSFER_OUT')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 ${
                      ledgerTypeFilter === 'TRANSFER_OUT'
                        ? 'bg-indigo-600 text-white font-bold'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Transfers to Partners
                  </button>
                  <button
                    type="button"
                    onClick={() => setLedgerTypeFilter('BANK_WITHDRAWAL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 ${
                      ledgerTypeFilter === 'BANK_WITHDRAWAL'
                        ? 'bg-amber-600 text-white font-bold'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Cash Withdrawals
                  </button>
                  <button
                    type="button"
                    onClick={() => setLedgerTypeFilter('EXPENSE')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 ${
                      ledgerTypeFilter === 'EXPENSE'
                        ? 'bg-rose-600 text-white font-bold'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Direct Payments
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setLedgerTypeFilter('TRANSFER_IN')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 ${
                      ledgerTypeFilter === 'TRANSFER_IN'
                        ? 'bg-sky-600 text-white font-bold'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Transfers Received
                  </button>
                  <button
                    type="button"
                    onClick={() => setLedgerTypeFilter('EXPENSE')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 ${
                      ledgerTypeFilter === 'EXPENSE'
                        ? 'bg-amber-600 text-white font-bold'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Site Expenses
                  </button>
                  <button
                    type="button"
                    onClick={() => setLedgerTypeFilter('TRANSFER_OUT')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 ${
                      ledgerTypeFilter === 'TRANSFER_OUT'
                        ? 'bg-indigo-600 text-white font-bold'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Transfers Out
                  </button>
                </>
              )}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={isBankSelected ? "Search bank records..." : "Search hisaab..."}
                value={ledgerSearchQuery}
                onChange={(e) => setLedgerSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Ledger Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Transaction Details</th>
                    <th className="py-3 px-4">Mode</th>
                    <th className="py-3 px-4 text-right">Inflow (+ Credit)</th>
                    <th className="py-3 px-4 text-right">Outflow (- Debit)</th>
                    <th className="py-3 px-4">Reference / Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {displayedLedger.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="font-semibold">{isBankSelected ? 'No bank transactions recorded for this period' : 'No transactions recorded for this partner in this period'}</p>
                        <p className="text-[11px] mt-1">Use the &quot;Send Money&quot; button above to record a new transaction.</p>
                      </td>
                    </tr>
                  ) : (
                    displayedLedger.map((entry) => {
                      const isCredit = entry.credit > 0;
                      return (
                        <tr key={entry.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                            {new Date(entry.date).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  entry.type === 'RECEIPT'
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                    : entry.type === 'TRANSFER_IN' || entry.type === 'BANK_WITHDRAWAL'
                                    ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20'
                                    : entry.type === 'TRANSFER_OUT'
                                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                }`}>
                                  {entry.categoryLabel}
                                </span>
                              </div>
                              <div className="font-bold text-slate-900 dark:text-white">
                                {entry.title}
                              </div>
                              {entry.subtitle && (
                                <div className="text-[11px] text-slate-400">
                                  {entry.subtitle}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                              {entry.paymentMethod}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold whitespace-nowrap text-emerald-600 dark:text-emerald-400">
                            {isCredit ? `+${formatINR(entry.credit)}` : '—'}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold whitespace-nowrap text-rose-600 dark:text-rose-400">
                            {!isCredit && entry.debit > 0 ? `-${formatINR(entry.debit)}` : '—'}
                          </td>
                          <td className="py-3.5 px-4 text-[11px] text-slate-500 dark:text-slate-400 max-w-xs truncate">
                            {entry.reference ? <span className="font-mono text-slate-600 dark:text-slate-300">{entry.reference} • </span> : ''}
                            {entry.notes || '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL: SEND MONEY / PAYMENT OUT */}
      <Modal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        title="Send Money / Transfer Payment"
        description="Send money from partner wallet or company bank to partners, bank deposit, workers, or record expense."
        size="xl"
      >
        <form onSubmit={handleSendMoneySubmit} className="space-y-4">
          {transferError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{transferError}</span>
            </div>
          )}

          {/* 1. PAY FROM (SOURCE ACCOUNT) */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-indigo-500" />
                Pay From (Source Account):
              </span>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Available: <strong className="font-mono text-emerald-600 dark:text-emerald-400">{formatINR(sourceAvailableBalance)}</strong>
              </span>
            </div>

            {/* Source Type Toggle */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  const defId = (selectedPartner && !isBankSelected) ? selectedPartner.id : (partners[0]?.id || '');
                  setSendMoneyForm((prev) => ({
                    ...prev,
                    sourceType: 'PARTNER',
                    sourceId: defId,
                    paymentMethod: 'CASH',
                    toPartnerId: prev.toPartnerId === defId ? (partners.find((p) => p.id !== defId)?.id || '') : prev.toPartnerId,
                  }));
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold text-center transition-all border flex items-center justify-center gap-1.5 ${
                  sendMoneyForm.sourceType === 'PARTNER'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Partner / Owner Wallet
              </button>
              <button
                type="button"
                onClick={() => {
                  const defBankId = selectedBankAccount?.id || (bankAccounts[0]?.id || '');
                  setSendMoneyForm((prev) => ({
                    ...prev,
                    sourceType: 'BANK',
                    sourceId: defBankId,
                    paymentMethod: 'BANK',
                    toBankAccountId: prev.toBankAccountId === defBankId ? (bankAccounts.find((b) => b.id !== defBankId)?.id || '') : prev.toBankAccountId,
                  }));
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold text-center transition-all border flex items-center justify-center gap-1.5 ${
                  sendMoneyForm.sourceType === 'BANK'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Landmark className="w-3.5 h-3.5" />
                Company Bank Account
              </button>
            </div>

            {/* Specific Source Dropdown */}
            {sendMoneyForm.sourceType === 'PARTNER' ? (
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Select Paying Partner / Owner <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={sendMoneyForm.sourceId}
                  onChange={(e) => {
                    const newSourceId = e.target.value;
                    setSendMoneyForm((prev) => ({
                      ...prev,
                      sourceId: newSourceId,
                      toPartnerId: prev.toPartnerId === newSourceId ? (partners.find((p) => p.id !== newSourceId)?.id || '') : prev.toPartnerId,
                    }));
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.role}) • Live Cash: {formatINR(p.currentBalance)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Select Company Bank Account <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={sendMoneyForm.sourceId}
                  onChange={(e) => {
                    const newBankId = e.target.value;
                    setSendMoneyForm((prev) => ({
                      ...prev,
                      sourceId: newBankId,
                      toBankAccountId: prev.toBankAccountId === newBankId ? (bankAccounts.find((b) => b.id !== newBankId)?.id || '') : prev.toBankAccountId,
                    }));
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} ({b.name}){b.accountLast4 ? ` ..${b.accountLast4}` : ''} • Bal: {formatINR(b.balance)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 2. SEND MONEY TO (DESTINATION SELECTOR) */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Send Money To (Destination):
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => setSendMoneyForm((prev) => ({ ...prev, destinationType: 'TO_PARTNER' }))}
                className={`p-2.5 rounded-xl text-center border transition-all flex flex-col items-center gap-1 ${
                  sendMoneyForm.destinationType === 'TO_PARTNER'
                    ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-500 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/20 font-bold'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold'
                }`}
              >
                <Users className="w-4 h-4 text-indigo-500" />
                <span className="text-xs">To Partner</span>
              </button>

              <button
                type="button"
                onClick={() => setSendMoneyForm((prev) => ({ ...prev, destinationType: 'INTERNAL_BANK_DEPOSIT' }))}
                className={`p-2.5 rounded-xl text-center border transition-all flex flex-col items-center gap-1 ${
                  sendMoneyForm.destinationType === 'INTERNAL_BANK_DEPOSIT'
                    ? 'bg-sky-50 dark:bg-sky-950/50 border-sky-500 text-sky-700 dark:text-sky-300 ring-2 ring-sky-500/20 font-bold'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold'
                }`}
              >
                <Landmark className="w-4 h-4 text-sky-500" />
                <span className="text-xs">{sendMoneyForm.sourceType === 'PARTNER' ? 'Bank Deposit' : 'Bank to Bank'}</span>
              </button>

              <button
                type="button"
                onClick={() => setSendMoneyForm((prev) => ({ ...prev, destinationType: 'TO_WORKER' }))}
                className={`p-2.5 rounded-xl text-center border transition-all flex flex-col items-center gap-1 ${
                  sendMoneyForm.destinationType === 'TO_WORKER'
                    ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-500 text-amber-700 dark:text-amber-300 ring-2 ring-amber-500/20 font-bold'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold'
                }`}
              >
                <User className="w-4 h-4 text-amber-500" />
                <span className="text-xs">To Worker</span>
              </button>

              <button
                type="button"
                onClick={() => setSendMoneyForm((prev) => ({ ...prev, destinationType: 'SELF_EXPENSE' }))}
                className={`p-2.5 rounded-xl text-center border transition-all flex flex-col items-center gap-1 ${
                  sendMoneyForm.destinationType === 'SELF_EXPENSE'
                    ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-500 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500/20 font-bold'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold'
                }`}
              >
                <Tag className="w-4 h-4 text-rose-500" />
                <span className="text-xs">Self Expense</span>
              </button>
            </div>
          </div>

          {/* 3. DESTINATION SPECIFIC FIELDS */}
          {/* Destination: TO_PARTNER */}
          {sendMoneyForm.destinationType === 'TO_PARTNER' && (
            <div className="space-y-3 p-3.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Select Recipient Partner / Owner <span className="text-rose-500">*</span>
                </label>
                <select
                  required={sendMoneyForm.destinationType === 'TO_PARTNER'}
                  value={sendMoneyForm.toPartnerId}
                  onChange={(e) => setSendMoneyForm((prev) => ({ ...prev, toPartnerId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Choose Recipient Partner --</option>
                  {partners
                    .filter((p) => sendMoneyForm.sourceType !== 'PARTNER' || p.id !== sendMoneyForm.sourceId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.role}) • Live Bal: {formatINR(p.currentBalance)}
                      </option>
                    ))}
                </select>
              </div>

              {/* Mode: Direct Funds vs From Client Receipt */}
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSendMoneyForm((prev) => ({ ...prev, transferSourceType: 'DIRECT', receiptId: '' }))}
                    className={`py-1.5 px-2.5 rounded-lg text-xs font-semibold text-center transition-all border ${
                      sendMoneyForm.transferSourceType === 'DIRECT'
                        ? 'bg-indigo-600 text-white border-indigo-600 font-bold'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    💵 Direct Funds
                  </button>
                  <button
                    type="button"
                    onClick={() => setSendMoneyForm((prev) => ({ ...prev, transferSourceType: 'FROM_RECEIPT' }))}
                    className={`py-1.5 px-2.5 rounded-lg text-xs font-semibold text-center transition-all border ${
                      sendMoneyForm.transferSourceType === 'FROM_RECEIPT'
                        ? 'bg-indigo-600 text-white border-indigo-600 font-bold'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    📑 From Client Payment Receipt
                  </button>
                </div>

                {sendMoneyForm.transferSourceType === 'FROM_RECEIPT' && (
                  <div className="pt-1.5 animate-fade-in">
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Select Client Payment Receipt <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required={sendMoneyForm.transferSourceType === 'FROM_RECEIPT'}
                      value={sendMoneyForm.receiptId}
                      onChange={(e) => handleReceiptSelection(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">-- Select Received Client Payment --</option>
                      {recentReceipts.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.clientName} • {formatINR(r.amount)} • {r.project?.name || 'Site'} ({new Date(r.date).toLocaleDateString('en-IN')})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Transfer Purpose
                </label>
                <select
                  value={sendMoneyForm.purpose}
                  onChange={(e) => setSendMoneyForm((prev) => ({ ...prev, purpose: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="PARTNER_TRANSFER">Site Expense Fund</option>
                  <option value="RA_BILL_SHARE">Payment Distribution</option>
                  <option value="ADVANCE">Partner Advance</option>
                  <option value="SETTLEMENT">Partner Settlement</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>
          )}

          {/* Destination: INTERNAL_BANK_DEPOSIT */}
          {sendMoneyForm.destinationType === 'INTERNAL_BANK_DEPOSIT' && (
            <div className="p-3.5 rounded-xl bg-sky-50/50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/40 space-y-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                {sendMoneyForm.sourceType === 'PARTNER' ? 'Select Target Company Bank (Deposit)' : 'Select Destination Bank Account'} <span className="text-rose-500">*</span>
              </label>
              <select
                required={sendMoneyForm.destinationType === 'INTERNAL_BANK_DEPOSIT'}
                value={sendMoneyForm.toBankAccountId}
                onChange={(e) => setSendMoneyForm((prev) => ({ ...prev, toBankAccountId: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="">-- Choose Company Bank Account --</option>
                {bankAccounts
                  .filter((b) => sendMoneyForm.sourceType !== 'BANK' || b.id !== sendMoneyForm.sourceId)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} ({b.name}){b.accountLast4 ? ` ..${b.accountLast4}` : ''} • Current Bal: {formatINR(b.balance)}
                    </option>
                  ))}
              </select>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {sendMoneyForm.sourceType === 'PARTNER'
                  ? 'Cash will be deducted from partner wallet and credited into this company bank account.'
                  : 'Funds will be transferred from source bank account to this destination bank account.'}
              </p>
            </div>
          )}

          {/* Destination: TO_WORKER */}
          {sendMoneyForm.destinationType === 'TO_WORKER' && (
            <div className="p-3.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Select Worker / Labour <span className="text-rose-500">*</span>
                </label>
                <select
                  required={sendMoneyForm.destinationType === 'TO_WORKER'}
                  value={sendMoneyForm.toWorkerId}
                  onChange={(e) => setSendMoneyForm((prev) => ({ ...prev, toWorkerId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">-- Select Worker --</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} {w.workerCode ? `(${w.workerCode})` : ''} {w.category ? `• ${w.category}` : ''} {w.mobile ? `• ${w.mobile}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Payment Reason <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={sendMoneyForm.workerReasonSelect}
                    onChange={(e) => setSendMoneyForm((prev) => ({ ...prev, workerReasonSelect: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="Salary / Wages">Salary / Wages</option>
                    <option value="Worker Advance">Worker Advance</option>
                    <option value="Worker Expense">Worker Expense / Kharcha</option>
                    <option value="Worker Food">Worker Food / Refreshments</option>
                    <option value="Site Labour Payment">Site Labour Payment</option>
                    <option value="Overtime Allowance">Overtime Allowance</option>
                    <option value="CUSTOM">+ Custom Reason / Other</option>
                  </select>
                </div>

                {sendMoneyForm.workerReasonSelect === 'CUSTOM' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Type Custom Reason <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required={sendMoneyForm.workerReasonSelect === 'CUSTOM'}
                      placeholder="e.g. Tools allowance, travel fare..."
                      value={sendMoneyForm.customWorkerReason}
                      onChange={(e) => setSendMoneyForm((prev) => ({ ...prev, customWorkerReason: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Destination: SELF_EXPENSE */}
          {sendMoneyForm.destinationType === 'SELF_EXPENSE' && (
            <div className="p-3.5 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Expense Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={sendMoneyForm.expenseCategorySelect}
                    onChange={(e) => setSendMoneyForm((prev) => ({ ...prev, expenseCategorySelect: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    {availableExpenseCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value="CUSTOM">+ Add New Custom Category...</option>
                  </select>
                </div>

                {sendMoneyForm.expenseCategorySelect === 'CUSTOM' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      New Category Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required={sendMoneyForm.expenseCategorySelect === 'CUSTOM'}
                      placeholder="e.g. Electrical fittings, Safety gear..."
                      value={sendMoneyForm.customCategoryName}
                      onChange={(e) => setSendMoneyForm((prev) => ({ ...prev, customCategoryName: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Expense Description / Item
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Lunch for 5 persons, 10 bags plaster cement"
                    value={sendMoneyForm.expenseDescription}
                    onChange={(e) => setSendMoneyForm((prev) => ({ ...prev, expenseDescription: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Vendor / Store / Person Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ram Hardware / Shell Petrol Pump"
                    value={sendMoneyForm.vendorName}
                    onChange={(e) => setSendMoneyForm((prev) => ({ ...prev, vendorName: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 4. COMMON TRANSACTION FIELDS */}
          {/* Amount & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Amount to Send (₹) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="5000"
                  value={sendMoneyForm.amount}
                  onChange={(e) => setSendMoneyForm((prev) => ({ ...prev, amount: e.target.value }))}
                  className="w-full pl-7 pr-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-black text-indigo-600 dark:text-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={sendMoneyForm.date}
                onChange={(e) => setSendMoneyForm((prev) => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Payment Method & Project */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Payment Mode <span className="text-rose-500">*</span>
              </label>
              <select
                value={sendMoneyForm.paymentMethod}
                onChange={(e) => setSendMoneyForm((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="CASH">Cash</option>
                <option value="UPI">UPI Transfer</option>
                <option value="BANK">Bank Transfer / NEFT</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Linked Project / Site (Optional)
              </label>
              <select
                value={sendMoneyForm.projectId}
                onChange={(e) => setSendMoneyForm((prev) => ({ ...prev, projectId: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- No Project (General) --</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.projectCode})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Reference & Notes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Reference / Txn ID
              </label>
              <input
                type="text"
                placeholder="e.g. UPI-928103 or CHQ-4402"
                value={sendMoneyForm.reference}
                onChange={(e) => setSendMoneyForm((prev) => ({ ...prev, reference: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Notes &amp; Remarks
              </label>
              <input
                type="text"
                placeholder="e.g. For plaster materials & labour"
                value={sendMoneyForm.notes}
                onChange={(e) => setSendMoneyForm((prev) => ({ ...prev, notes: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Footer Action Buttons (Sticky at bottom so always visible) */}
          <div className="sticky bottom-0 -mx-4 sm:-mx-5 -mb-4 sm:-mb-5 px-4 sm:px-5 py-3.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5 mt-5 z-20 shadow-lg">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsTransferModalOpen(false)}
              disabled={isSubmittingTransfer}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md"
              disabled={isSubmittingTransfer}
            >
              {isSubmittingTransfer ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Sending Money...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  Confirm &amp; Send Money {sendMoneyForm.amount ? `(${formatINR(parseFloat(sendMoneyForm.amount) || 0)})` : ''}
                </>
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
