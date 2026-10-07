'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Building2,
  Globe,
  IndianRupee,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Server,
  Save,
  Trash2,
  Sparkles,
  Upload,
  Image as ImageIcon,
  Loader2,
  Wallet,
  RotateCcw,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ReasonsSettings } from '@/components/settings/ReasonsSettings';

export default function SettingsPage() {
  const [org, setOrg] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    gstNumber: '',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    assistantEnabled: true,
  });

  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isRemovingLogo, setIsRemovingLogo] = useState(false);
  const [isClearingDemo, setIsClearingDemo] = useState(false);
  const [clearStatus, setClearStatus] = useState('');
  const [isResettingCashBook, setIsResettingCashBook] = useState(false);
  const [cashBookResetStatus, setCashBookResetStatus] = useState('');
  const [cashBookResetDetails, setCashBookResetDetails] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side quick check
    if (file.size > 2 * 1024 * 1024) {
      setError('File size exceeds 2 MB limit. Please select a smaller image.');
      return;
    }

    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (!allowed.includes(file.type) && !file.name.toLowerCase().endsWith('.svg')) {
      setError('Invalid file type. Only PNG, JPG, WebP, and SVG files are allowed.');
      return;
    }

    setError('');
    setMessage('');
    setIsUploadingLogo(true);

    try {
      const data = new FormData();
      data.append('file', file);

      const res = await fetch('/api/settings/organization/logo', {
        method: 'POST',
        body: data,
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to upload logo.');
        setIsUploadingLogo(false);
        return;
      }

      setMessage('Company logo uploaded successfully!');
      await fetchOrg();
      router.refresh();
    } catch (err: any) {
      setError(err?.message || 'Failed to upload logo.');
    } finally {
      setIsUploadingLogo(false);
      // Reset input value so same file can be re-selected if needed
      e.target.value = '';
    }
  };

  const handleLogoRemove = async () => {
    if (!confirm('Are you sure you want to remove the company logo and revert to the default branding?')) {
      return;
    }

    setError('');
    setMessage('');
    setIsRemovingLogo(true);

    try {
      const res = await fetch('/api/settings/organization/logo', {
        method: 'DELETE',
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to remove logo.');
        setIsRemovingLogo(false);
        return;
      }

      setMessage('Company logo removed successfully!');
      await fetchOrg();
      router.refresh();
    } catch (err: any) {
      setError(err?.message || 'Failed to remove logo.');
    } finally {
      setIsRemovingLogo(false);
    }
  };

  const fetchOrg = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/settings/organization');
      if (res.ok) {
        const data = await res.json();
        setOrg(data.organization);
        setFormData({
          name: data.organization.name || '',
          phone: data.organization.phone || '',
          email: data.organization.email || '',
          address: data.organization.address || '',
          gstNumber: data.organization.gstNumber || '',
          currency: data.organization.currency || 'INR',
          timezone: data.organization.timezone || 'Asia/Kolkata',
          assistantEnabled: data.organization.assistantEnabled ?? true,
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrg();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsSaving(true);
    try {
      const res = await fetch('/api/settings/organization', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save settings');
        setIsSaving(false);
        return;
      }
      setMessage('Company settings updated successfully!');
      fetchOrg();
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2.5">
          <Settings className="w-7 h-7 text-amber-500" />
          Company Profile & System Settings
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Configure contractor business information, tax identifiers, currency, and multi-tenant preferences
        </p>
      </div>

      {message && (
        <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-bold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Company Official Logo */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-3 border-b border-slate-800">
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-amber-400" /> Company Official Logo
            </h2>
            <span className="text-[11px] text-slate-400">
              Displayed on Sidebar, Login Screen &amp; Printed Reports
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            {/* Logo Preview */}
            <div className="relative flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-2xl border-2 border-dashed border-slate-700 bg-slate-950 p-2 overflow-hidden shadow-inner shrink-0">
              {org?.logoUrl ? (
                <img
                  src={org.logoUrl}
                  alt="Company Logo Preview"
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="text-center text-slate-500">
                  <Building2 className="w-8 h-8 mx-auto stroke-1 text-slate-600 mb-1" />
                  <span className="text-[10px] font-semibold block uppercase tracking-wider">No Logo</span>
                </div>
              )}
            </div>

            {/* Action Buttons & Guidance */}
            <div className="flex-1 space-y-3 text-center sm:text-left">
              <div className="flex flex-wrap items-center gap-2.5 justify-center sm:justify-start">
                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 text-xs font-bold transition-all shadow-md shadow-amber-500/20 disabled:opacity-50">
                  {isUploadingLogo ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  <span>{isUploadingLogo ? 'Uploading...' : 'Upload Logo'}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleLogoUpload}
                    disabled={isUploadingLogo || isRemovingLogo}
                    className="hidden"
                  />
                </label>

                {org?.logoUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleLogoRemove}
                    disabled={isUploadingLogo || isRemovingLogo}
                    className="text-xs text-rose-400 hover:text-rose-300 border-rose-500/30 hover:bg-rose-500/10 min-h-[36px]"
                  >
                    {isRemovingLogo ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1 text-rose-400" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5 mr-1 text-rose-400" />
                    )}
                    <span>{isRemovingLogo ? 'Removing...' : 'Remove Logo'}</span>
                  </Button>
                )}
              </div>

              <div className="text-[11px] text-slate-400 leading-relaxed space-y-1">
                <p>
                  Supported formats: <strong className="text-slate-300">PNG, JPG/JPEG, WebP, SVG</strong> (Max 2 MB).
                </p>
                <p className="text-[10px] text-slate-500">
                  Stored securely in company database. Changes take effect across all portal screens immediately.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Company Information */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2 pb-3 border-b border-slate-800">
            <Building2 className="w-4 h-4 text-amber-400" /> Company / Contractor Profile
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Company Name *
              </label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                GSTIN (Tax ID)
              </label>
              <Input
                value={formData.gstNumber}
                onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value.toUpperCase() })}
                placeholder="27AABCM1234F1Z8"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Official Phone / Mobile
              </label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91 98765 43210"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Official Email
              </label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="contact@company.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Office / Yard Headquarters Address
            </label>
            <Input
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Suite 401, Construction Tower, Pune, MH"
            />
          </div>
        </div>

        {/* Financial Localization */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2 pb-3 border-b border-slate-800">
            <Globe className="w-4 h-4 text-emerald-400" /> Currency & Timezone Standards
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Operating Currency
              </label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500"
              >
                <option value="INR">INR (₹) - Indian Rupee (Lakhs & Crores format)</option>
                <option value="USD">USD ($) - US Dollar</option>
                <option value="AED">AED (د.إ) - UAE Dirham</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Default Timezone
              </label>
              <select
                value={formData.timezone}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500"
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST - UTC+5:30)</option>
                <option value="Asia/Dubai">Asia/Dubai (GST - UTC+4:00)</option>
                <option value="UTC">UTC (Coordinated Universal Time)</option>
              </select>
            </div>
          </div>
        </div>

        {/* In-App AI Assistant Settings (Owner Controlled) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-slate-200">
                In-App AI Assistant (Text &amp; Voice)
              </h2>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Owner Controlled
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-200 block">
                Enable AI Assistant for Team
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Provides instant answers, quick reports, and speech recognition to partners and supervisors.
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.assistantEnabled}
                onChange={(e) => setFormData({ ...formData, assistantEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>
        </div>

        {/* Database & Multi-Tenant Diagnostics */}
        {org && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2 pb-3 border-b border-slate-800">
              <Server className="w-4 h-4 text-sky-400" /> Tenant Database Health & Resource Counts
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-500">Active Sites</span>
                <div className="text-xl font-bold text-slate-100 mt-1">{org._count?.projects || 0}</div>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-500">Labour Roster</span>
                <div className="text-xl font-bold text-emerald-400 mt-1">{org._count?.workers || 0}</div>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-500">Material Items</span>
                <div className="text-xl font-bold text-sky-400 mt-1">{org._count?.materials || 0}</div>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-500">Staff Accounts</span>
                <div className="text-xl font-bold text-purple-400 mt-1">{org._count?.members || 0}</div>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 font-mono">
              Tenant ID: {org.id} • Registered Code: {org.code}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end">
          <Button
            type="submit"
            disabled={isSaving}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs"
          >
            <Save className="w-4 h-4 mr-1.5" />
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </form>

      {/* Custom Reasons Management */}
      <ReasonsSettings />

      {/* Cash Book Reset Section */}
      <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-5 space-y-4 mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-amber-300 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-amber-400" /> Reset Cash Book (Clear All Cash Transactions)
            </h2>
            <p className="text-xs text-amber-200/70 mt-1 max-w-xl">
              Cash Book ki saari purani entries (Money In, Partner Transfers, Daily Expenses, Day Closings aur Bank Transactions) ko clear karke wallet balances ₹0 set karein taaki aap fresh hisaab shuru kar sakein. Aapke Projects, Workers, Material Catalog aur Login Accounts bilkul surakshit rahenge.
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <Link
              href="/cash-book"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
            >
              <span>View Cash Book</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </Link>
            <Button
              type="button"
              variant="outline"
              disabled={isResettingCashBook}
              onClick={async () => {
                const confirmed = confirm(
                  'Kripya confirm karein:\n\nKya aap sach me Cash Book ka saara hisaab clear karna chahte hain?\n\n- Saari Money In, Partner Transfers, Daily Expenses, Day Closings aur Bank Cash Movement delete ho jayengi.\n- Wallet balance ₹0 ho jayega taaki aap naye sire se fresh hisaab daal sakein.\n- Projects, Workers aur Users delete nahi honge.\n\nProceed karein?'
                );
                if (!confirmed) return;

                setIsResettingCashBook(true);
                setCashBookResetStatus('');
                setCashBookResetDetails(null);
                try {
                  const res = await fetch('/api/finance/reset-cash-book', { method: 'POST' });
                  const data = await res.json();
                  if (!res.ok) {
                    alert(data.error || 'Failed to reset Cash Book');
                    return;
                  }
                  setCashBookResetStatus(data.message || 'Cash Book successfully reset!');
                  setCashBookResetDetails(data.cleared);
                  fetchOrg();
                } catch (e: any) {
                  alert(e.message || 'Error occurred while resetting Cash Book');
                } finally {
                  setIsResettingCashBook(false);
                }
              }}
              className="border-amber-500/40 text-amber-400 hover:bg-amber-500/20 text-xs font-bold"
            >
              <RotateCcw className={`w-3.5 h-3.5 mr-1.5 ${isResettingCashBook ? 'animate-spin' : ''}`} />
              {isResettingCashBook ? 'Clearing Cash Book...' : 'Reset Cash Book (₹0 Balance)'}
            </Button>
          </div>
        </div>

        {cashBookResetStatus && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{cashBookResetStatus}</span>
            </div>
            {cashBookResetDetails && (
              <span className="text-[11px] text-emerald-300/80">
                Cleared: {cashBookResetDetails.receipts || 0} Receipts, {cashBookResetDetails.transfers || 0} Transfers, {cashBookResetDetails.expenses || 0} Expenses, {cashBookResetDetails.closings || 0} Closings, {cashBookResetDetails.bankTransactions || 0} Bank Txs
              </span>
            )}
          </div>
        )}
      </div>

      {/* Danger Zone: Wipe All Demo Data */}
      <div className="bg-rose-950/20 border border-rose-500/30 rounded-xl p-5 space-y-3 mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-rose-300 flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-400" /> Reset & Clear All Demo / Test Data
            </h2>
            <p className="text-xs text-rose-300/70 mt-1 max-w-xl">
              Wipe all dummy/demo projects, labour workers, attendance marks, work records, payments, expenses, and materials to start completely fresh. Your company profile and login accounts (Owner, Supervisor, Accountant) are preserved.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={isClearingDemo}
            onClick={async () => {
              if (
                !confirm(
                  'CAUTION: Are you sure you want to wipe all demo entries? This will delete all demo projects, workers, attendance, expenses, payments, materials, and quotations so you can start completely fresh. Proceed?'
                )
              ) {
                return;
              }
              setIsClearingDemo(true);
              setClearStatus('');
              try {
                const res = await fetch('/api/admin/clean-demo-data', { method: 'POST' });
                const data = await res.json();
                if (!res.ok) {
                  alert(data.error || 'Failed to clean demo data');
                  return;
                }
                setClearStatus(data.message || 'All demo entries successfully cleared!');
                fetchOrg();
              } catch (e: any) {
                alert(e.message || 'Error occurred while clearing demo data');
              } finally {
                setIsClearingDemo(false);
              }
            }}
            className="border-rose-500/40 text-rose-400 hover:bg-rose-500/20 text-xs shrink-0 font-bold"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            {isClearingDemo ? 'Wiping Demo Data...' : 'Wipe Demo Data & Start Fresh'}
          </Button>
        </div>
        {clearStatus && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-semibold">
            {clearStatus}
          </div>
        )}
      </div>
    </div>
  );
}
