'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  HardHat,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  Shield,
  Activity,
  Calendar,
  UserCheck,
  Building2,
  Sparkles,
  ArrowLeft,
  Phone,
  User,
  Briefcase,
  Search,
  CheckCircle2,
  Wallet,
} from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

type PortalType = 'none' | 'owner' | 'supervisor' | 'worker' | 'accountant';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPortal = (searchParams.get('portal') as PortalType) || 'none';

  const [activePortal, setActivePortal] = useState<PortalType>(initialPortal);

  // Form states for Credentials Login (Owner / Supervisor / Accountant)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Form states for Worker Quick Lookup (No password)
  const [workerMode, setWorkerMode] = useState<'passbook' | 'password'>('passbook');
  const [workerMobile, setWorkerMobile] = useState('');
  const [workerName, setWorkerName] = useState('');
  const [workerFatherName, setWorkerFatherName] = useState('');
  const [workerSite, setWorkerSite] = useState('');
  const [workerLoading, setWorkerLoading] = useState(false);
  const [workerError, setWorkerError] = useState('');

  // Force dark theme on mount for the 3-portal selector page
  useEffect(() => {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
    document.documentElement.setAttribute('data-theme', 'dark');
    if (document.body) {
      document.body.classList.add('dark');
      document.body.classList.remove('light');
      document.body.style.backgroundColor = '#0b0f17';
    }
  }, []);

  // Sync initial portal from query param
  useEffect(() => {
    const p = searchParams.get('portal') as PortalType;
    if (p && ['owner', 'supervisor', 'worker', 'accountant'].includes(p)) {
      selectPortal(p);
    }
  }, [searchParams]);

  const selectPortal = (portal: PortalType) => {
    setActivePortal(portal);
    setError('');
    setWorkerError('');

    // Pre-populate demo emails depending on portal
    if (portal === 'owner') {
      setEmail('owner@modernway.com');
      setPassword('password123');
    } else if (portal === 'supervisor') {
      setEmail('supervisor@modernway.com');
      setPassword('password123');
    } else if (portal === 'accountant') {
      setEmail('accountant@modernway.com');
      setPassword('password123');
    } else if (portal === 'worker') {
      setEmail('labour@modernway.com');
      setPassword('password123');
      setWorkerMobile('9812345678');
      setWorkerName('Ramesh');
      setWorkerFatherName('Shri Ram');
    }
  };

  // 1. Submit Credentials Login (Owner, Supervisor, Accountant, Worker-Password)
  const handleCredentialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to login. Please check your credentials.');
        setIsLoading(false);
        return;
      }

      if (data.hasOrganization) {
        router.push('/');
      } else {
        router.push('/onboarding');
      }
      router.refresh();
    } catch (err) {
      setError('A network error occurred. Please check your connection.');
      setIsLoading(false);
    }
  };

  // 2. Submit Worker Passbook Lookup (Direct without password)
  const handleWorkerLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setWorkerError('');

    if (!workerMobile.trim() && !workerName.trim()) {
      setWorkerError('कृपया मोबाइल नंबर या मज़दूर का नाम दर्ज करें।');
      return;
    }

    setWorkerLoading(true);

    try {
      const res = await fetch('/api/worker-portal/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: workerMobile.trim(),
          name: workerName.trim(),
          fatherName: workerFatherName.trim(),
          siteName: workerSite.trim(),
          saveSession: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setWorkerError(data.error || 'रिकॉर्ड नहीं मिला। कृपया सही विवरण दर्ज करें।');
        setWorkerLoading(false);
      } else {
        try {
          localStorage.setItem('mw_worker_portal_cache', JSON.stringify(data));
        } catch (e) {}
        // Navigate directly to the worker portal with report ready
        router.push('/worker-portal');
      }
    } catch (err) {
      setWorkerError('सर्वर से कनेक्ट करने में त्रुटि। कृपया पुनः प्रयास करें।');
      setWorkerLoading(false);
    }
  };

  return (
    <div
      className="portal-auth-page min-h-screen flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 relative overflow-hidden"
      style={{
        backgroundColor: '#090d16',
        color: '#f8fafc',
        backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.12) 1px, #090d16 1px)`,
        backgroundSize: '24px 24px',
      }}
    >
      {/* --------------------------------------------------------------- */}
      {/* BRAND HEADER                                                    */}
      {/* --------------------------------------------------------------- */}
      <div className="text-center space-y-2 mb-8 sm:mb-10 max-w-xl relative z-10">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500 text-slate-950 shadow-xl shadow-amber-500/20 mb-2">
          <HardHat className="w-8 h-8 stroke-[2.2]" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-wider text-white">
          MODERN WAY CIVIL SOLUTION
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 font-medium">
          Waterproofing, Epoxy Flooring & Labour Project Management System
        </p>
      </div>

      {/* =============================================================== */}
      {/* VIEW 1: 3-PORTAL SELECTOR DASHBOARD (Matches User Screenshot)    */}
      {/* =============================================================== */}
      {activePortal === 'none' && (
        <div className="w-full max-w-5xl space-y-6 relative z-10 animate-in fade-in duration-300">
          <div className="text-center mb-6">
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Select Your Access Portal (पोर्टल चुनें)
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1.5 font-medium">
              लॉगिन करने या अपनी रिपोर्ट देखने के लिए अपना रोल चुनें
            </p>
          </div>

          {/* 3 Portal Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">
            {/* ----------------------------------------------------------- */}
            {/* CARD 1: OWNER / ADMIN PORTAL                                */}
            {/* ----------------------------------------------------------- */}
            <div
              onClick={() => selectPortal('owner')}
              style={{ backgroundColor: '#0f1422' }}
              className="group relative flex flex-col justify-between p-6 sm:p-7 rounded-2xl border border-slate-800 hover:border-purple-500/50 hover:shadow-2xl hover:shadow-purple-500/10 hover:-translate-y-1 transition-all duration-200 cursor-pointer"
            >
              <div>
                {/* Top Row: Icon + Badge */}
                <div className="flex items-center justify-between gap-3 mb-6">
                  <div className="h-12 w-12 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center shadow-md shadow-purple-500/10 group-hover:scale-105 transition-transform">
                    <Shield className="w-6 h-6 stroke-[2.2]" />
                  </div>
                  <span className="text-[11px] font-semibold tracking-wide px-3 py-1 rounded-full bg-slate-800/90 text-slate-300 border border-slate-700/80">
                    Restricted Access
                  </span>
                </div>

                {/* Title & Description */}
                <h3 className="text-xl font-bold text-white tracking-tight group-hover:text-purple-300 transition-colors">
                  Owner Portal
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed mt-2.5">
                  Secure access to company projects, worker directory, financials, salary, quotations, and full organization settings.
                </p>
              </div>

              {/* Action Link at Bottom */}
              <div className="mt-8 pt-4 border-t border-slate-800/80 flex items-center text-sm font-semibold text-purple-400 group-hover:text-purple-300">
                <span>Enter Portal</span>
                <ArrowRight className="w-4 h-4 ml-1.5 transition-transform group-hover:translate-x-1" />
              </div>
            </div>

            {/* ----------------------------------------------------------- */}
            {/* CARD 2: SUPERVISOR PORTAL                                   */}
            {/* ----------------------------------------------------------- */}
            <div
              onClick={() => selectPortal('supervisor')}
              style={{ backgroundColor: '#0f1422' }}
              className="group relative flex flex-col justify-between p-6 sm:p-7 rounded-2xl border border-slate-800 hover:border-emerald-500/50 hover:shadow-2xl hover:shadow-emerald-500/10 hover:-translate-y-1 transition-all duration-200 cursor-pointer"
            >
              <div>
                {/* Top Row: Icon + Badge */}
                <div className="flex items-center justify-between gap-3 mb-6">
                  <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-md shadow-emerald-500/10 group-hover:scale-105 transition-transform">
                    <Activity className="w-6 h-6 stroke-[2.2]" />
                  </div>
                  <span className="text-[11px] font-semibold tracking-wide px-3 py-1 rounded-full bg-slate-800/90 text-slate-300 border border-slate-700/80">
                    Site Operations
                  </span>
                </div>

                {/* Title & Description */}
                <h3 className="text-xl font-bold text-white tracking-tight group-hover:text-emerald-300 transition-colors">
                  Supervisor Portal
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed mt-2.5">
                  Daily site attendance marking, waterproofing/epoxy work measurement logs, and material receipts for assigned sites.
                </p>
              </div>

              {/* Action Link at Bottom */}
              <div className="mt-8 pt-4 border-t border-slate-800/80 flex items-center text-sm font-semibold text-emerald-400 group-hover:text-emerald-300">
                <span>Enter Portal</span>
                <ArrowRight className="w-4 h-4 ml-1.5 transition-transform group-hover:translate-x-1" />
              </div>
            </div>

            {/* ----------------------------------------------------------- */}
            {/* CARD 3: WORKER PORTAL                                       */}
            {/* ----------------------------------------------------------- */}
            <div
              onClick={() => selectPortal('worker')}
              style={{ backgroundColor: '#0f1422' }}
              className="group relative flex flex-col justify-between p-6 sm:p-7 rounded-2xl border border-slate-800 hover:border-cyan-500/50 hover:shadow-2xl hover:shadow-cyan-500/10 hover:-translate-y-1 transition-all duration-200 cursor-pointer"
            >
              <div>
                {/* Top Row: Icon + Badge */}
                <div className="flex items-center justify-between gap-3 mb-6">
                  <div className="h-12 w-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shadow-md shadow-cyan-500/10 group-hover:scale-105 transition-transform">
                    <Calendar className="w-6 h-6 stroke-[2.2]" />
                  </div>
                  <span className="text-[11px] font-semibold tracking-wide px-3 py-1 rounded-full bg-slate-800/90 text-cyan-300 border border-cyan-500/30">
                    No Password
                  </span>
                </div>

                {/* Title & Description */}
                <h3 className="text-xl font-bold text-white tracking-tight group-hover:text-cyan-300 transition-colors">
                  Worker Portal
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed mt-2.5">
                  View your personal attendance history, wages earned, payment ledger, and check your pending balance in one step.
                </p>
              </div>

              {/* Action Link at Bottom */}
              <div className="mt-8 pt-4 border-t border-slate-800/80 flex items-center text-sm font-semibold text-cyan-400 group-hover:text-cyan-300">
                <span>Enter Portal</span>
                <ArrowRight className="w-4 h-4 ml-1.5 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </div>

          {/* Additional Quick Options (Accountant / Register) */}
          <div className="mt-8 pt-6 border-t border-slate-800/70 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 px-2">
            <button
              onClick={() => selectPortal('accountant')}
              className="hover:text-purple-300 flex items-center gap-1.5 transition-colors"
            >
              <Wallet className="w-3.5 h-3.5 text-purple-400" />
              <span>Are you an <strong>Accountant</strong>? Sign in here</span>
            </button>

            <div>
              New contractor?{' '}
              <Link href="/register" className="text-amber-400 hover:text-amber-300 font-semibold underline">
                Register Company
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* =============================================================== */}
      {/* VIEW 2: OWNER LOGIN PANEL                                       */}
      {/* =============================================================== */}
      {activePortal === 'owner' && (
        <div className="w-full max-w-md space-y-6 relative z-10 animate-in fade-in duration-300">
          <button
            onClick={() => setActivePortal('none')}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to All Portals (पोर्टल बदलें)</span>
          </button>

          <div className="rounded-2xl border border-purple-500/30 bg-[#0c1017]/95 p-7 sm:p-8 shadow-2xl shadow-purple-500/10 backdrop-blur-xl">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="h-11 w-11 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center">
                <Shield className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/30">
                  Owner Portal
                </span>
                <h2 className="text-xl font-bold text-white mt-0.5">Owner Sign In</h2>
              </div>
            </div>

            {error && (
              <div className="mb-5 flex items-center gap-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCredentialSubmit} className="space-y-4">
              <Input
                label="Email address"
                type="email"
                required
                placeholder="owner@modernway.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="w-4 h-4 text-purple-400" />}
              />

              <Input
                label="Password"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4 text-purple-400" />}
              />

              <Button
                type="submit"
                variant="primary"
                className="w-full mt-2 bg-purple-600 hover:bg-purple-700 text-white font-bold"
                size="lg"
                isLoading={isLoading}
              >
                <span>Sign In as Owner</span>
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </form>

            <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Demo Account:</span>
              <button
                type="button"
                onClick={() => {
                  setEmail('owner@modernway.com');
                  setPassword('password123');
                }}
                className="text-purple-400 hover:text-purple-300 font-medium flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Fill Demo (owner@modernway.com)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =============================================================== */}
      {/* VIEW 3: SUPERVISOR LOGIN PANEL                                  */}
      {/* =============================================================== */}
      {activePortal === 'supervisor' && (
        <div className="w-full max-w-md space-y-6 relative z-10 animate-in fade-in duration-300">
          <button
            onClick={() => setActivePortal('none')}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to All Portals (पोर्टल बदलें)</span>
          </button>

          <div className="rounded-2xl border border-emerald-500/30 bg-[#0c1017]/95 p-7 sm:p-8 shadow-2xl shadow-emerald-500/10 backdrop-blur-xl">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="h-11 w-11 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                <Activity className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Supervisor Portal
                </span>
                <h2 className="text-xl font-bold text-white mt-0.5">Supervisor Sign In</h2>
              </div>
            </div>

            {error && (
              <div className="mb-5 flex items-center gap-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCredentialSubmit} className="space-y-4">
              <Input
                label="Email or Mobile"
                type="text"
                required
                placeholder="supervisor@modernway.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="w-4 h-4 text-emerald-400" />}
              />

              <Input
                label="Password"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4 text-emerald-400" />}
              />

              <Button
                type="submit"
                variant="primary"
                className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                size="lg"
                isLoading={isLoading}
              >
                <span>Sign In as Supervisor</span>
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </form>

            <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Demo Account:</span>
              <button
                type="button"
                onClick={() => {
                  setEmail('supervisor@modernway.com');
                  setPassword('password123');
                }}
                className="text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Fill Demo (supervisor@modernway.com)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =============================================================== */}
      {/* VIEW 4: WORKER PORTAL (PASSBOOK OR PASSWORD)                    */}
      {/* =============================================================== */}
      {activePortal === 'worker' && (
        <div className="w-full max-w-lg space-y-6 relative z-10 animate-in fade-in duration-300">
          <button
            onClick={() => setActivePortal('none')}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to All Portals (पोर्टल बदलें)</span>
          </button>

          <div className="rounded-2xl border border-cyan-500/30 bg-[#0c1017]/95 p-6 sm:p-8 shadow-2xl shadow-cyan-500/10 backdrop-blur-xl">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
                  <Calendar className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                    Worker Portal
                  </span>
                  <h2 className="text-xl font-bold text-white mt-0.5">मज़दूर हाजिरी व पासबुक</h2>
                </div>
              </div>
            </div>

            {/* Mode Switcher: Quick Passbook (No Password) vs Password */}
            <div className="flex rounded-xl bg-slate-900 p-1 mb-5 border border-slate-800">
              <button
                type="button"
                onClick={() => setWorkerMode('passbook')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  workerMode === 'passbook'
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                1. बिना पासवर्ड के (फोन व नाम से)
              </button>
              <button
                type="button"
                onClick={() => setWorkerMode('password')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  workerMode === 'password'
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                2. ईमेल / पासवर्ड से
              </button>
            </div>

            {/* Sub-view A: Quick Passbook (No Password Required) */}
            {workerMode === 'passbook' ? (
              <form onSubmit={handleWorkerLookup} className="space-y-4">
                {workerError && (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{workerError}</span>
                  </div>
                )}

                <Input
                  label="मोबाइल नंबर (Phone Number)"
                  type="tel"
                  placeholder="10 अंकों का फोन नंबर (जैसे 9812345678)"
                  value={workerMobile}
                  onChange={(e) => setWorkerMobile(e.target.value)}
                  leftIcon={<Phone className="w-4 h-4 text-cyan-400" />}
                />

                <Input
                  label="मज़दूर / कारीगर का नाम (Worker Name)"
                  type="text"
                  placeholder="अपना नाम लिखें (जैसे Ramesh)"
                  value={workerName}
                  onChange={(e) => setWorkerName(e.target.value)}
                  leftIcon={<User className="w-4 h-4 text-cyan-400" />}
                />

                <Input
                  label="पिता या पति का नाम (Father's Name)"
                  type="text"
                  placeholder="पिता का नाम (जैसे Shri Ram)"
                  value={workerFatherName}
                  onChange={(e) => setWorkerFatherName(e.target.value)}
                  leftIcon={<Briefcase className="w-4 h-4 text-indigo-400" />}
                />

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full mt-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
                  size="lg"
                  isLoading={workerLoading}
                >
                  <Search className="w-4 h-4 mr-1.5" />
                  <span>पूरी रिपोर्ट व पासबुक देखें</span>
                </Button>

                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>डेमो टेस्ट:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setWorkerMobile('9812345678');
                      setWorkerName('Ramesh');
                      setWorkerFatherName('Shri Ram');
                    }}
                    className="text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Fill Demo (Ramesh)
                  </button>
                </div>
              </form>
            ) : (
              /* Sub-view B: Worker Password Login */
              <form onSubmit={handleCredentialSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Input
                  label="Labour Email ID"
                  type="email"
                  required
                  placeholder="labour@modernway.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  leftIcon={<Mail className="w-4 h-4 text-cyan-400" />}
                />

                <Input
                  label="Password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  leftIcon={<Lock className="w-4 h-4 text-cyan-400" />}
                />

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full mt-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
                  size="lg"
                  isLoading={isLoading}
                >
                  <span>Sign In as Labour</span>
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>

                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>Demo Account:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('labour@modernway.com');
                      setPassword('password123');
                    }}
                    className="text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Fill Demo (labour@modernway.com)
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* =============================================================== */}
      {/* VIEW 5: ACCOUNTANT LOGIN PANEL                                  */}
      {/* =============================================================== */}
      {activePortal === 'accountant' && (
        <div className="w-full max-w-md space-y-6 relative z-10 animate-in fade-in duration-300">
          <button
            onClick={() => setActivePortal('none')}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to All Portals (पोर्टल बदलें)</span>
          </button>

          <div className="rounded-2xl border border-amber-500/30 bg-[#0c1017]/95 p-7 sm:p-8 shadow-2xl shadow-amber-500/10 backdrop-blur-xl">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="h-11 w-11 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                <Wallet className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  Finance Portal
                </span>
                <h2 className="text-xl font-bold text-white mt-0.5">Accountant Sign In</h2>
              </div>
            </div>

            {error && (
              <div className="mb-5 flex items-center gap-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCredentialSubmit} className="space-y-4">
              <Input
                label="Email address"
                type="email"
                required
                placeholder="accountant@modernway.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="w-4 h-4 text-amber-400" />}
              />

              <Input
                label="Password"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4 text-amber-400" />}
              />

              <Button
                type="submit"
                variant="primary"
                className="w-full mt-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
                size="lg"
                isLoading={isLoading}
              >
                <span>Sign In as Accountant</span>
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </form>

            <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Demo Account:</span>
              <button
                type="button"
                onClick={() => {
                  setEmail('accountant@modernway.com');
                  setPassword('password123');
                }}
                className="text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Fill Demo (accountant@modernway.com)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
          Loading portal dashboard...
        </div>
      }
    >
      <LoginContent />
    </React.Suspense>
  );
}
