'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  CalendarDays,
  PieChart,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ReportViewerProps {
  reportType: string;
  defaultTitle: string;
}

const formatDateToISO = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getCategoryDetails = (cat: string) => {
  const upper = String(cat || '').toUpperCase();
  if (upper.includes('MATERIAL') || upper.includes('GOODS')) {
    return {
      title: 'Material & Goods',
      badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      barColor: 'bg-blue-500',
    };
  }
  if (upper.includes('LABOUR')) {
    return {
      title: 'Labour & Workers',
      badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      barColor: 'bg-amber-500',
    };
  }
  if (upper.includes('PETROL') || upper.includes('FUEL') || upper.includes('TRAVEL') || upper.includes('TRANSPORT')) {
    return {
      title: 'Fuel & Transport',
      badgeColor: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
      barColor: 'bg-orange-500',
    };
  }
  if (upper.includes('CHAY') || upper.includes('NASTA') || upper.includes('FOOD') || upper.includes('GROCERY')) {
    return {
      title: 'Food, Tea & Snacks',
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      barColor: 'bg-emerald-500',
    };
  }
  if (upper.includes('TOOL') || upper.includes('EQUIPMENT')) {
    return {
      title: 'Tools & Equipment',
      badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      barColor: 'bg-purple-500',
    };
  }
  if (upper.includes('RENT')) {
    return {
      title: 'Site Rent & Leases',
      badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
      barColor: 'bg-cyan-500',
    };
  }
  if (upper.includes('RECHARGE') || upper.includes('BILL') || upper.includes('UTILITIES')) {
    return {
      title: 'Utilities & Bills',
      badgeColor: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
      barColor: 'bg-teal-500',
    };
  }
  return {
    title: upper.replace(/_/g, ' '),
    badgeColor: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
    barColor: 'bg-slate-400',
  };
};

