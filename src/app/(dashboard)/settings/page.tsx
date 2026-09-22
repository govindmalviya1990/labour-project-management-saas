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
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

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
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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
    </div>
  );
}
