'use client';

import React, { useState, useEffect } from 'react';
import { RotateCcw, AlertCircle, Building2, Calendar, FileText } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { formatINR } from '@/lib/calculations';

interface AddPurchaseReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preSelectedBill?: any;
}

export function AddPurchaseReturnModal({
  isOpen,
  onClose,
  onSuccess,
  preSelectedBill,
}: AddPurchaseReturnModalProps) {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [billId, setBillId] = useState('');
  const [returnDate, setReturnDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    const fetchSuppliers = async () => {
      try {
        const res = await fetch('/api/purchases/suppliers');
        if (res.ok) {
          const d = await res.json();
          setSuppliers(d.suppliers || []);
        }
      } catch (e) {
        console.error(e);
      }
    };

    fetchSuppliers();

    if (preSelectedBill) {
      setSupplierId(preSelectedBill.supplierId || '');
      setBillId(preSelectedBill.id || '');
    } else {
      setSupplierId('');
      setBillId('');
      setAmount('');
      setReason('');
    }

    setError('');
  }, [isOpen, preSelectedBill]);

  // Fetch bills when supplier changes
  useEffect(() => {
    if (!supplierId) {
      setBills([]);
      return;
    }

    const fetchBills = async () => {
      try {
        const res = await fetch(`/api/purchases/bills?supplierId=${supplierId}`);
        if (res.ok) {
          const d = await res.json();
          setBills(d.bills || []);
        }
      } catch (e) {
        console.error(e);
      }
    };

    fetchBills();
  }, [supplierId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!supplierId) {
      setError('Please select a supplier');
      return;
    }

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setError('Please enter a valid return amount greater than ₹0');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/purchases/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId,
          billId: billId || null,
          returnDate,
          amount: amt,
          reason: reason.trim() || undefined,
        }),
      });

      const d = await res.json();
      if (!res.ok) {
        throw new Error(d.error || 'Failed to record purchase return');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Something went wrong while recording return');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Purchase Return"
      description="Return damaged or unused materials to supplier and reduce balance owed"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
              Select Supplier *
            </label>
            <select
              required
              value={supplierId}
              onChange={(e) => {
                setSupplierId(e.target.value);
                setBillId('');
              }}
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">-- Choose Supplier --</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} • Due: {formatINR(s.remainingBalance ?? s.openingBalance ?? 0)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
              Linked Purchase Bill (Optional)
            </label>
            <select
              value={billId}
              onChange={(e) => setBillId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white"
            >
              <option value="">-- General Return (Not Linked to Specific Bill) --</option>
              {bills.map((b) => (
                <option key={b.id} value={b.id}>
                  Bill #{b.billNumber || 'No #'} • {new Date(b.billDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} • Total: {formatINR(b.totalAmount)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                Return Date *
              </label>
              <input
                type="date"
                required
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                Return Amount (₹) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                <input
                  type="number"
                  step="any"
                  min="1"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-amber-600"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
              Reason / Item Details (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. 50 bags damaged due to rain, returned to supplier truck"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-xs font-semibold"
          >
            Cancel
          </Button>

          <Button
            type="submit"
            disabled={isSubmitting || !supplierId || !amount}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-6"
          >
            {isSubmitting ? 'Recording...' : 'Record Return'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
