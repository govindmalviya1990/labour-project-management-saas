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

export default function PartnerHisaabPage() {
  const [partners, setPartners] = useState<PartnerSummaryItem[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('ALL');
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [recentReceipts, setRecentReceipts] = useState<RecentReceipt[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [totalBankBalance, setTotalBankBalance] = useState<number>(0);
  const [bankSummary, setBankSummary] = useState<any>(null);
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

  // Transfer Modal State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);
  const [transferError, setTransferError] = useState('');

  // Transfer Form State
  const [transferForm, setTransferForm] = useState({
    fromUserId: '',
    toUserId: '',
    transferSourceType: 'DIRECT', // 'DIRECT' or 'FROM_RECEIPT'
    receiptId: '',
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

  // Open Transfer Modal for specific partner
  const openTransferModal = (targetPartnerId?: string) => {
    setTransferError('');
    const defaultRecipient = targetPartnerId || (selectedPartner ? selectedPartner.id : '');
    setTransferForm({
      fromUserId: '',
      toUserId: defaultRecipient,
      transferSourceType: 'DIRECT',
      receiptId: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      paymentMethod: isBankSelected ? 'BANK' : 'CASH',
      purpose: 'PARTNER_TRANSFER',
      projectId: '',
      siteId: '',
      reference: '',
      notes: '',
    });
    setIsTransferModalOpen(true);
  };

  // When selecting a receipt in the transfer form, auto-fill amount & details
  const handleReceiptSelection = (rcptId: string) => {
    const rcpt = recentReceipts.find((r) => r.id === rcptId);
    if (rcpt) {
      setTransferForm((prev) => ({
        ...prev,
        receiptId: rcpt.id,
        amount: String(rcpt.amount),
        projectId: rcpt.project?.id || prev.projectId,
        paymentMethod: rcpt.paymentMethod || prev.paymentMethod,
        notes: `Transfer of client receipt received from ${rcpt.clientName} (${rcpt.project?.name || ''})`,
      }));
    } else {
      setTransferForm((prev) => ({ ...prev, receiptId: '' }));
    }
  };

  // Submit Partner Fund Transfer
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransferError('');

    if (!transferForm.toUserId) {
      setTransferError('Please select the partner or owner who will receive this payment.');
      return;
    }

    const parsedAmount = parseFloat(transferForm.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setTransferError('Please enter a valid transfer amount greater than ₹0.');
      return;
    }

    if (!transferForm.date) {
      setTransferError('Please select the transfer date.');
      return;
    }

    setIsSubmittingTransfer(true);
    try {
      const res = await fetch('/api/finance/partner-hisaab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toUserId: transferForm.toUserId,
          amount: parsedAmount,
          date: transferForm.date,
          paymentMethod: transferForm.paymentMethod,
          purpose: transferForm.purpose,
          projectId: transferForm.projectId || null,
          siteId: transferForm.siteId || null,
          receiptId: transferForm.transferSourceType === 'FROM_RECEIPT' ? transferForm.receiptId || null : null,
          reference: transferForm.reference.trim() || null,
          notes: transferForm.notes.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to record partner transfer');
      }

      setSuccessMessage(data.message || 'Payment successfully transferred to partner!');
      setIsTransferModalOpen(false);
      loadPartnerHisaab();
    } catch (err: any) {
      setTransferError(err.message || 'Error processing transfer');
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
              onClick={() => openTransferModal(selectedPartner?.id)}
            >
              <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" />
              Transfer
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
                onClick={() => openTransferModal()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 mr-1" />
                Transfer Payment
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
                              onClick={() => openTransferModal(p.id)}
                              className="text-xs h-7 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                            >
                              Transfer
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
                  onClick={() => openTransferModal()}
                  className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" />
                  Transfer to Partner
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
                  onClick={() => openTransferModal(selectedPartner?.id)}
                  className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" />
                  Transfer to {selectedPartner?.name}
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
                        <p className="text-[11px] mt-1">Use the &quot;Transfer&quot; button above to record a new transaction.</p>
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

      {/* 6. MODAL: TRANSFER PAYMENT TO PARTNER */}
      <Modal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        title="Transfer Payment to Partner / Owner"
        description="Transfer received site payments or company cash to a partner's wallet."
        size="md"
      >
        <form onSubmit={handleTransferSubmit} className="space-y-4">
          {transferError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{transferError}</span>
            </div>
          )}

          {/* Transfer Source Switch: Direct Transfer vs From Received Client Payment */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Transfer Type / Source:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTransferForm({ ...transferForm, transferSourceType: 'DIRECT', receiptId: '' })}
                className={`py-2 px-3 rounded-lg text-xs font-semibold text-center transition-all border ${
                  transferForm.transferSourceType === 'DIRECT'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm font-bold'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                💵 Direct Cash Transfer
              </button>
              <button
                type="button"
                onClick={() => setTransferForm({ ...transferForm, transferSourceType: 'FROM_RECEIPT' })}
                className={`py-2 px-3 rounded-lg text-xs font-semibold text-center transition-all border ${
                  transferForm.transferSourceType === 'FROM_RECEIPT'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm font-bold'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                📑 From Received Payment
              </button>
            </div>

            {/* If FROM_RECEIPT selected, show dropdown of client payments */}
            {transferForm.transferSourceType === 'FROM_RECEIPT' && (
              <div className="pt-2 animate-fade-in">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Select Received Payment <span className="text-rose-500">*</span>
                </label>
                <select
                  required={transferForm.transferSourceType === 'FROM_RECEIPT'}
                  value={transferForm.receiptId}
                  onChange={(e) => handleReceiptSelection(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Select Received Payment --</option>
                  {recentReceipts.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.clientName} • {formatINR(r.amount)} • {r.project?.name || 'Site'} ({new Date(r.date).toLocaleDateString('en-IN')})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Selecting a receipt auto-fills the amount and links it to that client payment.
                </p>
              </div>
            )}
          </div>

          {/* Recipient Partner / Owner */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select Recipient Partner / Owner <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={transferForm.toUserId}
              onChange={(e) => setTransferForm({ ...transferForm, toUserId: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">-- Choose Partner or Owner --</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.role}) — Current Balance: {formatINR(p.currentBalance)}
                </option>
              ))}
            </select>
          </div>

          {/* Amount & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Amount to Transfer (₹) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                required
                placeholder="50000"
                value={transferForm.amount}
                onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-indigo-600 dark:text-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Transfer Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={transferForm.date}
                onChange={(e) => setTransferForm({ ...transferForm, date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Payment Method & Purpose */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Payment Mode <span className="text-rose-500">*</span>
              </label>
              <select
                value={transferForm.paymentMethod}
                onChange={(e) => setTransferForm({ ...transferForm, paymentMethod: e.target.value })}
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
                Transfer Purpose
              </label>
              <select
                value={transferForm.purpose}
                onChange={(e) => setTransferForm({ ...transferForm, purpose: e.target.value })}
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

          {/* Optional Project / Site */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Linked Project / Site (Optional)
            </label>
            <select
              value={transferForm.projectId}
              onChange={(e) => setTransferForm({ ...transferForm, projectId: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">-- Select Project (Optional) --</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.projectCode})
                </option>
              ))}
            </select>
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
                value={transferForm.reference}
                onChange={(e) => setTransferForm({ ...transferForm, reference: e.target.value })}
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
                value={transferForm.notes}
                onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
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
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
              disabled={isSubmittingTransfer}
            >
              {isSubmittingTransfer ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Transferring...
                </>
              ) : (
                'Confirm & Transfer Money'
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
