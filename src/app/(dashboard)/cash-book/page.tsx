'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  ShoppingBag,
  Receipt,
  Lock,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Trash2,
  RefreshCw,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Building,
  User,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { MoneyInModal } from '@/components/finance/MoneyInModal';
import { FundTransferModal } from '@/components/finance/FundTransferModal';
import { GoodsPurchaseModal } from '@/components/finance/GoodsPurchaseModal';
import { ExpenseFormModal } from '@/components/finance/ExpenseFormModal';
import { DailyClosingModal } from '@/components/finance/DailyClosingModal';
import { ExpenseCharts } from '@/components/charts/ExpenseCharts';
import { OverallMoneyPositionSection } from '@/components/finance/OverallMoneyPositionSection';
import { BankCashTransferModal } from '@/components/finance/BankCashTransferModal';
import { BankAccountManageModal } from '@/components/finance/BankAccountManageModal';

interface TransactionItem {
  id: string;
  type: 'MONEY_IN' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'EXPENSE';
  direction: 'IN' | 'OUT';
  amount: number;
  date: string;
  description: string;
  category?: string;
  partyName?: string;
  partyType?: string;
  projectName?: string;
  siteName?: string;
  paymentMethod: string;
  reference?: string | null;
  notes?: string | null;
  raw: any;
}

interface WalletData {
  user: { id: string; name: string; email: string };
  date: string;
  lifetimeWallet: {
    totalCredits: number;
    totalDebits: number;
    balance: number;
  };
  dailyCashFlow: {
    openingBalance: number;
    totalInflowToday: number;
    totalOutflowToday: number;
    closingBalance: number;
    actualPhysicalCash: number | null;
    discrepancy: number | null;
  };
  dailyClosing: {
    isVerified: boolean;
    actualCash: number | null;
    verifiedAt: string | null;
    notes: string | null;
  } | null;
  ledger: TransactionItem[];
  allPartnersSummary?: {
    userId: string;
    name: string;
    email: string;
    balance: number;
    totalCredits: number;
    totalDebits: number;
  }[];
}

