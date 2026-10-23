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
  Pencil,
  Trash2,
  History,
  Lock,
  Truck,
  Loader2,
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
  openingBalance?: number;
  openingBalanceDate?: string | null;
  openingBalanceNote?: string | null;
  expensesByCategory?: CategoryExpenseItem[];
  totalExpensesAmount?: number;
  period: {
    receiptsTotal: number;
    receiptsCount: number;
    transfersInTotal: number;
    transfersInCount: number;
    transfersOutTotal: number;
    transfersOutCount: number;
    supplierPaymentsTotal?: number;
    supplierPaymentsCount?: number;
    workerPaymentsTotal?: number;
    workerPaymentsCount?: number;
    combinedTransfersOutTotal?: number;
    combinedTransfersOutCount?: number;
    expensesTotal: number;
    expensesCount: number;
  };
}

export interface LedgerEntry {
  id: string;
  rawId: string;
  date: string;
  type: 'RECEIPT' | 'TRANSFER_IN' | 'BANK_WITHDRAWAL' | 'TRANSFER_OUT' | 'EXPENSE' | 'BANK_DEPOSIT' | 'OPENING_BALANCE' | 'BALANCE_BROUGHT_FORWARD' | 'TRANSFER' | 'WORKER_PAYMENT' | 'SUPPLIER_PAYMENT';
  entityType?: string;
  model?: string;
  categoryLabel: string;
  title: string;
  subtitle?: string;
  credit: number;
  debit: number;
  amount?: number;
  runningBalance?: number;
  paymentMethod: string;
  receivedIn?: string;
  reference?: string;
  notes?: string;
  remarks?: string;
  description?: string;
  category?: string;
  projectId?: string;
  siteId?: string;
  workerId?: string;
  workerName?: string;
  toWorkerId?: string;
  fromUserId?: string;
  toUserId?: string;
  isEdited?: boolean;
  editReason?: string | null;
  isDeleted?: boolean;
  deletedAt?: string | null;
  deleteReason?: string | null;
  canEdit?: boolean;
  canDelete?: boolean;
  isNonEditable?: boolean;
  isWorkerPayment?: boolean;
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

export interface WorkerQueueItem {
  id: string;
  workerId: string;
  workerName: string;
  workerCode?: string;
  category: string;
  amount: number;
}

export interface ExpenseQueueItem {
  id: string;
  category: string;
  description: string;
  vendor?: string;
  amount: number;
}

export interface PurposeOptionItem {
  id: string;
  name: string;
  type: string;
}

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
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-600/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-sm shrink-0">
            <PieChartIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <h2 className="text-xs sm:text-base font-bold text-slate-900 dark:text-white truncate">
                {title}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 uppercase tracking-wider shrink-0">
                Round Chart
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1 sm:line-clamp-none">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <span className="text-[11px] sm:text-xs font-semibold px-2 sm:px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {categories.length} {categories.length === 1 ? 'Category' : 'Categories'}
          </span>
          <span className="text-[11px] sm:text-xs font-bold px-2.5 sm:px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono truncate max-w-[170px] sm:max-w-none">
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-center">
          {/* Round Donut Visual */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center">
            <div className="h-56 sm:h-64 w-full relative flex items-center justify-center">
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
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {categories.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              {/* Center Donut Hole Content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-2 text-center">
                <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-slate-400">Total Expense</span>
                <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white font-mono truncate max-w-[120px] sm:max-w-[160px]">
                  {formatINR(totalAmount)}
                </span>
                <span className="text-[9px] sm:text-[10px] text-slate-500 font-medium mt-0.5">
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
  initialPeriod?: 'today' | 'single_day' | 'weekly' | 'monthly' | 'custom' | 'all';
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
  const [suppliers, setSuppliers] = useState<any[]>([]);
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
  const [period, setPeriod] = useState<'today' | 'single_day' | 'weekly' | 'monthly' | 'custom' | 'all'>(initialPeriod);
  const [selectedSingleDate, setSelectedSingleDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [ledgerSearchQuery, setLedgerSearchQuery] = useState('');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState('ALL');
  const [showMobileTableMatrix, setShowMobileTableMatrix] = useState(false);
  const [showMobileTableLedger, setShowMobileTableLedger] = useState(false);

  // Single Day quick helper functions (IST Safe)
  const getTodayStr = () => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  };

  const getYesterdayStr = () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(yesterday);
  };

  const shiftSingleDate = (days: number) => {
    const baseStr = selectedSingleDate || getTodayStr();
    const parts = baseStr.split('-').map(Number);
    if (parts.length === 3) {
      const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + days, 12, 0, 0));
      setSelectedSingleDate(d.toISOString().split('T')[0]);
    } else {
      setSelectedSingleDate(getTodayStr());
    }
  };
  const formatReadableDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        return d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
      }
      return new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Send Money Modal State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);
  const [transferError, setTransferError] = useState('');

  // Send Money Form State
  const [sendMoneyForm, setSendMoneyForm] = useState({
    sourceType: 'PARTNER' as 'PARTNER' | 'BANK',
    sourceId: '',
    destinationType: 'TO_PARTNER' as 'TO_PARTNER' | 'INTERNAL_BANK_DEPOSIT' | 'TO_WORKER' | 'SELF_EXPENSE' | 'TO_SUPPLIER',
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
    // Destination 5: Supplier
    toSupplierId: '',
    toPurchaseBillId: '',
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

  // Bulk Worker Payment Queue & Inline Worker Form State
  const [workerPaymentQueue, setWorkerPaymentQueue] = useState<WorkerQueueItem[]>([]);
  const [queueError, setQueueError] = useState('');
  const [workerAmountInput, setWorkerAmountInput] = useState('');
  const [showAddWorkerInline, setShowAddWorkerInline] = useState(false);
  const [inlineWorkerName, setInlineWorkerName] = useState('');
  const [inlineWorkerMobile, setInlineWorkerMobile] = useState('');
  const [inlineWorkerWage, setInlineWorkerWage] = useState('800');
  const [isSavingInlineWorker, setIsSavingInlineWorker] = useState(false);
  const [inlineWorkerError, setInlineWorkerError] = useState('');

  // Bulk Expense Queue State
  const [expenseQueue, setExpenseQueue] = useState<ExpenseQueueItem[]>([]);
  const [expenseQueueError, setExpenseQueueError] = useState('');
  const [expenseAmountInput, setExpenseAmountInput] = useState('');
  const [expenseDescriptionInput, setExpenseDescriptionInput] = useState('');
  const [expenseVendorInput, setExpenseVendorInput] = useState('');

  // Custom Category & Custom Reason Saving State
  const [isSavingCustomCategory, setIsSavingCustomCategory] = useState(false);
  const [customCategoryError, setCustomCategoryError] = useState('');
  const [isSavingCustomWorkerReason, setIsSavingCustomWorkerReason] = useState(false);
  const [customWorkerReasonError, setCustomWorkerReasonError] = useState('');

  // Role & Show Deleted Filter State
  const [userRole, setUserRole] = useState<string>('');
  const [showDeleted, setShowDeleted] = useState(false);

  // Opening Balance Modal State
  const [isOpeningBalanceModalOpen, setIsOpeningBalanceModalOpen] = useState(false);
  const [openingBalanceTarget, setOpeningBalanceTarget] = useState<{
    type: 'PARTNER' | 'BANK';
    id: string;
    name: string;
    currentOpeningBalance?: number;
    currentOpeningDate?: string | null;
    currentOpeningNote?: string | null;
  } | null>(null);
  const [openingBalanceAmount, setOpeningBalanceAmount] = useState('');
  const [openingBalanceDate, setOpeningBalanceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [openingBalanceNote, setOpeningBalanceNote] = useState('');
  const [isSubmittingOpeningBalance, setIsSubmittingOpeningBalance] = useState(false);
  const [openingBalanceError, setOpeningBalanceError] = useState('');

  // Edit Entry Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LedgerEntry | null>(null);
  const [editForm, setEditForm] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    category: '',
    description: '',
    paymentMethod: 'CASH',
    projectId: '',
    siteId: '',
    workerId: '',
    reason: '',
  });
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete Entry Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingEntry, setDeletingEntry] = useState<LedgerEntry | null>(null);
  const [deleteReasonInput, setDeleteReasonInput] = useState('');
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');

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
      if (period === 'single_day') {
        params.set('startDate', selectedSingleDate);
        params.set('endDate', selectedSingleDate);
      } else if (period === 'custom') {
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
      }
      if (showDeleted) params.set('showDeleted', 'true');

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
      setSuppliers(data.suppliers || []);
      setPurposeOptions(data.purposeOptions || []);
      setOverallExpensesByCategory(data.overallExpensesByCategory || []);
      setOverallExpensesTotal(data.overallExpensesTotal || 0);
      if (data.currentUserId) setCurrentUserId(data.currentUserId);
      if (data.userRole) setUserRole(data.userRole);
    } catch (err: any) {
      setError(err.message || 'Error loading data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedPartnerId, period, selectedSingleDate, startDate, endDate, showDeleted]);

  useEffect(() => {
    loadPartnerHisaab();
  }, [loadPartnerHisaab]);

  // When switching between ALL, BANK, and individual partner, always reset ledger filters
  useEffect(() => {
    setLedgerTypeFilter('ALL');
    setLedgerSearchQuery('');
  }, [selectedPartnerId]);

  // Open Opening Balance Modal
  const handleOpenOpeningBalance = (type: 'PARTNER' | 'BANK', target: any) => {
    setOpeningBalanceTarget({
      type,
      id: target.id,
      name: type === 'PARTNER' ? target.name : `${target.bankName} (${target.name})`,
      currentOpeningBalance: target.openingBalance ?? 0,
      currentOpeningDate: target.openingBalanceDate ?? null,
      currentOpeningNote: target.openingBalanceNote ?? null,
    });
    setOpeningBalanceAmount(target.openingBalance !== undefined && target.openingBalance !== null ? String(target.openingBalance) : '0');
    setOpeningBalanceDate(target.openingBalanceDate ? target.openingBalanceDate.split('T')[0] : new Date().toISOString().split('T')[0]);
    setOpeningBalanceNote(target.openingBalanceNote || '');
    setOpeningBalanceError('');
    setIsOpeningBalanceModalOpen(true);
  };

  // Submit Opening Balance
  const handleSubmitOpeningBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openingBalanceTarget) return;
    setIsSubmittingOpeningBalance(true);
    setOpeningBalanceError('');
    try {
      const parsedAmount = parseFloat(openingBalanceAmount);
      if (isNaN(parsedAmount)) {
        throw new Error('Please enter a valid amount');
      }
      const res = await fetch('/api/finance/partner-hisaab/opening-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: openingBalanceTarget.type,
          targetId: openingBalanceTarget.id,
          partnerUserId: openingBalanceTarget.type === 'PARTNER' ? openingBalanceTarget.id : undefined,
          bankAccountId: openingBalanceTarget.type === 'BANK' ? openingBalanceTarget.id : undefined,
          amount: parsedAmount,
          asOnDate: openingBalanceDate,
          note: openingBalanceNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update opening balance');
      }
      setIsOpeningBalanceModalOpen(false);
      setSuccessMessage(`Opening balance for ${openingBalanceTarget.name} updated to ${formatINR(parsedAmount)}`);
      await loadPartnerHisaab();
    } catch (err: any) {
      setOpeningBalanceError(err.message || 'Error updating opening balance');
    } finally {
      setIsSubmittingOpeningBalance(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (entry: LedgerEntry) => {
    setEditingEntry(entry);
    setEditForm({
      amount: String(entry.amount ?? (entry.credit > 0 ? entry.credit : entry.debit) ?? ''),
      date: entry.date ? entry.date.split('T')[0] : new Date().toISOString().split('T')[0],
      category: entry.category || (entry.type === 'RECEIPT' ? 'CLIENT_PAYMENT' : entry.categoryLabel),
      description: entry.description || entry.remarks || entry.notes || '',
      paymentMethod: entry.paymentMethod || 'CASH',
      projectId: entry.projectId || '',
      siteId: entry.siteId || '',
      workerId: entry.workerId || entry.toWorkerId || '',
      reason: '',
    });
    setEditError('');
    setIsEditModalOpen(true);
  };

  // Submit Edit
  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;
    setIsSubmittingEdit(true);
    setEditError('');
    try {
      const numAmount = parseFloat(editForm.amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        throw new Error('Amount must be greater than zero');
      }
      if (!editForm.date) {
        throw new Error('Please select a valid date');
      }
      const res = await fetch(`/api/finance/partner-hisaab/entries/${editingEntry.rawId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: editingEntry.entityType || editingEntry.model,
          amount: numAmount,
          date: editForm.date,
          category: editForm.category,
          description: editForm.description,
          remarks: editForm.description,
          paymentMethod: editForm.paymentMethod,
          projectId: editForm.projectId || undefined,
          siteId: editForm.siteId || undefined,
          workerId: editForm.workerId || undefined,
          editReason: editForm.reason || 'Edited via Partner Hisaab',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update transaction');
      }
      setIsEditModalOpen(false);
      setSuccessMessage('Transaction updated successfully');
      await loadPartnerHisaab();
    } catch (err: any) {
      setEditError(err.message || 'Error updating transaction');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Open Delete Modal
  const handleOpenDelete = (entry: LedgerEntry) => {
    setDeletingEntry(entry);
    setDeleteReasonInput('');
    setDeleteError('');
    setIsDeleteModalOpen(true);
  };

  // Submit Delete
  const handleSubmitDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletingEntry) return;
    if (!deleteReasonInput.trim()) {
      setDeleteError('Please provide a reason for deleting this transaction');
      return;
    }
    setIsSubmittingDelete(true);
    setDeleteError('');
    try {
      const res = await fetch(`/api/finance/partner-hisaab/entries/${deletingEntry.rawId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: deletingEntry.entityType || deletingEntry.model,
          deleteReason: deleteReasonInput.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete transaction');
      }
      setIsDeleteModalOpen(false);
      setSuccessMessage('Transaction deleted successfully');
      await loadPartnerHisaab();
    } catch (err: any) {
      setDeleteError(err.message || 'Error deleting transaction');
    } finally {
      setIsSubmittingDelete(false);
    }
  };

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
    const res = partners.reduce(
      (acc, p) => {
        acc.totalCash += p.currentBalance || 0;
        acc.receipts += p.period.receiptsTotal || 0;
        acc.transfersIn += p.period.transfersInTotal || 0;
        acc.transfersOut += p.period.transfersOutTotal || 0;
        acc.supplierPayments += p.period.supplierPaymentsTotal || 0;
        acc.workerPayments += p.period.workerPaymentsTotal || 0;
        return acc;
      },
      { totalCash: 0, receipts: 0, transfersIn: 0, transfersOut: 0, supplierPayments: 0, workerPayments: 0, expenses: 0 }
    );
    // Align total company expenses with overallExpensesTotal to match chart & all categories
    res.expenses = overallExpensesTotal;
    return res;
  }, [partners, overallExpensesTotal]);

  const periodTotalInflow = useMemo(() => {
    return (allPartnersTotals.receipts || 0) + (bankSummary?.periodInflow || 0);
  }, [allPartnersTotals.receipts, bankSummary?.periodInflow]);

  const isSingleDayView =
    period === 'today' ||
    period === 'single_day' ||
    (period === 'custom' && Boolean(startDate && endDate && startDate === endDate));

  // Filtered Ledger entries
  const displayedLedger = useMemo(() => {
    return ledger.filter((item) => {
      if (ledgerTypeFilter !== 'ALL') {
        if (ledgerTypeFilter === 'BANK') {
          if (item.type !== 'BANK_DEPOSIT' && item.type !== 'BANK_WITHDRAWAL') return false;
        } else if (ledgerTypeFilter === 'TRANSFER') {
          if (item.type !== 'TRANSFER' && item.type !== 'TRANSFER_IN' && item.type !== 'TRANSFER_OUT') return false;
        } else if (ledgerTypeFilter === 'EXPENSE') {
          if (item.type !== 'EXPENSE') return false;
        } else if (ledgerTypeFilter === 'WORKER_PAYMENT') {
          if (item.type !== 'WORKER_PAYMENT' && !item.isWorkerPayment) return false;
        } else if (item.type !== ledgerTypeFilter) {
          return false;
        }
      }
      if (ledgerSearchQuery.trim()) {
        const query = ledgerSearchQuery.toLowerCase();
        const matchesTitle = item.title?.toLowerCase().includes(query);
        const matchesSubtitle = item.subtitle?.toLowerCase().includes(query);
        const matchesRef = item.reference?.toLowerCase().includes(query);
        const matchesNotes = item.notes?.toLowerCase().includes(query);
        const matchesRemarks = item.remarks?.toLowerCase().includes(query);
        const matchesCat = item.categoryLabel?.toLowerCase().includes(query);
        const matchesWorker = item.workerName?.toLowerCase().includes(query);
        const matchesDesc = item.description?.toLowerCase().includes(query);
        const matchesAmt = item.amount ? String(item.amount).includes(query) : false;
        if (
          !matchesTitle &&
          !matchesSubtitle &&
          !matchesRef &&
          !matchesNotes &&
          !matchesRemarks &&
          !matchesCat &&
          !matchesWorker &&
          !matchesDesc &&
          !matchesAmt
        ) {
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

  // Computed worker payment reasons from system presets + custom DB purposeOptions
  const availableWorkerReasons = useMemo(() => {
    const customReasons = purposeOptions
      .filter((p) => p.type === 'TRANSFER' || p.type === 'EXPENSE')
      .map((p) => p.name);
    return Array.from(new Set([...DEFAULT_WORKER_REASONS, ...customReasons]));
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
    defaultDestType?: 'TO_PARTNER' | 'INTERNAL_BANK_DEPOSIT' | 'TO_WORKER' | 'SELF_EXPENSE' | 'TO_SUPPLIER';
    defaultTargetPartnerId?: string;
    defaultTargetSupplierId?: string;
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

    const destType: 'TO_PARTNER' | 'INTERNAL_BANK_DEPOSIT' | 'TO_WORKER' | 'SELF_EXPENSE' | 'TO_SUPPLIER' =
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
    const toSuppId = opts?.defaultTargetSupplierId || (suppliers.length > 0 ? suppliers[0].id : '');

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
      toSupplierId: toSuppId,
      toPurchaseBillId: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      paymentMethod: srcType === 'BANK' ? 'BANK' : 'CASH',
      purpose: 'PARTNER_TRANSFER',
      projectId: '',
      siteId: '',
      reference: '',
      notes: '',
    });

    // Reset bulk worker queue state
    setWorkerPaymentQueue([]);
    setQueueError('');
    setWorkerAmountInput('');
    setShowAddWorkerInline(false);
    setInlineWorkerError('');
    setInlineWorkerName('');
    setInlineWorkerMobile('');
    setInlineWorkerWage('800');

    // Reset bulk expense queue state
    setExpenseQueue([]);
    setExpenseQueueError('');
    setExpenseAmountInput('');
    setExpenseDescriptionInput('');
    setExpenseVendorInput('');

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

  // Bulk Worker Payment Queue Computations & Helpers
  const queueGroupedByCategory = useMemo(() => {
    const groups: Record<string, { items: WorkerQueueItem[]; subtotal: number }> = {};
    for (const item of workerPaymentQueue) {
      if (!groups[item.category]) {
        groups[item.category] = { items: [], subtotal: 0 };
      }
      groups[item.category].items.push(item);
      groups[item.category].subtotal = Math.round((groups[item.category].subtotal + item.amount) * 100) / 100;
    }
    return groups;
  }, [workerPaymentQueue]);

  const totalQueueAmount = useMemo(() => {
    return Math.round(workerPaymentQueue.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
  }, [workerPaymentQueue]);

  const isQueueBalanceExceeded = totalQueueAmount > sourceAvailableBalance;

  const handleSaveCustomWorkerReason = async () => {
    const trimmed = sendMoneyForm.customWorkerReason.trim();
    setCustomWorkerReasonError('');

    if (!trimmed) {
      setCustomWorkerReasonError('Please enter a reason name.');
      return;
    }
    if (trimmed.length < 2 || trimmed.length > 50) {
      setCustomWorkerReasonError('Reason name must be between 2 and 50 characters.');
      return;
    }

    const existing = availableWorkerReasons.find(
      (c) => c.toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) {
      setSendMoneyForm((prev) => ({
        ...prev,
        workerReasonSelect: existing,
        customWorkerReason: '',
      }));
      setCustomWorkerReasonError('');
      return;
    }

    setIsSavingCustomWorkerReason(true);
    try {
      const res = await fetch('/api/reasons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmed,
          type: 'TRANSFER',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.error && data.error.includes('already exists')) {
          setSendMoneyForm((prev) => ({
            ...prev,
            workerReasonSelect: trimmed,
            customWorkerReason: '',
          }));
          setCustomWorkerReasonError('');
          return;
        }
        throw new Error(data.error || 'Failed to save custom reason');
      }

      const created = data.reason || { id: `custom_${Date.now()}`, name: trimmed, type: 'TRANSFER' };
      setPurposeOptions((prev) => [...prev, created]);
      setSendMoneyForm((prev) => ({
        ...prev,
        workerReasonSelect: created.name,
        customWorkerReason: '',
      }));
      setCustomWorkerReasonError('');
    } catch (err: any) {
      setCustomWorkerReasonError(err.message || 'Error saving reason');
    } finally {
      setIsSavingCustomWorkerReason(false);
    }
  };

  const handleAddWorkerToQueue = async () => {
    setQueueError('');

    let finalCategory = sendMoneyForm.workerReasonSelect;
    if (sendMoneyForm.workerReasonSelect === '__CUSTOM__') {
      const trimmed = sendMoneyForm.customWorkerReason.trim();
      if (!trimmed) {
        setQueueError('Please enter a custom category name.');
        return;
      }
      finalCategory = trimmed;
      // Auto-persist in background
      try {
        const res = await fetch('/api/reasons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmed, type: 'TRANSFER' }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.reason) {
            setPurposeOptions((prev) => [...prev, data.reason]);
          }
        }
      } catch (e) {
        // non-blocking
      }
      setSendMoneyForm((prev) => ({
        ...prev,
        workerReasonSelect: trimmed,
        customWorkerReason: '',
      }));
    }

    if (!finalCategory) {
      setQueueError('Please enter a custom category name.');
      return;
    }

    if (!sendMoneyForm.toWorkerId || sendMoneyForm.toWorkerId === '__ADD_NEW__') {
      setQueueError('Please select a worker from the dropdown.');
      return;
    }

    const amt = parseFloat(workerAmountInput);
    if (isNaN(amt) || amt <= 0) {
      setQueueError('Please enter a valid amount greater than ₹0.');
      return;
    }

    const targetWorker = workers.find((w) => w.id === sendMoneyForm.toWorkerId);
    if (!targetWorker) {
      setQueueError('Selected worker not found.');
      return;
    }

    // Duplicate check: Block same worker under the same category
    const isDuplicate = workerPaymentQueue.some(
      (item) =>
        item.workerId === targetWorker.id &&
        item.category.trim().toLowerCase() === finalCategory.trim().toLowerCase()
    );

    if (isDuplicate) {
      setQueueError(
        `Worker "${targetWorker.name}" is already in the queue for category "${finalCategory}". Same worker cannot be added twice under the same category.`
      );
      return;
    }

    const newItem: WorkerQueueItem = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      workerId: targetWorker.id,
      workerName: targetWorker.name,
      workerCode: targetWorker.workerCode,
      category: finalCategory,
      amount: Math.round(amt * 100) / 100,
    };

    setWorkerPaymentQueue((prev) => [...prev, newItem]);
    // Clear worker & amount, KEEP category selected!
    setWorkerAmountInput('');
    setSendMoneyForm((prev) => ({ ...prev, toWorkerId: '' }));
    setQueueError('');
  };

  const handleRemoveWorkerFromQueue = (id: string) => {
    setWorkerPaymentQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSaveCustomExpenseCategory = async () => {
    const trimmed = sendMoneyForm.customCategoryName.trim();
    setCustomCategoryError('');

    if (!trimmed) {
      setCustomCategoryError('Please enter a category name.');
      return;
    }
    if (trimmed.length < 2 || trimmed.length > 50) {
      setCustomCategoryError('Category name must be between 2 and 50 characters.');
      return;
    }

    const existing = availableExpenseCategories.find(
      (c) => c.toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) {
      setSendMoneyForm((prev) => ({
        ...prev,
        expenseCategorySelect: existing,
        customCategoryName: '',
      }));
      setCustomCategoryError('');
      return;
    }

    setIsSavingCustomCategory(true);
    try {
      const res = await fetch('/api/reasons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmed,
          type: 'EXPENSE',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.error && data.error.includes('already exists')) {
          setSendMoneyForm((prev) => ({
            ...prev,
            expenseCategorySelect: trimmed,
            customCategoryName: '',
          }));
          setCustomCategoryError('');
          return;
        }
        throw new Error(data.error || 'Failed to save custom category');
      }

      const created = data.reason || { id: `custom_${Date.now()}`, name: trimmed, type: 'EXPENSE' };
      setPurposeOptions((prev) => [...prev, created]);
      setSendMoneyForm((prev) => ({
        ...prev,
        expenseCategorySelect: created.name,
        customCategoryName: '',
      }));
      setCustomCategoryError('');
    } catch (err: any) {
      setCustomCategoryError(err.message || 'Error saving category');
    } finally {
      setIsSavingCustomCategory(false);
    }
  };

  // Bulk Expense Queue Computations & Helpers
  const expenseQueueGroupedByCategory = useMemo(() => {
    const groups: Record<string, { items: ExpenseQueueItem[]; subtotal: number }> = {};
    for (const item of expenseQueue) {
      if (!groups[item.category]) {
        groups[item.category] = { items: [], subtotal: 0 };
      }
      groups[item.category].items.push(item);
      groups[item.category].subtotal = Math.round((groups[item.category].subtotal + item.amount) * 100) / 100;
    }
    return groups;
  }, [expenseQueue]);

  const totalExpenseQueueAmount = useMemo(() => {
    return Math.round(expenseQueue.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
  }, [expenseQueue]);

  const isExpenseQueueBalanceExceeded = totalExpenseQueueAmount > sourceAvailableBalance;

  const handleAddExpenseToQueue = async () => {
    setExpenseQueueError('');

    let finalCategory = sendMoneyForm.expenseCategorySelect;
    if (sendMoneyForm.expenseCategorySelect === '__CUSTOM__') {
      const trimmed = sendMoneyForm.customCategoryName.trim();
      if (!trimmed) {
        setExpenseQueueError('Please enter a valid expense category name.');
        return;
      }
      finalCategory = trimmed;
      // Auto-persist in background
      try {
        const res = await fetch('/api/reasons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmed, type: 'EXPENSE' }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.reason) {
            setPurposeOptions((prev) => [...prev, data.reason]);
          }
        }
      } catch (e) {
        // non-blocking
      }
      setSendMoneyForm((prev) => ({
        ...prev,
        expenseCategorySelect: trimmed,
        customCategoryName: '',
      }));
    }

    if (!finalCategory) {
      setExpenseQueueError('Please enter a valid expense category.');
      return;
    }

    const amt = parseFloat(expenseAmountInput);
    if (isNaN(amt) || amt <= 0) {
      setExpenseQueueError('Please enter a valid amount greater than ₹0.');
      return;
    }

    // Description is required if the category is custom or generic
    const isGeneric =
      ['miscellaneous', 'other', '__custom__'].includes(finalCategory.toLowerCase()) ||
      sendMoneyForm.expenseCategorySelect === '__CUSTOM__';
    if (isGeneric && !expenseDescriptionInput.trim()) {
      setExpenseQueueError('Please enter an expense description for this category.');
      return;
    }

    const newItem: ExpenseQueueItem = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      category: finalCategory,
      description: expenseDescriptionInput.trim() || finalCategory,
      vendor: expenseVendorInput.trim() || undefined,
      amount: Math.round(amt * 100) / 100,
    };

    // Do NOT block duplicates (the same category/description/amount can repeat legitimately)
    setExpenseQueue((prev) => [...prev, newItem]);
    // Clear description, vendor and amount; KEEP category!
    setExpenseDescriptionInput('');
    setExpenseVendorInput('');
    setExpenseAmountInput('');
    setExpenseQueueError('');
  };

  const handleRemoveExpenseFromQueue = (id: string) => {
    setExpenseQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSaveInlineWorker = async () => {
    setInlineWorkerError('');
    if (!inlineWorkerName.trim()) {
      setInlineWorkerError('Worker full name is required.');
      return;
    }

    setIsSavingInlineWorker(true);
    try {
      const parsedWage = parseFloat(inlineWorkerWage);
      const wage = isNaN(parsedWage) || parsedWage < 0 ? 800 : parsedWage;

      const res = await fetch('/api/workers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: inlineWorkerName.trim(),
          mobile: inlineWorkerMobile.trim() || undefined,
          dailyWage: wage,
          wageUnit: 'PER_DAY',
          category: 'Mason',
          status: 'ACTIVE',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create worker');
      }

      if (data.worker) {
        const targetWorker: WorkerItem = {
          id: data.worker.id,
          name: data.worker.name,
          workerCode: data.worker.workerCode,
          category: data.worker.category,
          mobile: data.worker.mobile,
        };

        // Add to dropdown if not already in list
        setWorkers((prev) => {
          if (prev.some((w) => w.id === targetWorker.id)) return prev;
          return [targetWorker, ...prev];
        });

        // Auto-select this worker in the dropdown
        setSendMoneyForm((prev) => ({
          ...prev,
          toWorkerId: targetWorker.id,
        }));

        setShowAddWorkerInline(false);
        setInlineWorkerName('');
        setInlineWorkerMobile('');
        setInlineWorkerWage('800');
        setInlineWorkerError('');

        if (data.exists && data.message) {
          setSuccessMessage(`ℹ️ ${data.message}`);
        } else if (data.message) {
          setSuccessMessage(`✅ ${data.message} (${targetWorker.workerCode})`);
        }
      }
    } catch (err: any) {
      setInlineWorkerError(err.message || 'Failed to save worker');
    } finally {
      setIsSavingInlineWorker(false);
    }
  };

  // Submit Send Money Transaction (Bulk for TO_WORKER, single for other destinations)
  const handleSendMoneySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransferError('');

    // ==========================================
    // BULK WORKER PAYMENT FLOW
    // ==========================================
    if (sendMoneyForm.destinationType === 'TO_WORKER') {
      if (workerPaymentQueue.length === 0) {
        setTransferError('Please add at least one worker payment to the queue.');
        return;
      }

      if (isQueueBalanceExceeded) {
        setTransferError(
          `Total payment (${formatINR(totalQueueAmount)}) exceeds available balance (${formatINR(sourceAvailableBalance)}).`
        );
        return;
      }

      setIsSubmittingTransfer(true);
      try {
        const payload = {
          sourceType: sendMoneyForm.sourceType,
          sourceId: sendMoneyForm.sourceId,
          method: sendMoneyForm.paymentMethod,
          date: sendMoneyForm.date,
          projectId: sendMoneyForm.projectId || undefined,
          siteId: sendMoneyForm.siteId || undefined,
          reference: sendMoneyForm.reference || undefined,
          items: workerPaymentQueue.map((item) => ({
            workerId: item.workerId,
            category: item.category,
            amount: item.amount,
            remarks: sendMoneyForm.notes ? `${sendMoneyForm.notes}` : undefined,
          })),
        };

        const res = await fetch('/api/finance/worker-payments/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const resData = await res.json();
        if (!res.ok) {
          throw new Error(resData.error || 'Failed to record bulk worker payments');
        }

        setSuccessMessage(resData.message || 'Worker payments recorded successfully!');
        setWorkerPaymentQueue([]);
        setIsTransferModalOpen(false);
        loadPartnerHisaab();
      } catch (err: any) {
        setTransferError(err.message || 'Something went wrong while recording payments');
      } finally {
        setIsSubmittingTransfer(false);
      }
      return;
    }

    // ==========================================
    // BULK EXPENSE FLOW (SELF / EXPENSE)
    // ==========================================
    if (sendMoneyForm.destinationType === 'SELF_EXPENSE') {
      if (expenseQueue.length === 0) {
        setTransferError('Please add at least one expense to the queue.');
        return;
      }

      if (isExpenseQueueBalanceExceeded) {
        setTransferError(
          `Total expense (${formatINR(totalExpenseQueueAmount)}) exceeds available balance (${formatINR(sourceAvailableBalance)}).`
        );
        return;
      }

      setIsSubmittingTransfer(true);
      try {
        const payload = {
          sourceType: sendMoneyForm.sourceType,
          sourceId: sendMoneyForm.sourceId,
          method: sendMoneyForm.paymentMethod,
          date: sendMoneyForm.date,
          projectId: sendMoneyForm.projectId || undefined,
          siteId: sendMoneyForm.siteId || undefined,
          reference: sendMoneyForm.reference || sendMoneyForm.notes || undefined,
          items: expenseQueue.map((item) => ({
            category: item.category,
            description: item.description,
            vendor: item.vendor || undefined,
            amount: item.amount,
          })),
        };

        const res = await fetch('/api/finance/expenses/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const resData = await res.json();
        if (!res.ok) {
          throw new Error(resData.error || 'Failed to record bulk expenses');
        }

        setSuccessMessage(resData.message || 'Expenses recorded successfully!');
        setExpenseQueue([]);
        setIsTransferModalOpen(false);
        loadPartnerHisaab();
      } catch (err: any) {
        setTransferError(err.message || 'Something went wrong while recording expenses');
      } finally {
        setIsSubmittingTransfer(false);
      }
      return;
    }

    // ==========================================
    // SINGLE FLOW FOR TO_PARTNER, BANK_DEPOSIT
    // ==========================================
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

    if (sendMoneyForm.destinationType === 'TO_SUPPLIER') {
      if (!sendMoneyForm.toSupplierId) {
        setTransferError('Please select a recipient supplier.');
        return;
      }
    }

    setIsSubmittingTransfer(true);
    try {
      const finalExpenseCategory =
        sendMoneyForm.expenseCategorySelect === '__CUSTOM__'
          ? sendMoneyForm.customCategoryName.trim() || 'Miscellaneous'
          : sendMoneyForm.expenseCategorySelect;

      const payload = {
        sourceType: sendMoneyForm.sourceType,
        sourceId: sendMoneyForm.sourceId,
        destinationType: sendMoneyForm.destinationType,
        toPartnerId: sendMoneyForm.toPartnerId,
        toSupplierId: sendMoneyForm.toSupplierId || undefined,
        toPurchaseBillId: sendMoneyForm.toPurchaseBillId || undefined,
        receiptId: sendMoneyForm.transferSourceType === 'FROM_RECEIPT' ? sendMoneyForm.receiptId : undefined,
        toBankAccountId: sendMoneyForm.toBankAccountId,
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
            : sendMoneyForm.destinationType === 'TO_SUPPLIER'
            ? 'SUPPLIER_PAYMENT'
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
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shrink-0">
              <UserCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <label htmlFor="partner-hisaab-select" className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 block truncate">
                Select Partner / Owner / Bank:
              </label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Choose an account or bank to inspect hisaab &amp; statement
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto sm:min-w-[340px]">
            <select
              id="partner-hisaab-select"
              value={selectedPartnerId}
              onChange={(e) => {
                setSelectedPartnerId(e.target.value);
                setLedgerTypeFilter('ALL');
                setLedgerSearchQuery('');
              }}
              className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm cursor-pointer"
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

            <Link
              href="/hisaab/send-money"
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0 shadow-sm flex items-center gap-1.5 transition-colors"
              title="Open full page multi-site folder sheet"
            >
              <Send className="w-3.5 h-3.5" />
              Multi-Site Sheet
            </Link>

            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shrink-0 shadow-sm"
              onClick={() => openSendMoneyModal()}
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              Quick Modal
            </Button>
          </div>
        </div>
      </div>

      {/* 3. Period Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Filter By Period:
            </span>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-xl overflow-x-auto no-scrollbar scroll-smooth w-full md:w-auto">
            <button
              type="button"
              onClick={() => {
                setPeriod('today');
                setSelectedSingleDate(getTodayStr());
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 whitespace-nowrap ${
                period === 'today'
                  ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => {
                setPeriod('single_day');
                if (!selectedSingleDate) setSelectedSingleDate(getTodayStr());
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 whitespace-nowrap flex items-center gap-1.5 ${
                period === 'single_day'
                  ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Single Day (Ek Din)
            </button>
            <button
              type="button"
              onClick={() => setPeriod('weekly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 whitespace-nowrap ${
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
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 whitespace-nowrap ${
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
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 whitespace-nowrap ${
                period === 'custom'
                  ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Custom Range
            </button>
            <button
              type="button"
              onClick={() => setPeriod('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 whitespace-nowrap ${
                period === 'all'
                  ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All Time
            </button>
          </div>
        </div>

        {/* Dedicated Single Day (Ek Din) Quick Picker */}
        {period === 'single_day' && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-amber-500/40 rounded-xl px-3 py-1.5 shadow-sm">
                <Calendar className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                  Date:
                </span>
                <input
                  type="date"
                  value={selectedSingleDate}
                  onChange={(e) => setSelectedSingleDate(e.target.value)}
                  className="bg-transparent border-none text-xs font-bold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                />
              </div>

              {/* Quick Jump Buttons: Prev, Kal, Aaj, Next */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => shiftSingleDate(-1)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                  title="Pichla Din"
                >
                  ◀ Prev
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSingleDate(getYesterdayStr())}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                >
                  Kal
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSingleDate(getTodayStr())}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 border border-amber-500/30 transition-colors"
                >
                  Aaj
                </button>
                <button
                  type="button"
                  onClick={() => shiftSingleDate(1)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                  title="Agla Din"
                >
                  Next ▶
                </button>
              </div>
            </div>

            {/* Selected Date Badge & Refresh */}
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 truncate">
                📅 {formatReadableDate(selectedSingleDate)}
              </span>
              <Button
                size="sm"
                onClick={loadPartnerHisaab}
                className="text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shrink-0 h-8"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                Check Hisaab
              </Button>
            </div>
          </div>
        )}

        {/* Custom Date Range Pickers */}
        {period === 'custom' && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 md:flex md:items-center gap-2.5 animate-fade-in">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 shrink-0">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch(_) {} }}
                onFocus={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch(_) {} }}
                className="w-full sm:w-auto px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer dark:[&::-webkit-calendar-picker-indicator]:filter dark:[&::-webkit-calendar-picker-indicator]:invert"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 shrink-0">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch(_) {} }}
                onFocus={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch(_) {} }}
                className="w-full sm:w-auto px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer dark:[&::-webkit-calendar-picker-indicator]:filter dark:[&::-webkit-calendar-picker-indicator]:invert"
              />
            </div>
            <Button
              size="sm"
              onClick={loadPartnerHisaab}
              className="text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shrink-0 w-full sm:w-auto"
            >
              Apply Filter
            </Button>
          </div>
        )}
      </div>

      {/* 4. Metric KPI Cards */}
      {selectedPartner ? (
        // 1) INDIVIDUAL PARTNER VIEW: Focused Metric Cards
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          <MetricCard
            title={`${selectedPartner.name}'s Cash Balance`}
            value={formatINR(selectedPartner.currentBalance)}
            subtitle="Current live balance in hand"
            variant="emerald"
          />
          <MetricCard
            title="Transfers Received"
            value={formatINR(selectedPartner.period.transfersInTotal)}
            subtitle={`${selectedPartner.period.transfersInCount} transfer(s) received`}
            variant="blue"
          />
          <MetricCard
            title="Site Expenses Paid"
            value={formatINR(selectedPartner.period.expensesTotal)}
            subtitle={`${selectedPartner.period.expensesCount} expense entries on site`}
            variant="amber"
          />
          <MetricCard
            title="Worker Salary & Wages"
            value={formatINR(selectedPartner.period.workerPaymentsTotal || 0)}
            subtitle={`${selectedPartner.period.workerPaymentsCount || 0} worker payout(s)`}
            variant="rose"
          />
          <MetricCard
            title="Supplier Payments"
            value={formatINR(selectedPartner.period.supplierPaymentsTotal || 0)}
            subtitle={`${selectedPartner.period.supplierPaymentsCount || 0} supplier payout(s)`}
            variant="purple"
          />
          <MetricCard
            title="Transfers Out to Partners"
            value={formatINR(selectedPartner.period.transfersOutTotal)}
            subtitle={`${selectedPartner.period.transfersOutCount} transfer(s) passed to others`}
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
            variant="blue"
          />
          <MetricCard
            title="Bank Inflow & Deposits"
            value={formatINR(bankSummary?.periodInflow ?? 0)}
            subtitle="Client receipts & deposits in period"
            variant="emerald"
          />
          <MetricCard
            title="Transfers to Partners"
            value={formatINR(bankSummary?.periodToPartner ?? 0)}
            subtitle="Funds transferred to partner wallets"
            variant="blue"
          />
          <MetricCard
            title="Direct Bank Payments"
            value={formatINR((bankSummary?.periodPayments ?? 0) + (bankSummary?.periodWithdrawals ?? 0))}
            subtitle={`Vendor: ${formatINR(bankSummary?.periodPayments ?? 0)} • Cash Out: ${formatINR(bankSummary?.periodWithdrawals ?? 0)}`}
            variant="amber"
          />
        </div>
      ) : (
        // 3) ALL PARTNERS & OWNERS OVERVIEW: Period-specific metrics vs All-Time Summary
        period !== 'all' ? (
          // A) FILTERED PERIOD / DAY VIEW: Shows exact expenses, inflow, and net flow for the chosen day/range
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
            <MetricCard
              title={isSingleDayView ? "Day's Total Expenses (Kul Kharch)" : "Period Total Expenses"}
              value={formatINR(overallExpensesTotal)}
              subtitle={`${overallExpensesByCategory.length} categories on site, workers & fuel`}
              variant="amber"
            />
            <MetricCard
              title={isSingleDayView ? "Day's Inflow / Receipts (Aaya Paisa)" : "Period Inflow / Receipts"}
              value={formatINR(periodTotalInflow)}
              subtitle="Client receipts & bank inflow in period"
              variant="emerald"
            />
            <MetricCard
              title={isSingleDayView ? "Day's Net Cash Movement" : "Period Net Cash Movement"}
              value={formatINR(periodTotalInflow - overallExpensesTotal)}
              subtitle="Total Inflow minus Total Expenses"
              variant={periodTotalInflow - overallExpensesTotal >= 0 ? "emerald" : "rose"}
            />
            <MetricCard
              title="Live Cash in Hand (Physical)"
              value={formatINR(allPartnersTotals.totalCash)}
              subtitle={`Current physical cash across ${partners.length} partners`}
              variant="blue"
            />
          </div>
        ) : (
          // B) ALL-TIME LIFETIME VIEW
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
            <MetricCard
              title="Total Remaining Balance (Cash + Bank)"
              value={formatINR(allPartnersTotals.totalCash + totalBankBalance)}
              subtitle={`Cash: ${formatINR(allPartnersTotals.totalCash)} • Bank: ${formatINR(totalBankBalance)}`}
              variant="emerald"
            />
            <MetricCard
              title="Total Bank Balance"
              value={formatINR(totalBankBalance)}
              subtitle={`Available across ${bankAccounts.length} company bank account(s)`}
              variant="blue"
            />
            <MetricCard
              title="Total Partners Cash in Hand"
              value={formatINR(allPartnersTotals.totalCash)}
              subtitle={`Held across ${partners.length} partners & owners`}
              variant="blue"
            />
            <MetricCard
              title="Total All-Time Site Expenses"
              value={formatINR(overallExpensesTotal)}
              subtitle="Total site & material expenses recorded"
              variant="amber"
            />
          </div>
        )
      )}

      {/* 5. Main Content: ALL PARTNERS SUMMARY and BANK & PARTNER STATEMENTS */}
      {isAllSelected && (
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
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 truncate">
                  <Users className="w-4 h-4 text-indigo-500 shrink-0" />
                  All Partners &amp; Owners Summary Matrix
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                  Check individual hisaab of each partner &amp; owner or transfer money
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => openSendMoneyModal()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shrink-0 shadow-sm"
              >
                <Send className="w-3.5 h-3.5 mr-1" />
                Send Money
              </Button>
            </div>

            {/* Mobile View: Sliding / Swipeable Partner Cards Carousel */}
            <div className="block md:hidden p-3.5 space-y-3 bg-slate-50/50 dark:bg-slate-950/30">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Partner Cards ({partners.length})
                </span>
                <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                  Swipe horizontally &rarr;
                </span>
              </div>

              {/* Sliding Horizontal Container */}
              <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-3 pt-1 px-1 -mx-1 no-scrollbar scroll-smooth">
                {partners.map((p) => {
                  const isPositive = p.currentBalance >= 0;
                  return (
                    <div
                      key={p.id}
                      className="w-[84vw] max-w-[320px] shrink-0 snap-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col justify-between space-y-3"
                    >
                      {/* Top: Avatar, Name & Role */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-black flex items-center justify-center text-sm shrink-0 border border-indigo-500/20">
                            {p.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                              {p.name}
                            </h3>
                            <span className="text-[10px] text-slate-400 truncate block">
                              {p.mobile || p.email}
                            </span>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                          p.role === 'OWNER'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                            : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                        }`}>
                          {p.role}
                        </span>
                      </div>

                      {/* Live Cash in Hand Balance */}
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                            Cash in Hand (Live)
                          </span>
                          <span className="text-[11px] text-slate-500">Wallet balance</span>
                        </div>
                        <div className={`text-base font-black font-mono ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {formatINR(p.currentBalance)}
                        </div>
                      </div>

                      {/* Breakdown Grid for the period */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Site Receipts</span>
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            +{formatINR(p.period.receiptsTotal)}
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-sky-500/5 border border-sky-500/10">
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Transfers In</span>
                          <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                            +{formatINR(p.period.transfersInTotal)}
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-rose-500/5 border border-rose-500/10">
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Worker Salary &amp; Wages</span>
                          <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                            -{formatINR(p.period.workerPaymentsTotal || 0)}
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-indigo-500/5 border border-indigo-500/10">
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Transfers Out</span>
                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            -{formatINR(p.period.transfersOutTotal)}
                          </span>
                        </div>
                        <div className="col-span-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Site Expenses</span>
                          <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                            -{formatINR(p.period.expensesTotal)}
                          </span>
                        </div>
                        {(p.period.supplierPaymentsTotal || 0) > 0 && (
                          <div className="col-span-2 p-2 rounded-lg bg-purple-500/5 border border-purple-500/10 flex items-center justify-between">
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">Supplier Payments</span>
                            <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                              -{formatINR(p.period.supplierPaymentsTotal || 0)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Card Action Buttons */}
                      <div className="space-y-1.5 pt-1">
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedPartnerId(p.id)}
                            className="text-xs h-8 font-semibold w-full"
                          >
                            Check Hisaab
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => openSendMoneyModal({ defaultSourceType: 'PARTNER', defaultSourceId: p.id })}
                            className="text-xs h-8 bg-indigo-600 hover:bg-indigo-700 text-white font-bold w-full"
                          >
                            <Send className="w-3 h-3 mr-1" />
                            Send Money
                          </Button>
                        </div>
                        {userRole === 'OWNER' && (
                          <button
                            type="button"
                            onClick={() => handleOpenOpeningBalance('PARTNER', p)}
                            className="w-full text-center py-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center justify-center gap-1 font-semibold"
                          >
                            <Wallet className="w-3 h-3" /> Set Opening Balance {p.openingBalance ? `(${formatINR(p.openingBalance)})` : ''}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Toggle Table View on Mobile */}
              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => setShowMobileTableMatrix(!showMobileTableMatrix)}
                  className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 underline underline-offset-4 transition-colors"
                >
                  {showMobileTableMatrix ? 'Hide Full Table Matrix' : 'View Full Matrix Table (Horizontal Scroll)'}
                </button>
              </div>
            </div>

            {/* Desktop Table (or mobile when toggled) */}
            <div className={`${showMobileTableMatrix ? 'block' : 'hidden md:block'} overflow-x-auto`}>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Partner / Owner</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4 text-right">Cash in Hand (Live)</th>
                    <th className="py-3 px-4 text-right">Direct Site Receipts</th>
                    <th className="py-3 px-4 text-right">Transfers In</th>
                    <th className="py-3 px-4 text-right">Worker Salary &amp; Wages</th>
                    <th className="py-3 px-4 text-right">Supplier Payments</th>
                    <th className="py-3 px-4 text-right">Transfers to Partners</th>
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
                        <td className="py-3.5 px-4 text-right font-mono text-rose-600 dark:text-rose-400 font-semibold">
                          -{formatINR(p.period.workerPaymentsTotal || 0)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-purple-600 dark:text-purple-400 font-semibold">
                          {(p.period.supplierPaymentsTotal || 0) > 0 ? `-${formatINR(p.period.supplierPaymentsTotal || 0)}` : '-'}
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
                            {userRole === 'OWNER' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenOpeningBalance('PARTNER', p)}
                                className="text-xs h-7 px-2 border-indigo-200 dark:border-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-semibold"
                                title="Set Opening Balance"
                              >
                                <Wallet className="w-3 h-3 mr-1" />
                                Opening Bal
                              </Button>
                            )}
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
              <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 truncate">
                    <Building2 className="w-4 h-4 text-sky-500 shrink-0" />
                    Company Bank Accounts
                  </h2>
                  <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    Official bank balances available for operations &amp; transfers
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => openSendMoneyModal({ defaultSourceType: 'BANK', defaultSourceId: bankAccounts[0]?.id })}
                  className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shrink-0 shadow-sm"
                >
                  <Send className="w-3.5 h-3.5 mr-1" />
                  Bank Transfer / Pay
                </Button>
              </div>

              {/* Mobile View: Sliding Bank Cards Carousel */}
              <div className="block md:hidden p-3.5 space-y-3 bg-slate-50/50 dark:bg-slate-950/30">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Bank Accounts ({bankAccounts.length})
                  </span>
                  <span className="text-[10px] font-semibold text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full">
                    Swipe horizontally &rarr;
                  </span>
                </div>

                <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-3 pt-1 px-1 -mx-1 no-scrollbar scroll-smooth">
                  {bankAccounts.map((b) => (
                    <div
                      key={b.id}
                      className="w-[84vw] max-w-[320px] shrink-0 snap-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col justify-between space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 font-black flex items-center justify-center shrink-0 border border-sky-500/20">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                              {b.bankName}
                            </h3>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate block">
                              {b.name}
                            </span>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                          {b.accountLast4 ? `..${b.accountLast4}` : 'A/C'}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-sky-500/5 border border-sky-500/10 flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-slate-500">Available Balance</span>
                        <span className="text-base font-black font-mono text-sky-600 dark:text-sky-400">
                          {formatINR(b.balance)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedPartnerId(`BANK_${b.id}`)}
                          className="text-xs h-8 font-semibold w-full"
                        >
                          Check Hisaab
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => openSendMoneyModal({ defaultSourceType: 'BANK', defaultSourceId: b.id })}
                          className="text-xs h-8 bg-sky-600 hover:bg-sky-700 text-white font-bold w-full"
                        >
                          <Send className="w-3 h-3 mr-1" />
                          Bank Pay
                        </Button>
                        {userRole === 'OWNER' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenOpeningBalance('BANK', b)}
                            className="text-xs h-8 font-semibold w-full border-sky-200 dark:border-sky-900/50 text-sky-600 dark:text-sky-400 col-span-2"
                          >
                            <Landmark className="w-3.5 h-3.5 mr-1" />
                            Set Opening Balance
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
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
                          <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedPartnerId(`BANK_${b.id}`)}
                              className="text-xs h-7 px-2.5"
                            >
                              Check Bank Hisaab
                            </Button>
                            {userRole === 'OWNER' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenOpeningBalance('BANK', b)}
                                className="text-xs h-7 px-2 border-sky-200 dark:border-sky-900/50 text-sky-600 dark:text-sky-400 font-semibold"
                                title="Set Opening Balance"
                              >
                                <Landmark className="w-3 h-3 mr-1" />
                                Opening Bal
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW B & C: SELECTED PARTNER or BANK BANNERS */}
      {!isAllSelected && (
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

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedPartnerId('ALL')}
                  className="text-xs"
                >
                  &larr; View All Summary
                </Button>
                {userRole === 'OWNER' && selectedBankAccount && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenOpeningBalance('BANK', selectedBankAccount)}
                    className="text-xs border-sky-300 dark:border-sky-800 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-950/60 font-semibold"
                  >
                    <Landmark className="w-3.5 h-3.5 mr-1" />
                    Set Opening Balance
                  </Button>
                )}
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

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedPartnerId('ALL')}
                  className="text-xs"
                >
                  &larr; View All Partners
                </Button>
                {userRole === 'OWNER' && selectedPartner && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenOpeningBalance('PARTNER', selectedPartner)}
                    className="text-xs border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-950/60 font-semibold"
                  >
                    <Wallet className="w-3.5 h-3.5 mr-1" />
                    Set Opening Balance
                  </Button>
                )}
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
        </div>
      )}

      {/* TRANSACTION STATEMENT SECTION (RENDERED FOR ALL VIEWS: ALL, BANK, INDIVIDUAL PARTNER) */}
      <div className="space-y-4 pt-2">
        {/* Statement Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-500" />
              {isBankSelected
                ? `${selectedBankAccount ? selectedBankAccount.bankName : 'Bank'} Account Statement`
                : isAllSelected
                ? 'All Transactions Statement (Sabhi Transactions Ka Statement)'
                : `${selectedPartner?.name}'s Hisaab Statement`}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isBankSelected
                ? 'Chronological statement of bank receipts, deposits, withdrawals and payments'
                : isAllSelected
                ? 'Unified statement of all receipts, transfers, worker payouts, site expenses and bank transactions across company'
                : `Detailed ledger entries for ${selectedPartner?.name} with running balance`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold border border-amber-500/20">
              {displayedLedger.length} Record(s) Found
            </span>
          </div>
        </div>

        {/* Ledger Toolbar (Search & Filter Card) */}
        <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          {/* Row 1: Search Bar & Action Toggles */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1 sm:max-w-md">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={
                  isBankSelected
                    ? 'Search bank records, ref, amount...'
                    : isAllSelected
                    ? 'Search all transactions, names, ref, amount...'
                    : `Search ${selectedPartner?.name || 'partner'}'s hisaab...`
                }
                value={ledgerSearchQuery}
                onChange={(e) => setLedgerSearchQuery(e.target.value)}
                className="w-full pl-8 pr-8 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
              {ledgerSearchQuery && (
                <button
                  type="button"
                  onClick={() => setLedgerSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-full"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Right: Owner Toggle & Reset Button */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {(ledgerTypeFilter !== 'ALL' || ledgerSearchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setLedgerTypeFilter('ALL');
                    setLedgerSearchQuery('');
                  }}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 flex items-center gap-1 transition-colors"
                >
                  <X className="w-3 h-3" />
                  Clear Filters
                </button>
              )}

              {userRole === 'OWNER' && (
                <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none shrink-0 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700/60 transition-colors">
                  <input
                    type="checkbox"
                    checked={showDeleted}
                    onChange={(e) => setShowDeleted(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                  />
                  <span>Show deleted</span>
                </label>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-slate-100 dark:bg-slate-800/80 -mx-1" />

          {/* Row 2: Filter Buttons (Clean Wrapping) */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3 text-indigo-500" />
              Filter:
            </span>

            <button
              type="button"
              onClick={() => setLedgerTypeFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 whitespace-nowrap transition-all ${
                ledgerTypeFilter === 'ALL'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/60'
              }`}
            >
              All Entries ({ledger.length})
            </button>

            <button
              type="button"
              onClick={() => setLedgerTypeFilter('RECEIPT')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 whitespace-nowrap transition-all ${
                ledgerTypeFilter === 'RECEIPT'
                  ? 'bg-emerald-600 text-white font-bold shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/60'
              }`}
            >
              {isBankSelected ? 'Client Receipts in Bank' : 'Client Receipts'}
            </button>

            {isBankSelected ? (
              <>
                <button
                  type="button"
                  onClick={() => setLedgerTypeFilter('BANK_DEPOSIT')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 whitespace-nowrap transition-all ${
                    ledgerTypeFilter === 'BANK_DEPOSIT'
                      ? 'bg-sky-600 text-white font-bold shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/60'
                  }`}
                >
                  Bank Deposits
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerTypeFilter('TRANSFER_OUT')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 whitespace-nowrap transition-all ${
                    ledgerTypeFilter === 'TRANSFER_OUT'
                      ? 'bg-indigo-600 text-white font-bold shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/60'
                  }`}
                >
                  Transfers to Partners
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerTypeFilter('BANK_WITHDRAWAL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 whitespace-nowrap transition-all ${
                    ledgerTypeFilter === 'BANK_WITHDRAWAL'
                      ? 'bg-amber-600 text-white font-bold shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/60'
                  }`}
                >
                  Cash Withdrawals
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerTypeFilter('EXPENSE')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 whitespace-nowrap transition-all ${
                    ledgerTypeFilter === 'EXPENSE'
                      ? 'bg-rose-600 text-white font-bold shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/60'
                  }`}
                >
                  Direct Payments
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerTypeFilter('WORKER_PAYMENT')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 whitespace-nowrap transition-all ${
                    ledgerTypeFilter === 'WORKER_PAYMENT'
                      ? 'bg-purple-600 text-white font-bold shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/60'
                  }`}
                >
                  Worker Salary &amp; Wages
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerTypeFilter('SUPPLIER_PAYMENT')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 whitespace-nowrap transition-all ${
                    ledgerTypeFilter === 'SUPPLIER_PAYMENT'
                      ? 'bg-purple-600 text-white font-bold shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/60'
                  }`}
                >
                  Supplier Payments
                </button>
              </>
            ) : isAllSelected ? (
              <>
                <button
                  type="button"
                  onClick={() => setLedgerTypeFilter('EXPENSE')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 whitespace-nowrap transition-all ${
                    ledgerTypeFilter === 'EXPENSE'
                      ? 'bg-amber-600 text-white font-bold shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/60'
                  }`}
                >
                  Site Expenses
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerTypeFilter('WORKER_PAYMENT')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 whitespace-nowrap transition-all ${
                    ledgerTypeFilter === 'WORKER_PAYMENT'
                      ? 'bg-rose-600 text-white font-bold shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/60'
                  }`}
                >
                  Worker Salary &amp; Wages
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerTypeFilter('SUPPLIER_PAYMENT')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 whitespace-nowrap transition-all ${
                    ledgerTypeFilter === 'SUPPLIER_PAYMENT'
                      ? 'bg-purple-600 text-white font-bold shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/60'
                  }`}
                >
                  Supplier Payments
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerTypeFilter('TRANSFER')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 whitespace-nowrap transition-all ${
                    ledgerTypeFilter === 'TRANSFER'
                      ? 'bg-sky-600 text-white font-bold shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/60'
                  }`}
                >
                  Transfers Between Partners
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerTypeFilter('BANK')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 whitespace-nowrap transition-all ${
                    ledgerTypeFilter === 'BANK'
                      ? 'bg-indigo-600 text-white font-bold shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/60'
                  }`}
                >
                  Bank Deposits &amp; Withdrawals
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setLedgerTypeFilter('TRANSFER_IN')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 whitespace-nowrap transition-all ${
                    ledgerTypeFilter === 'TRANSFER_IN'
                      ? 'bg-sky-600 text-white font-bold shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/60'
                  }`}
                >
                  Transfers Received
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerTypeFilter('EXPENSE')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 whitespace-nowrap transition-all ${
                    ledgerTypeFilter === 'EXPENSE'
                      ? 'bg-amber-600 text-white font-bold shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/60'
                  }`}
                >
                  Site Expenses
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerTypeFilter('WORKER_PAYMENT')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 whitespace-nowrap transition-all ${
                    ledgerTypeFilter === 'WORKER_PAYMENT'
                      ? 'bg-rose-600 text-white font-bold shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/60'
                  }`}
                >
                  Worker Salary &amp; Wages
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerTypeFilter('SUPPLIER_PAYMENT')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 whitespace-nowrap transition-all ${
                    ledgerTypeFilter === 'SUPPLIER_PAYMENT'
                      ? 'bg-purple-600 text-white font-bold shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/60'
                  }`}
                >
                  Supplier Payments
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerTypeFilter('TRANSFER_OUT')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 whitespace-nowrap transition-all ${
                    ledgerTypeFilter === 'TRANSFER_OUT'
                      ? 'bg-indigo-600 text-white font-bold shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/60'
                  }`}
                >
                  Transfers Out to Partners
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerTypeFilter('BANK')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 whitespace-nowrap transition-all ${
                    ledgerTypeFilter === 'BANK'
                      ? 'bg-sky-600 text-white font-bold shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/60'
                  }`}
                >
                  Bank In / Out
                </button>
              </>
            )}
          </div>
        </div>

          {/* Mobile Transaction Statement Cards View */}
          <div className="block md:hidden space-y-2.5">
            {displayedLedger.length === 0 ? (
              <div className="py-10 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="font-semibold text-xs">
                  {isBankSelected
                    ? 'No bank transactions recorded for this period'
                    : isAllSelected
                    ? 'No transactions found across company for this period'
                    : 'No transactions recorded for this partner in this period'}
                </p>
                <p className="text-[11px] mt-1">Tap &quot;Send Money&quot; above to record a new transaction.</p>
              </div>
            ) : (
              displayedLedger.map((entry) => {
                const isCredit = entry.credit > 0;
                const isOpOrBbf = entry.type === 'OPENING_BALANCE' || entry.type === 'BALANCE_BROUGHT_FORWARD';
                return (
                  <div
                    key={entry.id}
                    className={`p-3.5 rounded-xl border shadow-sm space-y-2 transition-all ${
                      entry.isDeleted
                        ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 opacity-75'
                        : isOpOrBbf
                        ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/40'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {/* Row 1: Date & Type Badge & Badges */}
                    <div className="flex items-center justify-between gap-2 text-xs flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          entry.type === 'OPENING_BALANCE'
                            ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                            : entry.type === 'BALANCE_BROUGHT_FORWARD'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                            : entry.type === 'RECEIPT'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : entry.type === 'TRANSFER_IN' || entry.type === 'BANK_WITHDRAWAL'
                            ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20'
                            : entry.type === 'TRANSFER_OUT'
                            ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                        }`}>
                          {entry.categoryLabel}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[9px] font-semibold text-slate-600 dark:text-slate-400">
                          {entry.paymentMethod}
                        </span>
                        {entry.isEdited && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[9px] font-bold border border-amber-500/30 flex items-center gap-0.5" title={entry.editReason ? `Edit reason: ${entry.editReason}` : 'Edited'}>
                            <History className="w-2.5 h-2.5" /> Edited
                          </span>
                        )}
                        {entry.isDeleted && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-700 dark:text-rose-300 text-[9px] font-bold border border-rose-500/30" title={entry.deleteReason ? `Delete reason: ${entry.deleteReason}` : 'Deleted'}>
                            Deleted
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[10px] text-slate-400 shrink-0">
                        {new Date(entry.date).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    {/* Row 2: Title & Amount */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className={`font-bold text-xs ${entry.isDeleted ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'} leading-snug`}>
                          {entry.title}
                        </div>
                        {entry.subtitle && (
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {entry.subtitle}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 text-right font-mono font-black text-sm">
                        {isCredit ? (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            +{formatINR(entry.credit)}
                          </span>
                        ) : (
                          <span className="text-rose-600 dark:text-rose-400">
                            -{formatINR(entry.debit)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Row 3: Running Balance */}
                    <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">Running Balance:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {entry.runningBalance !== undefined ? formatINR(entry.runningBalance) : '—'}
                      </span>
                    </div>

                    {/* Row 4: Reference & Notes if any */}
                    {(entry.reference || entry.notes || entry.deleteReason) && (
                      <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">{entry.notes || '—'}</span>
                          {entry.reference && (
                            <span className="font-mono text-[10px] text-slate-400 shrink-0">
                              Ref: {entry.reference}
                            </span>
                          )}
                        </div>
                        {entry.deleteReason && (
                          <div className="text-[10px] text-rose-500 font-medium">
                            Delete Reason: {entry.deleteReason}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Row 5: Action buttons if editable */}
                    {!isOpOrBbf && !entry.isDeleted && (entry.canEdit || entry.canDelete) && (
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        {entry.canEdit && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenEdit(entry)}
                            className="h-7 px-2.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200"
                          >
                            <Pencil className="w-3 h-3 mr-1 text-indigo-500" />
                            Edit
                          </Button>
                        )}
                        {entry.canDelete && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenDelete(entry)}
                            className="h-7 px-2.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          >
                            <Trash2 className="w-3 h-3 mr-1 text-rose-500" />
                            Delete
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Toggle Full Table View on mobile */}
            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={() => setShowMobileTableLedger(!showMobileTableLedger)}
                className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 underline underline-offset-4 transition-colors"
              >
                {showMobileTableLedger ? 'Hide Full Table Ledger' : 'View Full Table (Horizontal Scroll)'}
              </button>
            </div>
          </div>

          {/* Desktop Table (or mobile when toggled) */}
          <div className={`${showMobileTableLedger ? 'block' : 'hidden md:block'} bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Transaction Details</th>
                    <th className="py-3 px-4">Mode</th>
                    <th className="py-3 px-4 text-right">Inflow (+ Credit)</th>
                    <th className="py-3 px-4 text-right">Outflow (- Debit)</th>
                    <th className="py-3 px-4 text-right">Running Balance</th>
                    <th className="py-3 px-4">Reference / Remarks</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {displayedLedger.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="font-semibold">
                          {isBankSelected
                            ? 'No bank transactions recorded for this period'
                            : isAllSelected
                            ? 'No transactions found across company for this period'
                            : 'No transactions recorded for this partner in this period'}
                        </p>
                        <p className="text-[11px] mt-1">Use the &quot;Send Money&quot; button above to record a new transaction.</p>
                      </td>
                    </tr>
                  ) : (
                    displayedLedger.map((entry) => {
                      const isCredit = entry.credit > 0;
                      const isOpOrBbf = entry.type === 'OPENING_BALANCE' || entry.type === 'BALANCE_BROUGHT_FORWARD';
                      return (
                        <tr
                          key={entry.id}
                          className={`transition-colors ${
                            entry.isDeleted
                              ? 'bg-rose-50/30 dark:bg-rose-950/15 opacity-70'
                              : isOpOrBbf
                              ? 'bg-indigo-50/20 dark:bg-indigo-950/20 font-medium'
                              : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                            {new Date(entry.date).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  entry.type === 'OPENING_BALANCE'
                                    ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                                    : entry.type === 'BALANCE_BROUGHT_FORWARD'
                                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                    : entry.type === 'RECEIPT'
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                    : entry.type === 'TRANSFER_IN' || entry.type === 'BANK_WITHDRAWAL'
                                    ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20'
                                    : entry.type === 'TRANSFER_OUT'
                                    ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                }`}>
                                  {entry.categoryLabel}
                                </span>
                                {entry.isEdited && (
                                  <span
                                    className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-0.5"
                                    title={entry.editReason ? `Edit reason: ${entry.editReason}` : 'Edited'}
                                  >
                                    <History className="w-2.5 h-2.5" /> Edited
                                  </span>
                                )}
                                {entry.isDeleted && (
                                  <span
                                    className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30"
                                    title={entry.deleteReason ? `Delete reason: ${entry.deleteReason}` : 'Deleted'}
                                  >
                                    Deleted
                                  </span>
                                )}
                              </div>
                              <div className={`font-bold ${entry.isDeleted ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>
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
                          <td className="py-3.5 px-4 text-right font-mono font-black whitespace-nowrap text-slate-900 dark:text-white">
                            {entry.runningBalance !== undefined ? formatINR(entry.runningBalance) : '—'}
                          </td>
                          <td className="py-3.5 px-4 text-[11px] text-slate-500 dark:text-slate-400 max-w-xs">
                            {entry.reference ? <span className="font-mono text-slate-600 dark:text-slate-300">{entry.reference} • </span> : ''}
                            <span>{entry.notes || entry.remarks || '—'}</span>
                            {entry.deleteReason && (
                              <div className="text-[10px] text-rose-500 mt-0.5">
                                Reason: {entry.deleteReason}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {isOpOrBbf ? (
                              <span className="text-[11px] text-slate-400">—</span>
                            ) : entry.isDeleted ? (
                              <span className="text-[10px] text-rose-400 font-semibold italic">Deleted</span>
                            ) : (entry.canEdit || entry.canDelete) ? (
                              <div className="flex items-center justify-center gap-1">
                                {entry.canEdit && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEdit(entry)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
                                    title="Edit entry"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {entry.canDelete && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDelete(entry)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                                    title="Delete entry"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400" title="Modification restricted by permission or age">
                                <Lock className="w-3 h-3 inline text-slate-400" />
                              </span>
                            )}
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

            {/* Destination Mode Selector (5 Options) */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
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
              <button
                type="button"
                onClick={() => setSendMoneyForm((prev) => ({ ...prev, destinationType: 'TO_SUPPLIER' }))}
                className={`py-2 px-2.5 rounded-lg text-xs font-bold text-center transition-all border flex flex-col items-center justify-center gap-1 ${
                  sendMoneyForm.destinationType === 'TO_SUPPLIER'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Truck className="w-4 h-4" />
                <span>To Supplier</span>
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

            {/* Destination 3: Worker Payment Options (Bulk Multi-Worker Flow) */}
            {sendMoneyForm.destinationType === 'TO_WORKER' && (
              <div className="space-y-3.5 pt-2">
                {/* Common Batch Parameters (Apply to all payments in queue) */}
                <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                        Payment Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={sendMoneyForm.date}
                        onChange={(e) => setSendMoneyForm((prev) => ({ ...prev, date: e.target.value }))}
                        className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                        Payment Method:
                      </label>
                      <select
                        value={sendMoneyForm.paymentMethod}
                        onChange={(e) => setSendMoneyForm((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                        className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="CASH">Cash in Hand</option>
                        <option value="BANK">Bank Transfer (NEFT/RTGS/IMPS)</option>
                        <option value="UPI">UPI / QR Code</option>
                        <option value="CHEQUE">Cheque</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
                        className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="">-- No Specific Project --</option>
                        {projects.map((pr) => (
                          <option key={pr.id} value={pr.id}>
                            {pr.name} ({pr.projectCode})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                        Reference / Batch Notes (Optional):
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Weekly Payout, Site 4 Labour"
                        value={sendMoneyForm.notes}
                        onChange={(e) => setSendMoneyForm((prev) => ({ ...prev, notes: e.target.value }))}
                        className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 1. Payment Reason / Category FIRST */}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Payment Reason / Category:
                  </label>
                  <select
                    value={sendMoneyForm.workerReasonSelect}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSendMoneyForm((prev) => ({ ...prev, workerReasonSelect: val }));
                      if (val === '__CUSTOM__') {
                        setCustomWorkerReasonError('');
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {availableWorkerReasons.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                    <option value="__CUSTOM__" className="font-bold text-emerald-600 dark:text-emerald-400">
                      + Add Custom Reason / Category...
                    </option>
                  </select>
                </div>

                {sendMoneyForm.workerReasonSelect === '__CUSTOM__' && (
                  <div className="p-3 rounded-xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5" />
                        New Worker Payment Reason
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setSendMoneyForm((prev) => ({
                            ...prev,
                            workerReasonSelect: availableWorkerReasons[0] || 'Salary / Wages',
                            customWorkerReason: '',
                          }));
                          setCustomWorkerReasonError('');
                        }}
                        className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        autoFocus
                        placeholder="e.g. Festival Bonus, Overtime Kharcha"
                        value={sendMoneyForm.customWorkerReason}
                        onChange={(e) => {
                          setSendMoneyForm((prev) => ({ ...prev, customWorkerReason: e.target.value }));
                          if (customWorkerReasonError) setCustomWorkerReasonError('');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveCustomWorkerReason();
                          }
                        }}
                        className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                      />
                      <button
                        type="button"
                        disabled={isSavingCustomWorkerReason || !sendMoneyForm.customWorkerReason.trim()}
                        onClick={handleSaveCustomWorkerReason}
                        className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shrink-0 shadow-sm"
                      >
                        {isSavingCustomWorkerReason ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Saving...</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add & Select</span>
                          </>
                        )}
                      </button>
                    </div>

                    {customWorkerReasonError && (
                      <p className="text-[11px] text-rose-500 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {customWorkerReasonError}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Press <strong>Enter</strong> or click <strong>Add &amp; Select</strong> to save permanently for future entries.
                    </p>
                  </div>
                )}

                {/* 2. Select Worker (with + Add new worker) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">
                      Select Worker / Labour:
                    </label>
                    {!showAddWorkerInline && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddWorkerInline(true);
                          setInlineWorkerError('');
                        }}
                        className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        Add new worker
                      </button>
                    )}
                  </div>
                  <select
                    value={sendMoneyForm.toWorkerId}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '__ADD_NEW__') {
                        setShowAddWorkerInline(true);
                        setInlineWorkerError('');
                      } else {
                        setSendMoneyForm((prev) => ({ ...prev, toWorkerId: val }));
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Choose Worker --</option>
                    {workers.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} {w.workerCode ? `(${w.workerCode})` : ''} {w.category ? `• ${w.category}` : ''}
                      </option>
                    ))}
                    <option value="__ADD_NEW__" className="font-bold text-emerald-600 dark:text-emerald-400">
                      + Add new worker
                    </option>
                  </select>
                </div>

                {/* Inline Mini Form for creating worker */}
                {showAddWorkerInline && (
                  <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        Add New Worker (Quick Register)
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowAddWorkerInline(false)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {inlineWorkerError && (
                      <div className="text-[11px] text-rose-500 font-semibold bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
                        {inlineWorkerError}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block mb-0.5">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          placeholder="Worker name"
                          value={inlineWorkerName}
                          onChange={(e) => setInlineWorkerName(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block mb-0.5">
                          Mobile (Optional)
                        </label>
                        <input
                          type="tel"
                          placeholder="10-digit mobile"
                          value={inlineWorkerMobile}
                          onChange={(e) => setInlineWorkerMobile(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block mb-0.5">
                          Daily Wage (₹)
                        </label>
                        <input
                          type="number"
                          placeholder="800"
                          value={inlineWorkerWage}
                          onChange={(e) => setInlineWorkerWage(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddWorkerInline(false)}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isSavingInlineWorker}
                        onClick={handleSaveInlineWorker}
                        className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 shadow-sm disabled:opacity-50"
                      >
                        {isSavingInlineWorker ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          'Save worker'
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. Amount with "Add to list" button */}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Amount (₹):
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                      <input
                        type="number"
                        step="any"
                        min="1"
                        placeholder="0.00"
                        value={workerAmountInput}
                        onChange={(e) => setWorkerAmountInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddWorkerToQueue();
                          }
                        }}
                        className="w-full pl-8 pr-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddWorkerToQueue}
                      className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 shadow-sm transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add to list</span>
                    </button>
                  </div>
                </div>

                {queueError && (
                  <div className="flex items-center gap-1.5 text-xs text-rose-500 font-semibold p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{queueError}</span>
                  </div>
                )}

                {/* 4. The Queue Grouped by Category */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                      <span>Payment Queue ({workerPaymentQueue.length})</span>
                    </span>
                    {workerPaymentQueue.length > 0 && (
                      <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        Queue Total: {formatINR(totalQueueAmount)}
                      </span>
                    )}
                  </div>

                  {workerPaymentQueue.length === 0 ? (
                    <div className="py-6 px-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        No workers added to queue yet.
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                        Choose category, worker, enter amount and click &quot;Add to list&quot; to queue multiple payments.
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-56 overflow-y-auto space-y-3 p-3 rounded-xl bg-slate-100/60 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800">
                      {Object.entries(queueGroupedByCategory).map(([cat, group]) => (
                        <div key={cat} className="space-y-1.5">
                          {/* Category Header with Subtotal */}
                          <div className="flex items-center justify-between py-1 px-2.5 rounded-lg bg-slate-200/80 dark:bg-slate-800/80 text-xs font-bold text-slate-800 dark:text-slate-200">
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span>{cat}</span>
                              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                ({group.items.length} {group.items.length === 1 ? 'payment' : 'payments'})
                              </span>
                            </div>
                            <span className="font-mono text-emerald-600 dark:text-emerald-400">
                              Subtotal: {formatINR(group.subtotal)}
                            </span>
                          </div>

                          {/* Worker Rows */}
                          <div className="space-y-1 pl-2">
                            {group.items.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between py-1 px-2 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                    {item.workerName}
                                  </span>
                                  {item.workerCode && (
                                    <span className="text-[10px] text-slate-400 font-mono shrink-0">
                                      ({item.workerCode})
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2.5 shrink-0">
                                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                                    {formatINR(item.amount)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveWorkerFromQueue(item.id)}
                                    className="text-slate-400 hover:text-rose-500 transition-colors p-0.5 rounded"
                                    title="Remove worker from queue"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Source Balance Exceeded Warning */}
                  {isQueueBalanceExceeded && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>
                        Total queue amount ({formatINR(totalQueueAmount)}) exceeds available source balance ({formatINR(sourceAvailableBalance)}). Please reduce amounts or remove workers.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Destination 4: Self / Site Expense Options (Bulk Multi-Expense Flow) */}
            {sendMoneyForm.destinationType === 'SELF_EXPENSE' && (
              <div className="space-y-3.5 pt-2">
                {/* Common Batch Parameters (Apply to all expenses in queue) */}
                <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                        Transaction Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={sendMoneyForm.date}
                        onChange={(e) => setSendMoneyForm((prev) => ({ ...prev, date: e.target.value }))}
                        className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                        Payment Method:
                      </label>
                      <select
                        value={sendMoneyForm.paymentMethod}
                        onChange={(e) => setSendMoneyForm((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                        className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="CASH">Cash in Hand</option>
                        <option value="BANK">Bank Transfer (NEFT/RTGS/IMPS)</option>
                        <option value="UPI">UPI / QR Code</option>
                        <option value="CHEQUE">Cheque</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
                            siteId: proj?.sites && proj.sites.length > 0 ? proj.sites[0].id : '',
                          }));
                        }}
                        className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="">-- No Specific Project --</option>
                        {projects.map((pr) => (
                          <option key={pr.id} value={pr.id}>
                            {pr.name} ({pr.projectCode})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                        Site:
                      </label>
                      {(() => {
                        const selectedProj = projects.find((p) => p.id === sendMoneyForm.projectId);
                        if (!selectedProj || !selectedProj.sites || selectedProj.sites.length === 0) {
                          return (
                            <div className="w-full px-3 py-1.5 rounded-lg bg-slate-200/50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-400 dark:text-slate-500">
                              No site
                            </div>
                          );
                        }
                        return (
                          <select
                            value={sendMoneyForm.siteId}
                            onChange={(e) => setSendMoneyForm((prev) => ({ ...prev, siteId: e.target.value }))}
                            className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                          >
                            {selectedProj.sites.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        );
                      })()}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      Reference / UTR / Remarks (Optional):
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. UTR123456, Paid via GPay, Cash handed over"
                      value={sendMoneyForm.reference || sendMoneyForm.notes}
                      onChange={(e) =>
                        setSendMoneyForm((prev) => ({
                          ...prev,
                          reference: e.target.value,
                          notes: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                {/* 1. Expense Category FIRST */}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Expense Category:
                  </label>
                  <select
                    value={sendMoneyForm.expenseCategorySelect}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSendMoneyForm((prev) => ({ ...prev, expenseCategorySelect: val }));
                      if (val === '__CUSTOM__') {
                        setCustomCategoryError('');
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {availableExpenseCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value="__CUSTOM__" className="font-bold text-amber-600 dark:text-amber-400">
                      + Add Custom Category...
                    </option>
                  </select>
                </div>

                {sendMoneyForm.expenseCategorySelect === '__CUSTOM__' && (
                  <div className="p-3 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5" />
                        New Custom Category
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setSendMoneyForm((prev) => ({
                            ...prev,
                            expenseCategorySelect: availableExpenseCategories[0] || 'Site Materials / Hardware',
                            customCategoryName: '',
                          }));
                          setCustomCategoryError('');
                        }}
                        className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        autoFocus
                        placeholder="e.g. Generator Fuel, Client Lunch, Hardware"
                        value={sendMoneyForm.customCategoryName}
                        onChange={(e) => {
                          setSendMoneyForm((prev) => ({ ...prev, customCategoryName: e.target.value }));
                          if (customCategoryError) setCustomCategoryError('');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveCustomExpenseCategory();
                          }
                        }}
                        className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                      />
                      <button
                        type="button"
                        disabled={isSavingCustomCategory || !sendMoneyForm.customCategoryName.trim()}
                        onClick={handleSaveCustomExpenseCategory}
                        className="px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shrink-0 shadow-sm"
                      >
                        {isSavingCustomCategory ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Saving...</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add & Select</span>
                          </>
                        )}
                      </button>
                    </div>

                    {customCategoryError && (
                      <p className="text-[11px] text-rose-500 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {customCategoryError}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Press <strong>Enter</strong> or click <strong>Add &amp; Select</strong> to save permanently for future entries.
                    </p>
                  </div>
                )}

                {/* 2. Description and 3. Vendor / Shop Name */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      Expense Description:
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Petrol for site visit, cement bags"
                      value={expenseDescriptionInput}
                      onChange={(e) => setExpenseDescriptionInput(e.target.value)}
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
                      value={expenseVendorInput}
                      onChange={(e) => setExpenseVendorInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                {/* 4. Amount with "Add to list" button */}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Amount (₹):
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                      <input
                        type="number"
                        step="any"
                        min="1"
                        placeholder="0.00"
                        value={expenseAmountInput}
                        onChange={(e) => setExpenseAmountInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddExpenseToQueue();
                          }
                        }}
                        className="w-full pl-8 pr-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddExpenseToQueue}
                      className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 shadow-sm transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add to list</span>
                    </button>
                  </div>
                </div>

                {expenseQueueError && (
                  <div className="flex items-center gap-1.5 text-xs text-rose-500 font-semibold p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{expenseQueueError}</span>
                  </div>
                )}

                {/* 4. The Queue Grouped by Category */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                      <span>Expense Queue ({expenseQueue.length})</span>
                    </span>
                    {expenseQueue.length > 0 && (
                      <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                        Queue Total: {formatINR(totalExpenseQueueAmount)}
                      </span>
                    )}
                  </div>

                  {expenseQueue.length === 0 ? (
                    <div className="py-6 px-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        No expenses added to queue yet.
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                        Choose category, enter description, amount and click &quot;Add to list&quot; to queue multiple expenses.
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-56 overflow-y-auto space-y-3 p-3 rounded-xl bg-slate-100/60 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800">
                      {Object.entries(expenseQueueGroupedByCategory).map(([cat, group]) => (
                        <div key={cat} className="space-y-1.5">
                          {/* Category Header with Subtotal */}
                          <div className="flex items-center justify-between py-1 px-2.5 rounded-lg bg-slate-200/80 dark:bg-slate-800/80 text-xs font-bold text-slate-800 dark:text-slate-200">
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              <span>{cat}</span>
                              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                ({group.items.length} {group.items.length === 1 ? 'expense' : 'expenses'})
                              </span>
                            </div>
                            <span className="font-mono text-amber-600 dark:text-amber-400">
                              Subtotal: {formatINR(group.subtotal)}
                            </span>
                          </div>

                          {/* Expense Rows */}
                          <div className="space-y-1 pl-2">
                            {group.items.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between py-1 px-2 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                    {item.description}
                                  </span>
                                  {item.vendor && (
                                    <span className="text-[10px] text-slate-400 font-medium shrink-0">
                                      ({item.vendor})
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2.5 shrink-0">
                                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                                    {formatINR(item.amount)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveExpenseFromQueue(item.id)}
                                    className="text-slate-400 hover:text-rose-500 transition-colors p-0.5 rounded"
                                    title="Remove expense from queue"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Source Balance Exceeded Warning */}
                  {isExpenseQueueBalanceExceeded && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>
                        Total queue amount ({formatINR(totalExpenseQueueAmount)}) exceeds available source balance ({formatINR(sourceAvailableBalance)}). Please reduce amounts or remove expenses.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Destination 5: Supplier Payment Options */}
            {sendMoneyForm.destinationType === 'TO_SUPPLIER' && (
              <div className="space-y-3 pt-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">
                      Select Supplier *
                    </label>
                    <Link
                      href="/materials/purchases"
                      className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Purchases &amp; Suppliers
                    </Link>
                  </div>
                  <select
                    value={sendMoneyForm.toSupplierId}
                    onChange={(e) => setSendMoneyForm((prev) => ({ ...prev, toSupplierId: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">-- Choose Recipient Supplier --</option>
                    {suppliers.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.mobile ? `(${s.mobile})` : ''} • Balance: {formatINR(s.currentBalance ?? s.balance ?? 0)}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Payment will credit this supplier&apos;s ledger and debit the selected source wallet/bank account once without double-counting.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 3. COMMON FIELDS FOR NON-WORKER & NON-EXPENSE DESTINATIONS (TO_PARTNER, BANK_DEPOSIT) */}
          {sendMoneyForm.destinationType !== 'TO_WORKER' && sendMoneyForm.destinationType !== 'SELF_EXPENSE' && (
            <>
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
            </>
          )}

          {/* Modal Actions */}
          <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            {sendMoneyForm.destinationType === 'TO_WORKER' ? (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 dark:text-slate-400">Total:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {formatINR(totalQueueAmount)}
                </span>
                <span className="text-slate-400">•</span>
                <span className="font-semibold text-slate-600 dark:text-slate-300">
                  {workerPaymentQueue.length} {workerPaymentQueue.length === 1 ? 'payment' : 'payments'}
                </span>
              </div>
            ) : sendMoneyForm.destinationType === 'SELF_EXPENSE' ? (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 dark:text-slate-400">Total:</span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                  {formatINR(totalExpenseQueueAmount)}
                </span>
                <span className="text-slate-400">•</span>
                <span className="font-semibold text-slate-600 dark:text-slate-300">
                  {expenseQueue.length} {expenseQueue.length === 1 ? 'expense' : 'expenses'}
                </span>
              </div>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
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
              {sendMoneyForm.destinationType === 'TO_WORKER' ? (
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingTransfer || workerPaymentQueue.length === 0 || isQueueBalanceExceeded}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                >
                  {isSubmittingTransfer ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Processing Bulk Payments...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                      Confirm and send all ({workerPaymentQueue.length})
                    </>
                  )}
                </Button>
              ) : sendMoneyForm.destinationType === 'SELF_EXPENSE' ? (
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingTransfer || expenseQueue.length === 0 || isExpenseQueueBalanceExceeded}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
                >
                  {isSubmittingTransfer ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Processing Bulk Expenses...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                      Confirm and send all ({expenseQueue.length})
                    </>
                  )}
                </Button>
              ) : (
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
              )}
            </div>
          </div>
        </form>
      </Modal>

      {/* 7. MODAL: SET OPENING BALANCE */}
      <Modal
        isOpen={isOpeningBalanceModalOpen}
        onClose={() => setIsOpeningBalanceModalOpen(false)}
        title={`Set Opening Balance: ${openingBalanceTarget?.name || ''}`}
        description="Set or adjust the starting opening balance as on a baseline date. Positive for funds in hand, negative for starting liability."
        size="md"
      >
        <form onSubmit={handleSubmitOpeningBalance} className="space-y-4">
          {openingBalanceError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{openingBalanceError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Opening Balance Amount (₹) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <IndianRupee className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 5000 or -2000"
                value={openingBalanceAmount}
                onChange={(e) => setOpeningBalanceAmount(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Enter positive amount (e.g. 5000) for cash held in hand, or negative (e.g. -2000) for dues / overdrawn balance.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              As On Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={openingBalanceDate}
              onChange={(e) => setOpeningBalanceDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Note / Reference (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Verified by Akshay Tak on financial handover"
              value={openingBalanceNote}
              onChange={(e) => setOpeningBalanceNote(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsOpeningBalanceModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmittingOpeningBalance}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
            >
              {isSubmittingOpeningBalance ? 'Saving...' : 'Save Opening Balance'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 8. MODAL: EDIT TRANSACTION */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Transaction Entry"
        description={`Modify transaction details for ${editingEntry?.title || 'selected record'}. Linked entries will update atomically.`}
        size="lg"
      >
        <form onSubmit={handleSubmitEdit} className="space-y-4">
          {editError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{editError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Amount (₹) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <IndianRupee className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={editForm.amount}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, amount: e.target.value }))}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Transaction Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                max={new Date().toISOString().split('T')[0]}
                value={editForm.date}
                onChange={(e) => setEditForm((prev) => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Category / Purpose
              </label>
              <input
                type="text"
                value={editForm.category}
                onChange={(e) => setEditForm((prev) => ({ ...prev, category: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Payment Method
              </label>
              <select
                value={editForm.paymentMethod}
                onChange={(e) => setEditForm((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="CASH">Cash in Hand</option>
                <option value="BANK">Bank Transfer (NEFT/RTGS/IMPS)</option>
                <option value="UPI">UPI / Online</option>
                <option value="CHEQUE">Cheque</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Project Link
              </label>
              <select
                value={editForm.projectId}
                onChange={(e) => {
                  const projId = e.target.value;
                  const proj = projects.find((p) => p.id === projId);
                  setEditForm((prev) => ({
                    ...prev,
                    projectId: projId,
                    siteId: proj?.sites[0]?.id || '',
                  }));
                }}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- No Project Link --</option>
                {projects.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.name} ({pr.projectCode})
                  </option>
                ))}
              </select>
            </div>

            {editingEntry?.workerId || editingEntry?.isWorkerPayment ? (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Worker
                </label>
                <select
                  value={editForm.workerId}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, workerId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Select Worker --</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} {w.workerCode ? `(${w.workerCode})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Description / Remarks
            </label>
            <input
              type="text"
              placeholder="e.g. Material voucher 402, cement bags"
              value={editForm.description}
              onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Reason for Edit <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Corrected amount from bill, updated wrong date"
              value={editForm.reason}
              onChange={(e) => setEditForm((prev) => ({ ...prev, reason: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Mandatory reason for audit log compliance.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmittingEdit}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
            >
              {isSubmittingEdit ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 9. MODAL: DELETE TRANSACTION CONFIRMATION */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirm Delete Transaction"
        description="Soft-deletes this transaction and all linked records atomically. The record remains in the audit log."
        size="md"
      >
        <form onSubmit={handleSubmitDelete} className="space-y-4">
          {deleteError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{deleteError}</span>
            </div>
          )}

          {deletingEntry && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 space-y-1.5 text-xs text-rose-900 dark:text-rose-200">
              <div className="font-bold flex items-center justify-between">
                <span>{deletingEntry.title}</span>
                <span className="font-mono text-sm font-black">
                  {deletingEntry.credit > 0 ? `+${formatINR(deletingEntry.credit)}` : `-${formatINR(deletingEntry.debit)}`}
                </span>
              </div>
              <div className="text-slate-600 dark:text-slate-400 text-[11px]">
                Date: {new Date(deletingEntry.date).toLocaleDateString('en-IN')} • Mode: {deletingEntry.paymentMethod}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Reason for Deletion <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Duplicate entry recorded by mistake, voucher cancelled"
              value={deleteReasonInput}
              onChange={(e) => setDeleteReasonInput(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
              required
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              A valid reason is required for compliance and audit trail.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmittingDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
            >
              {isSubmittingDelete ? 'Deleting...' : 'Confirm & Delete'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
