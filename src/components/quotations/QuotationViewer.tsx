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
  Droplets,
  Layers,
  MapPin,
  Check,
} from 'lucide-react';
import { formatINR } from '@/lib/calculations';
import { DEFAULT_ORGANIZATION } from '@/lib/quotations/templates';

export type QuotationLayout =
  | 'OFFICIAL_MODERNWAY'
  | 'MODERN_BLUE'
  | 'CLASSIC_ARCHITECTURAL'
  | 'MINIMAL_CLEAN'
  | 'INDUSTRIAL_TECH'
  | 'ELEGANT_LUXURY'
  | 'WATERPROOF_AQUA'
  | 'EPOXY_AMBER'
  | 'CORPORATE_NAVY'
  | 'SLATE_COMPACT'
  | 'CRIMSON_BOLD'
  | 'ROYAL_INDIGO'
  | 'FOREST_GREEN'
  | 'MONOCHROME_PRINT'
  | 'DUAL_TONE_ACCENT'
  | 'GRID_MODERN'
  | 'BLUEPRINT_TECHNICAL'
  | 'PREMIUM_GOLD'
  | 'NORDIC_FROST'
  | 'SOFT_PASTEL'
  | 'DARK_STEEL'
  | 'CERTIFICATE_BORDER'
  | 'SIDEBAR_SUMMARY'
  | 'TOP_BANNER_SOLID'
  | 'FLOATING_CARDS'
  | 'RETRO_STAMP'
  | 'BOLD_METHODOLOGY'
  | 'COMPACT_SINGLE_PAGE'
  | 'DETAILED_TWO_PAGE'
  | 'EXECUTIVE_PROPOSAL';

export const QUOTATION_LAYOUT_OPTIONS: { id: QuotationLayout; name: string; tag: string }[] = [
  { id: 'OFFICIAL_MODERNWAY', name: '1. Modern Way Official (Ahmedabad PDF Replica)', tag: 'Recommended' },
  { id: 'WATERPROOF_AQUA', name: '2. Waterproofing Aqua (Cyan Barrier Theme)', tag: 'Specialized' },
  { id: 'EPOXY_AMBER', name: '3. Epoxy Flooring Amber (Industrial Gloss)', tag: 'Specialized' },
  { id: 'MODERN_BLUE', name: '4. Modern Executive Royal Blue', tag: 'Executive' },
  { id: 'CLASSIC_ARCHITECTURAL', name: '5. Classic Architectural (Double Border Serif)', tag: 'Formal' },
  { id: 'MINIMAL_CLEAN', name: '6. Swiss Minimalist Clean', tag: 'Modern' },
  { id: 'INDUSTRIAL_TECH', name: '7. Industrial Tech (Graphite & High-Vis Amber)', tag: 'Technical' },
  { id: 'ELEGANT_LUXURY', name: '8. Elegant Luxury (Emerald & Gold Villa)', tag: 'Premium' },
  { id: 'CORPORATE_NAVY', name: '9. Corporate Navy Blue (Enterprise)', tag: 'Corporate' },
  { id: 'SLATE_COMPACT', name: '10. Dense Slate Engineering', tag: 'Compact' },
  { id: 'CRIMSON_BOLD', name: '11. Crimson Bold (Emergency Repairs)', tag: 'High-Impact' },
  { id: 'ROYAL_INDIGO', name: '12. Royal Indigo Gradient', tag: 'Modern' },
  { id: 'FOREST_GREEN', name: '13. Deep Forest Green (Structural Preservation)', tag: 'Durability' },
  { id: 'MONOCHROME_PRINT', name: '14. Monochrome Zero-Ink (Laser B&W)', tag: 'Eco-Print' },
  { id: 'DUAL_TONE_ACCENT', name: '15. Dual Tone Accent Stripe', tag: 'Modern' },
  { id: 'GRID_MODERN', name: '16. Modular Card Grid', tag: 'Structured' },
  { id: 'BLUEPRINT_TECHNICAL', name: '17. Blueprint Technical Drawing', tag: 'Engineering' },
  { id: 'PREMIUM_GOLD', name: '18. Champagne Gold VIP Contractor', tag: 'VIP' },
  { id: 'NORDIC_FROST', name: '19. Nordic Ice Blue Minimalist', tag: 'Clean' },
  { id: 'SOFT_PASTEL', name: '20. Warm Sand Architectural', tag: 'Boutique' },
  { id: 'DARK_STEEL', name: '21. Dark Steel Digital Tablet Presentation', tag: 'Digital' },
  { id: 'CERTIFICATE_BORDER', name: '22. Formal Certificate Frame & Seal', tag: 'Contract' },
  { id: 'SIDEBAR_SUMMARY', name: '23. Sidebar Financial Summary', tag: 'Modern' },
  { id: 'TOP_BANNER_SOLID', name: '24. Heavy Solid Top Banner', tag: 'Bold' },
  { id: 'FLOATING_CARDS', name: '25. Floating Elevated Cards', tag: 'SaaS Style' },
  { id: 'RETRO_STAMP', name: '26. Vintage Voucher & Official Stamp', tag: 'Traditional' },
  { id: 'BOLD_METHODOLOGY', name: '27. Method-Statement (Procedure Highlighted)', tag: 'Detailed' },
  { id: 'COMPACT_SINGLE_PAGE', name: '28. Single-Page Fast Quotation Sheet', tag: 'A4 1-Page' },
  { id: 'DETAILED_TWO_PAGE', name: '29. 2-Page Technical Proposal Format', tag: 'A4 2-Page' },
  { id: 'EXECUTIVE_PROPOSAL', name: '30. Executive Contractor Proposal with Signoff', tag: 'Comprehensive' },
];

interface QuotationViewerProps {
  quotation: any;
  onEdit?: () => void;
  onStatusChange?: (newStatus: string) => void;
  onBack?: () => void;
  onLayoutChange?: (newLayout: QuotationLayout) => void;
}

