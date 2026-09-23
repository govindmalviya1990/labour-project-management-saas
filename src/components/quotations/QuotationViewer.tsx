'use client';

import React, { useState } from 'react';
import {
  Printer,
  Share2,
  Mail,
  MessageSquare,
  CheckCircle2,
  Clock,
  Building2,
  Calendar,
  FileText,
  Phone,
  ArrowLeft,
  Edit,
  Download,
  ShieldCheck,
  HardHat,
  Sparkles,
} from 'lucide-react';
import { formatINR } from '@/lib/calculations';

interface QuotationViewerProps {
  quotation: any;
  onEdit?: () => void;
  onStatusChange?: (newStatus: string) => void;
  onBack?: () => void;
}

export function QuotationViewer({
  quotation,
  onEdit,
  onStatusChange,
  onBack,
}: QuotationViewerProps) {
  const [selectedLayout, setSelectedLayout] = useState<'MODERN' | 'CLASSIC' | 'MINIMAL' | 'INDUSTRIAL' | 'ELEGANT'>(
    (quotation.formatLayout as any) || 'MODERN'
  );

  const org = quotation.organization || {
    name: 'Modern Way Civil Solution',
    ownerName: 'Er. Ramesh Chandra',
    mobile: '+91 98765 43210',
    email: 'contact@modernwaycivil.com',
    address: 'Industrial Zone, Sector 63',
    city: 'Noida',
    state: 'Uttar Pradesh',
    gstNumber: '07AAACM1234F1Z9',
  };

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    const text = `*QUOTATION FROM MODERN WAY CIVIL SOLUTION*
---------------------------------------
*Quotation No:* ${quotation.quotationNumber}
*Subject:* ${quotation.title}
*Client:* ${quotation.clientName}
*Date:* ${new Date(quotation.date).toLocaleDateString('en-IN')}
*Valid Until:* ${quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString('en-IN') : '30 Days'}
---------------------------------------
*Total BOQ Items:* ${quotation.items?.length || 0}
*Subtotal:* ${formatINR(quotation.subtotal)}
*Discount:* -${formatINR(quotation.discountAmount || 0)}
*GST (${quotation.taxRate}%):* +${formatINR(quotation.taxAmount || 0)}
*GRAND TOTAL:* ${formatINR(quotation.grandTotal)}
---------------------------------------
For inquiries and project kick-off, please contact:
Modern Way Civil Solution
Phone: ${org.mobile || '+91 98765 43210'}
Email: ${org.email || 'contact@modernwaycivil.com'}

View Online: ${window.location.href}`;

    const phone = quotation.clientPhone ? quotation.clientPhone.replace(/\D/g, '') : '';
    const url = phone
      ? `https://wa.me/${phone.length === 10 ? '91' + phone : phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;

    window.open(url, '_blank');
  };

  const handleEmailShare = () => {
    const subject = `Quotation ${quotation.quotationNumber}: ${quotation.title} - Modern Way Civil Solution`;
    const body = `Dear ${quotation.clientName},

Thank you for giving us the opportunity to quote for your project. Please find below the quotation details:

Quotation No: ${quotation.quotationNumber}
Project Scope: ${quotation.title}
Date: ${new Date(quotation.date).toLocaleDateString('en-IN')}
Grand Total: ${formatINR(quotation.grandTotal)} (Including GST)

Payment Terms:
${quotation.paymentTerms || 'Standard progress-based billing'}

Terms & Conditions:
${quotation.termsAndConditions || 'As per approved civil engineering specifications'}

You can also view the full itemized BOQ at:
${window.location.href}

Best regards,
Modern Way Civil Solution
${org.mobile || ''}
${org.email || ''}`;

    const mailto = `mailto:${quotation.clientEmail || ''}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  };

  // Layout-specific CSS classes
  const getLayoutClasses = () => {
    switch (selectedLayout) {
      case 'CLASSIC':
        return 'font-serif border-4 border-double border-slate-700 bg-white text-slate-900';
      case 'MINIMAL':
        return 'font-sans border border-slate-300 bg-white text-slate-800';
      case 'INDUSTRIAL':
        return 'font-mono border-2 border-slate-800 bg-slate-950 text-slate-100';
      case 'ELEGANT':
        return 'font-sans border border-emerald-500/40 bg-white text-slate-900 shadow-xl';
      case 'MODERN':
      default:
        return 'font-sans border border-slate-800 bg-slate-900 text-slate-100';
    }
  };

  const isLightLayout = selectedLayout === 'CLASSIC' || selectedLayout === 'MINIMAL' || selectedLayout === 'ELEGANT';

  return (
    <div className="space-y-6">
      {/* Action Header (Hidden during Print) */}
      <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                {quotation.quotationNumber}
              </span>
              <h1 className="text-lg font-bold text-white">{quotation.title}</h1>
            </div>
            <p className="text-xs text-slate-400">
              Client: <span className="text-slate-200 font-semibold">{quotation.clientName}</span> | Date: {new Date(quotation.date).toLocaleDateString('en-IN')}
            </p>
          </div>
        </div>

        {/* Format Selector & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Layout Theme Selector */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-2.5 py-1.5 rounded-xl text-xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400 text-[11px]">Format:</span>
            <select
              value={selectedLayout}
              onChange={(e) => setSelectedLayout(e.target.value as any)}
              className="bg-transparent text-white font-semibold text-xs focus:outline-none cursor-pointer"
            >
              <option value="MODERN" className="bg-slate-900">Modern Corporate</option>
              <option value="CLASSIC" className="bg-slate-900">Classic Architectural</option>
              <option value="MINIMAL" className="bg-slate-900">Minimalist Clean</option>
              <option value="INDUSTRIAL" className="bg-slate-900">Industrial Heavy</option>
              <option value="ELEGANT" className="bg-slate-900">Elegant Premium</option>
            </select>
          </div>

          {/* Edit */}
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
            >
              <Edit className="w-3.5 h-3.5" />
              Edit
            </button>
          )}

          {/* WhatsApp Share */}
          <button
            type="button"
            onClick={handleWhatsAppShare}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 transition-all"
            title="Share via WhatsApp"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            WhatsApp
          </button>

          {/* Email Share */}
          <button
            type="button"
            onClick={handleEmailShare}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/20 transition-all"
            title="Share via Email"
          >
            <Mail className="w-3.5 h-3.5" />
            Email
          </button>

          {/* Print to PDF */}
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/20 transition-all"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / PDF
          </button>
        </div>
      </div>

      {/* Printable Quotation Document Card */}
      <div
        id="quotation-print-card"
        className={`printable-card rounded-2xl p-6 sm:p-10 shadow-2xl transition-all duration-200 ${getLayoutClasses()} ${
          isLightLayout ? 'text-slate-900 bg-white' : ''
        }`}
      >
        {/* Document Letterhead */}
        <div className={`pb-6 border-b ${isLightLayout ? 'border-slate-300' : 'border-slate-800'} flex flex-col sm:flex-row justify-between items-start gap-6`}>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-slate-950 font-black shadow-md">
                <HardHat className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-amber-500">
                  Modern Way Civil Solution
                </h1>
                <p className={`text-xs ${isLightLayout ? 'text-slate-500' : 'text-slate-400'} font-medium`}>
                  Civil Engineers, Contractors & Project Management Consultants
                </p>
              </div>
            </div>
            <div className={`text-xs ${isLightLayout ? 'text-slate-600' : 'text-slate-400'} pt-1 space-y-0.5`}>
              <p>{org.address ? `${org.address}, ${org.city || ''}, ${org.state || ''}` : 'Industrial Zone, Sector 63, Noida, UP'}</p>
              <p>Phone: <span className="font-semibold">{org.mobile || '+91 98765 43210'}</span> | Email: {org.email || 'contact@modernwaycivil.com'}</p>
              {org.gstNumber && <p>GSTIN: <span className="font-mono font-semibold">{org.gstNumber}</span></p>}
            </div>
          </div>

          <div className="text-left sm:text-right space-y-1 sm:min-w-[200px]">
            <div className="inline-block px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-extrabold text-sm uppercase tracking-wider">
              QUOTATION
            </div>
            <p className="text-xs font-mono font-bold pt-1">
              Ref: <span className="text-amber-500">{quotation.quotationNumber}</span>
            </p>
            <p className={`text-xs ${isLightLayout ? 'text-slate-600' : 'text-slate-400'}`}>
              Date: <span className="font-medium">{new Date(quotation.date).toLocaleDateString('en-IN')}</span>
            </p>
            {quotation.validUntil && (
              <p className={`text-xs ${isLightLayout ? 'text-slate-600' : 'text-slate-400'}`}>
                Valid Until: <span className="font-medium">{new Date(quotation.validUntil).toLocaleDateString('en-IN')}</span>
              </p>
            )}
          </div>
        </div>

        {/* Bill To & Project Scope Banner */}
        <div className={`py-6 border-b ${isLightLayout ? 'border-slate-300' : 'border-slate-800'} grid grid-cols-1 sm:grid-cols-2 gap-6`}>
          <div className={`p-4 rounded-xl ${isLightLayout ? 'bg-slate-50 border border-slate-200' : 'bg-slate-950 border border-slate-850'}`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isLightLayout ? 'text-slate-500' : 'text-slate-400'}`}>
              QUOTATION FOR (CLIENT):
            </span>
            <h3 className={`text-base font-bold mt-1 ${isLightLayout ? 'text-slate-900' : 'text-white'}`}>
              {quotation.clientName}
            </h3>
            {quotation.clientAddress && (
              <p className={`text-xs mt-1 ${isLightLayout ? 'text-slate-600' : 'text-slate-300'}`}>
                {quotation.clientAddress}
              </p>
            )}
            <div className={`text-xs mt-2 space-y-0.5 ${isLightLayout ? 'text-slate-600' : 'text-slate-400'}`}>
              {quotation.clientPhone && <p>Mobile: <span className="font-medium">{quotation.clientPhone}</span></p>}
              {quotation.clientEmail && <p>Email: <span className="font-medium">{quotation.clientEmail}</span></p>}
              {quotation.clientGst && <p>GSTIN: <span className="font-mono font-medium">{quotation.clientGst}</span></p>}
            </div>
          </div>

          <div className={`p-4 rounded-xl ${isLightLayout ? 'bg-slate-50 border border-slate-200' : 'bg-slate-950 border border-slate-850'} flex flex-col justify-between`}>
            <div>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isLightLayout ? 'text-slate-500' : 'text-slate-400'}`}>
                PROJECT WORK SCOPE:
              </span>
              <h3 className={`text-base font-bold mt-1 ${isLightLayout ? 'text-slate-900' : 'text-white'}`}>
                {quotation.title}
              </h3>
              {quotation.project && (
                <p className="text-xs text-amber-500 font-semibold mt-1">
                  Project Code: {quotation.project.projectCode} ({quotation.project.name})
                </p>
              )}
            </div>
            <div className="pt-2">
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 uppercase">
                STATUS: {quotation.status}
              </span>
            </div>
          </div>
        </div>

        {/* BOQ Table */}
        <div className="py-6 space-y-2">
          <h4 className={`text-xs font-bold uppercase tracking-wider ${isLightLayout ? 'text-slate-700' : 'text-slate-300'}`}>
            Itemized Bill of Quantities (BOQ)
          </h4>
          <div className={`overflow-x-auto rounded-xl border ${isLightLayout ? 'border-slate-300' : 'border-slate-800'}`}>
            <table className="w-full text-left text-xs">
              <thead className={`${isLightLayout ? 'bg-slate-100 text-slate-700' : 'bg-slate-950 text-slate-400'} uppercase text-[10px] border-b ${isLightLayout ? 'border-slate-300' : 'border-slate-800'}`}>
                <tr>
                  <th className="py-3 px-3 w-10 text-center">#</th>
                  <th className="py-3 px-3">Description of Work / Item Specifications</th>
                  <th className="py-3 px-3 w-20 text-center">Unit</th>
                  <th className="py-3 px-3 w-24 text-right">Quantity</th>
                  <th className="py-3 px-3 w-28 text-right">Rate (₹)</th>
                  <th className="py-3 px-3 w-32 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isLightLayout ? 'divide-slate-200' : 'divide-slate-850'}`}>
                {quotation.items?.map((item: any, index: number) => (
                  <tr key={item.id || index} className={isLightLayout ? 'hover:bg-slate-50' : 'hover:bg-slate-850/40'}>
                    <td className={`py-3 px-3 text-center font-mono text-[11px] ${isLightLayout ? 'text-slate-500' : 'text-slate-500'}`}>
                      {item.itemNumber || index + 1}
                    </td>
                    <td className="py-3 px-3">
                      <p className={`font-semibold ${isLightLayout ? 'text-slate-900' : 'text-slate-200'}`}>
                        {item.description}
                      </p>
                      {item.notes && (
                        <p className={`text-[10px] mt-0.5 ${isLightLayout ? 'text-slate-500' : 'text-slate-400'}`}>
                          {item.notes}
                        </p>
                      )}
                    </td>
                    <td className={`py-3 px-3 text-center font-medium ${isLightLayout ? 'text-slate-600' : 'text-slate-400'}`}>
                      {item.unit}
                    </td>
                    <td className={`py-3 px-3 text-right font-mono font-medium ${isLightLayout ? 'text-slate-800' : 'text-slate-300'}`}>
                      {item.quantity}
                    </td>
                    <td className={`py-3 px-3 text-right font-mono ${isLightLayout ? 'text-slate-800' : 'text-slate-300'}`}>
                      {formatINR(item.rate)}
                    </td>
                    <td className={`py-3 px-3 text-right font-mono font-bold ${isLightLayout ? 'text-slate-900' : 'text-amber-400'}`}>
                      {formatINR(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Financial Summary & Tax Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 pb-6 border-b border-slate-800">
          {/* Payment Terms & Notes */}
          <div className="space-y-4 text-xs">
            {quotation.paymentTerms && (
              <div className={`p-4 rounded-xl ${isLightLayout ? 'bg-slate-50 border border-slate-200' : 'bg-slate-950 border border-slate-850'}`}>
                <h5 className="font-bold text-amber-500 uppercase text-[10px] tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Payment Milestones
                </h5>
                <pre className={`whitespace-pre-wrap font-sans text-xs ${isLightLayout ? 'text-slate-700' : 'text-slate-300'} leading-relaxed`}>
                  {quotation.paymentTerms}
                </pre>
              </div>
            )}

            {quotation.termsAndConditions && (
              <div className={`p-4 rounded-xl ${isLightLayout ? 'bg-slate-50 border border-slate-200' : 'bg-slate-950 border border-slate-850'}`}>
                <h5 className="font-bold text-amber-500 uppercase text-[10px] tracking-wider mb-1.5 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Terms & Conditions
                </h5>
                <pre className={`whitespace-pre-wrap font-sans text-xs ${isLightLayout ? 'text-slate-700' : 'text-slate-300'} leading-relaxed`}>
                  {quotation.termsAndConditions}
                </pre>
              </div>
            )}
          </div>

          {/* Amount Calculation Box */}
          <div className="flex flex-col justify-end">
            <div className={`rounded-xl p-5 ${isLightLayout ? 'bg-slate-50 border border-slate-300' : 'bg-slate-950 border border-slate-800'} space-y-3 text-xs`}>
              <div className={`flex justify-between ${isLightLayout ? 'text-slate-600' : 'text-slate-400'}`}>
                <span>Total BOQ Subtotal:</span>
                <span className="font-mono font-semibold">{formatINR(quotation.subtotal)}</span>
              </div>

              {quotation.discountAmount > 0 && (
                <div className="flex justify-between text-rose-500 font-semibold">
                  <span>Discount ({quotation.discountType === 'PERCENT' ? `${quotation.discountValue}%` : 'Fixed'}):</span>
                  <span className="font-mono">- {formatINR(quotation.discountAmount)}</span>
                </div>
              )}

              <div className={`flex justify-between ${isLightLayout ? 'text-slate-600' : 'text-slate-400'}`}>
                <span>GST Tax ({quotation.taxRate}%):</span>
                <span className="font-mono font-semibold">+ {formatINR(quotation.taxAmount)}</span>
              </div>

              <div className={`pt-3 border-t ${isLightLayout ? 'border-slate-300' : 'border-slate-800'} flex justify-between items-center text-sm font-bold`}>
                <span className={isLightLayout ? 'text-slate-900' : 'text-white'}>
                  Net Grand Total:
                </span>
                <span className="text-amber-500 font-mono text-lg font-black">
                  {formatINR(quotation.grandTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Signature & Authorized Footer */}
        <div className="pt-8 flex flex-col sm:flex-row justify-between items-end gap-8">
          <div className={`text-xs ${isLightLayout ? 'text-slate-500' : 'text-slate-400'} space-y-1`}>
            <p>1. This is a computer generated quotation by Modern Way Civil Solution.</p>
            <p>2. Subject to Noida/Delhi jurisdiction.</p>
          </div>

          <div className="text-center sm:text-right space-y-3 min-w-[200px]">
            <p className={`text-xs font-bold ${isLightLayout ? 'text-slate-800' : 'text-slate-200'}`}>
              For Modern Way Civil Solution
            </p>
            <div className="h-12 flex items-center justify-end">
              <span className="font-serif italic text-xs text-amber-500 border-b border-amber-500/50 pb-0.5">
                Authorized Signatory
              </span>
            </div>
            <p className={`text-[11px] ${isLightLayout ? 'text-slate-500' : 'text-slate-400'}`}>
              Managing Director / Chief Project Engineer
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
