'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building,
  Wallet,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { formatINR } from '@/lib/calculations';

interface BankAccountOption {
  id: string;
  name: string;
  bankName: string;
  accountLast4?: string | null;
  balance: number;
}

interface PartnerOption {
  id: string;
  name: string;
  walletBalance?: number;
}

interface BankCashTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultDate?: string;
  defaultMode?: 'WITHDRAWAL' | 'DEPOSIT'; // WITHDRAWAL = Bank se Nikala, DEPOSIT = Bank mein Jama
  isOwnerOrManager?: boolean;
}

export function BankCashTransferModal({
  isOpen,
  onClose,
  onSuccess,
  defaultDate,
  defaultMode = 'WITHDRAWAL',
  isOwnerOrManager = false,
}: BankCashTransferModalProps) {
  const [mode, setMode] = useState<'WITHDRAWAL' | 'DEPOSIT'>(defaultMode);
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [selectedBankId, setSelectedBankId] = useState('');
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(defaultDate || new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMode(defaultMode);
      setDate(defaultDate || new Date().toISOString().split('T')[0]);
      setError(null);
      fetchDependencies();
    }
  }, [isOpen, defaultMode, defaultDate]);

  const fetchDependencies = async () => {
    setLoadingData(true);
    try {
      const [bankRes, partRes] = await Promise.all([
        fetch('/api/finance/bank-accounts'),
        isOwnerOrManager ? fetch('/api/partners') : Promise.resolve(null),
      ]);

      if (bankRes.ok) {
        const bData = await bankRes.json();
        setBankAccounts(bData.bankAccounts || []);
        if (bData.bankAccounts?.length > 0 && !selectedBankId) {
          setSelectedBankId(bData.bankAccounts[0].id);
        }
      }

      if (partRes && partRes.ok) {
        const pData = await partRes.json();
        setPartners(pData.partners || []);
      }
    } catch (err) {
      console.error('Failed to load transfer dependencies:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const selectedBank = bankAccounts.find((b) => b.id === selectedBankId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBankId) {
      setError('Please select a bank account');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }

    setLoading(true);
    setError(null);

    const txType = mode === 'WITHDRAWAL' ? 'TRANSFER_TO_PARTNER' : 'TRANSFER_FROM_PARTNER';

    try {
      const res = await fetch('/api/finance/bank-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankAccountId: selectedBankId,
          type: txType,
          amount: parsedAmount,
          date,
          partnerId: selectedPartnerId || undefined,
          reference: reference.trim() || null,
          notes: notes.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to execute bank cash transfer');
      }

      // Reset & notify
      setAmount('');
      setReference('');
      setNotes('');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const isWithdrawal = mode === 'WITHDRAWAL';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Bank & Cash Internal Movement"
      description="Transfer funds between Bank Account and Partner Cash In Hand. This is an internal movement and does NOT affect expenses or project costs."
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 text-sm text-rose-400 bg-rose-950/40 border border-rose-800 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setMode('WITHDRAWAL')}
            className={`py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              isWithdrawal
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4" />
            Bank se Cash Nikala
          </button>

          <button
            type="button"
            onClick={() => setMode('DEPOSIT')}
            className={`py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              !isWithdrawal
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            Cash Bank mein Jama
          </button>
        </div>

        {/* Visual Direction Flow Card */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-blue-500" />
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Source</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {isWithdrawal ? (selectedBank?.name || 'Selected Bank Account') : 'Partner Cash in Hand'}
              </span>
            </div>
          </div>

          <div className="text-slate-400 font-bold px-3">&rarr;</div>

          <div className="flex items-center gap-2 text-right">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Destination</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {isWithdrawal ? 'Partner Cash in Hand' : (selectedBank?.name || 'Selected Bank Account')}
              </span>
            </div>
            <Wallet className="w-4 h-4 text-amber-500" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Bank Account Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Bank Account <span className="text-rose-400">*</span>
            </label>
            <select
              value={selectedBankId}
              onChange={(e) => setSelectedBankId(e.target.value)}
              required
              className="w-full h-10 px-3 text-sm rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="" disabled>Select Bank Account...</option>
              {bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bankName} - {b.name} (Bal: {formatINR(b.balance)})
                </option>
              ))}
            </select>
            {selectedBank && (
              <span className="text-[11px] text-slate-400 mt-1 block">
                Live Bank Balance: <strong className="text-amber-400">{formatINR(selectedBank.balance)}</strong>
              </span>
            )}
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Amount to Transfer (₹) <span className="text-rose-400">*</span>
            </label>
            <Input
              type="number"
              min="1"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 10000"
              required
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Transfer Date <span className="text-rose-400">*</span>
            </label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          {/* Reference / Cheque No */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Cheque / Slip / UTR No. (Optional)
            </label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. Self Cheque #004521"
            />
          </div>

          {/* If Owner: Partner Selector */}
          {isOwnerOrManager && partners.length > 0 && (
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Target Partner Cash Wallet
              </label>
              <select
                value={selectedPartnerId}
                onChange={(e) => setSelectedPartnerId(e.target.value)}
                className="w-full h-10 px-3 text-sm rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="">Myself (Current Login User)</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Remarks / Transfer Purpose
          </label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              isWithdrawal
                ? 'e.g. Self withdrawal for site daily cash requirements'
                : 'e.g. Surplus site cash deposited into bank'
            }
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className={`font-semibold flex items-center gap-2 text-white ${
              isWithdrawal
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-950'
                : 'bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-950'
            }`}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isWithdrawal ? (
              <ArrowDownLeft className="w-4 h-4" />
            ) : (
              <ArrowUpRight className="w-4 h-4" />
            )}
            {isWithdrawal ? 'Withdraw Cash to Wallet' : 'Deposit Cash to Bank'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
