'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  HardHat,
  Phone,
  User,
  MapPin,
  Building2,
  CalendarCheck,
  IndianRupee,
  CheckCircle2,
  Clock,
  Printer,
  Share2,
  Search,
  ArrowLeft,
  AlertCircle,
  Calendar,
  Sparkles,
  RefreshCw,
  Briefcase,
  FileText,
  UserCheck,
  Receipt,
  Download,
} from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { formatINR } from '@/lib/calculations';

interface WorkerReportData {
  worker: {
    id: string;
    workerCode: string;
    name: string;
    fatherOrHusbandName?: string | null;
    mobile?: string | null;
    address?: string | null;
    category: string;
    dailyWage: number;
    wageUnit: string;
    status: string;
    joiningDate?: string;
  };
  organization: {
    name: string;
    ownerName: string;
    mobile: string;
    city: string;
  };
  summary: {
    totalDaysWorked: number;
    presentDays: number;
    halfDays: number;
    absentDays: number;
    overtimeHours: number;
    attendanceWages: number;
    workRecordWages: number;
    totalAllowances: number;
    totalEarned: number;
    totalPaid: number;
    totalAdvances: number;
    totalReceived: number;
    remainingPayable: number;
  };
  attendance: Array<{
    id: string;
    date: string;
    status: string;
    shift?: string | null;
    overtimeHours: number;
    wageForDay: number;
    notes?: string | null;
    projectName: string;
    location?: string;
    siteName?: string;
  }>;
  payments: Array<{
    id: string;
    date: string;
    amount: number;
    transactionType: string;
    paymentMethod: string;
    reference?: string | null;
    notes?: string | null;
    projectName: string;
  }>;
  workRecords: Array<{
    id: string;
    date: string;
    task: string;
    description?: string | null;
    quantity: number;
    unit: string;
    rate: number;
    totalWorkValue: number;
    projectName: string;
    siteName?: string;
  }>;
  sites: Array<{
    projectId: string;
    projectName: string;
    projectCode: string;
    location: string;
    siteName?: string | null;
    supervisorName?: string | null;
    supervisorMobile?: string | null;
  }>;
}

