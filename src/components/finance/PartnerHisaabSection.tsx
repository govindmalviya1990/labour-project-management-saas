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
  PieChart as PieChartIcon,
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { MetricCard } from '@/components/ui/MetricCard';
import { formatINR } from '@/lib/calculations';

export interface CategoryExpenseItem {
  category: string;
  label: string;
  amount: number;
  count: number;
  percentage: number;
  color: string;
}

export interface PartnerSummaryItem {
  id: string;
  name: string;
  email: string;
  mobile?: string;
  role: string;
  currentBalance: number;
  totalCredits: number;
  totalDebits: number;
  expensesByCategory?: CategoryExpenseItem[];
  totalExpensesAmount?: number;
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

export interface LedgerEntry {
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

export interface RecentReceipt {
  id: string;
  clientName: string;
  amount: number;
  date: string;
  paymentMethod: string;
  project?: { id: string; name: string };
  site?: { id: string; name: string };
  receivedBy?: { id: string; name: string };
}

export interface ProjectItem {
  id: string;
  name: string;
  projectCode: string;
  sites: { id: string; name: string }[];
}

export interface WorkerItem {
  id: string;
  name: string;
  workerCode?: string;
  category?: string;
  mobile?: string;
}

export interface PurposeOptionItem {
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

interface ExpenseDonutChartProps {
  title: string;
  subtitle: string;
  categories: CategoryExpenseItem[];
  totalAmount: number;
  isMounted: boolean;
  emptyLabel?: string;
}

function ExpenseDonutChart({
  title,
  subtitle,
  categories,
  totalAmount,
  isMounted,
  emptyLabel = 'No expenses recorded in this period',
}: ExpenseDonutChartProps) {
  const hasData = isMounted && categories && categories.length > 0 && totalAmount > 0;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-600/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-sm">
            <PieChartIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                {title}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 uppercase tracking-wider">
                Round Chart
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {categories.length} {categories.length === 1 ? 'Category' : 'Categories'}
          </span>
          <span className="text-xs font-bold px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
            Total: {formatINR(totalAmount)}
          </span>
        </div>
      </div>

      {/* Content */}
      {!hasData ? (
        <div className="py-10 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full border-4 border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center mb-3">
            <PieChartIcon className="w-7 h-7 text-slate-400 opacity-50" />
          </div>
          <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
            {emptyLabel}
          </p>
          <p className="text-[11px] text-slate-400 max-w-sm mt-1">
            When site expenses, goods purchases, or personal expenses are recorded, they will show up here categorized with percentages.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Round Donut Visual */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center">
            <div className="h-60 sm:h-64 w-full relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload as CategoryExpenseItem;
                        return (
                          <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 p-3 rounded-xl text-white text-xs shadow-xl min-w-[160px]">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: d.color }}
                              />
                              <span className="font-bold text-slate-100">{d.label}</span>
                            </div>
                            <div className="text-amber-400 font-black text-sm font-mono">
                              {formatINR(d.amount)}
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5 pt-1.5 border-t border-slate-800">
                              <span>{d.count} transaction{d.count > 1 ? 's' : ''}</span>
                              <span className="text-emerald-400 font-bold">{d.percentage}%</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Pie
                    data={categories}
                    dataKey="amount"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={62}
                    outerRadius={96}
                    paddingAngle={3}
                  >
                    {categories.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              {/* Center Donut Hole Content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Total Expense</span>
                <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-mono">
                  {formatINR(totalAmount)}
                </span>
                <span className="text-[10px] text-slate-500 font-medium mt-0.5">
                  {categories.length} {categories.length === 1 ? 'category' : 'categories'}
                </span>
              </div>
            </div>
          </div>

          {/* Category List & Percentage Legend */}
          <div className="lg:col-span-7 space-y-2 max-h-72 overflow-y-auto pr-1">
            {categories.map((item) => (
              <div
                key={item.category}
                className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-3 h-3 rounded-md shrink-0 shadow-sm"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                      {item.label}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium shrink-0">
                      ({item.count} tx)
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {formatINR(item.amount)}
                    </span>
                    <span
                      className="text-[10px] font-black px-1.5 py-0.5 rounded text-white min-w-[42px] text-center"
                      style={{ backgroundColor: item.color }}
                    >
                      {item.percentage}%
                    </span>
                  </div>
                </div>
                {/* Visual Progress Bar */}
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(item.percentage, 100)}%`, backgroundColor: item.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export interface PartnerHisaabSectionProps {
  showHeaderTitle?: boolean;
  initialPartnerId?: string;
  initialPeriod?: 'today' | 'weekly' | 'monthly' | 'custom' | 'all';
}

export function PartnerHisaabSection({
  showHeaderTitle = true,
  initialPartnerId = 'ALL',
  initialPeriod = 'monthly',
}: PartnerHisaabSectionProps) {
  const [partners, setPartners] = useState<PartnerSummaryItem[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(initialPartnerId);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [recentReceipts, setRecentReceipts] = useState<RecentReceipt[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [totalBankBalance, setTotalBankBalance] = useState<number>(0);
  const [bankSummary, setBankSummary] = useState<any>(null);
  const [workers, setWorkers] = useState<WorkerItem[]>([]);
  const [purposeOptions, setPurposeOptions] = useState<PurposeOptionItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [overallExpensesByCategory, setOverallExpensesByCategory] = useState<CategoryExpenseItem[]>([]);
  const [overallExpensesTotal, setOverallExpensesTotal] = useState<number>(0);
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Period Filters
  const [period, setPeriod] = useState<'today' | 'weekly' | 'monthly' | 'custom' | 'all'>(initialPeriod);
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
      setOverallExpensesByCategory(data.overallExpensesByCategory || []);
      setOverallExpensesTotal(data.overallExpensesTotal || 0);
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
      setTransferError('Please select a source account (paying partner or bank).');
      return;
    }

    if (sendMoneyForm.destinationType === 'TO_PARTNER') {
      if (!sendMoneyForm.toPartnerId) {
        setTransferError('Please select the recipient partner.');
        return;
      }
      if (sendMoneyForm.sourceType === 'PARTNER' && sendMoneyForm.sourceId === sendMoneyForm.toPartnerId) {
        setTransferError('Sender partner and recipient partner cannot be the same person.');
        return;
      }
    }

    if (sendMoneyForm.destinationType === 'INTERNAL_BANK_DEPOSIT') {
      if (!sendMoneyForm.toBankAccountId) {
        setTransferError('Please select the receiving bank account.');
        return;
      }
      if (sendMoneyForm.sourceType === 'BANK' && sendMoneyForm.sourceId === sendMoneyForm.toBankAccountId) {
        setTransferError('Source bank and receiving bank cannot be the same.');
        return;
      }
    }

    if (sendMoneyForm.destinationType === 'TO_WORKER') {
      if (!sendMoneyForm.toWorkerId) {
        setTransferError('Please select the worker to pay.');
        return;
      }
    }

    setIsSubmittingTransfer(true);
    try {
      const finalWorkerReason =
        sendMoneyForm.workerReasonSelect === '__CUSTOM__'
          ? sendMoneyForm.customWorkerReason.trim() || 'Worker Payment'
          : sendMoneyForm.workerReasonSelect;

      const finalExpenseCategory =
        sendMoneyForm.expenseCategorySelect === '__CUSTOM__'
          ? sendMoneyForm.customCategoryName.trim() || 'Miscellaneous'
          : sendMoneyForm.expenseCategorySelect;

      const payload = {
        sourceType: sendMoneyForm.sourceType,
        sourceId: sendMoneyForm.sourceId,
        destinationType: sendMoneyForm.destinationType,
        toPartnerId: sendMoneyForm.toPartnerId,
        receiptId: sendMoneyForm.transferSourceType === 'FROM_RECEIPT' ? sendMoneyForm.receiptId : undefined,
        toBankAccountId: sendMoneyForm.toBankAccountId,
        toWorkerId: sendMoneyForm.toWorkerId,
        workerReason: finalWorkerReason,
        expenseCategory: finalExpenseCategory,
        expenseDescription: sendMoneyForm.expenseDescription,
        vendorName: sendMoneyForm.vendorName,
        amount: parsedAmount,
        date: sendMoneyForm.date,
        paymentMethod: sendMoneyForm.paymentMethod,
        purpose:
          sendMoneyForm.destinationType === 'TO_PARTNER'
            ? 'PARTNER_TRANSFER'
            : sendMoneyForm.destinationType === 'INTERNAL_BANK_DEPOSIT'
            ? 'BANK_DEPOSIT'
            : sendMoneyForm.destinationType === 'TO_WORKER'
            ? finalWorkerReason
            : finalExpenseCategory,
        projectId: sendMoneyForm.projectId || undefined,
        siteId: sendMoneyForm.siteId || undefined,
        reference: sendMoneyForm.reference || undefined,
        notes: sendMoneyForm.notes || undefined,
      };

      const res = await fetch('/api/finance/partner-hisaab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to record transaction');
      }

      setSuccessMessage(resData.message || 'Transaction recorded successfully!');
      setIsTransferModalOpen(false);
      loadPartnerHisaab();
    } catch (err: any) {
      setTransferError(err.message || 'Something went wrong while recording transaction');
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  if (isLoading && partners.length === 0) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-20 bg-slate-100 dark:bg-slate-800/60 rounded-2xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-100 dark:bg-slate-800/60 rounded-2xl" />
          ))}
        </div>
        <div className="h-72 bg-slate-100 dark:bg-slate-800/60 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6">
      {/* 1. Header Toolbar (Optional) */}
      {showHeaderTitle && (
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
      )}

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
          {/* Round Chart: Total Expense Category-wise (All Partners & Sites) */}
          <ExpenseDonutChart
            title="Category-wise Expense Breakdown (All Partners & Sites)"
            subtitle="Overall expenses recorded across all partner wallets and sites for the selected period"
            categories={overallExpensesByCategory}
            totalAmount={overallExpensesTotal || allPartnersTotals.expenses}
            isMounted={isMounted}
            emptyLabel="No partner or site expenses recorded for this period"
          />

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
                        <td className="py-3.5 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                          +{formatINR(p.period.receiptsTotal)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-sky-600 dark:text-sky-400 font-semibold">
                          +{formatINR(p.period.transfersInTotal)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                          -{formatINR(p.period.transfersOutTotal)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-amber-600 dark:text-amber-400 font-semibold">
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
                              className="text-xs h-7 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
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
                    Company Bank Accounts
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Official bank balances available for project operations &amp; transfers
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => openSendMoneyModal({ defaultSourceType: 'BANK', defaultSourceId: bankAccounts[0]?.id })}
                  className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs"
                >
                  <Send className="w-3.5 h-3.5 mr-1" />
                  Bank Transfer / Pay
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                      <th className="py-3 px-4">Bank Name</th>
                      <th className="py-3 px-4">Account Label</th>
                      <th className="py-3 px-4">A/C Last 4</th>
                      <th className="py-3 px-4 text-right">Available Balance</th>
                      <th className="py-3 px-4 text-center">Actions</th>
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

          {/* Personal Partner Round Chart */}
          {selectedPartner && (
            <ExpenseDonutChart
              title={`${selectedPartner.name}'s Category-wise Expense Breakdown`}
              subtitle={`Personal expenses paid from ${selectedPartner.name}'s wallet for the selected period`}
              categories={selectedPartner.expensesByCategory || []}
              totalAmount={selectedPartner.totalExpensesAmount || selectedPartner.period.expensesTotal || 0}
              isMounted={isMounted}
              emptyLabel={`No expenses recorded for ${selectedPartner.name} in this period`}
            />
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

            {/* Source Account Dropdown */}
            {sendMoneyForm.sourceType === 'PARTNER' ? (
              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Select Paying Partner / Owner:
                </label>
                <select
                  value={sendMoneyForm.sourceId}
                  onChange={(e) => {
                    const newSrcId = e.target.value;
                    setSendMoneyForm((prev) => ({
                      ...prev,
                      sourceId: newSrcId,
                      toPartnerId: prev.toPartnerId === newSrcId ? (partners.find((p) => p.id !== newSrcId)?.id || '') : prev.toPartnerId,
                    }));
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.role}) • Wallet Bal: {formatINR(p.currentBalance)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Select Paying Bank Account:
                </label>
                <select
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
                      {b.bankName} - {b.name} {b.accountLast4 ? `(..${b.accountLast4})` : ''} • Bal: {formatINR(b.balance)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 2. TRANSFER DESTINATION (SEND TO) */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-indigo-500" />
              Transfer Destination (Send Money To):
            </span>

            {/* Destination Mode Selector (4 Options) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setSendMoneyForm((prev) => ({ ...prev, destinationType: 'TO_PARTNER' }))}
                className={`py-2 px-2.5 rounded-lg text-xs font-bold text-center transition-all border flex flex-col items-center justify-center gap-1 ${
                  sendMoneyForm.destinationType === 'TO_PARTNER'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>To Partner</span>
              </button>
              <button
                type="button"
                onClick={() => setSendMoneyForm((prev) => ({ ...prev, destinationType: 'INTERNAL_BANK_DEPOSIT' }))}
                className={`py-2 px-2.5 rounded-lg text-xs font-bold text-center transition-all border flex flex-col items-center justify-center gap-1 ${
                  sendMoneyForm.destinationType === 'INTERNAL_BANK_DEPOSIT'
                    ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Landmark className="w-4 h-4" />
                <span>Bank Deposit</span>
              </button>
              <button
                type="button"
                onClick={() => setSendMoneyForm((prev) => ({ ...prev, destinationType: 'TO_WORKER' }))}
                className={`py-2 px-2.5 rounded-lg text-xs font-bold text-center transition-all border flex flex-col items-center justify-center gap-1 ${
                  sendMoneyForm.destinationType === 'TO_WORKER'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <User className="w-4 h-4" />
                <span>To Worker</span>
              </button>
              <button
                type="button"
                onClick={() => setSendMoneyForm((prev) => ({ ...prev, destinationType: 'SELF_EXPENSE' }))}
                className={`py-2 px-2.5 rounded-lg text-xs font-bold text-center transition-all border flex flex-col items-center justify-center gap-1 ${
                  sendMoneyForm.destinationType === 'SELF_EXPENSE'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Tag className="w-4 h-4" />
                <span>Self / Expense</span>
              </button>
            </div>

            {/* Destination 1: Partner Options */}
            {sendMoneyForm.destinationType === 'TO_PARTNER' && (
              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Select Receiving Partner:
                  </label>
                  <select
                    value={sendMoneyForm.toPartnerId}
                    onChange={(e) => setSendMoneyForm((prev) => ({ ...prev, toPartnerId: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Choose Recipient Partner --</option>
                    {partners
                      .filter((p) => p.id !== sendMoneyForm.sourceId || sendMoneyForm.sourceType === 'BANK')
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.role}) • Wallet Bal: {formatINR(p.currentBalance)}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Transfer Source Type (Direct vs Client Receipt) */}
                <div className="flex items-center gap-4 text-xs font-semibold pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="transferSourceType"
                      checked={sendMoneyForm.transferSourceType === 'DIRECT'}
                      onChange={() => setSendMoneyForm((prev) => ({ ...prev, transferSourceType: 'DIRECT', receiptId: '' }))}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Direct Balance Transfer</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="transferSourceType"
                      checked={sendMoneyForm.transferSourceType === 'FROM_RECEIPT'}
                      onChange={() => setSendMoneyForm((prev) => ({ ...prev, transferSourceType: 'FROM_RECEIPT' }))}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Pass from Received Client Payment</span>
                  </label>
                </div>

                {sendMoneyForm.transferSourceType === 'FROM_RECEIPT' && (
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      Select Client Receipt to Transfer:
                    </label>
                    <select
                      value={sendMoneyForm.receiptId}
                      onChange={(e) => handleReceiptSelection(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">-- Choose Client Receipt --</option>
                      {recentReceipts.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.clientName} - {formatINR(r.amount)} ({r.project?.name || 'Project'} • {new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Destination 2: Bank Deposit Options */}
            {sendMoneyForm.destinationType === 'INTERNAL_BANK_DEPOSIT' && (
              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Select Receiving Company Bank Account:
                  </label>
                  <select
                    value={sendMoneyForm.toBankAccountId}
                    onChange={(e) => setSendMoneyForm((prev) => ({ ...prev, toBankAccountId: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="">-- Choose Receiving Bank --</option>
                    {bankAccounts
                      .filter((b) => b.id !== sendMoneyForm.sourceId || sendMoneyForm.sourceType === 'PARTNER')
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.bankName} - {b.name} {b.accountLast4 ? `(..${b.accountLast4})` : ''} • Current Bal: {formatINR(b.balance)}
                        </option>
                      ))}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {sendMoneyForm.sourceType === 'PARTNER'
                      ? 'Partner cash will be deposited into this company bank account.'
                      : 'Internal bank transfer between company accounts.'}
                  </p>
                </div>
              </div>
            )}

            {/* Destination 3: Worker Payment Options */}
            {sendMoneyForm.destinationType === 'TO_WORKER' && (
              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Select Worker / Labour:
                  </label>
                  <select
                    value={sendMoneyForm.toWorkerId}
                    onChange={(e) => setSendMoneyForm((prev) => ({ ...prev, toWorkerId: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                    value={sendMoneyForm.workerReasonSelect}
                    onChange={(e) => setSendMoneyForm((prev) => ({ ...prev, workerReasonSelect: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Salary / Wages">Salary / Wages</option>
                    <option value="Labour Advance">Labour Advance</option>
                    <option value="Worker Food & Tea (Kharcha)">Worker Food &amp; Tea (Kharcha)</option>
                    <option value="Worker Travel / Petrol">Worker Travel / Petrol</option>
                    <option value="Worker Emergency / Medical">Worker Emergency / Medical</option>
                    <option value="Worker Grocery">Worker Grocery</option>
                    <option value="__CUSTOM__">+ Add Custom Reason / Category...</option>
                  </select>
                </div>

                {sendMoneyForm.workerReasonSelect === '__CUSTOM__' && (
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      Custom Reason Name:
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Festival Bonus, Overtime Kharcha"
                      value={sendMoneyForm.customWorkerReason}
                      onChange={(e) => setSendMoneyForm((prev) => ({ ...prev, customWorkerReason: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Destination 4: Self / Site Expense Options */}
            {sendMoneyForm.destinationType === 'SELF_EXPENSE' && (
              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Expense Category:
                  </label>
                  <select
                    value={sendMoneyForm.expenseCategorySelect}
                    onChange={(e) => setSendMoneyForm((prev) => ({ ...prev, expenseCategorySelect: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {availableExpenseCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value="__CUSTOM__">+ Create New Custom Category...</option>
                  </select>
                </div>

                {sendMoneyForm.expenseCategorySelect === '__CUSTOM__' && (
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      New Category Name:
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Generator Fuel, Client Lunch, Hardware"
                      value={sendMoneyForm.customCategoryName}
                      onChange={(e) => setSendMoneyForm((prev) => ({ ...prev, customCategoryName: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      Expense Description:
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Petrol for site visit, cement bags"
                      value={sendMoneyForm.expenseDescription}
                      onChange={(e) => setSendMoneyForm((prev) => ({ ...prev, expenseDescription: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      Vendor / Shop Name (Optional):
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Sharma Hardware, HP Petrol Pump"
                      value={sendMoneyForm.vendorName}
                      onChange={(e) => setSendMoneyForm((prev) => ({ ...prev, vendorName: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 3. COMMON FIELDS (AMOUNT, DATE, METHOD, PROJECT, NOTES) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                Amount (₹) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                <input
                  type="number"
                  step="any"
                  min="1"
                  required
                  placeholder="0.00"
                  value={sendMoneyForm.amount}
                  onChange={(e) => setSendMoneyForm((prev) => ({ ...prev, amount: e.target.value }))}
                  className="w-full pl-8 pr-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                Transaction Date *
              </label>
              <input
                type="date"
                required
                value={sendMoneyForm.date}
                onChange={(e) => setSendMoneyForm((prev) => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                Payment Method:
              </label>
              <select
                value={sendMoneyForm.paymentMethod}
                onChange={(e) => setSendMoneyForm((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="CASH">Cash in Hand</option>
                <option value="BANK">Bank Transfer (NEFT/RTGS/IMPS)</option>
                <option value="UPI">UPI / QR Code</option>
                <option value="CHEQUE">Cheque</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                Link to Project (Optional):
              </label>
              <select
                value={sendMoneyForm.projectId}
                onChange={(e) => {
                  const projId = e.target.value;
                  const proj = projects.find((p) => p.id === projId);
                  setSendMoneyForm((prev) => ({
                    ...prev,
                    projectId: projId,
                    siteId: proj?.sites[0]?.id || '',
                  }));
                }}
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- No Specific Project --</option>
                {projects.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.name} ({pr.projectCode})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
              Reference / UTR / Remarks (Optional):
            </label>
            <input
              type="text"
              placeholder="e.g. UTR123456, Paid via GPay, Cash handed over"
              value={sendMoneyForm.notes}
              onChange={(e) => setSendMoneyForm((prev) => ({ ...prev, notes: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsTransferModalOpen(false)}
              disabled={isSubmittingTransfer}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmittingTransfer}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
            >
              {isSubmittingTransfer ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Recording Transaction...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  Confirm &amp; Send Money
                </>
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
