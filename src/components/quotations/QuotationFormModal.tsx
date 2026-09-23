'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  FileSpreadsheet,
  Building2,
  Layers,
  Percent,
  CheckCircle2,
  FileText,
  Calculator,
} from 'lucide-react';
import { QUOTATION_TEMPLATES, QuotationTemplate, TemplateItem } from '@/lib/quotations/templates';
import { formatINR } from '@/lib/calculations';

interface QuotationFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  quotationToEdit?: any;
  projects?: { id: string; name: string; projectCode: string }[];
}

export function QuotationFormModal({
  isOpen,
  onClose,
  onSuccess,
  quotationToEdit,
  projects = [],
}: QuotationFormModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('RESIDENTIAL_CONSTRUCTION');
  const [quotationNumber, setQuotationNumber] = useState('');
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientGst, setClientGst] = useState('');
  const [projectId, setProjectId] = useState('');
  const [status, setStatus] = useState('DRAFT');
  const [formatLayout, setFormatLayout] = useState('MODERN');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [discountType, setDiscountType] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(18);
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [notes, setNotes] = useState('');

  const [items, setItems] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Populate data when editing or reset when creating
  useEffect(() => {
    if (quotationToEdit) {
      setQuotationNumber(quotationToEdit.quotationNumber || '');
      setTitle(quotationToEdit.title || '');
      setClientName(quotationToEdit.clientName || '');
      setClientPhone(quotationToEdit.clientPhone || '');
      setClientEmail(quotationToEdit.clientEmail || '');
      setClientAddress(quotationToEdit.clientAddress || '');
      setClientGst(quotationToEdit.clientGst || '');
      setProjectId(quotationToEdit.projectId || '');
      setStatus(quotationToEdit.status || 'DRAFT');
      setSelectedTemplate(quotationToEdit.templateType || 'RESIDENTIAL_CONSTRUCTION');
      setFormatLayout(quotationToEdit.formatLayout || 'MODERN');
      setDate(
        quotationToEdit.date
          ? new Date(quotationToEdit.date).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0]
      );
      setValidUntil(
        quotationToEdit.validUntil
          ? new Date(quotationToEdit.validUntil).toISOString().split('T')[0]
          : ''
      );
      setDiscountType(quotationToEdit.discountType || 'PERCENT');
      setDiscountValue(quotationToEdit.discountValue || 0);
      setTaxRate(quotationToEdit.taxRate ?? 18);
      setTermsAndConditions(quotationToEdit.termsAndConditions || '');
      setPaymentTerms(quotationToEdit.paymentTerms || '');
      setNotes(quotationToEdit.notes || '');
      setItems(
        quotationToEdit.items?.map((it: any) => ({
          description: it.description,
          unit: it.unit,
          quantity: it.quantity,
          rate: it.rate,
          notes: it.notes || '',
        })) || []
      );
    } else {
      // Default to initial template
      applyTemplate('RESIDENTIAL_CONSTRUCTION');
    }
  }, [quotationToEdit, isOpen]);

  const applyTemplate = (templateId: string) => {
    const tmpl = QUOTATION_TEMPLATES.find((t) => t.id === templateId);
    if (!tmpl) return;
    setSelectedTemplate(templateId);
    setTitle(tmpl.title);
    setTaxRate(tmpl.defaultTaxRate);
    setPaymentTerms(tmpl.paymentTerms);
    setTermsAndConditions(tmpl.termsAndConditions);
    setNotes(tmpl.notes);
    setItems(tmpl.items.map((i) => ({ ...i })));
  };

  const addItemRow = () => {
    setItems([
      ...items,
      { description: 'Additional Scope of Work item', unit: 'sq.ft.', quantity: 100, rate: 150 },
    ]);
  };

  const removeItemRow = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  const updateItem = (index: number, field: keyof TemplateItem, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  // Live Calculations
  const subtotal = items.reduce((acc, curr) => acc + (Number(curr.quantity) || 0) * (Number(curr.rate) || 0), 0);
  const discountAmount =
    discountType === 'PERCENT'
      ? Math.round(((subtotal * (Number(discountValue) || 0)) / 100) * 100) / 100
      : Math.min(subtotal, Number(discountValue) || 0);
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = Math.round(((taxableAmount * (Number(taxRate) || 0)) / 100) * 100) / 100;
  const grandTotal = Math.round((taxableAmount + taxAmount) * 100) / 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !clientName.trim()) {
      setError('Please provide a quotation title and client name.');
      return;
    }

    if (items.length === 0) {
      setError('Please add at least one line item to the quotation.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        quotationNumber: quotationNumber.trim() || undefined,
        title,
        clientName,
        clientPhone,
        clientEmail,
        clientAddress,
        clientGst,
        projectId: projectId || undefined,
        status,
        templateType: selectedTemplate,
        formatLayout,
        date,
        validUntil: validUntil || undefined,
        discountType,
        discountValue,
        taxRate,
        termsAndConditions,
        paymentTerms,
        notes,
        items,
      };

      const url = quotationToEdit ? `/api/quotations/${quotationToEdit.id}` : '/api/quotations';
      const method = quotationToEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save quotation');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-5xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl text-slate-100 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/30">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {quotationToEdit ? 'Edit Quotation / Estimate' : 'Create New Quotation / Estimate'}
              </h2>
              <p className="text-xs text-slate-400">
                Modern Way Civil Solution Quotation Generator
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
              {error}
            </div>
          )}

          {/* 1. Template Selector (14 Construction Formats) */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4" />
                Select from 14 Civil Construction Templates
              </label>
              <span className="text-[11px] text-slate-400">
                1-click auto-fills BOQ items, rates & terms
              </span>
            </div>
            <select
              value={selectedTemplate}
              onChange={(e) => applyTemplate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 font-medium focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              {QUOTATION_TEMPLATES.map((tmpl) => (
                <option key={tmpl.id} value={tmpl.id} className="bg-slate-900 text-slate-100">
                  [{tmpl.category}] {tmpl.title} ({tmpl.items.length} items)
                </option>
              ))}
            </select>
          </div>

          {/* 2. Client & Project Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Quotation Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Turnkey Civil Construction"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Client / Company Name *
              </label>
              <input
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Shreedhar Infra / Mr. Sharma"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Client Phone (WhatsApp)
              </label>
              <input
                type="text"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Client Email
              </label>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="client@example.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Client GSTIN (Optional)
              </label>
              <input
                type="text"
                value={clientGst}
                onChange={(e) => setClientGst(e.target.value)}
                placeholder="e.g. 07AAACH7409R1ZZ"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Link to Project (Optional)
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="">-- No Project Linked --</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.projectCode})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Quotation Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Valid Until
              </label>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="DRAFT">Draft</option>
                <option value="SENT">Sent to Client</option>
                <option value="ACCEPTED">Accepted / Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="EXPIRED">Expired</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Site Location / Address
              </label>
              <input
                type="text"
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                placeholder="e.g. Plot 42, Green Park Avenue, Sector 62, Noida"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* 3. Itemized Bill of Quantities (BOQ) Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-500" />
                Bill of Quantities (BOQ) / Scope of Work ({items.length} items)
              </h3>
              <button
                type="button"
                onClick={addItemRow}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500 hover:text-slate-950 text-xs font-semibold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Item Row
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3 w-10">#</th>
                    <th className="py-2.5 px-3 min-w-[280px]">Item Description & Scope</th>
                    <th className="py-2.5 px-3 w-28">Unit</th>
                    <th className="py-2.5 px-3 w-24">Qty</th>
                    <th className="py-2.5 px-3 w-28">Rate (₹)</th>
                    <th className="py-2.5 px-3 w-32 text-right">Amount (₹)</th>
                    <th className="py-2.5 px-2 w-12 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {items.map((item, index) => {
                    const rowAmount = (Number(item.quantity) || 0) * (Number(item.rate) || 0);
                    return (
                      <tr key={index} className="hover:bg-slate-900/50 transition-colors">
                        <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                          {index + 1}
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            required
                            value={item.description}
                            onChange={(e) => updateItem(index, 'description', e.target.value)}
                            placeholder="Description of work"
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <select
                            value={item.unit}
                            onChange={(e) => updateItem(index, 'unit', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                          >
                            <option value="sq.ft.">sq.ft.</option>
                            <option value="sq.m.">sq.m.</option>
                            <option value="cum">cum</option>
                            <option value="brass">brass</option>
                            <option value="rft">rft</option>
                            <option value="ton">ton</option>
                            <option value="bags">bags</option>
                            <option value="nos">nos</option>
                            <option value="lumpsum">lumpsum</option>
                            <option value="month">month</option>
                          </select>
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.rate}
                            onChange={(e) => updateItem(index, 'rate', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-amber-400 font-mono">
                          {formatINR(rowAmount)}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeItemRow(index)}
                            disabled={items.length <= 1}
                            className="p-1 text-slate-500 hover:text-rose-400 disabled:opacity-30 disabled:hover:text-slate-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4. Financial Calculation Summary & Taxes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Payment & Terms */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Payment Milestones
                </label>
                <textarea
                  rows={3}
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="e.g. 20% Advance, 30% Plinth..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 resize-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Terms & Conditions
                </label>
                <textarea
                  rows={3}
                  value={termsAndConditions}
                  onChange={(e) => setTermsAndConditions(e.target.value)}
                  placeholder="Terms and conditions..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>
            </div>

            {/* Calculations Card */}
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3.5 flex flex-col justify-between">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-850">
                <Calculator className="w-4 h-4 text-amber-500" />
                Quotation Financial Summary
              </h4>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal ({items.length} items):</span>
                  <span className="font-semibold text-white font-mono">{formatINR(subtotal)}</span>
                </div>

                {/* Discount */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Discount:</span>
                    <select
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value as any)}
                      className="bg-slate-900 border border-slate-800 text-[11px] rounded px-1.5 py-0.5 text-slate-300"
                    >
                      <option value="PERCENT">%</option>
                      <option value="FIXED">₹</option>
                    </select>
                    <input
                      type="number"
                      min="0"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(Number(e.target.value))}
                      className="w-16 bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-xs text-white"
                    />
                  </div>
                  <span className="font-semibold text-rose-400 font-mono">
                    - {formatINR(discountAmount)}
                  </span>
                </div>

                {/* GST Tax Rate */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">GST Rate:</span>
                    <select
                      value={taxRate}
                      onChange={(e) => setTaxRate(Number(e.target.value))}
                      className="bg-slate-900 border border-slate-800 text-xs rounded px-2 py-0.5 text-white"
                    >
                      <option value="0">0% (Nil)</option>
                      <option value="5">5% GST</option>
                      <option value="12">12% GST</option>
                      <option value="18">18% GST (Standard)</option>
                      <option value="28">28% GST</option>
                    </select>
                  </div>
                  <span className="font-semibold text-slate-300 font-mono">
                    + {formatINR(taxAmount)}
                  </span>
                </div>

                <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-sm font-bold">
                  <span className="text-white">Grand Total:</span>
                  <span className="text-amber-400 font-mono text-base">{formatINR(grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
            >
              {loading ? (
                <div className="h-4 w-4 border-2 border-slate-950 border-t-transparent animate-spin rounded-full" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              {quotationToEdit ? 'Save Changes' : 'Create Quotation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
