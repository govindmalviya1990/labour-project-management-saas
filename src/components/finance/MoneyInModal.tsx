'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ArrowDownLeft, Loader2, AlertCircle } from 'lucide-react';

interface ProjectOption {
  id: string;
  name: string;
  projectCode: string;
  sites?: { id: string; name: string }[];
}

interface PartnerOption {
  id: string;
  name: string;
}

interface BankAccountOption {
  id: string;
  name: string;
  bankName: string;
  accountLast4?: string | null;
  balance?: number;
}

interface MoneyInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultDate?: string;
  defaultProjectId?: string;
  defaultSiteId?: string;
  defaultClientName?: string;
  isOwnerOrManager?: boolean;
}

export function MoneyInModal({
  isOpen,
  onClose,
  onSuccess,
  defaultDate,
  defaultProjectId,
  defaultSiteId,
  defaultClientName,
  isOwnerOrManager = false,
}: MoneyInModalProps) {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState(defaultProjectId || '');
  const [selectedSiteId, setSelectedSiteId] = useState(defaultSiteId || '');
  const [receivedById, setReceivedById] = useState('');
  const [receivedIn, setReceivedIn] = useState<'WALLET' | 'BANK'>('WALLET');
  const [selectedBankAccountId, setSelectedBankAccountId] = useState('');
  const [clientName, setClientName] = useState(defaultClientName || '');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(defaultDate || new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [purpose, setPurpose] = useState('RUNNING_BILL');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDate(defaultDate || new Date().toISOString().split('T')[0]);
      if (defaultProjectId) setSelectedProjectId(defaultProjectId);
      if (defaultSiteId) setSelectedSiteId(defaultSiteId);
      if (defaultClientName && !clientName) setClientName(defaultClientName);
      setError(null);
      fetchDependencies();
    }
  }, [isOpen, defaultDate, defaultProjectId, defaultSiteId, defaultClientName]);

  const fetchDependencies = async () => {
    setLoadingData(true);
    try {
      const [projRes, partRes, bankRes] = await Promise.all([
        fetch('/api/projects'),
        isOwnerOrManager ? fetch('/api/partners') : Promise.resolve(null),
        fetch('/api/finance/bank-accounts'),
      ]);

      if (projRes.ok) {
        const data = await projRes.json();
        setProjects(data.projects || []);
        const targetId = defaultProjectId || selectedProjectId || (data.projects?.[0]?.id ?? '');
        setSelectedProjectId(targetId);
        if (defaultClientName && !clientName) {
          setClientName(defaultClientName);
        } else if (!clientName && targetId) {
          const found = (data.projects || []).find((p: any) => p.id === targetId);
          if (found?.clientName) setClientName(found.clientName);
        }
      }

      if (partRes && partRes.ok) {
        const pData = await partRes.json();
        setPartners(pData.partners || []);
      }

      if (bankRes && bankRes.ok) {
        const bData = await bankRes.json();
        setBankAccounts(bData.bankAccounts || []);
      }
    } catch (err) {
      console.error('Failed to load modal dependencies:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const availableSites = selectedProject?.sites || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      setError('Please select a project');
      return;
    }
    if (!clientName.trim()) {
      setError('Client name is required');
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }

    if (receivedIn === 'BANK' && !selectedBankAccountId) {
      setError('Please select which Bank Account received this payment');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/finance/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProjectId,
          siteId: selectedSiteId || null,
          receivedById: receivedById || undefined,
          receivedIn,
          bankAccountId: receivedIn === 'BANK' ? selectedBankAccountId : null,
          clientName: clientName.trim(),
          amount: parsedAmount,
          date,
          paymentMethod: receivedIn === 'BANK' ? (paymentMethod === 'CASH' ? 'BANK' : paymentMethod) : paymentMethod,
          purpose,
          reference: reference.trim() || null,
          notes: notes.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to record client receipt');
      }

      // Reset & notify
      setClientName('');
      setAmount('');
      setReference('');
      setNotes('');
      setSelectedBankAccountId('');
      setReceivedIn('WALLET');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Receive Client Payment (Money IN)"
      description="Record incoming project cash from client. Directly credits your partner wallet and updates project receivables."
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 text-sm text-rose-400 bg-rose-950/40 border border-rose-800 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Project */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Project <span className="text-rose-400">*</span>
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                setSelectedSiteId('');
              }}
              required
              className="w-full h-10 px-3 text-sm rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="" disabled>Select Project...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.projectCode})
                </option>
              ))}
            </select>
          </div>

          {/* Site / Tower */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Site / Tower (Optional)
            </label>
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className="w-full h-10 px-3 text-sm rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="">All / Entire Project</option>
              {availableSites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Client Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Client / Payer Name <span className="text-rose-400">*</span>
            </label>
            <Input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g. Mr. Patel / Shapoorji Group"
              required
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Amount Received (₹) <span className="text-rose-400">*</span>
            </label>
            <Input
              type="number"
              min="1"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 50000"
              required
            />
          </div>

          {/* Received In Destination */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Received In (Paisa Kaha Aaya) <span className="text-rose-400">*</span>
            </label>
            <select
              value={receivedIn === 'BANK' ? selectedBankAccountId : 'WALLET'}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'WALLET') {
                  setReceivedIn('WALLET');
                  setSelectedBankAccountId('');
                  setPaymentMethod('CASH');
                } else {
                  setReceivedIn('BANK');
                  setSelectedBankAccountId(val);
                  setPaymentMethod('BANK');
                }
              }}
              className="w-full h-10 px-3 text-sm rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="WALLET">👤 Partner Cash Wallet (Physical Cash in Hand)</option>
              {bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>
                  🏦 {b.bankName} - {b.name} {b.accountLast4 ? `(***${b.accountLast4})` : ''}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              {receivedIn === 'BANK'
                ? '⚡ Direct Bank Credit: Paisa Bank Account balance mein deposit hoga. Partner cash-in-hand wallet par asar nahi padega.'
                : '💼 Cash In Hand: Paisa partner ke physical cash book/wallet balance mein credit hoga.'}
            </p>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Payment Date <span className="text-rose-400">*</span>
            </label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full h-10 px-3 text-sm rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="CASH">💵 Physical Cash</option>
              <option value="UPI">📱 UPI / GPay / PhonePe</option>
              <option value="BANK">🏦 Bank NEFT / RTGS</option>
              <option value="CHEQUE">📝 Cheque</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          {/* Purpose */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Receipt Purpose / Stage
            </label>
            <select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="w-full h-10 px-3 text-sm rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="RUNNING_BILL">Running RA Bill Payment</option>
              <option value="ADVANCE">Site Mobilization Advance</option>
              <option value="FINAL_PAYMENT">Final Settlement Bill</option>
              <option value="RETENTION">Retention Money Release</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          {/* Reference / UTR */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Ref / Cheque / UTR No. (Optional)
            </label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. UTR-9821381 or Chq #12890"
            />
          </div>

          {/* If Owner: Receiver Partner */}
          {isOwnerOrManager && partners.length > 0 && (
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Received By Partner (Wallet to Credit)
              </label>
              <select
                value={receivedById}
                onChange={(e) => setReceivedById(e.target.value)}
                className="w-full h-10 px-3 text-sm rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="">Myself (Current Login)</option>
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
            Remarks / Site Notes
          </label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Received 2nd floor terrace slab waterproofing installment"
          />
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-2 shadow-lg shadow-emerald-900/30"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowDownLeft className="w-4 h-4" />
            )}
            Credit Cash Book
          </Button>
        </div>
      </form>
    </Modal>
  );
}
