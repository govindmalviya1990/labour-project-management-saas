'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Printer,
  Download,
  Calendar,
  Building2,
  FileBarChart,
  RefreshCw,
  Search,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatINR } from '@/lib/calculations';

interface ReportViewerProps {
  reportType: string;
  defaultTitle: string;
}

export function ReportViewer({ reportType, defaultTitle }: ReportViewerProps) {
  const [data, setData] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchReport = async () => {
    setIsLoading(true);
    try {
      const [projRes, repRes] = await Promise.all([
        fetch('/api/projects'),
        fetch(
          `/api/reports?type=${reportType}${
            selectedProjectId !== 'ALL' ? `&projectId=${selectedProjectId}` : ''
          }${startDate ? `&startDate=${startDate}` : ''}${
            endDate ? `&endDate=${endDate}` : ''
          }`
        ),
      ]);

      if (projRes.ok) {
        const p = await projRes.json();
        setProjects(p.projects || []);
      }
      if (repRes.ok) {
        const r = await repRes.json();
        setData(r);
      }
    } catch (e) {
      console.error('Failed to load report:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType, selectedProjectId, startDate, endDate]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!data?.data || data.data.length === 0) return;
    const items = data.data;
    const keys = Object.keys(items[0]).filter((k) => k !== 'id');
    const headers = keys.map((k) => `"${k.toUpperCase()}"`).join(',');
    const rows = items.map((row: any) =>
      keys.map((k) => `"${row[k] !== undefined && row[k] !== null ? String(row[k]).replace(/"/g, '""') : ''}"`).join(',')
    );

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${reportType}_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const rows = (data?.data || []).filter((r: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return Object.values(r).some((v) => String(v).toLowerCase().includes(q));
  });

  const columns = rows.length > 0 ? Object.keys(rows[0]).filter((k) => k !== 'id') : [];

  return (
    <div className="space-y-6 pb-20 print:p-0 print:space-y-4">
      {/* Non-print Back Navigation & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/reports" className="text-xs text-slate-400 hover:text-amber-400 flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> All Reports Directory
            </Link>
          </div>
          <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2.5">
            <FileBarChart className="w-7 h-7 text-amber-500" />
            {data?.reportType || defaultTitle}
          </h1>
          <p className="text-sm text-slate-400">
            Official verifiable audit and operations report with multi-format export
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            onClick={handlePrint}
            variant="outline"
            className="text-xs font-bold border-slate-700 text-slate-200 hover:bg-slate-800"
          >
            <Printer className="w-4 h-4 mr-1.5" />
            Print / PDF
          </Button>

          <Button
            onClick={handleExportCSV}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs"
          >
            <Download className="w-4 h-4 mr-1.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Printable Letterhead Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 print:border-black print:bg-white print:text-black print:p-0">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-800 pb-4 print:border-black">
          <div>
            <h2 className="text-xl font-black text-slate-100 print:text-black">
              {data?.organization?.name || 'Modern Way Civil Solutions SaaS'}
            </h2>
            <p className="text-xs text-slate-400 print:text-gray-600 mt-0.5">
              {data?.organization?.address || 'Site Office & Corporate Headquarters'}
            </p>
            {data?.organization?.gstNumber && (
              <p className="text-xs font-mono text-amber-400 print:text-black mt-1">
                GSTIN: <strong>{data?.organization?.gstNumber}</strong>
              </p>
            )}
          </div>

          <div className="sm:text-right">
            <span className="inline-block px-3 py-1 rounded bg-amber-500/10 text-amber-400 print:bg-gray-100 print:text-black border border-amber-500/20 text-xs font-bold uppercase tracking-wider mb-1">
              {data?.reportType || defaultTitle}
            </span>
            <p className="text-[11px] text-slate-400 print:text-gray-600">
              Generated: {new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
            </p>
            <p className="text-[11px] text-slate-400 print:text-gray-600">
              Site Scope: {selectedProjectId === 'ALL' ? 'All Organization Projects' : projects.find((p) => p.id === selectedProjectId)?.name}
            </p>
          </div>
        </div>

        {/* Dynamic Summary Cards */}
        {data?.summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            {Object.entries(data.summary).map(([key, val]: any) => (
              <div key={key} className="bg-slate-950 p-3 rounded-lg border border-slate-800 print:border-gray-300 print:bg-gray-50">
                <span className="text-[10px] uppercase font-bold text-slate-400 print:text-gray-500 tracking-wider">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </span>
                <div className="text-lg font-black text-slate-100 print:text-black mt-0.5">
                  {typeof val === 'number' && key.toLowerCase().includes('amount') || key.toLowerCase().includes('wage') || key.toLowerCase().includes('cost') || key.toLowerCase().includes('payable') || key.toLowerCase().includes('profit') || key.toLowerCase().includes('salary') || key.toLowerCase().includes('debit') || key.toLowerCase().includes('credit')
                    ? `₹${Number(val).toLocaleString('en-IN')}`
                    : typeof val === 'number'
                    ? val.toLocaleString('en-IN')
                    : val}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filter Toolbar (Hidden during print) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800 print:hidden">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="w-full sm:w-56">
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:ring-1 focus:ring-amber-500"
            >
              <option value="ALL">🏢 All Project Sites</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.projectCode})</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-amber-500"
              placeholder="From Date"
            />
            <span className="text-slate-500 text-xs">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-amber-500"
              placeholder="To Date"
            />
          </div>

          <div className="relative w-full sm:w-56">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Filter in report..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg pl-9 pr-3 py-2 focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>

        <Button size="sm" variant="ghost" onClick={fetchReport} className="text-xs text-slate-400 hover:text-slate-100">
          <RefreshCw className="w-3.5 h-3.5 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Report Data Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden print:border-black print:bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse print:text-black">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 font-semibold uppercase tracking-wider print:border-black print:bg-gray-100 print:text-black">
                {columns.map((col) => (
                  <th key={col} className="py-3 px-3">
                    {col.replace(/([A-Z])/g, ' $1').trim()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 print:divide-gray-300">
              {isLoading ? (
                <tr>
                  <td colSpan={columns.length || 1} className="text-center py-10 text-slate-500">
                    Generating report data...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length || 1} className="text-center py-10 text-slate-400">
                    No data records found for this period and project.
                  </td>
                </tr>
              ) : (
                rows.map((row: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-800/40 print:hover:bg-transparent transition">
                    {columns.map((col) => {
                      const val = row[col];
                      const isMoney =
                        col.toLowerCase().includes('wage') ||
                        col.toLowerCase().includes('rate') ||
                        col.toLowerCase().includes('amount') ||
                        col.toLowerCase().includes('cost') ||
                        col.toLowerCase().includes('payable') ||
                        col.toLowerCase().includes('profit') ||
                        col.toLowerCase().includes('salary') ||
                        col.toLowerCase().includes('credit') ||
                        col.toLowerCase().includes('debit') ||
                        col.toLowerCase().includes('totalearned') ||
                        col.toLowerCase().includes('totalpaid') ||
                        col.toLowerCase().includes('budget');

                      return (
                        <td key={col} className="py-2.5 px-3">
                          {isMoney && typeof val === 'number' ? (
                            <span className="font-mono font-medium text-slate-200 print:text-black">
                              ₹{val.toLocaleString('en-IN')}
                            </span>
                          ) : col === 'status' || col === 'paymentStatus' ? (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              val === 'PAID' || val === 'PRESENT' || val === 'OK' || val === 'COMPLETED'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : val === 'PENDING' || val === 'ABSENT' || val === 'LOW STOCK' || val === 'OVER BUDGET'
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            }`}>
                              {val}
                            </span>
                          ) : typeof val === 'string' && val.includes('T') && !isNaN(Date.parse(val)) && val.length >= 10 ? (
                            new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                          ) : (
                            <span className="text-slate-300 print:text-black">{val ?? '—'}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