export function QuotationViewer({
  quotation,
  onEdit,
  onStatusChange,
  onBack,
  onLayoutChange,
}: QuotationViewerProps) {
  const [selectedLayout, setSelectedLayout] = useState<QuotationLayout>(
    (quotation.formatLayout as QuotationLayout) || 'OFFICIAL_MODERNWAY'
  );

  React.useEffect(() => {
    if (quotation.formatLayout) {
      setSelectedLayout(quotation.formatLayout as QuotationLayout);
    }
  }, [quotation.formatLayout]);

  const org = quotation.organization || DEFAULT_ORGANIZATION;

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    const text = `*QUOTATION FROM MODERN WAY CIVIL SOLUTIONS*
*(Waterproofing Services & Epoxy Coatings)*
---------------------------------------
*Quotation No:* ${quotation.quotationNumber}
*Scope of Work:* ${quotation.title}
*Client:* ${quotation.clientName}
*Date:* ${new Date(quotation.date).toLocaleDateString('en-IN')}
*Valid Until:* ${quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString('en-IN') : '30 Days'}
---------------------------------------
*Total Scope Items:* ${quotation.items?.length || 0}
*Subtotal:* ${formatINR(quotation.subtotal)}
*Discount:* -${formatINR(quotation.discountAmount || 0)}
*GST:* ${quotation.taxAmount > 0 ? `+${formatINR(quotation.taxAmount)} (${quotation.taxRate}%)` : 'Extra as applicable'}
*NET GRAND TOTAL:* ${formatINR(quotation.grandTotal)}
---------------------------------------
*Key Payment Terms:*
50% Advance & 50% with Live work going.

*Head Office:*
I 04 - S G Business Hub, Opp PNB Bank Sola Road,
S G Highway, Gota - Ahmedabad, Gujarat
Phone: 9898035669, 9898035110
Email: modernway9394@gmail.com
Instagram: @modernwaycs_2023

View Quotation Online: ${typeof window !== 'undefined' ? window.location.href : ''}`;

    const phone = quotation.clientPhone ? quotation.clientPhone.replace(/\D/g, '') : '';
    const url = phone
      ? `https://wa.me/${phone.length === 10 ? '91' + phone : phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;

    window.open(url, '_blank');
  };

  const handleEmailShare = () => {
    const subject = `Quotation ${quotation.quotationNumber}: ${quotation.title} - Modern Way Civil Solutions`;
    const body = `Respected Sir/Madam,

Thank you for giving Modern Way Civil Solutions the opportunity to submit our proposal for Waterproofing & Epoxy Coating services.

Quotation Details:
Quotation No: ${quotation.quotationNumber}
Project: ${quotation.title}
Date: ${new Date(quotation.date).toLocaleDateString('en-IN')}
Net Amount: ${formatINR(quotation.grandTotal)}

Payment Terms:
${quotation.paymentTerms || '50% Advance & 50% with Live work going'}

Terms & Conditions:
${quotation.termsAndConditions || 'Standard Ahmedabad site specifications'}

You can inspect the complete technical proposal online at:
${typeof window !== 'undefined' ? window.location.href : ''}

Best regards,
Modern Way Civil Solutions
I 04 - S G Business Hub, Gota, S G Highway, Ahmedabad
Phone: 9898035669, 9898035110
Email: modernway9394@gmail.com`;

    const mailto = `mailto:${quotation.clientEmail || ''}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  };

  // Determine light vs dark layout paper background
  const isDarkCanvas = selectedLayout === 'DARK_STEEL';

  // Format date helper
  const formattedDate = new Date(quotation.date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).replace(/\//g, '-');

  return (
    <div className="space-y-6">
      {/* Top Action Toolbar (Hidden during Print) */}
      <div className="no-print flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors border border-slate-750"
              title="Back to Quotations"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/30">
                {quotation.quotationNumber}
              </span>
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {quotation.title}
              </h1>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Client: <span className="text-white font-semibold">{quotation.clientName}</span> | Date: {formattedDate}
            </p>
          </div>
        </div>

        {/* 30 Visual Format Selector & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Format Selector Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700 px-3 py-1.5 rounded-xl text-xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-slate-300 text-[11px] font-medium hidden sm:inline">Theme:</span>
            <select
              value={selectedLayout}
              onChange={(e) => {
                const val = e.target.value as QuotationLayout;
                setSelectedLayout(val);
                onLayoutChange?.(val);
              }}
              className="bg-transparent text-amber-300 font-semibold text-xs focus:outline-none cursor-pointer max-w-[220px] sm:max-w-none"
            >
              {QUOTATION_LAYOUT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id} className="bg-slate-900 text-slate-100 py-1">
                  {opt.name}
                </option>
              ))}
            </select>
          </div>

          {/* Edit */}
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold border border-slate-700 transition-colors"
            >
              <Edit className="w-3.5 h-3.5" />
              Edit
            </button>
          )}

          {/* WhatsApp Share */}
          <button
            type="button"
            onClick={handleWhatsAppShare}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all"
            title="Share via WhatsApp"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            WhatsApp
          </button>

          {/* Email Share */}
          <button
            type="button"
            onClick={handleEmailShare}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/20 transition-all"
            title="Share via Email"
          >
            <Mail className="w-3.5 h-3.5" />
            Email
          </button>

          {/* Print / Save PDF */}
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-lg shadow-amber-500/20 transition-all"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / PDF
          </button>
        </div>
      </div>

      {/* RENDER THE SELECTED QUOTATION FORMAT */}
      {selectedLayout === 'OFFICIAL_MODERNWAY' ? (
        <OfficialModernWayView
          quotation={quotation}
          org={org}
          formattedDate={formattedDate}
        />
      ) : (
        <StyledQuotationView
          layout={selectedLayout}
          quotation={quotation}
          org={org}
          formattedDate={formattedDate}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------------------------------------------
// 1. OFFICIAL MODERN WAY LETTERHEAD VIEW (Exact 1:1 replica of user's Ahmedabad quotation PDF)
// -------------------------------------------------------------------------------------------------
function OfficialModernWayView({
  quotation,
  org,
  formattedDate,
}: {
  quotation: any;
  org: any;
  formattedDate: string;
}) {
  return (
    <div className="print-container max-w-4xl mx-auto space-y-6">
      {/* PAGE 1: Scope of Work, Technical Procedure & Grand Total */}
      <div className="bg-white text-slate-900 border border-slate-300 rounded-lg p-6 sm:p-10 shadow-xl min-h-[1050px] flex flex-col justify-between">
        <div>
          {/* Header section with Logo, Address, and Quotation Title */}
          <div className="flex flex-row items-center justify-between pb-4 border-b border-slate-900/80 gap-3">
            {/* Logo matching PDF */}
            <div className="flex items-center gap-2.5">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#102a5c] rounded-md p-1.5 flex flex-col items-center justify-center text-center shadow-sm shrink-0 border border-slate-300">
                {/* Chevron icon representation */}
                <div className="flex items-center justify-center">
                  <div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[14px] border-b-[#f59e0b] -mr-1.5"></div>
                  <div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[14px] border-b-[#2563eb]"></div>
                </div>
                <span className="text-[7px] font-black text-white leading-tight tracking-wider uppercase mt-1">
                  MODERN WAY
                </span>
                <span className="text-[6px] font-bold text-[#38bdf8] uppercase tracking-tighter">
                  CIVIL SOLUTIONS
                </span>
                <span className="text-[5.5px] font-medium text-amber-300 leading-none mt-0.5">
                  &quot;સમસ્યા અમારી નિવારણ&quot;
                </span>
              </div>
            </div>

            {/* Centered Company Name & Address */}
            <div className="text-center flex-1 px-2">
              <h2 className="text-xl sm:text-2xl font-black text-[#1a365d] tracking-tight uppercase">
                Modern Way Civil Solutions
              </h2>
              <div className="text-[11px] sm:text-xs font-semibold text-slate-800 leading-tight space-y-0.5 mt-0.5">
                <p>I 04 - S G BUSSINESS HUB</p>
                <p>OPP PNB BANK SOLA ROAD</p>
                <p>S G HIGHWAY GOTA - AHMEDABAD</p>
                <p className="text-[#1a365d]">Instagram Id - modernwaycs_2023</p>
              </div>
              <div className="text-[11px] sm:text-xs font-bold text-slate-900 mt-1 flex flex-wrap items-center justify-center gap-x-3">
                <span>📞 9898035669, 9898035110</span>
                <span>✉️ modernway9394@gmail.com</span>
              </div>
            </div>

            {/* Quotation Title */}
            <div className="text-right shrink-0">
              <h1 className="text-2xl sm:text-3xl font-black text-[#1a365d] tracking-tight">
                Quotation
              </h1>
            </div>
          </div>

          {/* Client Details & Quotation Number Meta Grid */}
          <div className="grid grid-cols-2 gap-4 mt-3 text-xs sm:text-sm">
            {/* Left: To box */}
            <div className="border border-slate-900/70 p-3 rounded-none">
              <p className="font-bold text-slate-900">To,</p>
              <p className="font-bold text-slate-900 text-sm">{quotation.clientName}</p>
              <p className="text-slate-700">{quotation.clientAddress || 'Ahmedabad, Gujarat'}</p>
              {quotation.clientPhone && <p className="text-slate-700">Phone: {quotation.clientPhone}</p>}
              {quotation.clientGst && <p className="text-slate-700">GST: {quotation.clientGst}</p>}
            </div>

            {/* Right: Quotation # & Date */}
            <div className="border border-slate-900/70 p-3 rounded-none flex flex-col justify-center space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-800">Quotation#</span>
                <span className="font-bold text-slate-950 font-mono">{quotation.quotationNumber}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-800">Date:</span>
                <span className="font-bold text-slate-950 font-mono">{formattedDate}</span>
              </div>
            </div>
          </div>

          {/* Formal Greeting Message */}
          <div className="mt-4 text-xs sm:text-sm text-slate-800 space-y-1 leading-relaxed">
            <p className="font-semibold text-slate-900">Respected Sir/medam,</p>
            <p>
              I am always looking for long time relationship with customers and we always tried to find the proper solution
            </p>
            <p>
              We work diligently and honestly, and I have skilled and capable workers for the job
            </p>
          </div>

          {/* Scope & BOQ Table */}
          <div className="mt-4 border border-slate-900/80">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#153e75] text-white font-bold uppercase text-[11px]">
                  <th className="py-2 px-2.5 w-10 text-center border-r border-slate-400/40 text-white" style={{ color: '#ffffff' }}>#</th>
                  <th className="py-2 px-3 border-r border-slate-400/40 text-white" style={{ color: '#ffffff' }}>DESCRIPTION</th>
                  <th className="py-2 px-2.5 w-20 text-center border-r border-slate-400/40 text-white" style={{ color: '#ffffff' }}>QTY</th>
                  <th className="py-2 px-3 w-28 text-right border-r border-slate-400/40 text-white" style={{ color: '#ffffff' }}>PRICE</th>
                  <th className="py-2 px-3 w-32 text-right text-white" style={{ color: '#ffffff' }}>TOTAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {quotation.items?.map((item: any, idx: number) => (
                  <tr key={idx} className="align-top">
                    <td className="py-3 px-2 text-center font-bold text-slate-900 border-r border-slate-300">
                      {item.itemNumber || idx + 1}
                    </td>
                    <td className="py-3 px-3 text-slate-900 border-r border-slate-300">
                      <div className="whitespace-pre-wrap font-sans text-xs leading-relaxed space-y-1">
                        {item.description}
                      </div>
                      {item.notes && (
                        <p className="mt-2 text-[11px] font-semibold text-slate-700 bg-slate-100 p-1.5 rounded">
                          Specification: {item.notes}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-2.5 text-center font-bold text-slate-900 border-r border-slate-300">
                      <div>{item.quantity}</div>
                      <div className="text-[11px] text-slate-600 font-normal">{item.unit}</div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 border-r border-slate-300">
                      {formatINR(item.rate)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-950">
                      {formatINR(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {/* Grand Total Row */}
                <tr className="bg-[#153e75] text-white font-bold text-sm">
                  <td colSpan={4} className="py-2.5 px-3 uppercase text-right tracking-wider text-white" style={{ color: '#ffffff' }}>
                    GRAND TOTAL
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-base font-black text-white" style={{ color: '#ffffff' }}>
                    {formatINR(quotation.grandTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Courtesy Ending Note */}
          <div className="mt-4 text-xs sm:text-sm font-medium text-slate-900">
            We hope you find our offer to be in line with your requirement.
          </div>
        </div>

        {/* Page 1 Footer */}
        <div className="pt-6 border-t border-slate-200 flex justify-between items-center text-[11px] text-slate-500">
          <span>Modern Way Civil Solutions - Quotation {quotation.quotationNumber}</span>
          <span>Page 1 of 2</span>
        </div>
      </div>

      {/* PAGE 2: TERMS & CONDITIONS + AUTHORIZED SIGNATURE */}
      <div className="bg-white text-slate-900 border border-slate-300 rounded-lg p-6 sm:p-10 shadow-xl min-h-[900px] flex flex-col justify-between page-break">
        <div>
          {/* Header on Page 2 */}
          <div className="pb-3 border-b border-slate-400 flex justify-between items-center">
            <span className="text-xs font-bold text-[#1a365d] uppercase tracking-wider">
              Modern Way Civil Solutions • Official Quotation
            </span>
            <span className="text-xs font-mono font-bold text-slate-700">
              Ref: {quotation.quotationNumber}
            </span>
          </div>

          {/* Terms & Conditions Section */}
          <div className="mt-6 border border-slate-900 p-5 rounded-none space-y-3">
            <h3 className="text-xs font-black uppercase text-slate-950 tracking-wider">
              TERMS & CONDITIONS:
            </h3>
            <div className="text-xs sm:text-sm text-slate-800 space-y-2 leading-relaxed">
              <pre className="whitespace-pre-wrap font-sans text-xs sm:text-sm text-slate-800 leading-relaxed">
                {quotation.termsAndConditions || `• 1. Payment Term 50% Advance & 50% with Live work going
2. Electricity water, Cement , any ladder is completely from your side
3. Labour room should be managed at your side in labour colony
4. GST is not including in this rate. If you want GST bill GST will be fine extra
5. Labour will be working day and night shift by shift. You have to allow night working with halogen lights
6. Final Measurement consider after completing the work with your engineer
7. We will submit you daily work report to engineer or supervisor who is supervise us`}
              </pre>
            </div>
          </div>

          {/* Payment Terms Section if specified separately */}
          {quotation.paymentTerms && quotation.paymentTerms !== 'Standard progress-based billing' && (
            <div className="mt-4 border border-slate-300 p-4 rounded-none bg-slate-50 text-xs sm:text-sm">
              <h4 className="font-bold text-[#1a365d] uppercase text-[11px] mb-1">
                Payment Schedule:
              </h4>
              <pre className="whitespace-pre-wrap font-sans text-slate-800">
                {quotation.paymentTerms}
              </pre>
            </div>
          )}

          {/* Authorized Signature Box */}
          <div className="mt-16 flex flex-col items-end">
            <div className="text-right space-y-3">
              <p className="text-sm font-black text-slate-950 uppercase tracking-tight">
                For, MODERN WAY CIVIL SOLUTIONS
              </p>

              {/* Signature Graphic / Stamp Container */}
              <div className="w-56 h-20 border border-dashed border-slate-300 bg-slate-50/40 flex flex-col items-center justify-center relative p-2">
                <div className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">
                  [ SEAL & SIGNATURE ]
                </div>
              </div>

              <div className="border-t-2 border-slate-900 pt-1.5 text-center">
                <p className="text-xs font-black uppercase text-slate-950 tracking-wider">
                  AUTHORIZED SIGNATURE
                </p>
                <p className="text-[10px] text-slate-500">
                  Modern Way Civil Solutions
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Page 2 Footer */}
        <div className="pt-6 border-t border-slate-200 flex justify-between items-center text-[11px] text-slate-500">
          <span>Modern Way Civil Solutions • Ahmedabad, Gujarat</span>
          <span>Page 2 of 2</span>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------------------------------
// 2. UNIVERSAL STYLED VIEW (Renders remaining 29 themes with distinct typography, borders & colors)
// -------------------------------------------------------------------------------------------------
function StyledQuotationView({
  layout,
  quotation,
  org,
  formattedDate,
}: {
  layout: QuotationLayout;
  quotation: any;
  org: any;
  formattedDate: string;
}) {
  // Theme configuration for remaining styles
  const getThemeConfig = () => {
    switch (layout) {
      case 'WATERPROOF_AQUA':
        return {
          wrapper: 'bg-white text-slate-900 border-2 border-cyan-500 shadow-xl',
          headerBg: 'bg-gradient-to-r from-cyan-900 to-sky-800 text-white',
          accentColor: 'text-cyan-700',
          badgeBg: 'bg-cyan-100 text-cyan-800 border-cyan-300',
          tableHeader: 'bg-cyan-800 text-white',
          totalRow: 'bg-cyan-900 text-white',
          title: 'Waterproofing Barrier Specification Quotation',
        };
      case 'EPOXY_AMBER':
        return {
          wrapper: 'bg-white text-slate-900 border-2 border-amber-500 shadow-xl',
          headerBg: 'bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-700 text-slate-950',
          accentColor: 'text-amber-600',
          badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
          tableHeader: 'bg-slate-900 text-amber-400',
          totalRow: 'bg-amber-500 text-slate-950 font-black',
          title: 'High-Gloss Industrial Epoxy Flooring Quotation',
        };
      case 'MODERN_BLUE':
        return {
          wrapper: 'bg-white text-slate-900 border border-blue-600 shadow-2xl',
          headerBg: 'bg-blue-800 text-white',
          accentColor: 'text-blue-700',
          badgeBg: 'bg-blue-100 text-blue-800 border-blue-300',
          tableHeader: 'bg-blue-700 text-white',
          totalRow: 'bg-blue-900 text-white',
          title: 'Executive Waterproofing & Coating Proposal',
        };
      case 'CLASSIC_ARCHITECTURAL':
        return {
          wrapper: 'bg-[#fafafa] text-slate-900 border-4 border-double border-slate-700 font-serif',
          headerBg: 'bg-slate-900 text-white font-serif',
          accentColor: 'text-slate-800',
          badgeBg: 'bg-slate-200 text-slate-800 border-slate-400',
          tableHeader: 'bg-slate-800 text-white',
          totalRow: 'bg-slate-950 text-white',
          title: 'Architectural Waterproofing Contract Proposal',
        };
      case 'MINIMAL_CLEAN':
        return {
          wrapper: 'bg-white text-slate-800 border border-slate-200 shadow-sm font-sans',
          headerBg: 'bg-white text-slate-900 border-b-2 border-slate-900',
          accentColor: 'text-slate-900',
          badgeBg: 'bg-slate-100 text-slate-800 border-slate-300',
          tableHeader: 'bg-slate-100 text-slate-900 border-b border-slate-300',
          totalRow: 'bg-slate-100 text-slate-950 border-t-2 border-slate-900',
          title: 'Civil Solution Scope & Estimate',
        };
      case 'INDUSTRIAL_TECH':
        return {
          wrapper: 'bg-[#0f172a] text-slate-100 border-2 border-amber-500 font-mono',
          headerBg: 'bg-[#090d16] text-amber-400 border-b-2 border-amber-500',
          accentColor: 'text-amber-400',
          badgeBg: 'bg-amber-950 text-amber-300 border-amber-700',
          tableHeader: 'bg-slate-900 text-amber-400',
          totalRow: 'bg-amber-500 text-slate-950',
          title: 'Heavy Chemical & Waterproofing BOQ',
        };
      case 'ELEGANT_LUXURY':
        return {
          wrapper: 'bg-white text-slate-900 border-2 border-emerald-600 shadow-2xl',
          headerBg: 'bg-gradient-to-r from-emerald-900 to-teal-800 text-white',
          accentColor: 'text-emerald-700',
          badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-300',
          tableHeader: 'bg-emerald-800 text-white',
          totalRow: 'bg-emerald-950 text-white',
          title: 'Luxury Villa Waterproofing & Protective Coating',
        };
      case 'CORPORATE_NAVY':
        return {
          wrapper: 'bg-white text-slate-900 border border-slate-300 shadow-lg',
          headerBg: 'bg-[#0b1e3b] text-white',
          accentColor: 'text-[#0b1e3b]',
          badgeBg: 'bg-slate-100 text-slate-800 border-slate-300',
          tableHeader: 'bg-[#0b1e3b] text-white',
          totalRow: 'bg-[#0b1e3b] text-white',
          title: 'Corporate Civil Solutions Tender',
        };
      case 'DARK_STEEL':
        return {
          wrapper: 'bg-[#0f172a] text-slate-100 border border-slate-700 shadow-2xl',
          headerBg: 'bg-[#1e293b] text-white border-b border-slate-700',
          accentColor: 'text-amber-400',
          badgeBg: 'bg-slate-800 text-amber-300 border-slate-700',
          tableHeader: 'bg-slate-800 text-slate-200',
          totalRow: 'bg-slate-850 text-amber-400 border-t border-slate-700',
          title: 'Digital Engineering Estimate',
        };
      case 'MONOCHROME_PRINT':
        return {
          wrapper: 'bg-white text-black border-2 border-black font-sans',
          headerBg: 'bg-white text-black border-b-2 border-black',
          accentColor: 'text-black',
          badgeBg: 'bg-white text-black border-black',
          tableHeader: 'bg-black text-white',
          totalRow: 'bg-black text-white font-bold',
          title: 'Official Contractor Quotation',
        };
      case 'ROYAL_INDIGO':
        return {
          wrapper: 'bg-white text-slate-900 border-2 border-indigo-600 shadow-2xl',
          headerBg: 'bg-gradient-to-r from-indigo-950 via-indigo-700 to-purple-800 text-white',
          accentColor: 'text-indigo-600',
          badgeBg: 'bg-indigo-50 text-indigo-900 border-indigo-300',
          tableHeader: 'bg-indigo-900 text-indigo-100',
          totalRow: 'bg-gradient-to-r from-indigo-900 to-purple-900 text-white font-black',
          title: 'Royal Indigo Waterproofing & Epoxy Proposal',
        };
      case 'SLATE_COMPACT':
        return {
          wrapper: 'bg-white text-slate-900 border border-slate-400 font-sans shadow-md',
          headerBg: 'bg-slate-800 text-white',
          accentColor: 'text-slate-700',
          badgeBg: 'bg-slate-100 text-slate-800 border-slate-300',
          tableHeader: 'bg-slate-800 text-white',
          totalRow: 'bg-slate-900 text-white font-bold',
          title: 'Compact Engineering Estimate & BOQ',
        };
      case 'CRIMSON_BOLD':
        return {
          wrapper: 'bg-white text-slate-900 border-2 border-rose-600 shadow-2xl',
          headerBg: 'bg-gradient-to-r from-rose-950 via-red-700 to-rose-900 text-white',
          accentColor: 'text-rose-600',
          badgeBg: 'bg-rose-50 text-rose-800 border-rose-300',
          tableHeader: 'bg-rose-900 text-white',
          totalRow: 'bg-rose-950 text-white font-black',
          title: 'Critical Waterproofing & Structural Repair Estimate',
        };
      case 'FOREST_GREEN':
        return {
          wrapper: 'bg-white text-slate-900 border-2 border-emerald-700 shadow-xl',
          headerBg: 'bg-gradient-to-r from-emerald-950 via-emerald-800 to-green-900 text-white',
          accentColor: 'text-emerald-800',
          badgeBg: 'bg-emerald-50 text-emerald-900 border-emerald-300',
          tableHeader: 'bg-emerald-900 text-white',
          totalRow: 'bg-emerald-950 text-white font-bold',
          title: 'Structural Preservation & Waterproofing Proposal',
        };
      case 'DUAL_TONE_ACCENT':
        return {
          wrapper: 'bg-white text-slate-900 border-t-8 border-t-amber-500 border-x border-b border-slate-300 shadow-xl',
          headerBg: 'bg-gradient-to-r from-slate-950 via-slate-800 to-amber-600 text-white',
          accentColor: 'text-amber-600',
          badgeBg: 'bg-amber-50 text-amber-900 border-amber-300',
          tableHeader: 'bg-slate-900 text-amber-400',
          totalRow: 'bg-amber-500 text-slate-950 font-black',
          title: 'Modern Dual-Accent Commercial Quotation',
        };
      case 'GRID_MODERN':
        return {
          wrapper: 'bg-[#f8fafc] text-slate-900 border border-slate-300 shadow-xl',
          headerBg: 'bg-gradient-to-r from-slate-900 to-blue-900 text-white',
          accentColor: 'text-blue-600',
          badgeBg: 'bg-blue-50 text-blue-800 border-blue-200',
          tableHeader: 'bg-blue-950 text-white',
          totalRow: 'bg-blue-900 text-white font-bold',
          title: 'Modular Construction Scope & Estimation Grid',
        };
      case 'BLUEPRINT_TECHNICAL':
        return {
          wrapper: 'bg-[#0a192f] text-sky-100 border-2 border-sky-400 font-mono shadow-2xl',
          headerBg: 'bg-[#050f1e] text-sky-300 border-b-2 border-sky-400',
          accentColor: 'text-sky-400',
          badgeBg: 'bg-sky-950 text-sky-200 border-sky-700',
          tableHeader: 'bg-sky-950 text-sky-300 border-b border-sky-500',
          totalRow: 'bg-sky-900 text-white font-black',
          title: 'Technical Blueprint Specifications & BOQ',
        };
      case 'PREMIUM_GOLD':
        return {
          wrapper: 'bg-[#fffdfa] text-slate-900 border-2 border-amber-400 shadow-2xl',
          headerBg: 'bg-gradient-to-r from-neutral-950 via-amber-950 to-neutral-950 text-amber-300',
          accentColor: 'text-amber-700',
          badgeBg: 'bg-amber-50 text-amber-900 border-amber-300',
          tableHeader: 'bg-neutral-900 text-amber-300',
          totalRow: 'bg-amber-400 text-slate-950 font-black',
          title: 'VIP Premium Villa Protective Coating Contract',
        };
      case 'NORDIC_FROST':
        return {
          wrapper: 'bg-[#f8fafc] text-slate-800 border border-slate-200 shadow-sm',
          headerBg: 'bg-slate-100 text-slate-900 border-b border-slate-300',
          accentColor: 'text-sky-700',
          badgeBg: 'bg-sky-50 text-sky-800 border-sky-200',
          tableHeader: 'bg-slate-200 text-slate-800',
          totalRow: 'bg-slate-300 text-slate-950 font-bold',
          title: 'Nordic Clean Waterproofing Estimate',
        };
      case 'SOFT_PASTEL':
        return {
          wrapper: 'bg-[#faf8f5] text-stone-800 border border-stone-300 shadow-md',
          headerBg: 'bg-stone-800 text-stone-100',
          accentColor: 'text-amber-800',
          badgeBg: 'bg-stone-200 text-stone-800 border-stone-300',
          tableHeader: 'bg-stone-700 text-stone-100',
          totalRow: 'bg-stone-900 text-stone-100 font-bold',
          title: 'Boutique Architecture Waterproofing Estimate',
        };
      case 'CERTIFICATE_BORDER':
        return {
          wrapper: 'bg-white text-slate-900 border-8 border-double border-slate-800 shadow-2xl p-8',
          headerBg: 'bg-slate-950 text-white font-serif',
          accentColor: 'text-slate-900',
          badgeBg: 'bg-slate-100 text-slate-900 border-slate-400',
          tableHeader: 'bg-slate-900 text-white',
          totalRow: 'bg-slate-950 text-white font-black',
          title: 'Official Waterproofing & Civil Solutions Certificate Proposal',
        };
      case 'SIDEBAR_SUMMARY':
        return {
          wrapper: 'bg-white text-slate-900 border border-indigo-200 shadow-xl',
          headerBg: 'bg-gradient-to-r from-indigo-950 to-slate-900 text-white',
          accentColor: 'text-indigo-600',
          badgeBg: 'bg-indigo-50 text-indigo-900 border-indigo-200',
          tableHeader: 'bg-indigo-900 text-white',
          totalRow: 'bg-indigo-950 text-white font-black',
          title: 'Executive Financial Summary Proposal',
        };
      case 'TOP_BANNER_SOLID':
        return {
          wrapper: 'bg-white text-slate-900 border border-slate-300 shadow-xl overflow-hidden',
          headerBg: 'bg-blue-900 text-white',
          accentColor: 'text-blue-800',
          badgeBg: 'bg-blue-50 text-blue-900 border-blue-200',
          tableHeader: 'bg-blue-800 text-white',
          totalRow: 'bg-blue-950 text-white font-bold',
          title: 'Solid Enterprise Tender Quotation',
        };
      case 'FLOATING_CARDS':
        return {
          wrapper: 'bg-slate-50 text-slate-900 border border-slate-200 shadow-lg',
          headerBg: 'bg-gradient-to-r from-slate-950 via-blue-950 to-slate-950 text-white',
          accentColor: 'text-blue-600',
          badgeBg: 'bg-white text-slate-800 border-slate-200 shadow-sm',
          tableHeader: 'bg-slate-900 text-white',
          totalRow: 'bg-blue-600 text-white font-black',
          title: 'Modern Elevated Cards Civil Proposal',
        };
      case 'RETRO_STAMP':
        return {
          wrapper: 'bg-[#fffef8] text-stone-900 border-2 border-stone-800 shadow-lg font-serif',
          headerBg: 'bg-stone-900 text-stone-100',
          accentColor: 'text-red-700',
          badgeBg: 'bg-red-50 text-red-900 border-red-300',
          tableHeader: 'bg-stone-800 text-stone-100',
          totalRow: 'bg-stone-950 text-stone-100 font-bold',
          title: 'Contractor Work Order & Tender Estimate',
        };
      case 'BOLD_METHODOLOGY':
        return {
          wrapper: 'bg-white text-slate-900 border-2 border-orange-500 shadow-xl',
          headerBg: 'bg-gradient-to-r from-slate-950 via-orange-950 to-slate-950 text-orange-400',
          accentColor: 'text-orange-600',
          badgeBg: 'bg-orange-50 text-orange-900 border-orange-300',
          tableHeader: 'bg-orange-950 text-orange-300',
          totalRow: 'bg-orange-500 text-slate-950 font-black',
          title: 'Method Statement & Technical Execution BOQ',
        };
      case 'COMPACT_SINGLE_PAGE':
        return {
          wrapper: 'bg-white text-slate-900 border border-slate-300 shadow-md text-xs',
          headerBg: 'bg-slate-900 text-white',
          accentColor: 'text-slate-800',
          badgeBg: 'bg-slate-100 text-slate-800 border-slate-300',
          tableHeader: 'bg-slate-800 text-white',
          totalRow: 'bg-slate-950 text-white font-bold',
          title: 'Single Page Rapid Estimate Sheet',
        };
      case 'DETAILED_TWO_PAGE':
        return {
          wrapper: 'bg-white text-slate-900 border border-slate-400 shadow-xl',
          headerBg: 'bg-gradient-to-r from-blue-950 via-indigo-900 to-slate-900 text-white',
          accentColor: 'text-blue-800',
          badgeBg: 'bg-blue-50 text-blue-900 border-blue-300',
          tableHeader: 'bg-slate-900 text-white',
          totalRow: 'bg-blue-950 text-white font-black',
          title: 'Comprehensive 2-Page Technical Tender Proposal',
        };
      case 'EXECUTIVE_PROPOSAL':
        return {
          wrapper: 'bg-[#0f172a] text-slate-100 border-2 border-amber-500 shadow-2xl',
          headerBg: 'bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950 text-amber-400 border-b border-amber-500/40',
          accentColor: 'text-amber-400',
          badgeBg: 'bg-amber-950/60 text-amber-300 border-amber-600',
          tableHeader: 'bg-slate-900 text-amber-300 border-b border-amber-500/30',
          totalRow: 'bg-amber-500 text-slate-950 font-black',
          title: 'Executive Boardroom Civil Solution Proposal',
        };
      default:
        return {
          wrapper: 'bg-white text-slate-900 border border-slate-300 shadow-xl',
          headerBg: 'bg-slate-900 text-white',
          accentColor: 'text-amber-600',
          badgeBg: 'bg-amber-50 text-amber-900 border-amber-300',
          tableHeader: 'bg-slate-800 text-white',
          totalRow: 'bg-slate-950 text-white',
          title: 'Waterproofing & Epoxy Coating Quotation',
        };
    }
  };

  const theme = getThemeConfig();

  return (
    <div className={`print-container max-w-4xl mx-auto rounded-xl p-6 sm:p-10 ${theme.wrapper}`}>
      {/* Letterhead Header Banner */}
      {(() => {
        const isLightBanner = theme.headerBg.includes('text-slate-900') || theme.headerBg.includes('text-black');
        const bannerTextColor = isLightBanner ? '#0f172a' : '#ffffff';
        return (
          <div
            className={`rounded-lg p-6 mb-6 ${theme.headerBg} flex flex-col sm:flex-row justify-between items-start gap-4`}
            style={{ color: bannerTextColor }}
          >
            <div>
              <div className="flex items-center gap-2">
                <Droplets className="w-5 h-5 text-amber-400" />
                <span className="text-xs uppercase font-bold tracking-widest text-amber-300">
                  Modern Way Civil Solutions
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight mt-1" style={{ color: bannerTextColor }}>
                {theme.title}
              </h2>
              <p className="text-xs opacity-90 mt-1 max-w-md" style={{ color: bannerTextColor }}>
                I 04 - S G Business Hub, Opp PNB Bank Sola Road, S G Highway, Gota, Ahmedabad
              </p>
            </div>

            <div className="text-left sm:text-right shrink-0" style={{ color: bannerTextColor }}>
              <div className="text-xs font-mono font-bold uppercase opacity-80">Quotation No</div>
              <div className="text-lg font-mono font-black">{quotation.quotationNumber}</div>
              <div className="text-xs opacity-90 mt-1">Date: {formattedDate}</div>
            </div>
          </div>
        );
      })()}

      {/* Client & Project Details Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6 border-b border-slate-300 text-xs">
        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
          <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider block mb-1">
            Billed To Client:
          </span>
          <p className="text-sm font-bold text-slate-900">{quotation.clientName}</p>
          <p className="text-slate-700">{quotation.clientAddress || 'Ahmedabad, Gujarat'}</p>
          {quotation.clientPhone && <p className="text-slate-700">Phone: {quotation.clientPhone}</p>}
          {quotation.clientGst && <p className="text-slate-700">GST: {quotation.clientGst}</p>}
        </div>

        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
          <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider block mb-1">
            Project Scope:
          </span>
          <p className="text-sm font-bold text-slate-900">{quotation.title}</p>
          <p className="text-slate-700 mt-1">Domain: Waterproofing Services & Epoxy Coating</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 uppercase">
              Status: {quotation.status}
            </span>
            <span className="text-[11px] text-slate-500">
              Valid: {quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString('en-IN') : '30 Days'}
            </span>
          </div>
        </div>
      </div>

      {/* BOQ Table */}
      <div className="mt-6 border border-slate-300 rounded-lg overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            {(() => {
              const isLightHeader =
                theme.tableHeader.includes('text-slate-900') ||
                theme.tableHeader.includes('text-slate-800');
              const headerTextColor = isLightHeader
                ? '#0f172a'
                : theme.tableHeader.includes('text-amber-')
                ? '#fbbf24'
                : theme.tableHeader.includes('text-sky-')
                ? '#7dd3fc'
                : '#ffffff';
              return (
                <tr className={`font-bold uppercase text-[10px] ${theme.tableHeader}`}>
                  <th className="py-3 px-3 w-10 text-center" style={{ color: headerTextColor }}>#</th>
                  <th className="py-3 px-4" style={{ color: headerTextColor }}>Item Scope & Technical Procedure</th>
                  <th className="py-3 px-3 w-20 text-center" style={{ color: headerTextColor }}>Unit</th>
                  <th className="py-3 px-3 w-24 text-right" style={{ color: headerTextColor }}>Quantity</th>
                  <th className="py-3 px-3 w-28 text-right" style={{ color: headerTextColor }}>Rate</th>
                  <th className="py-3 px-4 w-32 text-right" style={{ color: headerTextColor }}>Total</th>
                </tr>
              );
            })()}
          </thead>
          <tbody className="divide-y divide-slate-200">
            {quotation.items?.map((item: any, idx: number) => (
              <tr key={idx} className="align-top hover:bg-slate-50/50">
                <td className="py-3 px-3 text-center font-bold text-slate-500 font-mono">
                  {item.itemNumber || idx + 1}
                </td>
                <td className="py-3 px-4">
                  <div className="whitespace-pre-wrap font-sans text-xs leading-relaxed">
                    {item.description}
                  </div>
                  {item.notes && (
                    <p className="text-[10px] text-slate-500 mt-1 font-semibold">
                      Note: {item.notes}
                    </p>
                  )}
                </td>
                <td className="py-3 px-3 text-center font-medium text-slate-600">
                  {item.unit}
                </td>
                <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
                  {item.quantity}
                </td>
                <td className="py-3 px-3 text-right font-mono text-slate-800">
                  {formatINR(item.rate)}
                </td>
                <td className="py-3 px-4 text-right font-mono font-bold text-slate-950">
                  {formatINR(item.amount)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {(() => {
              const isLightTotal =
                theme.totalRow.includes('text-slate-950') ||
                theme.totalRow.includes('text-slate-900');
              const totalTextColor = isLightTotal ? '#020617' : '#ffffff';
              return (
                <tr className={`font-bold text-sm ${theme.totalRow}`}>
                  <td
                    colSpan={4}
                    className="py-3.5 px-4 uppercase text-right tracking-wider"
                    style={{ color: totalTextColor }}
                  >
                    GRAND TOTAL
                  </td>
                  <td
                    colSpan={2}
                    className="py-3.5 px-4 text-right font-mono text-base font-black"
                    style={{ color: totalTextColor }}
                  >
                    {formatINR(quotation.grandTotal)}
                  </td>
                </tr>
              );
            })()}
          </tfoot>
        </table>
      </div>

      {/* Terms and Financials Split */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 pb-6 border-b border-slate-300 text-xs">
        <div className="space-y-3">
          <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">
            Terms & Conditions:
          </h4>
          <pre className="whitespace-pre-wrap font-sans text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-200">
            {quotation.termsAndConditions || `1. 50% Advance & 50% with Live work going.
2. Electricity, water, Cement, any ladder is completely from your side.
3. Labour room should be managed at your side in labour colony.
4. Final Measurement consider after completing the work with your engineer.`}
          </pre>
        </div>

        <div className="flex flex-col justify-end space-y-3">
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-mono font-semibold">{formatINR(quotation.subtotal)}</span>
            </div>
            {quotation.discountAmount > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>Discount:</span>
                <span className="font-mono font-semibold">- {formatINR(quotation.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-600">
              <span>GST ({quotation.taxRate}%):</span>
              <span className="font-mono font-semibold">
                {quotation.taxAmount > 0 ? `+ ${formatINR(quotation.taxAmount)}` : 'As applicable'}
              </span>
            </div>
            <div className="pt-2 border-t border-slate-300 flex justify-between font-bold text-base text-slate-950">
              <span>Net Payable:</span>
              <span className="font-mono text-amber-600 font-black">{formatINR(quotation.grandTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Signature Footer */}
      <div className="pt-8 flex flex-col sm:flex-row justify-between items-end gap-6 text-xs">
        <div className="text-slate-500 space-y-1">
          <p>Modern Way Civil Solutions • Ahmedabad, Gujarat</p>
          <p>📞 9898035669, 9898035110 • ✉️ modernway9394@gmail.com</p>
        </div>

        <div className="text-right space-y-2">
          <p className="font-bold text-slate-900">For, MODERN WAY CIVIL SOLUTIONS</p>
          <div className="h-10 flex items-end justify-end">
            <span className="w-36 border-b border-slate-400 block"></span>
          </div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">
            Authorized Signatory
          </p>
        </div>
      </div>
    </div>
  );
}
