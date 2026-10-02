'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Landmark,
  Wallet,
  Users,
  ShieldCheck,
  ArrowDownLeft,
  ArrowUpRight,
  PieChart as PieIcon,
  RefreshCw,
  Plus,
  Building2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { formatINR } from '@/lib/calculations';
import { Button } from '@/components/ui/Button';
import { BankCashTransferModal } from '@/components/finance/BankCashTransferModal';
import { BankAccountManageModal } from '@/components/finance/BankAccountManageModal';

interface MoneyPositionData {
  totalPartnersCash: number;
  totalSupervisorsCash: number;
  totalBankBalance: number;
  totalMoney: number;
  breakdown: {
    partnerWallets: { id: string; name: string; balance: number; percentage: number }[];
    supervisorWallets: { id: string; name: string; balance: number; percentage: number }[];
    bankBalances: {
      id: string;
      name: string;
      bankName: string;
      accountLast4?: string | null;
      balance: number;
      percentage: number;
    }[];
  };
  totalReceived: number;
  totalExpenses: number;
  totalRemaining: number;
  categoryExpenses: { category: string; amount: number; percentage: number }[];
  isOwnerOrManager: boolean;
}

const DISTRIBUTION_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4'];

export function OverallMoneyPositionSection() {
  const [data, setData] = useState<MoneyPositionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isManageBanksOpen, setIsManageBanksOpen] = useState(false);

  const fetchPosition = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/finance/money-position');
      if (!res.ok) throw new Error('Failed to load overall money position');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Error loading money position');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosition();
  }, [fetchPosition]);

  // Distribution chart data: Partners Cash vs Supervisors Cash vs Bank Balances
  const distributionChartData = React.useMemo(() => {
    if (!data || data.totalMoney <= 0) return [];
    const items = [];
    if (data.totalPartnersCash > 0) {
      items.push({
        name: 'Partners Cash in Hand',
        amount: data.totalPartnersCash,
        percentage: Number(((data.totalPartnersCash / data.totalMoney) * 100).toFixed(1)),
        color: '#f59e0b', // amber
      });
    }
    if (data.totalBankBalance > 0) {
      items.push({
        name: 'Bank Accounts',
        amount: data.totalBankBalance,
        percentage: Number(((data.totalBankBalance / data.totalMoney) * 100).toFixed(1)),
        color: '#3b82f6', // blue
      });
    }
    if (data.totalSupervisorsCash > 0) {
      items.push({
        name: 'Supervisors Petty Cash',
        amount: data.totalSupervisorsCash,
        percentage: Number(((data.totalSupervisorsCash / data.totalMoney) * 100).toFixed(1)),
        color: '#10b981', // emerald
      });
    }
    return items;
  }, [data]);

  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                Overall Money Position
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase">
                  All Partners + Supervisors + Banks
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Single Source of Truth: Total company funds available across cash wallets and bank accounts
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => setIsTransferOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs h-9 flex items-center gap-1.5 shadow-md shadow-blue-950"
          >
            <ArrowDownLeft className="w-4 h-4" />
            ↔ Bank ⇄ Cash Transfer
          </Button>

          {data?.isOwnerOrManager && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsManageBanksOpen(true)}
              className="text-xs h-9 flex items-center gap-1.5"
            >
              <Building2 className="w-3.5 h-3.5 text-blue-500" />
              Manage Banks
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={fetchPosition}
            className="text-xs h-9 px-2.5"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Main 4 Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. Grand Total Money */}
        <div className="col-span-2 sm:col-span-1 p-4 rounded-xl bg-gradient-to-br from-emerald-950/30 to-slate-900/60 border border-emerald-500/30 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
              Total Company Money
            </span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-400">
            {formatINR(data?.totalMoney || 0)}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            Cash in Hand + Bank Balances
          </p>
        </div>

        {/* 2. Partners Cash in Hand */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-500 uppercase tracking-wider">
              Partners Cash in Hand
            </span>
            <Wallet className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
            {formatINR(data?.totalPartnersCash || 0)}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            {data?.breakdown?.partnerWallets?.length || 0} active partner wallet(s)
          </p>
        </div>

        {/* 3. Bank Balances Total */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-blue-500 uppercase tracking-wider">
              Total Bank Balances
            </span>
            <Building2 className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
            {formatINR(data?.totalBankBalance || 0)}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            {data?.breakdown?.bankBalances?.length || 0} active bank account(s)
          </p>
        </div>

        {/* 4. Supervisors Petty Cash */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider">
              Supervisors Cash
            </span>
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
            {formatINR(data?.totalSupervisorsCash || 0)}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            Site petty cash with supervisors
          </p>
        </div>
      </div>

      {/* Breakdown Grid & "Kaha Kitna Pada Hai" Distribution Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-1">
        {/* Left: Detailed Breakdown Cards */}
        <div className="lg:col-span-7 space-y-4">
          {/* Partner-wise Breakdown */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-amber-500" />
                Partner-wise Cash in Hand
              </span>
              <span className="text-[11px] text-slate-400 font-semibold">
                Total: {formatINR(data?.totalPartnersCash || 0)}
              </span>
            </div>

            <div className="space-y-1.5">
              {(data?.breakdown?.partnerWallets || []).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-extrabold text-amber-500 dark:text-amber-400">
                      {formatINR(p.balance)}
                    </span>
                    <span className="text-[11px] text-slate-400 font-semibold w-12 text-right">
                      {p.percentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bank-wise Breakdown */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-500" />
                Bank-wise Account Balances
              </span>
              <span className="text-[11px] text-slate-400 font-semibold">
                Total: {formatINR(data?.totalBankBalance || 0)}
              </span>
            </div>

            <div className="space-y-1.5">
              {(data?.breakdown?.bankBalances || []).length === 0 ? (
                <div className="text-center py-4 text-slate-400 text-xs">
                  No bank accounts added yet.
                </div>
              ) : (
                (data?.breakdown?.bankBalances || []).map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{b.name}</span>
                        <span className="text-[10px] text-slate-400 ml-1.5">
                          ({b.bankName} {b.accountLast4 ? `***${b.accountLast4}` : ''})
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-extrabold text-blue-600 dark:text-blue-400">
                        {formatINR(b.balance)}
                      </span>
                      <span className="text-[11px] text-slate-400 font-semibold w-12 text-right">
                        {b.percentage}%
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: "Kaha Kitna Pada Hai" Distribution Donut */}
        <div className="lg:col-span-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <PieIcon className="w-3.5 h-3.5 text-emerald-500" />
                Kaha Kitna Pada Hai (Distribution)
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Proportional share of cash in hand vs bank balances
            </p>

            {/* Donut Chart */}
            <div className="h-48 sm:h-52 w-full relative flex items-center justify-center my-2">
              {distributionChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const p = payload[0].payload;
                          return (
                            <div className="bg-slate-900 border border-slate-700 p-2 rounded-lg text-white text-xs">
                              <span className="font-bold">{p.name}: </span>
                              <span className="text-amber-400 font-extrabold">{formatINR(p.amount)}</span>
                              <div className="text-[10px] text-emerald-400">{p.percentage}%</div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Pie
                      data={distributionChartData}
                      dataKey="amount"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={75}
                      paddingAngle={4}
                    >
                      {distributionChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-slate-400 text-xs">Zero funds recorded.</div>
              )}
            </div>
          </div>

          {/* Distribution Legend */}
          <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
            {distributionChartData.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-white dark:bg-slate-900"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-white">{formatINR(item.amount)}</span>
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 w-12 text-right">
                    {item.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom KPI Flow Strip: Total Received, Total Expense, Total Cash+Bank Bacha */}
      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Received</span>
            <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
              +{formatINR(data?.totalReceived || 0)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-rose-500/10 text-rose-500">
            <TrendingDown className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Expenses Spent</span>
            <span className="font-bold text-sm text-rose-600 dark:text-rose-400">
              -{formatINR(data?.totalExpenses || 0)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Cash + Bank Bacha</span>
            <span className="font-bold text-sm text-amber-600 dark:text-amber-400">
              ={formatINR(data?.totalMoney || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Modals */}
      <BankCashTransferModal
        isOpen={isTransferOpen}
        onClose={() => setIsTransferOpen(false)}
        onSuccess={fetchPosition}
        isOwnerOrManager={data?.isOwnerOrManager}
      />

      <BankAccountManageModal
        isOpen={isManageBanksOpen}
        onClose={() => setIsManageBanksOpen(false)}
        onUpdated={fetchPosition}
      />
    </div>
  );
}