export default function CashBookPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [partnersList, setPartnersList] = useState<any[]>([]);

  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'ALL' | 'IN' | 'TRANSFERS' | 'EXPENSES' | 'PARTNERS'>('ALL');

  // Modals state
  const [isMoneyInOpen, setIsMoneyInOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isPurchaseOpen, setIsPurchaseOpen] = useState(false);
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);
  const [isClosingOpen, setIsClosingOpen] = useState(false);
  const [isBankTransferOpen, setIsBankTransferOpen] = useState(false);
  const [isManageBanksOpen, setIsManageBanksOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // 1. Load current user session
  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setCurrentUser(data.user);
        }
      } catch (err) {
        console.error('Failed to get current user:', err);
      }
    }
    loadUser();
  }, []);

  const isOwnerOrManager =
    currentUser?.role === 'OWNER' || currentUser?.role === 'MANAGER';

  // 2. Load partners list if Owner/Manager
  useEffect(() => {
    if (isOwnerOrManager) {
      async function loadPartners() {
        try {
          const res = await fetch('/api/partners');
          if (res.ok) {
            const data = await res.json();
            setPartnersList(data.partners || []);
          }
        } catch (err) {
          console.error('Failed to get partners list:', err);
        }
      }
      loadPartners();
    }
  }, [isOwnerOrManager]);

  // 3. Fetch wallet and ledger data
  const fetchWallet = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('date', selectedDate);
      if (selectedUserId) {
        params.append('userId', selectedUserId);
      }
      if (isOwnerOrManager) {
        params.append('summary', 'all');
      }

      const res = await fetch(`/api/wallet?${params.toString()}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to fetch cash book data');
      }

      const data = await res.json();
      setWalletData(data);
    } catch (err: any) {
      setError(err.message || 'Error loading wallet data');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedUserId, isOwnerOrManager]);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  // Date step helper
  const handleDateShift = (days: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const handleSetToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  // Delete transaction with Day Lock check
  const handleDeleteTransaction = async (item: TransactionItem) => {
    if (!confirm(`Are you sure you want to delete this ${item.type} entry of ₹${item.amount.toLocaleString('en-IN')}?`)) {
      return;
    }

    try {
      let endpoint = '';
      if (item.type === 'MONEY_IN') {
        endpoint = `/api/finance/receipts/${item.id}`;
      } else if (item.type === 'TRANSFER_OUT' || item.type === 'TRANSFER_IN') {
        endpoint = `/api/finance/transfers/${item.id}`;
      } else if (item.type === 'EXPENSE') {
        endpoint = `/api/finance/expenses/${item.id}`;
      }

      const res = await fetch(endpoint, { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Failed to delete record');
        return;
      }

      if (data.warning) {
        alert(`Warning: ${data.warning}`);
      }

      setStatusMessage(data.message || 'Entry deleted successfully');
      setTimeout(() => setStatusMessage(null), 4000);
      fetchWallet();
    } catch (err: any) {
      alert(err.message || 'Network error occurred');
    }
  };

  // Filtered transactions for tabs
  const filteredLedger = (walletData?.ledger || []).filter((item) => {
    if (activeTab === 'IN') return item.direction === 'IN';
    if (activeTab === 'TRANSFERS') return item.type === 'TRANSFER_OUT' || item.type === 'TRANSFER_IN';
    if (activeTab === 'EXPENSES') return item.type === 'EXPENSE';
    return true;
  });

  const daily = walletData?.dailyCashFlow;
  const closing = walletData?.dailyClosing;
  const isVerified = Boolean(closing?.isVerified);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header & Context Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Cash Book &amp; Partner Wallet
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Single Source of Truth: Daily connected hisaab for waterproofing sites &amp; partners
              </p>
            </div>
          </div>
        </div>

        {/* Date Selector & Partner Filter */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Partner Selector for Owner */}
          {isOwnerOrManager && partnersList.length > 0 && (
            <div className="flex items-center">
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="h-9 px-3 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="">👤 My Cash Book</option>
                {partnersList.map((p) => (
                  <option key={p.id} value={p.id}>
                    🤝 {p.name} ({p.role}) - ₹{(p.walletBalance || 0).toLocaleString('en-IN')}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date Picker & Controls */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-0.5">
            <button
              onClick={() => handleDateShift(-1)}
              className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded hover:bg-slate-200 dark:hover:bg-slate-800"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-semibold px-2 text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
            />
            <button
              onClick={() => handleDateShift(1)}
              className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded hover:bg-slate-200 dark:hover:bg-slate-800"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={handleSetToday}
            className="text-xs h-9"
          >
            Today
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={fetchWallet}
            className="text-xs h-9 px-2.5"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>

          {isOwnerOrManager && (
            <Button
              size="sm"
              variant="outline"
              disabled={isResetting}
              onClick={async () => {
                const confirmed = confirm(
                  'Kripya confirm karein:\n\nKya aap sach me Cash Book ka saara hisaab clear karke fresh hisaab shuru karna chahte hain?\n\n- Saari Money In, Partner Transfers, Daily Expenses, Day Closings aur Bank Cash Movement delete ho jayengi.\n- Wallet balance ₹0 ho jayega.\n- Projects aur Workers delete nahi honge.\n\nProceed karein?'
                );
                if (!confirmed) return;

                setIsResetting(true);
                setError(null);
                setStatusMessage(null);
                try {
                  const res = await fetch('/api/finance/reset-cash-book', { method: 'POST' });
                  const data = await res.json();
                  if (!res.ok) {
                    setError(data.error || 'Failed to reset Cash Book');
                    return;
                  }
                  setStatusMessage(data.message || 'Cash Book successfully reset to ₹0!');
                  await fetchWallet();
                } catch (err: any) {
                  setError(err.message || 'Error resetting Cash Book');
                } finally {
                  setIsResetting(false);
                }
              }}
              className="text-xs h-9 text-rose-500 border-rose-500/30 hover:bg-rose-500/10 font-bold"
              title="Reset Cash Book Transactions to ₹0"
            >
              <RotateCcw className={`w-3.5 h-3.5 mr-1.5 ${isResetting ? 'animate-spin' : ''}`} />
              {isResetting ? 'Resetting...' : 'Reset Cash Book'}
            </Button>
          )}
        </div>
      </div>

      {statusMessage && (
        <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-xl">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Day Verification & Lock Banner */}
      <div
        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border ${
          isVerified
            ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
            : 'bg-amber-950/20 border-amber-800/40 text-amber-300'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg ${
              isVerified ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
            }`}
          >
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold block">
              {isVerified
                ? `Din Ka Hisaab Verified & Locked (${new Date(selectedDate).toLocaleDateString('en-IN')})`
                : `Din Ka Hisaab Pending Verification (${new Date(selectedDate).toLocaleDateString('en-IN')})`}
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5">
              {isVerified
                ? `Physical cash counted: ₹${(closing?.actualCash || 0).toLocaleString('en-IN')}. Past entries locked against accidental change.`
                : 'Count physical cash at end of day, compare with system closing, and lock entries.'}
            </span>
          </div>
        </div>

        <Button
          size="sm"
          onClick={() => setIsClosingOpen(true)}
          className={`text-xs font-semibold ${
            isVerified
              ? 'bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-200 border border-emerald-500/30'
              : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold'
          }`}
        >
          {isVerified ? 'Re-verify Cash Closing' : 'Verify & Close Day (Din Ka Hisaab)'}
        </Button>
      </div>

      {/* Aaj Ka Hisaab - Financial Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {/* Total In-Hand Wallet Balance */}
        <div className="col-span-2 sm:col-span-1 p-4 rounded-xl bg-slate-900 border border-amber-500/30 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-400/90 uppercase tracking-wider">
              Cash In Hand (Total)
            </span>
            <Wallet className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-xl font-extrabold text-amber-400">
            ₹{(walletData?.lifetimeWallet.balance ?? 0).toLocaleString('en-IN')}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            Current live wallet balance
          </p>
        </div>

        {/* Opening Cash */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Opening Cash
          </span>
          <div className="mt-2 text-lg font-bold text-slate-200">
            ₹{(daily?.openingBalance ?? 0).toLocaleString('en-IN')}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Start of day balance</p>
        </div>

        {/* Today's Money IN */}
        <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-800/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
              Money IN Today
            </span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="mt-2 text-lg font-bold text-emerald-400">
            +₹{(daily?.totalInflowToday ?? 0).toLocaleString('en-IN')}
          </div>
          <p className="text-[10px] text-emerald-500/80 mt-1">Client receipts &amp; in</p>
        </div>

        {/* Today's Transfers OUT */}
        <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-800/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
              Transfers Given
            </span>
            <TrendingDown className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="mt-2 text-lg font-bold text-amber-400">
            -₹{(walletData?.ledger
              .filter((i) => i.type === 'TRANSFER_OUT')
              .reduce((s, i) => s + i.amount, 0) ?? 0
            ).toLocaleString('en-IN')}
          </div>
          <p className="text-[10px] text-amber-500/80 mt-1">To supervisor / worker</p>
        </div>

        {/* Today's Expenses */}
        <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-800/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider">
              Expenses Today
            </span>
            <Receipt className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="mt-2 text-lg font-bold text-rose-400">
            -₹{(walletData?.ledger
              .filter((i) => i.type === 'EXPENSE')
              .reduce((s, i) => s + i.amount, 0) ?? 0
            ).toLocaleString('en-IN')}
          </div>
          <p className="text-[10px] text-rose-500/80 mt-1">Goods, chay, petrol</p>
        </div>

        {/* Closing Cash Today */}
        <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-800/40">
          <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider block">
            Closing Cash Today
          </span>
          <div className="mt-2 text-lg font-bold text-blue-300">
            ₹{(daily?.closingBalance ?? 0).toLocaleString('en-IN')}
          </div>
          <p className="text-[10px] text-blue-400/80 mt-1">Opening + IN - OUT</p>
        </div>
      </div>

      {/* Quick Action Buttons Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5 p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl">
        <span className="text-xs font-semibold text-slate-400 mr-1 hidden sm:inline">
          Quick Entry:
        </span>

        {/* 1. Receive Money */}
        <Button
          onClick={() => setIsMoneyInOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-9 flex items-center gap-1.5 shadow-md shadow-emerald-950"
        >
          <ArrowDownLeft className="w-4 h-4" />
          + Receive Money (Client)
        </Button>

        {/* 2. Give Money / Transfer */}
        <Button
          onClick={() => setIsTransferOpen(true)}
          className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold text-xs h-9 flex items-center gap-1.5 shadow-md shadow-amber-950"
        >
          <ArrowUpRight className="w-4 h-4" />
          + Give Money (Supervisor / Worker)
        </Button>

        {/* 3. 1-Click Goods Purchase */}
        <Button
          onClick={() => setIsPurchaseOpen(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs h-9 flex items-center gap-1.5 shadow-md shadow-blue-950"
        >
          <ShoppingBag className="w-4 h-4" />
          + Buy Goods (Stock + Cash)
        </Button>

        {/* 4. Daily Expense */}
        <Button
          onClick={() => setIsExpenseOpen(true)}
          className="bg-rose-700 hover:bg-rose-600 text-white font-semibold text-xs h-9 flex items-center gap-1.5 shadow-md shadow-rose-950"
        >
          <Receipt className="w-4 h-4" />
          + Daily Expense (Chay/Petrol)
        </Button>

        {/* 5. Bank ⇄ Cash Transfer */}
        <Button
          onClick={() => setIsBankTransferOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs h-9 flex items-center gap-1.5 shadow-md shadow-indigo-950"
        >
          <ArrowDownLeft className="w-4 h-4" />
          + Bank ⇄ Cash
        </Button>

        {/* 6. Bank Accounts (Owner / Manager) */}
        {isOwnerOrManager && (
          <Button
            variant="outline"
            onClick={() => setIsManageBanksOpen(true)}
            className="text-xs h-9 flex items-center gap-1.5 text-blue-400 border-blue-500/30 hover:bg-blue-950/20"
          >
            <Building className="w-3.5 h-3.5 text-blue-400" />
            Bank Accounts
          </Button>
        )}

        {/* 7. Daily Closing */}
        <Button
          variant="outline"
          onClick={() => setIsClosingOpen(true)}
          className="text-xs h-9 flex items-center gap-1.5 border-purple-500/40 text-purple-300 hover:bg-purple-950/30 ml-auto"
        >
          <Lock className="w-3.5 h-3.5 text-purple-400" />
          Din Ka Hisaab
        </Button>
      </div>

      {/* Overall Money Position (Grand Total = Partners Cash + Supervisors Cash + Bank Balances) */}
      <OverallMoneyPositionSection />

      {/* Expense Charts (Round Donut + Pillar Bar) */}
      <ExpenseCharts
        title="Cash Book Expense Analytics"
        subtitle="Category-wise Round Donut & Partner-wise Pillar distribution (Single source of truth)"
        initialDateRange="TODAY"
      />

      {/* Tabs & Ledger Statement Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        {/* Tabs Bar */}
        <div className="flex items-center gap-1 p-2 border-b border-slate-800 bg-slate-950/60 overflow-x-auto">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'ALL'
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            All Transactions ({walletData?.ledger.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('IN')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'IN'
                ? 'bg-emerald-500 text-slate-950'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Money IN (Receipts)
          </button>
          <button
            onClick={() => setActiveTab('TRANSFERS')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'TRANSFERS'
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Transfers &amp; Worker Payouts
          </button>
          <button
            onClick={() => setActiveTab('EXPENSES')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'EXPENSES'
                ? 'bg-rose-500 text-slate-950'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Site &amp; Daily Expenses
          </button>

          {isOwnerOrManager && walletData?.allPartnersSummary && (
            <button
              onClick={() => setActiveTab('PARTNERS')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ml-auto ${
                activeTab === 'PARTNERS'
                  ? 'bg-blue-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              👥 All Partners Overview
            </button>
          )}
        </div>

        {/* Tab 1-4: Transactions Ledger Table */}
        {activeTab !== 'PARTNERS' && (
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-400 text-xs">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Loading ledger records...
              </div>
            ) : filteredLedger.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-xs">
                No transactions recorded for this date.
                <div className="mt-3 flex items-center justify-center gap-2">
                  <Button size="sm" onClick={() => setIsMoneyInOpen(true)}>
                    + Receive Money
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setIsTransferOpen(true)}>
                    + Transfer Cash
                  </Button>
                </div>
              </div>
            ) : (
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Party / Recipient</th>
                    <th className="py-3 px-4">Project &amp; Site</th>
                    <th className="py-3 px-4">Payment Mode</th>
                    <th className="py-3 px-4 text-right">Amount (₹)</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredLedger.map((item) => (
                    <tr
                      key={`${item.type}-${item.id}`}
                      className="hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3 px-4 whitespace-nowrap text-slate-400 font-medium">
                        {new Date(item.date).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                        })}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.direction === 'IN'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : item.type === 'TRANSFER_OUT'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {item.direction === 'IN' ? (
                            <ArrowDownLeft className="w-3 h-3" />
                          ) : (
                            <ArrowUpRight className="w-3 h-3" />
                          )}
                          {item.type === 'MONEY_IN'
                            ? 'Client IN'
                            : item.type === 'TRANSFER_IN'
                            ? 'Transfer IN'
                            : item.type === 'TRANSFER_OUT'
                            ? 'Transfer OUT'
                            : 'Expense'}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-medium text-slate-200 truncate flex items-center gap-1.5">
                          <span className="truncate">{item.description}</span>
                          {(item.raw?.purpose || item.category) && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 border border-amber-500/20 shrink-0">
                              {item.raw?.purpose || item.category}
                            </span>
                          )}
                        </div>
                        {item.notes && (
                          <div className="text-[11px] text-slate-400 truncate mt-0.5">
                            {item.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-300">
                        {item.partyName || '-'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="text-slate-300 font-medium">
                          {item.projectName || '-'}
                        </div>
                        {item.siteName && (
                          <div className="text-[10px] text-slate-400">{item.siteName}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-400">
                        {item.paymentMethod}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-right font-bold text-sm">
                        <span
                          className={
                            item.direction === 'IN'
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }
                        >
                          {item.direction === 'IN' ? '+' : '-'}₹
                          {item.amount.toLocaleString('en-IN')}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleDeleteTransaction(item)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors rounded hover:bg-slate-800"
                          title="Delete Entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 5: All Partners Overview Comparison (Owner / Manager view) */}
        {activeTab === 'PARTNERS' && (
          <div className="p-4">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Building className="w-4 h-4 text-blue-400" />
              Partners Cash Balance Comparison
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(walletData?.allPartnersSummary || []).map((p) => (
                <div
                  key={p.userId}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer"
                  onClick={() => {
                    setSelectedUserId(p.userId);
                    setActiveTab('ALL');
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-200">{p.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">
                      Partner
                    </span>
                  </div>
                  <div className="mt-3">
                    <span className="text-[11px] text-slate-400 block font-medium">Cash in Hand:</span>
                    <span className="text-xl font-extrabold text-amber-400">
                      ₹{p.balance.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-900 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                    <div>
                      <span>Total IN:</span>
                      <span className="text-emerald-400 font-semibold block">
                        ₹{p.totalCredits.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div>
                      <span>Total OUT:</span>
                      <span className="text-rose-400 font-semibold block">
                        ₹{p.totalDebits.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 text-[11px] text-amber-400 flex items-center gap-1 font-medium">
                    <span>View partner cash book &rarr;</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <MoneyInModal
        isOpen={isMoneyInOpen}
        onClose={() => setIsMoneyInOpen(false)}
        onSuccess={fetchWallet}
        defaultDate={selectedDate}
        isOwnerOrManager={isOwnerOrManager}
      />

      <FundTransferModal
        isOpen={isTransferOpen}
        onClose={() => setIsTransferOpen(false)}
        onSuccess={fetchWallet}
        defaultDate={selectedDate}
        currentUserRole={currentUser?.role}
      />

      <GoodsPurchaseModal
        isOpen={isPurchaseOpen}
        onClose={() => setIsPurchaseOpen(false)}
        onSuccess={fetchWallet}
        defaultDate={selectedDate}
      />

      <ExpenseFormModal
        isOpen={isExpenseOpen}
        onClose={() => setIsExpenseOpen(false)}
        onSuccess={fetchWallet}
      />

      <DailyClosingModal
        isOpen={isClosingOpen}
        onClose={() => setIsClosingOpen(false)}
        onSuccess={fetchWallet}
        date={selectedDate}
        systemClosingBalance={daily?.closingBalance || 0}
        existingActualCash={closing?.actualCash}
        existingNotes={closing?.notes}
        isAlreadyVerified={isVerified}
      />

      <BankCashTransferModal
        isOpen={isBankTransferOpen}
        onClose={() => setIsBankTransferOpen(false)}
        onSuccess={fetchWallet}
        defaultDate={selectedDate}
        isOwnerOrManager={isOwnerOrManager}
      />

      <BankAccountManageModal
        isOpen={isManageBanksOpen}
        onClose={() => setIsManageBanksOpen(false)}
        onUpdated={fetchWallet}
      />
    </div>
  );
}
