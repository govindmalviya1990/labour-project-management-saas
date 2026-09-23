'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { QuotationViewer } from '@/components/quotations/QuotationViewer';
import { QuotationFormModal } from '@/components/quotations/QuotationFormModal';

export default function SingleQuotationPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [quotation, setQuotation] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    if (id) {
      fetchQuotation();
      fetchProjects();
    }
  }, [id]);

  const fetchQuotation = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/quotations/${id}`);
      const data = await res.json();
      if (data.success) {
        setQuotation(data.quotation);
      } else {
        setError(data.error || 'Quotation not found');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load quotation');
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

  const handleStatusChange = async (newStatus: string) => {
    try {
      const res = await fetch(`/api/quotations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchQuotation();
      }
    } catch (e) {
      console.error('Status error:', e);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-400">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
        <p className="mt-2 text-xs">Loading quotation details...</p>
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div className="py-20 text-center">
        <p className="text-rose-400 font-semibold">{error || 'Quotation not found'}</p>
        <button
          type="button"
          onClick={() => router.push('/quotations')}
          className="mt-4 px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold hover:bg-slate-700"
        >
          Back to Quotations List
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <QuotationViewer
        quotation={quotation}
        onBack={() => router.push('/quotations')}
        onEdit={() => setIsModalOpen(true)}
        onStatusChange={handleStatusChange}
      />

      {isModalOpen && (
        <QuotationFormModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={fetchQuotation}
          quotationToEdit={quotation}
          projects={projects}
        />
      )}
    </div>
  );
}