export function ReportViewer({ reportType, defaultTitle }: ReportViewerProps) {
  const [data, setData] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSingleDate, setSelectedSingleDate] = useState<string>(() => formatDateToISO(new Date()));
  const [activePeriod, setActivePeriod] = useState<'all' | 'daily' | 'single_day' | 'weekly' | 'monthly' | 'custom'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const startDateInputRef = useRef<HTMLInputElement>(null);
  const endDateInputRef = useRef<HTMLInputElement>(null);

  const isExpenseReport =
    reportType === 'daily-expense' ||
    reportType === 'weekly-expense' ||
    reportType === 'monthly-expense' ||
    reportType === 'expense';

  const getTodayStr = () => formatDateToISO(new Date());
  const getYesterdayStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return formatDateToISO(d);
  };
  const shiftSingleDate = (days: number) => {
    const base = selectedSingleDate ? new Date(selectedSingleDate) : new Date();
    base.setDate(base.getDate() + days);
    const newStr = formatDateToISO(base);
    setSelectedSingleDate(newStr);
    setStartDate(newStr);
    setEndDate(newStr);
    setActivePeriod('single_day');
  };

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

  const handleSelectPeriod = (period: 'all' | 'daily' | 'single_day' | 'weekly' | 'monthly' | 'custom') => {
    setActivePeriod(period);
    const today = new Date();
    if (period === 'daily') {
      const isoToday = formatDateToISO(today);
      setSelectedSingleDate(isoToday);
      setStartDate(isoToday);
      setEndDate(isoToday);
    } else if (period === 'single_day') {
      const target = selectedSingleDate || formatDateToISO(today);
      setSelectedSingleDate(target);
      setStartDate(target);
      setEndDate(target);
    } else if (period === 'weekly') {
      const lastWeek = new Date();
      lastWeek.setDate(today.getDate() - 6);
      setStartDate(formatDateToISO(lastWeek));
      setEndDate(formatDateToISO(today));
    } else if (period === 'monthly') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(formatDateToISO(firstDay));
      setEndDate(formatDateToISO(today));
    } else if (period === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (period === 'custom') {
      setTimeout(() => {
        if (startDateInputRef.current) {
          try {
            (startDateInputRef.current as any).showPicker?.();
          } catch {}
          startDateInputRef.current.focus();
        }
      }, 50);
    }
  };

  const handleCustomDateChange = (newStart: string, newEnd: string) => {
    setStartDate(newStart);
    setEndDate(newEnd);
    setActivePeriod('custom');
  };

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

  // Category breakdown for Expense reports
  const expenseCategories = useMemo(() => {
    if (!isExpenseReport || !data?.data) return [];
    if (data.categoryBreakdown && Array.isArray(data.categoryBreakdown) && data.categoryBreakdown.length > 0) {
      return data.categoryBreakdown;
    }
    const map: Record<string, { totalAmount: number; count: number; percentage: number }> = {};
    const total = data.data.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
    data.data.forEach((r: any) => {
      const cat = r.category || 'MISCELLANEOUS';
      if (!map[cat]) map[cat] = { totalAmount: 0, count: 0, percentage: 0 };
      map[cat].totalAmount += Number(r.amount) || 0;
      map[cat].count += 1;
    });
    return Object.entries(map)
      .map(([category, stats]) => ({
        category,
        totalAmount: stats.totalAmount,
        count: stats.count,
        percentage: total > 0 ? Math.round((stats.totalAmount / total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }, [isExpenseReport, data]);

  // Filtered rows
  const rows = (data?.data || []).filter((r: any) => {
    if (isExpenseReport && selectedCategory !== 'ALL') {
      if (r.category !== selectedCategory) return false;
    }
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return Object.values(r).some((v) => String(v).toLowerCase().includes(q));
  });

  const columns = rows.length > 0 ? Object.keys(rows[0]).filter((k) => k !== 'id') : [];

  return (
    <div className="space-y-6 pb-20 print:p-0 print:space-y-4">
      {/* Top Header & Actions (Hidden during print) */}
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
            Official verifiable audit and operations report with Daily, Weekly, Monthly & Custom Date filters
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
          <div className="flex items-start gap-3.5">
            {data?.organization?.logoUrl ? (
              <img
                src={data.organization.logoUrl}
                alt={data.organization.name || 'Company Logo'}
                className="h-12 w-12 object-contain rounded-lg border border-slate-700 print:border-black p-0.5 bg-white shrink-0"
              />
            ) : (
              <div className="h-11 w-11 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center print:border-black shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
            )}
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
            {(startDate || endDate) && (
              <p className="text-[11px] text-amber-400 print:text-black font-semibold mt-0.5">
                {startDate && endDate && startDate === endDate ? (
                  <>Date: <strong>{new Date(startDate).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</strong> (Single Day)</>
                ) : (
                  <>Period: {startDate ? new Date(startDate).toLocaleDateString('en-IN') : 'Start'} to {endDate ? new Date(endDate).toLocaleDateString('en-IN') : 'Current'}</>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Dynamic Summary Cards */}
        {data?.summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            {Object.entries(data.summary)
              .filter(([key, val]) => key !== 'categories' && typeof val !== 'object')
              .map(([key, val]: any) => (
                <div key={key} className="bg-slate-950 p-3 rounded-lg border border-slate-800 print:border-gray-300 print:bg-gray-50">
                  <span className="text-[10px] uppercase font-bold text-slate-400 print:text-gray-500 tracking-wider">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                  <div className="text-lg font-black text-slate-100 print:text-black mt-0.5">
                    {typeof val === 'number' && (key.toLowerCase().includes('amount') || key.toLowerCase().includes('wage') || key.toLowerCase().includes('cost') || key.toLowerCase().includes('payable') || key.toLowerCase().includes('profit') || key.toLowerCase().includes('salary') || key.toLowerCase().includes('debit') || key.toLowerCase().includes('credit'))
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

      {/* FILTER & DATE CONTROLS BAR (Hidden during print) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4 print:hidden">
        {/* Row 1: Quick Time-Period Selector Buttons */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              Select Period:
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleSelectPeriod('daily')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activePeriod === 'daily'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-950 border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              📅 Daily (Today)
            </button>

            <button
              type="button"
              onClick={() => handleSelectPeriod('single_day')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activePeriod === 'single_day'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-950 border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              🗓️ Single Day (Ek Din)
            </button>

            <button
              type="button"
              onClick={() => handleSelectPeriod('weekly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activePeriod === 'weekly'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-950 border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              📊 Weekly (7 Days)
            </button>

            <button
              type="button"
              onClick={() => handleSelectPeriod('monthly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activePeriod === 'monthly'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-950 border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              🗓️ Monthly (This Month)
            </button>

            <button
              type="button"
              onClick={() => handleSelectPeriod('custom')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activePeriod === 'custom'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-950 border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              📆 Custom Date Range
            </button>

            <button
              type="button"
              onClick={() => handleSelectPeriod('all')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                activePeriod === 'all'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Time
            </button>
          </div>
        </div>

        {/* Row 1b: Dedicated Single Day Quick Day Bar */}
        {activePeriod === 'single_day' && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-950/80 border border-amber-500/30 rounded-xl animate-fade-in">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-amber-500" />
                Select Any Day:
              </span>
              <input
                type="date"
                value={selectedSingleDate}
                onChange={(e) => {
                  setSelectedSingleDate(e.target.value);
                  setStartDate(e.target.value);
                  setEndDate(e.target.value);
                }}
                className="bg-slate-900 border border-slate-700 text-slate-100 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
              />

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => shiftSingleDate(-1)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                  title="Pichla Din"
                >
                  ◀ Prev
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const y = getYesterdayStr();
                    setSelectedSingleDate(y);
                    setStartDate(y);
                    setEndDate(y);
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                >
                  Kal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const t = getTodayStr();
                    setSelectedSingleDate(t);
                    setStartDate(t);
                    setEndDate(t);
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition border border-amber-500/40"
                >
                  Aaj
                </button>
                <button
                  type="button"
                  onClick={() => shiftSingleDate(1)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                  title="Agla Din"
                >
                  Next ▶
                </button>
              </div>
            </div>

            <div className="text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">
              Report for: {new Date(selectedSingleDate).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
          </div>
        )}

        {/* Row 2: Calendar Pickers, Site Selector, Search, & Refresh */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Site / Project Dropdown */}
            <div className="w-full sm:w-56">
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:ring-1 focus:ring-amber-500"
              >
                <option value="ALL">🏢 All Project Sites</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.projectCode})
                  </option>
                ))}
              </select>
            </div>

            {/* Calendar Range Inputs */}
            <div className={`flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border transition ${
              activePeriod === 'custom' ? 'border-amber-500/80 ring-1 ring-amber-500/30' : 'border-slate-800'
            }`}>
              <Calendar className="w-4 h-4 text-amber-500 shrink-0" />
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-500">From:</span>
                <input
                  ref={startDateInputRef}
                  type="date"
                  value={startDate}
                  onChange={(e) => handleCustomDateChange(e.target.value, endDate)}
                  className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
                  placeholder="Start Date"
                />
                <span className="text-slate-600 text-xs">to</span>
                <span className="text-[10px] uppercase font-bold text-slate-500">To:</span>
                <input
                  ref={endDateInputRef}
                  type="date"
                  value={endDate}
                  onChange={(e) => handleCustomDateChange(startDate, e.target.value)}
                  className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
                  placeholder="End Date"
                />
              </div>
            </div>

            {/* In-table search filter */}
            <div className="relative w-full sm:w-52">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search in table..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg pl-9 pr-3 py-2 focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={fetchReport}
              className="text-xs text-slate-400 hover:text-slate-100"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Active Filter Pill Badge */}
        {(startDate || endDate || selectedProjectId !== 'ALL' || (isExpenseReport && selectedCategory !== 'ALL')) && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/60 text-xs">
            <span className="text-slate-500 font-medium">Active Filters:</span>
            {startDate && endDate && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono text-[11px] flex items-center gap-1">
                <CalendarDays className="w-3 h-3" />
                {startDate === endDate ? `Today: ${startDate}` : `${startDate} to ${endDate}`}
              </span>
            )}
            {selectedProjectId !== 'ALL' && (
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[11px]">
                Site: {projects.find((p) => p.id === selectedProjectId)?.name || selectedProjectId}
              </span>
            )}
            {isExpenseReport && selectedCategory !== 'ALL' && (
              <span className="px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[11px] flex items-center gap-1.5">
                Category: {selectedCategory}
                <button
                  type="button"
                  onClick={() => setSelectedCategory('ALL')}
                  className="hover:text-purple-200 font-bold ml-1"
                >
                  ✕
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setActivePeriod('all');
                setSelectedProjectId('ALL');
                setSelectedCategory('ALL');
                setSearch('');
              }}
              className="text-[11px] text-slate-400 hover:text-rose-400 underline ml-auto"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      {/* CATEGORY-WISE EXPENSE BREAKDOWN (Featured for Expense Report) */}
      {isExpenseReport && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 print:border-black print:bg-white print:text-black">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3 print:border-black mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-100 print:text-black flex items-center gap-2">
                <PieChart className="w-5 h-5 text-amber-500" />
                Category-Wise Expense Breakdown
              </h2>
              <p className="text-xs text-slate-400 print:text-gray-600 mt-0.5">
                Total expenditure distribution, percentage share, and voucher count (Click any category to filter table)
              </p>
            </div>
            {selectedCategory !== 'ALL' && (
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className="text-xs font-semibold px-2.5 py-1 rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30 print:hidden w-fit"
              >
                Show All Categories
              </button>
            )}
          </div>

          {expenseCategories.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-xs">
              No expense records found for this period.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {expenseCategories.map((item: any) => {
                const meta = getCategoryDetails(item.category);
                const isSelected = selectedCategory === item.category;

                return (
                  <div
                    key={item.category}
                    onClick={() => setSelectedCategory(isSelected ? 'ALL' : item.category)}
                    className={`cursor-pointer rounded-xl p-3.5 border transition duration-150 ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/20'
                        : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                    } print:border-gray-400 print:bg-gray-50`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${meta.badgeColor} print:border-black print:text-black mb-1`}>
                          {meta.title}
                        </span>
                        <div className="text-[11px] text-slate-400 print:text-gray-600 truncate">
                          {item.category}
                        </div>
                      </div>
                      <span className="text-xs font-mono font-bold text-amber-400 print:text-black shrink-0">
                        {item.percentage}%
                      </span>
                    </div>

                    <div className="mt-2.5 flex items-baseline justify-between">
                      <div className="text-lg font-black text-slate-100 print:text-black font-mono">
                        ₹{Number(item.totalAmount || 0).toLocaleString('en-IN')}
                      </div>
                      <div className="text-[11px] text-slate-400 print:text-gray-600">
                        {item.count} {item.count === 1 ? 'voucher' : 'vouchers'}
                      </div>
                    </div>

                    {/* Ratio / Progress bar */}
                    <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2.5 overflow-hidden print:bg-gray-200">
                      <div
                        className={`h-1.5 rounded-full ${meta.barColor} print:bg-black`}
                        style={{ width: `${Math.min(100, Math.max(3, item.percentage))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* REPORT DATA TABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden print:border-black print:bg-white">
        {isExpenseReport && selectedCategory !== 'ALL' && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between text-xs print:hidden">
            <span className="text-amber-400 font-medium">
              Active Filter: <strong>{selectedCategory}</strong> ({rows.length} records)
            </span>
            <button
              onClick={() => setSelectedCategory('ALL')}
              className="text-slate-400 hover:text-white underline text-[11px]"
            >
              Clear Category Filter
            </button>
          </div>
        )}

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
                  <td colSpan={columns.length || 1} className="text-center py-12 text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-amber-500" />
                      <span>Generating report data...</span>
                    </div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length || 1} className="text-center py-12 text-slate-400">
                    No records found for this period and site filter.
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
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                val === 'PAID' || val === 'PRESENT' || val === 'OK' || val === 'COMPLETED'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : val === 'PENDING' || val === 'ABSENT' || val === 'LOW STOCK' || val === 'OVER BUDGET'
                                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              }`}
                            >
                              {val}
                            </span>
                          ) : col === 'category' && isExpenseReport ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-amber-400 border border-slate-700">
                              {val}
                            </span>
                          ) : typeof val === 'string' && val.includes('T') && !isNaN(Date.parse(val)) && val.length >= 10 ? (
                            new Date(val).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
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
