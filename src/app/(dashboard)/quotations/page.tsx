'use client';

import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Search,
  Filter,
  Printer,
  Share2,
  Mail,
  MessageSquare,
  Edit,
  Trash2,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  Building2,
  TrendingUp,
  DollarSign,
  Eye,
  Layers,
} from 'lucide-react';
import { QuotationFormModal } from '@/components/quotations/QuotationFormModal';
import { QuotationViewer } from '@/components/quotations/QuotationViewer';
import { formatINR } from '@/lib/calculations';

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Active View
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [quotationToEdit, setQuotationToEdit] = useState<any | null>(null);
  const [viewingQuotation, setViewingQuotation] = useState<any | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchQuotations();
    fetchProjects();
  }, [statusFilter, searchQuery]);

  const fetchQuotations = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res = await fetch(`/api/quotations?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setQuotations(data.quotations || []);
        setStats(data.stats || {});
      }
    } catch (err) {
      console.error('Error fetching quotations:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (data.projects) {
        setProjects(data.projects.map((p: any) => ({ id: p.id, name: p.name, projectCode: p.projectCode })));
      }
    } catch (e) {}
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this quotation? This cannot be undone.')) {
      return;
    }
    try {
      const res = await fetch(`/api/quotations/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (viewingQuotation?.id === id) {
          setViewingQuotation(null);
        }
        fetchQuotations();
      }
    } catch (e) {
      console.error('Delete error:', e);
    }
  };

  const handleQuickStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/quotations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchQuotations();
        if (viewingQuotation?.id === id) {
          setViewingQuotation({ ...viewingQuotation, status: newStatus });
        }
      }
    } catch (e) {
      console.error('Status change error:', e);
    }
  };

  const handleWhatsAppQuickShare = (q: any) => {
    const text = `*Quotation from Modern Way Civil Solution*
Ref: ${q.quotationNumber}
Scope: ${q.title}
Client: ${q.clientName}
Grand Total: ${formatINR(q.grandTotal)} (Incl. GST)
Valid Until: ${q.validUntil ? new Date(q.validUntil).toLocaleDateString('en-IN') : '30 Days'}

For inquiries contact: Modern Way Civil Solution (+91 98765 43210)`;

    const phone = q.clientPhone ? q.clientPhone.replace(/\D/g, '') : '';
    const url = phone
      ? `https://wa.me/${phone.length === 10 ? '91' + phone : phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;

    window.open(url, '_blank');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACCEPTED':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 w-fit">
            <CheckCircle2 className="w-3 h-3" />
            Accepted
          </span>
        );
      case 'SENT':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30 flex items-center gap-1 w-fit">
            <Clock className="w-3 h-3" />
            Sent to Client
          </span>
        );
      case 'REJECTED':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center gap-1 w-fit">
            <XCircle className="w-3 h-3" />
            Rejected
          </span>
        );
      case 'DRAFT':
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1 w-fit">
            <FileText className="w-3 h-3" />
            Draft
          </span>
        );
    }
  };

  // If a quotation is currently open for viewing/printing
  if (viewingQuotation) {
    return (
      <div className="space-y-6">
        <QuotationViewer
          quotation={viewingQuotation}
          onBack={() => setViewingQuotation(null)}
          onEdit={() => {
            setQuotationToEdit(viewingQuotation);
            setIsModalOpen(true);
          }}
          onStatusChange={(st) => handleQuickStatusChange(viewingQuotation.id, st)}
        />

        {/* Modal for Editing */}
        {isModalOpen && (
          <QuotationFormModal
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false);
              setQuotationToEdit(null);
            }}
            onSuccess={() => {
              fetchQuotations();
              // Re-fetch viewed quotation
              fetch(`/api/quotations/${viewingQuotation.id}`)
                .then((r) => r.json())
                .then((d) => {
                  if (d.success) setViewingQuotation(d.quotation);
                });
            }}
            quotationToEdit={quotationToEdit}
            projects={projects}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-amber-500 uppercase tracking-wider">
              Modern Way Civil Solutions
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-xs text-slate-300">Waterproofing & Epoxy Coatings</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mt-1">
            Quotations & Estimates
          </h1>
          <p className="text-xs text-slate-300 mt-0.5">
            Create, manage, print, and share professional Waterproofing & Epoxy quotations with 30 visual design templates and 14 technical specifications.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setQuotationToEdit(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Create New Quotation
        </button>
      </div>

      {/* 4 Executive KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Total Quotations
          </span>
          <div className="text-xl font-bold text-white font-mono">
            {stats.totalCount || quotations.length}
          </div>
          <p className="text-[10px] text-slate-500">
            Portfolio Value: {formatINR(stats.totalValue || 0)}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider">
            Sent to Clients
          </span>
          <div className="text-xl font-bold text-blue-400 font-mono">
            {stats.sentCount || 0}
          </div>
          <p className="text-[10px] text-slate-500">
            Pipeline Value: {formatINR(stats.sentValue || 0)}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
            Approved / Accepted
          </span>
          <div className="text-xl font-bold text-emerald-400 font-mono">
            {stats.acceptedCount || 0}
          </div>
          <p className="text-[10px] text-slate-500">
            Closed Value: {formatINR(stats.acceptedValue || 0)}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
            Conversion Rate
          </span>
          <div className="text-xl font-bold text-amber-400 font-mono">
            {stats.conversionRate || 0}%
          </div>
          <p className="text-[10px] text-slate-500">
            Accepted / Total Ratio
          </p>
        </div>
      </div>

      {/* Filter Tabs & Search Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900 border border-slate-800">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
          {[
            { id: 'ALL', label: 'All Quotations' },
            { id: 'DRAFT', label: 'Drafts' },
            { id: 'SENT', label: 'Sent' },
            { id: 'ACCEPTED', label: 'Accepted' },
            { id: 'REJECTED', label: 'Rejected' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                statusFilter === tab.id
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search client, quote #, title..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>
      </div>

      {/* Quotations Registry Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase text-[10px]">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Quote Ref #</th>
                <th className="py-3.5 px-4 font-semibold min-w-[200px]">Scope & Project</th>
                <th className="py-3.5 px-4 font-semibold">Client Name</th>
                <th className="py-3.5 px-4 font-semibold">Date & Validity</th>
                <th className="py-3.5 px-4 font-semibold text-right">Items</th>
                <th className="py-3.5 px-4 font-semibold text-right">Grand Total (₹)</th>
                <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                <th className="py-3.5 px-4 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                    <p className="mt-2 text-xs">Loading quotations...</p>
                  </td>
                </tr>
              ) : quotations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <FileSpreadsheet className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                    <p className="font-semibold text-slate-300">No quotations found</p>
                    <p className="text-[11px] text-slate-300 mt-1">
                      Click &quot;Create New Quotation&quot; to generate your first estimate with 14 Waterproofing &amp; Epoxy specifications and 30 visual design templates.
                    </p>
                  </td>
                </tr>
              ) : (
                quotations.map((q) => (
                  <tr
                    key={q.id}
                    className="hover:bg-slate-850/50 transition-colors group cursor-pointer"
                    onClick={() => setViewingQuotation(q)}
                  >
                    {/* Ref # */}
                    <td className="py-3.5 px-4 font-mono font-bold text-amber-400">
                      {q.quotationNumber}
                    </td>

                    {/* Scope & Project */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white group-hover:text-amber-400 transition-colors">
                        {q.title}
                      </div>
                      {q.project && (
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3 text-amber-500" />
                          {q.project.name}
                        </div>
                      )}
                    </td>

                    {/* Client */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-200">{q.clientName}</div>
                      {q.clientPhone && (
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {q.clientPhone}
                        </div>
                      )}
                    </td>

                    {/* Date */}
                    <td className="py-3.5 px-4 text-slate-300">
                      <div>{new Date(q.date).toLocaleDateString('en-IN')}</div>
                      {q.validUntil && (
                        <div className="text-[10px] text-slate-500">
                          Valid: {new Date(q.validUntil).toLocaleDateString('en-IN')}
                        </div>
                      )}
                    </td>

                    {/* Items Count */}
                    <td className="py-3.5 px-4 text-right font-mono text-slate-400">
                      {q.items?.length || 0}
                    </td>

                    {/* Grand Total */}
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-amber-400 text-sm">
                      {formatINR(q.grandTotal)}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={q.status}
                          onChange={(e) => handleQuickStatusChange(q.id, e.target.value)}
                          className="bg-slate-950 border border-slate-800 rounded-lg text-[10px] font-bold px-2 py-1 text-slate-200 focus:outline-none cursor-pointer"
                        >
                          <option value="DRAFT">Draft</option>
                          <option value="SENT">Sent</option>
                          <option value="ACCEPTED">Accepted</option>
                          <option value="REJECTED">Rejected</option>
                          <option value="EXPIRED">Expired</option>
                        </select>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1.5">
                        {/* View / Print */}
                        <button
                          type="button"
                          onClick={() => setViewingQuotation(q)}
                          title="View & Print Quotation"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        >
                          <Eye className="w-4 h-4 text-amber-400" />
                        </button>

                        {/* WhatsApp */}
                        <button
                          type="button"
                          onClick={() => handleWhatsAppQuickShare(q)}
                          title="Share on WhatsApp"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-colors"
                        >
                          <MessageSquare className="w-4 h-4 text-emerald-400" />
                        </button>

                        {/* Edit */}
                        <button
                          type="button"
                          onClick={() => {
                            setQuotationToEdit(q);
                            setIsModalOpen(true);
                          }}
                          title="Edit Quotation"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => handleDelete(q.id)}
                          title="Delete Quotation"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <QuotationFormModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setQuotationToEdit(null);
          }}
          onSuccess={fetchQuotations}
          quotationToEdit={quotationToEdit}
          projects={projects}
        />
      )}
    </div>
  );
}