export default function WorkerPortalPage() {
  const [mobile, setMobile] = useState('');
  const [name, setName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [siteName, setSiteName] = useState('');
  const [location, setLocation] = useState('');
  const [saveSession, setSaveSession] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<WorkerReportData | null>(null);

  // Active tab in report: 'attendance' | 'payments' | 'work' | 'sites'
  const [activeTab, setActiveTab] = useState<'attendance' | 'payments' | 'work' | 'sites'>('attendance');

  // Month filter: 'ALL' | current month format YYYY-MM
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');

  const fetchReport = async (searchParams?: {
    mobile?: string;
    name?: string;
    fatherName?: string;
    siteName?: string;
    location?: string;
  }) => {
    const qMobile = (searchParams?.mobile !== undefined ? searchParams.mobile : mobile).trim();
    const qName = (searchParams?.name !== undefined ? searchParams.name : name).trim();
    const qFather = (searchParams?.fatherName !== undefined ? searchParams.fatherName : fatherName).trim();
    const qSite = (searchParams?.siteName !== undefined ? searchParams.siteName : siteName).trim();
    const qLoc = (searchParams?.location !== undefined ? searchParams.location : location).trim();

    if (!qMobile && !qName) {
      setError('Please enter your mobile number or your name.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/worker-portal/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: qMobile,
          name: qName,
          fatherName: qFather,
          siteName: qSite,
          location: qLoc,
          saveSession,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Record not found. Please verify the entered details.');
        setReport(null);
      } else {
        setReport(data);
        try {
          localStorage.setItem('mw_worker_portal_cache', JSON.stringify(data));
        } catch (e) {}
      }
    } catch (err: any) {
      setError('Failed to connect to server. Please check your internet connection.');
    } finally {
      setIsLoading(false);
    }
  };

  // Check if previously searched worker stored in localStorage & auto-sync fresh data
  useEffect(() => {
    try {
      const saved = localStorage.getItem('mw_worker_portal_cache');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.worker?.name) {
          setReport(parsed);
          const m = parsed.worker.mobile || '';
          const n = parsed.worker.name || '';
          const f = parsed.worker.fatherOrHusbandName || '';
          setMobile(m);
          setName(n);
          setFatherName(f);
          // Auto background fetch fresh database data
          fetchReport({ mobile: m, name: n, fatherName: f });
        }
      }
    } catch (e) {
      // Ignore cache read error
    }
  }, []);

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    fetchReport();
  };

  const handleReset = () => {
    setReport(null);
    setError('');
    try {
      localStorage.removeItem('mw_worker_portal_cache');
    } catch (e) {}
  };

  const handleQuickDemo = () => {
    setMobile('9812345678');
    setName('Ramesh');
    setFatherName('Shri Ram');
    setSiteName('Waterproofing');
    setLocation('Indore');
  };

  // Extract unique available months from attendance
  const availableMonths = useMemo(() => {
    if (!report?.attendance) return [];
    const set = new Set<string>();
    report.attendance.forEach((a) => {
      const d = new Date(a.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      set.add(key);
    });
    return Array.from(set).sort().reverse();
  }, [report]);

  // Filtered lists by selectedMonth
  const filteredAttendance = useMemo(() => {
    if (!report?.attendance) return [];
    if (selectedMonth === 'ALL') return report.attendance;
    return report.attendance.filter((a) => {
      const d = new Date(a.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return key === selectedMonth;
    });
  }, [report, selectedMonth]);

  const filteredPayments = useMemo(() => {
    if (!report?.payments) return [];
    if (selectedMonth === 'ALL') return report.payments;
    return report.payments.filter((p) => {
      const d = new Date(p.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return key === selectedMonth;
    });
  }, [report, selectedMonth]);

  const filteredWorkRecords = useMemo(() => {
    if (!report?.workRecords) return [];
    if (selectedMonth === 'ALL') return report.workRecords;
    return report.workRecords.filter((w) => {
      const d = new Date(w.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return key === selectedMonth;
    });
  }, [report, selectedMonth]);

  // WhatsApp share generator
  const handleShareWhatsApp = () => {
    if (!report) return;
    const { worker, summary, organization } = report;
    const days = summary.totalDaysWorked;
    const earned = formatINR(summary.totalEarned);
    const paid = formatINR(summary.totalReceived);
    const balance = formatINR(summary.remainingPayable);

    const message = `*${organization.name} - Worker Attendance & Passbook Report*
👤 *Name:* ${worker.name}
👨‍👦 *Father/Husband:* ${worker.fatherOrHusbandName || 'N/A'}
🆔 *Worker Code:* ${worker.workerCode}
📱 *Mobile:* ${worker.mobile || 'N/A'}
💼 *Category:* ${worker.category}
💵 *Daily Wage:* ${formatINR(worker.dailyWage)}/day
-------------------------
📅 *Total Attendance:* ${days} days
💰 *Total Earned:* ${earned}
💳 *Total Received:* ${paid}
⚠️ *Balance Due:* ${balance}
-------------------------
_Report generated by Modern Way Civil Solution System._`;

    const encoded = encodeURIComponent(message);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 antialiased">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP NAV / BRAND HEADER                                     */}
      {/* ------------------------------------------------------------- */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 py-3 print:hidden">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 flex items-center justify-center font-black shadow-md shadow-amber-500/20">
              <HardHat className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tracking-tight text-white">
                  MODERN WAY CIVIL SOLUTION
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  Worker Portal
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Labour Self-Service Attendance &amp; Passbook Report
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-xs font-medium text-slate-300 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Main Sign In</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* 2. MAIN CONTAINER                                             */}
      {/* ------------------------------------------------------------- */}
      <main className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
        {!report ? (
          /* ============================================================ */
          /* SEARCH SCREEN: LOOKUP FORM                                  */
          /* ============================================================ */
          <div className="max-w-xl mx-auto space-y-6">
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 mb-1">
                <UserCheck className="w-8 h-8" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Worker Attendance &amp; Passbook Portal
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                Enter your mobile number, name, father&apos;s name, or site to view your full passbook records.
              </p>
            </div>

            {/* Form Card */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 sm:p-7 shadow-2xl backdrop-blur-xl">
              {error && (
                <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Notice:</span> {error}
                  </div>
                </div>
              )}

              <form onSubmit={handleSearch} className="space-y-4">
                {/* 1. Mobile Number */}
                <Input
                  label="1. Mobile Number"
                  type="tel"
                  placeholder="10-digit phone number (e.g. 9812345678)"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  leftIcon={<Phone className="w-4 h-4 text-amber-500" />}
                  helperText="Enter your 10-digit mobile number registered with the company"
                />

                {/* 2. Worker Name */}
                <Input
                  label="2. Worker Name"
                  type="text"
                  placeholder="Enter your name (e.g. Ramesh)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  leftIcon={<User className="w-4 h-4 text-cyan-400" />}
                />

                {/* 3. Father's Name */}
                <Input
                  label="3. Father / Husband Name"
                  type="text"
                  placeholder="Father's name (e.g. Shri Ram)"
                  value={fatherName}
                  onChange={(e) => setFatherName(e.target.value)}
                  leftIcon={<Briefcase className="w-4 h-4 text-indigo-400" />}
                  helperText="Optional: Helps identify the correct profile if names match"
                />

                {/* 4. Site Name & Location */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <Input
                    label="4. Project / Site Name"
                    type="text"
                    placeholder="Site name (optional)"
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    leftIcon={<Building2 className="w-4 h-4 text-emerald-400" />}
                  />
                  <Input
                    label="Location / City"
                    type="text"
                    placeholder="City / location (optional)"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    leftIcon={<MapPin className="w-4 h-4 text-rose-400" />}
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="saveSession"
                    checked={saveSession}
                    onChange={(e) => setSaveSession(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-amber-500/40"
                  />
                  <label htmlFor="saveSession" className="text-xs text-slate-300 cursor-pointer">
                    Save details on this device for quick access
                  </label>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full mt-3 py-3 text-sm font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                  isLoading={isLoading}
                >
                  <Search className="w-4 h-4" />
                  <span>View Attendance &amp; Passbook Report</span>
                </Button>
              </form>

              {/* Quick Demo Test Helper */}
              <div className="mt-5 pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-slate-400">
                <span>To test quickly:</span>
                <button
                  type="button"
                  onClick={handleQuickDemo}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 font-medium transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Fill Demo Worker Details</span>
                </button>
              </div>
            </div>

            {/* Informational help card */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 space-y-1.5 leading-relaxed">
              <p className="font-semibold text-slate-300 flex items-center gap-1.5">
                <HardHat className="w-4 h-4 text-amber-400" />
                Worker Information Guide:
              </p>
              <p>
                • Through this portal, you can inspect your complete attendance history, payments received, and outstanding balance anytime.
              </p>
              <p>
                • If you cannot locate your record, please verify your registered name and mobile number with your site supervisor.
              </p>
            </div>
          </div>
        ) : (
          /* ============================================================ */
          /* REPORT SCREEN: COMPREHENSIVE PASSBOOK VIEW                  */
          /* ============================================================ */
          <div className="space-y-6">
            {/* Top Bar for Reset and Print/Share */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-900 border border-slate-800 print:hidden">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Search Another Worker</span>
                </button>
                <button
                  onClick={() => fetchReport()}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>Live Refresh</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleShareWhatsApp}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share on WhatsApp</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handlePrint}
                  className="border-slate-700 hover:bg-slate-800 text-slate-200 text-xs flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / PDF</span>
                </Button>
              </div>
            </div>

            {/* Print Header (Visible ONLY on Print) */}
            <div className="hidden print:block text-slate-950 pb-4 border-b-2 border-slate-900 mb-4">
              <div className="text-center">
                <h1 className="text-2xl font-black uppercase tracking-wider">
                  {report.organization.name}
                </h1>
                <p className="text-xs text-slate-600">
                  Waterproofing, Epoxy Flooring & Civil Construction Solutions
                </p>
                <p className="text-xs font-semibold mt-1">
                  Worker Digital Attendance &amp; Payment Passbook Slip
                </p>
                <p className="text-[10px] text-slate-500">
                  Date: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>

            {/* Worker Profile Card */}
            <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/70 border border-cyan-800/40 shadow-xl relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-amber-500 text-slate-950 flex items-center justify-center font-black text-2xl shadow-lg shadow-cyan-500/20 shrink-0">
                    {report.worker.name?.charAt(0) || 'W'}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                        {report.worker.name}
                      </h2>
                      <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                        {report.worker.category || 'Worker'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-slate-300 mt-2">
                      <div>
                        Father / Husband:{' '}
                        <strong className="text-white">
                          {report.worker.fatherOrHusbandName || 'Not registered'}
                        </strong>
                      </div>
                      <div>
                        Worker Code:{' '}
                        <strong className="text-amber-400 font-mono">
                          {report.worker.workerCode}
                        </strong>
                      </div>
                      <div>
                        Mobile:{' '}
                        <strong className="text-white">
                          {report.worker.mobile || 'Not registered'}
                        </strong>
                      </div>
                      <div>
                        Daily Wage Rate:{' '}
                        <strong className="text-emerald-400">
                          {formatINR(report.worker.dailyWage)} / day
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 text-right sm:text-right shrink-0">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">
                    Company / Contractor
                  </div>
                  <div className="text-xs font-bold text-white mt-0.5">
                    {report.organization.name}
                  </div>
                  <div className="text-[11px] text-amber-400">
                    {report.organization.ownerName} ({report.organization.mobile})
                  </div>
                </div>
              </div>
            </div>

            {/* 4 Financial Highlight Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Card 1: Total Days */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Total Attendance (Days)</span>
                  <CalendarCheck className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white mt-2">
                  {report.summary.totalDaysWorked}{' '}
                  <span className="text-xs font-normal text-slate-400">days</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {report.summary.presentDays} Full • {report.summary.halfDays} Half
                  {report.summary.overtimeHours > 0 && ` • ${report.summary.overtimeHours}hr OT`}
                </div>
              </div>

              {/* Card 2: Total Earned */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Total Earned (Wages)</span>
                  <IndianRupee className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white mt-2">
                  {formatINR(report.summary.totalEarned)}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Daily attendance + task work value
                </div>
              </div>

              {/* Card 3: Total Received */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Total Received (Paid)</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-400 mt-2">
                  {formatINR(report.summary.totalReceived)}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {formatINR(report.summary.totalPaid)} Paid • {formatINR(report.summary.totalAdvances)} Advance
                </div>
              </div>

              {/* Card 4: Net Balance Due */}
              <div className="p-4 rounded-xl bg-amber-500/10 border-2 border-amber-500/40 text-slate-100 shadow-md shadow-amber-500/10">
                <div className="flex items-center justify-between text-xs font-semibold text-amber-400">
                  <span>Balance Due</span>
                  <Clock className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-amber-400 mt-2">
                  {formatINR(report.summary.remainingPayable)}
                </div>
                <div className="text-[11px] text-amber-300/80 mt-1 font-medium">
                  {report.summary.remainingPayable > 0
                    ? 'Pending balance payable by company'
                    : 'Account settled / No balance due'}
                </div>
              </div>
            </div>

            {/* Filter by Month bar */}
            {availableMonths.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800 print:hidden">
                <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                  <Calendar className="w-4 h-4 text-amber-400" />
                  <span>Filter by Month:</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => setSelectedMonth('ALL')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      selectedMonth === 'ALL'
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    All Records (All Time)
                  </button>
                  {availableMonths.map((m) => {
                    const [year, month] = m.split('-');
                    const dateObj = new Date(Number(year), Number(month) - 1, 1);
                    const label = dateObj.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
                    return (
                      <button
                        key={m}
                        onClick={() => setSelectedMonth(m)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                          selectedMonth === m
                            ? 'bg-amber-500 text-slate-950 shadow-sm'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tabs for Detailed Lists */}
            <div className="space-y-4">
              <div className="flex items-center gap-1 border-b border-slate-800 print:hidden overflow-x-auto">
                <button
                  onClick={() => setActiveTab('attendance')}
                  className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                    activeTab === 'attendance'
                      ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <CalendarCheck className="w-4 h-4" />
                  <span>1. Attendance Timeline ({filteredAttendance.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('payments')}
                  className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                    activeTab === 'payments'
                      ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Receipt className="w-4 h-4" />
                  <span>2. Payments &amp; Advances ({filteredPayments.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('work')}
                  className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                    activeTab === 'work'
                      ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Briefcase className="w-4 h-4" />
                  <span>3. Work Records ({filteredWorkRecords.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('sites')}
                  className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                    activeTab === 'sites'
                      ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span>4. Sites &amp; Locations ({report.sites.length})</span>
                </button>
              </div>

              {/* --------------------------------------------------------- */}
              {/* TAB 1: ATTENDANCE HISTORY                                 */}
              {/* --------------------------------------------------------- */}
              {(activeTab === 'attendance' || typeof window === 'undefined') && (
                <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden shadow-sm">
                  <div className="p-3.5 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
                    <h3 className="text-xs font-bold text-white flex items-center gap-2">
                      <CalendarCheck className="w-4 h-4 text-emerald-400" />
                      Attendance Records
                    </h3>
                    <span className="text-[11px] text-slate-400">
                      Total Records: {filteredAttendance.length}
                    </span>
                  </div>

                  {filteredAttendance.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                      No attendance records found for this period.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold">
                            <th className="py-2.5 px-4">Date</th>
                            <th className="py-2.5 px-3">Project / Site</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3">Shift / Overtime</th>
                            <th className="py-2.5 px-4 text-right">Daily Wage</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {filteredAttendance.map((att) => {
                            const dateObj = new Date(att.date);
                            const formattedDate = dateObj.toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              weekday: 'short',
                            });

                            return (
                              <tr key={att.id} className="hover:bg-slate-800/30 transition-colors">
                                <td className="py-2.5 px-4 font-medium text-slate-200">
                                  {formattedDate}
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="font-semibold text-slate-300">
                                    {att.projectName}
                                  </div>
                                  {(att.siteName || att.location) && (
                                    <div className="text-[10px] text-slate-500">
                                      {att.siteName} {att.location && `• ${att.location}`}
                                    </div>
                                  )}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      att.status === 'PRESENT'
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                        : att.status === 'HALF_DAY'
                                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                    }`}
                                  >
                                    {att.status === 'PRESENT'
                                      ? 'Present'
                                      : att.status === 'HALF_DAY'
                                      ? 'Half Day'
                                      : 'Absent'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-slate-400">
                                  {att.shift || 'DAY'}{' '}
                                  {att.overtimeHours > 0 && `(+${att.overtimeHours} hr OT)`}
                                </td>
                                <td className="py-2.5 px-4 text-right font-bold text-emerald-400">
                                  {formatINR(att.wageForDay)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* --------------------------------------------------------- */}
              {/* TAB 2: PAYMENTS & ADVANCES                                */}
              {/* --------------------------------------------------------- */}
              {activeTab === 'payments' && (
                <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden shadow-sm">
                  <div className="p-3.5 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
                    <h3 className="text-xs font-bold text-white flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-emerald-400" />
                      Payments &amp; Advances Ledger
                    </h3>
                    <span className="text-[11px] text-slate-400">
                      Total Records: {filteredPayments.length}
                    </span>
                  </div>

                  {filteredPayments.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                      No payment records found for this period.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold">
                            <th className="py-2.5 px-4">Date</th>
                            <th className="py-2.5 px-3">Type</th>
                            <th className="py-2.5 px-3">Payment Mode</th>
                            <th className="py-2.5 px-3">Reference / Project</th>
                            <th className="py-2.5 px-4 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {filteredPayments.map((p) => {
                            const dateObj = new Date(p.date);
                            const formattedDate = dateObj.toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            });

                            return (
                              <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                                <td className="py-2.5 px-4 font-medium text-slate-200">
                                  {formattedDate}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      p.transactionType === 'ADVANCE'
                                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                    }`}
                                  >
                                    {p.transactionType === 'ADVANCE' ? 'Advance' : 'Payment'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-slate-300">
                                  {p.paymentMethod || 'CASH'}
                                </td>
                                <td className="py-2.5 px-3 text-slate-400">
                                  {p.projectName} {p.notes && `• ${p.notes}`}
                                </td>
                                <td className="py-2.5 px-4 text-right font-bold text-white">
                                  {formatINR(p.amount)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* --------------------------------------------------------- */}
              {/* TAB 3: WORK RECORDS                                       */}
              {/* --------------------------------------------------------- */}
              {activeTab === 'work' && (
                <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden shadow-sm">
                  <div className="p-3.5 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
                    <h3 className="text-xs font-bold text-white flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-cyan-400" />
                      Work Measurement &amp; Task Logs
                    </h3>
                    <span className="text-[11px] text-slate-400">
                      Total Records: {filteredWorkRecords.length}
                    </span>
                  </div>

                  {filteredWorkRecords.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                      No work measurement records found for this worker.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold">
                            <th className="py-2.5 px-4">Date</th>
                            <th className="py-2.5 px-3">Site</th>
                            <th className="py-2.5 px-3">Task Details</th>
                            <th className="py-2.5 px-3">Quantity</th>
                            <th className="py-2.5 px-3">Rate</th>
                            <th className="py-2.5 px-4 text-right">Total Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {filteredWorkRecords.map((w) => {
                            const dateObj = new Date(w.date);
                            const formattedDate = dateObj.toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                            });

                            return (
                              <tr key={w.id} className="hover:bg-slate-800/30 transition-colors">
                                <td className="py-2.5 px-4 font-medium text-slate-200">
                                  {formattedDate}
                                </td>
                                <td className="py-2.5 px-3 text-slate-300">
                                  {w.projectName}
                                </td>
                                <td className="py-2.5 px-3 font-semibold text-white">
                                  {w.task} {w.description && `(${w.description})`}
                                </td>
                                <td className="py-2.5 px-3 text-slate-300">
                                  {w.quantity} {w.unit}
                                </td>
                                <td className="py-2.5 px-3 text-slate-400">
                                  {formatINR(w.rate)} / {w.unit}
                                </td>
                                <td className="py-2.5 px-4 text-right font-bold text-amber-400">
                                  {formatINR(w.totalWorkValue)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* --------------------------------------------------------- */}
              {/* TAB 4: SITES & SUPERVISORS                                */}
              {/* --------------------------------------------------------- */}
              {activeTab === 'sites' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {report.sites.length === 0 ? (
                    <div className="col-span-2 p-8 text-center text-xs text-slate-500 rounded-xl border border-slate-800 bg-slate-900">
                      No specific project sites linked to this worker.
                    </div>
                  ) : (
                    report.sites.map((s) => (
                      <div
                        key={s.projectId}
                        className="p-4 rounded-xl border border-slate-800 bg-slate-900 space-y-2 shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-white text-sm">{s.projectName}</div>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                            {s.projectCode}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span>{s.location || 'Location not specified'}</span>
                        </div>
                        {s.supervisorName && (
                          <div className="text-xs text-slate-300 pt-2 border-t border-slate-800 flex items-center justify-between">
                            <span>Supervisor: {s.supervisorName}</span>
                            {s.supervisorMobile && (
                              <a
                                href={`tel:${s.supervisorMobile}`}
                                className="text-amber-400 hover:underline flex items-center gap-1"
                              >
                                <Phone className="w-3 h-3" />
                                {s.supervisorMobile}
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Footer Passbook Note */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-400">
              This digital passbook is automatically generated by Modern Way Civil Solution system. For any queries, please contact your contractor or site supervisor.
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
