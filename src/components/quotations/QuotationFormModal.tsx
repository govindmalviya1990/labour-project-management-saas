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
  Droplets,
  Sparkles,
  Eye,
} from 'lucide-react';
import { QUOTATION_TEMPLATES, QuotationTemplate, TemplateItem } from '@/lib/quotations/templates';
import {
  QUOTATION_LAYOUT_OPTIONS,
  QuotationViewer,
  QuotationLayout,
} from '@/components/quotations/QuotationViewer';
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
  const [selectedTemplate, setSelectedTemplate] = useState<string>('DR_FIXIT_PU_270I');
  const [quotationNumber, setQuotationNumber] = useState('');
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientGst, setClientGst] = useState('');
  const [projectId, setProjectId] = useState('');
  const [status, setStatus] = useState('DRAFT');
  const [formatLayout, setFormatLayout] = useState('OFFICIAL_MODERNWAY');
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
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

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
      setSelectedTemplate(quotationToEdit.templateType || 'DR_FIXIT_PU_270I');
      setFormatLayout(quotationToEdit.formatLayout || 'OFFICIAL_MODERNWAY');
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
      // Default to Dr. Fixit PU 270i template
      applyTemplate('DR_FIXIT_PU_270I');
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
      { description: 'Waterproofing / Coating scope specification', unit: 'Sqmt', quantity: 100, rate: 850 },
    ]);
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) {
      alert('A quotation must contain at least one scope item.');
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof TemplateItem, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  // Live Financial Calculations
  const subtotal = items.reduce(
    (acc, curr) => acc + (Number(curr.quantity) || 0) * (Number(curr.rate) || 0),
    0
  );

  const discountAmount =
    discountType === 'PERCENT'
      ? (subtotal * (Number(discountValue) || 0)) / 100
      : Number(discountValue) || 0;

  const discountedSubtotal = Math.max(0, subtotal - discountAmount);
  const taxAmount = (discountedSubtotal * (Number(taxRate) || 0)) / 100;
  const grandTotal = Math.round(discountedSubtotal + taxAmount);

  const getThemePreviewBadge = (layoutId: string) => {
    switch (layoutId) {
      case 'OFFICIAL_MODERNWAY':
        return {
          pill: 'bg-blue-600 text-white',
          desc: 'Ahmedabad Official Letterhead with Blue & Red MWCS logo, stamp block & Gujarat terms.',
          border: 'border-blue-500/50',
          gradient: 'from-blue-900 to-slate-900',
        };
      case 'ROYAL_INDIGO':
        return {
          pill: 'bg-indigo-600 text-white',
          desc: 'Modern Royal Indigo & Violet gradient banner with high-contrast executive table and sleek borders.',
          border: 'border-indigo-500/50',
          gradient: 'from-indigo-950 via-indigo-700 to-purple-900',
        };
      case 'WATERPROOF_AQUA':
        return {
          pill: 'bg-cyan-600 text-white',
          desc: 'Cyan barrier theme designed specifically for terrace & basement waterproofing membranes.',
          border: 'border-cyan-500/50',
          gradient: 'from-cyan-950 to-blue-900',
        };
      case 'EPOXY_AMBER':
        return {
          pill: 'bg-amber-500 text-slate-950 font-bold',
          desc: 'Industrial high-gloss amber & yellow theme designed for industrial epoxy & PU flooring.',
          border: 'border-amber-500/50',
          gradient: 'from-amber-600 to-yellow-600',
        };
      case 'DARK_STEEL':
        return {
          pill: 'bg-slate-700 text-amber-400 font-bold',
          desc: 'Dark high-tech digital presentation format tailored for mobile & tablet presentations.',
          border: 'border-slate-500/50',
          gradient: 'from-slate-950 to-slate-800',
        };
      case 'CLASSIC_ARCHITECTURAL':
        return {
          pill: 'bg-slate-800 text-white',
          desc: 'Formal architectural double-border serif style for institutional & corporate contracts.',
          border: 'border-slate-400/50',
          gradient: 'from-slate-900 to-stone-900',
        };
      case 'ELEGANT_LUXURY':
        return {
          pill: 'bg-emerald-700 text-white',
          desc: 'Emerald & gold luxury villa style for residential waterproofing and decorative coatings.',
          border: 'border-emerald-500/50',
          gradient: 'from-emerald-950 to-teal-900',
        };
      case 'BLUEPRINT_TECHNICAL':
        return {
          pill: 'bg-sky-600 text-white',
          desc: 'Engineering blueprint aesthetic with monospace technical notation and CAD styling.',
          border: 'border-sky-500/50',
          gradient: 'from-sky-950 to-blue-950',
        };
      default:
        return {
          pill: 'bg-blue-600 text-white',
          desc: 'Professional modern format with company letterhead header, structured BOQ, and seal box.',
          border: 'border-blue-500/40',
          gradient: 'from-slate-900 to-blue-950',
        };
    }
  };

  const currentLiveQuotation = {
    id: quotationToEdit?.id || 'preview',
    quotationNumber: quotationNumber || 'MWCS-QT-PREVIEW',
    title: title || 'Waterproofing & Epoxy Proposal',
    clientName: clientName || 'Client / Company Name',
    clientPhone: clientPhone || '',
    clientEmail: clientEmail || '',
    clientAddress: clientAddress || 'Ahmedabad, Gujarat',
    clientGst: clientGst || '',
    status: status || 'DRAFT',
    templateType: selectedTemplate,
    formatLayout: (formatLayout as QuotationLayout) || 'OFFICIAL_MODERNWAY',
    date: date ? new Date(date).toISOString() : new Date().toISOString(),
    validUntil: validUntil ? new Date(validUntil).toISOString() : null,
    subtotal,
    discountType,
    discountValue,
    discountAmount,
    taxRate,
    taxAmount,
    grandTotal,
    paymentTerms: paymentTerms || '50% Advance & 50% with Live work',
    termsAndConditions: termsAndConditions || 'Standard Ahmedabad site specifications',
    notes: notes || '',
    items:
      items.length > 0
        ? items.map((it, idx) => ({
            id: `item-${idx}`,
            itemNumber: idx + 1,
            description: it.description,
            unit: it.unit,
            quantity: Number(it.quantity) || 0,
            rate: Number(it.rate) || 0,
            amount: (Number(it.quantity) || 0) * (Number(it.rate) || 0),
            notes: it.notes || '',
          }))
        : [
            {
              id: 'preview-item',
              itemNumber: 1,
              description: 'Surface Preparation, Primer Application & Protective Coating',
              unit: 'sq.ft.',
              quantity: 1000,
              rate: 85,
              amount: 85000,
              notes: 'Specification scope item',
            },
          ],
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Please provide a quotation title / scope.');
      return;
    }
    if (!clientName.trim()) {
      setError('Client or Company name is required.');
      return;
    }
    if (items.length === 0) {
      setError('Please add at least one line item to the BOQ.');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        title,
        clientName,
        clientPhone,
        clientEmail,
        clientAddress,
        clientGst,
        projectId: projectId || null,
        status,
        templateType: selectedTemplate,
        formatLayout,
        date: new Date(date).toISOString(),
        validUntil: validUntil ? new Date(validUntil).toISOString() : null,
        subtotal,
        discountType,
        discountValue: Number(discountValue) || 0,
        discountAmount,
        taxRate: Number(taxRate) || 0,
        taxAmount,
        grandTotal,
        paymentTerms,
        termsAndConditions,
        notes,
        items: items.map((it, idx) => ({
          itemNumber: idx + 1,
          description: it.description,
          unit: it.unit,
          quantity: Number(it.quantity) || 0,
          rate: Number(it.rate) || 0,
          amount: (Number(it.quantity) || 0) * (Number(it.rate) || 0),
          notes: it.notes || '',
        })),
      };

      const url = quotationToEdit
        ? `/api/quotations/${quotationToEdit.id}`
        : '/api/quotations';
      const method = quotationToEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save quotation');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error occurred while saving quotation');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-5xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-slate-950 font-black shadow-md">
              <Droplets className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                {quotationToEdit ? 'Edit Quotation' : 'Create New Waterproofing & Epoxy Quotation'}
              </h2>
              <p className="text-xs text-slate-300">
                Modern Way Civil Solutions • Official Quotation Builder
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors border border-slate-750"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium">
              {error}
            </div>
          )}

          {/* 1. Template Selector (Waterproofing & Epoxy Specifications) */}
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <label className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-amber-400" />
                Select Waterproofing & Epoxy Service Specification
              </label>
              <span className="text-[11px] text-slate-300 font-medium">
                1-click auto-fills technical procedure, rates & authentic terms
              </span>
            </div>
            <select
              value={selectedTemplate}
              onChange={(e) => applyTemplate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 font-semibold focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              {QUOTATION_TEMPLATES.map((tmpl) => (
                <option key={tmpl.id} value={tmpl.id} className="bg-slate-900 text-slate-100">
                  [{tmpl.category}] {tmpl.title} ({tmpl.items.length} item{tmpl.items.length > 1 ? 's' : ''})
                </option>
              ))}
            </select>
          </div>

          {/* 2. Visual Format Layout (30 Styles Selector) */}
          <div className="rounded-xl border border-blue-500/40 bg-blue-500/10 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <label className="text-xs font-bold text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-blue-400" />
                Select Presentation Format (30 Visual Design Styles)
              </label>
              <span className="text-[11px] text-blue-200">
                Choose the visual look & color theme for this quotation
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={formatLayout}
                onChange={(e) => setFormatLayout(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 font-semibold focus:outline-none focus:border-blue-400 cursor-pointer"
              >
                {QUOTATION_LAYOUT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id} className="bg-slate-900 text-slate-100">
                    {opt.name} — [{opt.tag}]
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setIsPreviewOpen(true)}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition-all shrink-0 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                Live Preview Style
              </button>
            </div>

            {/* Instant Active Style Banner */}
            {(() => {
              const preview = getThemePreviewBadge(formatLayout);
              const opt = QUOTATION_LAYOUT_OPTIONS.find((o) => o.id === formatLayout);
              return (
                <div
                  className={`p-3 rounded-lg border ${preview.border} bg-gradient-to-r ${preview.gradient} text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-lg`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                        Active Visual Theme:
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black ${preview.pill}`}>
                        {opt?.name || formatLayout}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-200">{preview.desc}</p>
                  </div>
                  <span className="text-[10px] text-slate-300 bg-black/40 px-2 py-1 rounded shrink-0 border border-white/10 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    Applied to Letterhead & Print
                  </span>
                </div>
              );
            })()}
          </div>

          {/* 3. Client & Project Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-200 mb-1.5">
                Quotation Scope / Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Dr. Fixit PU 270i Terrace Waterproofing"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-200 mb-1.5">
                Client / Company Name *
              </label>
              <input
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Rivira Infra Projects"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-200 mb-1.5">
                Client Phone (WhatsApp)
              </label>
              <input
                type="text"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="e.g. 9898035669"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-200 mb-1.5">
                Client Email
              </label>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="client@example.com"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-200 mb-1.5">
                Client GSTIN (Optional)
              </label>
              <input
                type="text"
                value={clientGst}
                onChange={(e) => setClientGst(e.target.value)}
                placeholder="e.g. 24AAACH7409R1ZZ"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-200 mb-1.5">
                Link to Project (Optional)
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
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
              <label className="block text-xs font-bold text-slate-200 mb-1.5">
                Quotation Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-200 mb-1.5">
                Valid Until
              </label>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-200 mb-1.5">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="DRAFT">Draft</option>
                <option value="SENT">Sent to Client</option>
                <option value="ACCEPTED">Accepted / Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="EXPIRED">Expired</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-slate-200 mb-1.5">
                Site Location / Client Address
              </label>
              <input
                type="text"
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                placeholder="e.g. S G Highway Gota, Ahmedabad"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
              />
            </div>
          </div>

          {/* 4. Itemized Bill of Quantities (BOQ) with Multi-Line Procedure Support */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-500" />
                Scope of Work & Technical Procedures ({items.length} item{items.length > 1 ? 's' : ''})
              </h3>
              <button
                type="button"
                onClick={addItemRow}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500 hover:text-slate-950 text-xs font-bold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Item Row
              </button>
            </div>

            <div className="space-y-4">
              {items.map((item, index) => {
                const rowAmount = (Number(item.quantity) || 0) * (Number(item.rate) || 0);
                return (
                  <div
                    key={index}
                    className="p-4 rounded-xl border border-slate-700 bg-slate-950 space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-xs font-bold text-amber-400 font-mono">
                        Item #{index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeItemRow(index)}
                        className="text-slate-400 hover:text-rose-400 p-1 rounded transition-colors"
                        title="Remove Item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Detailed Technical Methodology / Application Procedure:
                      </label>
                      <textarea
                        rows={4}
                        required
                        value={item.description}
                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                        placeholder="Detailed application procedure: e.g. Step 1 cleaning, Step 2 vata, Step 3 primer, Step 4 & 5 PU coats..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-sans leading-relaxed"
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Unit
                        </label>
                        <select
                          value={item.unit}
                          onChange={(e) => updateItem(index, 'unit', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer font-medium"
                        >
                          <option value="Sqmt">Sqmt</option>
                          <option value="sq.ft.">sq.ft.</option>
                          <option value="sq.m.">sq.m.</option>
                          <option value="rft">rft</option>
                          <option value="kg">kg</option>
                          <option value="nos">nos</option>
                          <option value="cum">cum</option>
                          <option value="brass">brass</option>
                          <option value="lumpsum">lumpsum</option>
                          <option value="bags">bags</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Quantity
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Rate (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.rate}
                          onChange={(e) => updateItem(index, 'rate', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Amount (₹)
                        </label>
                        <div className="w-full bg-slate-900/60 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-amber-400 font-mono font-bold">
                          {formatINR(rowAmount)}
                        </div>
                      </div>
                    </div>

                    <div>
                      <input
                        type="text"
                        value={item.notes || ''}
                        onChange={(e) => updateItem(index, 'notes', e.target.value)}
                        placeholder="Specification notes (e.g. 1.5mm DFT, 10-Year Warranty, Dr. Fixit PU 270i)"
                        className="w-full bg-slate-900/70 border border-slate-800 rounded px-3 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 5. Terms & Financials Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Terms and Payment Schedule */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">
                  Payment Milestones (Advance & Running)
                </label>
                <textarea
                  rows={3}
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="e.g. 50% Advance & 50% with Live work going"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">
                  Terms & Conditions (Electricity, Water, Labour Colony, Night shifts)
                </label>
                <textarea
                  rows={6}
                  value={termsAndConditions}
                  onChange={(e) => setTermsAndConditions(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono leading-relaxed"
                />
              </div>
            </div>

            {/* Calculations & Discounts */}
            <div className="p-4 rounded-xl border border-slate-700 bg-slate-950 space-y-3.5">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-amber-500" />
                Financial Summary & Taxes
              </h4>

              <div className="flex justify-between items-center text-xs text-slate-300">
                <span>BOQ Subtotal:</span>
                <span className="font-mono font-bold text-white">{formatINR(subtotal)}</span>
              </div>

              {/* Discount Controls */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Discount Type
                  </label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="PERCENT">Percent (%)</option>
                    <option value="FIXED">Fixed (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Value
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Number(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Discount (₹)
                  </label>
                  <div className="w-full bg-slate-900/60 border border-slate-800 rounded px-2 py-1 text-xs text-rose-400 font-mono font-semibold">
                    -{formatINR(discountAmount)}
                  </div>
                </div>
              </div>

              {/* GST Tax Rate */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-300">GST Rate (%):</span>
                  <select
                    value={taxRate}
                    onChange={(e) => setTaxRate(Number(e.target.value))}
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value={0}>0% (Exempt / Not included)</option>
                    <option value={5}>5%</option>
                    <option value={12}>12%</option>
                    <option value={18}>18% (Standard Civil Services)</option>
                    <option value={28}>28%</option>
                  </select>
                </div>
                <span className="font-mono text-slate-300">+{formatINR(taxAmount)}</span>
              </div>

              {/* Grand Total */}
              <div className="pt-3 border-t border-slate-700 flex justify-between items-center text-sm font-bold">
                <span className="text-white">NET GRAND TOTAL:</span>
                <span className="text-amber-400 font-mono text-lg font-black">
                  {formatINR(grandTotal)}
                </span>
              </div>
            </div>
          </div>

          {/* Form Actions Footer */}
          <div className="pt-4 border-t border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPreviewOpen(true)}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20 cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              Live Preview Quotation
            </button>

            <div className="w-full sm:w-auto flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Saving Quotation...' : quotationToEdit ? 'Update Quotation' : 'Generate Quotation'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Real-time Fullscreen / Overlay Live Quotation Preview Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex flex-col p-2 sm:p-6 overflow-y-auto animate-fade-in">
          <div className="relative w-full max-w-5xl mx-auto my-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Preview Modal Header */}
            <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-800 bg-slate-950">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">
                    Live Quotation Preview — {QUOTATION_LAYOUT_OPTIONS.find((o) => o.id === formatLayout)?.name || formatLayout}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Rendered with your live form inputs • You can test all 30 styles here
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Close Preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Preview Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-950/60">
              <QuotationViewer
                quotation={currentLiveQuotation}
                onLayoutChange={(newLayout) => setFormatLayout(newLayout)}
              />
            </div>

            {/* Preview Footer */}
            <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row justify-between items-center gap-2">
              <p className="text-xs text-slate-400">
                💡 Changing the theme dropdown above immediately updates the look of your quotation.
              </p>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md cursor-pointer transition-all"
              >
                Done & Return to Edit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
