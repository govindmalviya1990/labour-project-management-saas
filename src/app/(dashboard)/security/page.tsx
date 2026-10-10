'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  History,
  Undo2,
  Trash2,
  Clock,
  User,
  AlertTriangle,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Eye,
  Filter,
  Monitor,
  Smartphone,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface LoginEntry {
  id: string;
  userId: string | null;
  userEmail: string;
  userName: string | null;
  role: string | null;
  portal: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  status: string;
  loginAt: string;
}

interface AuditEntry {
  id: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  userRole: string | null;
  entityType: string;
  entityId: string;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  details: string | null;
  ipAddress: string | null;
  canUndoUntil: string | null;
  isReverted: boolean;
  revertedAt: string | null;
  revertedByName: string | null;
  status: string;
  createdAt: string;
  canUndo?: boolean;
  remainingHours?: number;
  remainingMinutes?: number;
}

export default function SecurityAuditPage() {
  const [activeTab, setActiveTab] = useState<'logins' | 'activities' | 'undo'>('undo');

  // Login History State
  const [logins, setLogins] = useState<LoginEntry[]>([]);
  const [loginSummary, setLoginSummary] = useState({ total: 0, success: 0, failed: 0 });
  const [loginLoading, setLoginLoading] = useState(true);
  const [loginSearch, setLoginSearch] = useState('');
  const [loginStatusFilter, setLoginStatusFilter] = useState('ALL');

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [auditSummary, setAuditSummary] = useState({ total: 0, activeUndoAvailable: 0, revertedCount: 0 });
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditEntityFilter, setAuditEntityFilter] = useState('ALL');
  const [auditActionFilter, setAuditActionFilter] = useState('ALL');

  // Action states
  const [isUndoing, setIsUndoing] = useState<string | null>(null);
  const [isPurging, setIsPurging] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Detail Modal
  const [selectedAudit, setSelectedAudit] = useState<AuditEntry | null>(null);

  // Fetch Logins
  const fetchLogins = async () => {
    setLoginLoading(true);
    try {
      const params = new URLSearchParams();
      if (loginStatusFilter !== 'ALL') params.set('status', loginStatusFilter);
      if (loginSearch.trim()) params.set('search', loginSearch.trim());

      const res = await fetch(`/api/security/login-history?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogins(data.logins || []);
        if (data.summary) setLoginSummary(data.summary);
      }
    } catch (e) {
      console.error('Error fetching logins:', e);
    } finally {
      setLoginLoading(false);
    }
  };

  // Fetch Audit Logs
  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const params = new URLSearchParams();
      if (auditEntityFilter !== 'ALL') params.set('entityType', auditEntityFilter);
      if (auditActionFilter !== 'ALL') params.set('action', auditActionFilter);
      if (auditSearch.trim()) params.set('search', auditSearch.trim());

      const res = await fetch(`/api/security/audit-logs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
        if (data.summary) setAuditSummary(data.summary);
      }
    } catch (e) {
      console.error('Error fetching audit logs:', e);
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    fetchLogins();
    fetchAuditLogs();
  }, [loginStatusFilter, auditEntityFilter, auditActionFilter]);

  // Handle Undo
  const handleUndo = async (auditId: string) => {
    if (
      !confirm(
        'Are you sure you want to undo this action? This change made within 48 hours will be reverted.'
      )
    ) {
      return;
    }

    setIsUndoing(auditId);
    setActionMessage(null);
    setActionError(null);

    try {
      const res = await fetch(`/api/security/audit-logs/${auditId}/undo`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        setActionError(data.error || 'Failed to undo action.');
        return;
      }

      setActionMessage(data.message || 'Action successfully undone / reverted!');
      await fetchAuditLogs();
    } catch (e: any) {
      setActionError(e.message || 'Server error');
    } finally {
      setIsUndoing(null);
    }
  };

  // Handle Purge (>48 hours)
  const handlePurgeExpired = async () => {
    if (
      !confirm(
        'CAUTION: Are you sure you want to permanently purge all records removed over 48 hours ago? This action cannot be reversed.'
      )
    ) {
      return;
    }

    setIsPurging(true);
    setActionMessage(null);
    setActionError(null);

    try {
      const res = await fetch('/api/security/audit-logs/purge-expired', {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        setActionError(data.error || 'Failed to purge expired records.');
        return;
      }

      setActionMessage(
        `Successfully purged: ${data.purgedExpenses || 0} expenses, ${data.purgedAttendances || 0} attendance records, ${data.purgedPayments || 0} payments.`
      );
      await fetchAuditLogs();
    } catch (e: any) {
      setActionError(e.message || 'Server error');
    } finally {
      setIsPurging(false);
    }
  };

  const formatIST = (dateStr: string) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREATE':
        return { label: 'Created (CREATE)', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
      case 'UPDATE':
        return { label: 'Modified (UPDATE)', color: 'bg-sky-500/10 text-sky-400 border-sky-500/30' };
      case 'DELETE':
        return { label: 'Deleted (DELETE)', color: 'bg-rose-500/10 text-rose-400 border-rose-500/30' };
      case 'RESTORE':
        return { label: 'Restored (RESTORE)', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' };
      default:
        return { label: action, color: 'bg-slate-800 text-slate-300 border-slate-700' };
    }
  };

  const getEntityLabel = (entity: string) => {
    const map: Record<string, string> = {
      Expense: 'Expense',
      Attendance: 'Attendance',
      Payment: 'Payment / Salary',
      Worker: 'Worker',
      Project: 'Project',
      ProjectSite: 'Site',
      MaterialReceipt: 'Material Receipt',
      FundTransfer: 'Fund Transfer',
      BankAccount: 'Bank Account',
    };
    return map[entity] || entity;
  };

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto">
      {/* ------------------------------------------------------------- */}
      {/* ------------------------------------------------------------- */}
      {/* HEADER                                                        */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Security &amp; Audit Control Center (Owner Surveillance)
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Surveillance: Track user logins, audit record modifications, and rollback changes within 48 hours
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              fetchLogins();
              fetchAuditLogs();
            }}
            className="border-slate-700 text-slate-300 hover:text-white text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Refresh
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPurging}
            onClick={handlePurgeExpired}
            className="border-rose-500/40 text-rose-400 hover:bg-rose-500/10 text-xs font-bold"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            {isPurging ? 'Purging...' : 'Purge Expired (>48h)'}
          </Button>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {actionMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {actionError && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* METRIC KPI SUMMARY CARDS                                      */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Login Attempts</span>
            <User className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white mt-2">
            {loginSummary.total}
          </div>
          <div className="text-[11px] text-emerald-400 mt-1 font-medium">
            ✔ {loginSummary.success} Success • ✖ {loginSummary.failed} Failed
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Audit Events</span>
            <History className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white mt-2">
            {auditSummary.total}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Expenses, attendance, payments, workers, etc.
          </div>
        </div>

        <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-4 bg-amber-500/5">
          <div className="flex items-center justify-between text-amber-400 text-xs font-semibold">
            <span>48h Undo Available</span>
            <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-amber-400 mt-2">
            {auditSummary.activeUndoAvailable}
          </div>
          <div className="text-[11px] text-amber-300/80 mt-1">
            Active within 48-hour rollback window
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Reverted by Owner</span>
            <Undo2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-400 mt-2">
            {auditSummary.revertedCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Successfully restored records
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB NAVIGATION                                                */}
      {/* ------------------------------------------------------------- */}
      <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab('undo')}
          className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'undo'
              ? 'bg-amber-500 text-slate-950 shadow-md font-black'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Undo2 className="w-3.5 h-3.5" />
          <span>1. 48-Hour Undo Center ({auditSummary.activeUndoAvailable})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('activities')}
          className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'activities'
              ? 'bg-amber-500 text-slate-950 shadow-md font-black'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>2. All Activities &amp; Changes ({auditSummary.total})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('logins')}
          className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'logins'
              ? 'bg-amber-500 text-slate-950 shadow-md font-black'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>3. Login Surveillance ({loginSummary.total})</span>
        </button>
      </div>

      {/* ============================================================= */}
      {/* TAB 1: 48-HOUR UNDO / ROLLBACK CENTER                         */}
      {/* ============================================================= */}
      {activeTab === 'undo' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  Recent Modifications (48-Hour Undo / Rollback Window)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  If a supervisor, accountant, or staff member made an erroneous change or deleted a record, you can revert it within 48 hours.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-400">
                  Locked Permanently After 48h
                </span>
              </div>
            </div>

            {/* List of items that can be undone */}
            <div className="mt-4 divide-y divide-slate-800/80">
              {auditLoading ? (
                <div className="text-center py-10 text-xs text-slate-400">
                  Loading undo items...
                </div>
              ) : auditLogs.filter((a) => a.canUndo || a.isReverted).length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                  <p className="text-sm font-bold text-white">
                    No Pending Undo Items Available
                  </p>
                  <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                    All modifications within the last 48 hours are safe or permanent. Deleted expenses, attendance records, or payments will appear here immediately.
                  </p>
                </div>
              ) : (
                auditLogs
                  .filter((a) => a.canUndo || a.isReverted)
                  .map((log) => {
                    return (
                      <div
                        key={log.id}
                        className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-800/30 px-2 rounded-lg transition"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Action badge */}
                            {(() => {
                              const badge = getActionBadge(log.action);
                              return (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${badge.color}`}>
                                  {badge.label}
                                </span>
                              );
                            })()}

                            {/* Entity */}
                            <span className="text-xs font-bold text-white">
                              {getEntityLabel(log.entityType)}
                            </span>

                            {/* Remaining time countdown badge */}
                            {log.isReverted ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/30">
                                ✔ Reverted by {log.revertedByName || 'Owner'}
                              </span>
                            ) : log.canUndo ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                                <Clock className="w-3 h-3 animate-spin" />
                                {log.remainingHours}h {log.remainingMinutes}m remaining (Undo Available)
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                Permanent (48h Expired)
                              </span>
                            )}
                          </div>

                          {/* Details description */}
                          <p className="text-xs text-slate-300 font-medium truncate max-w-2xl">
                            {log.details || `Action on ${log.entityType}`}
                          </p>

                          {/* Who and When */}
                          <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-3">
                            <span>
                              By: <strong className="text-slate-200">{log.userName || log.userEmail || 'System'}</strong> ({log.userRole || 'STAFF'})
                            </span>
                            <span>•</span>
                            <span>Time: {formatIST(log.createdAt)}</span>
                            {log.ipAddress && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-[10px] text-slate-500">IP: {log.ipAddress}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setSelectedAudit(log)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            title="View Raw Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {log.canUndo && !log.isReverted ? (
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              disabled={isUndoing === log.id}
                              onClick={() => handleUndo(log.id)}
                              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs"
                            >
                              <Undo2 className="w-3.5 h-3.5 mr-1" />
                              {isUndoing === log.id ? 'Reverting...' : 'Undo (Revert)'}
                            </Button>
                          ) : (
                            <span className="text-[11px] text-slate-500 font-medium px-2 py-1">
                              {log.isReverted ? 'Completed' : 'Permanent Lock'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* TAB 2: ALL ACTIVITIES & CHANGE LOG                            */}
      {/* ============================================================= */}
      {activeTab === 'activities' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search: details, name, email, or category..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchAuditLogs()}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={auditEntityFilter}
                onChange={(e) => setAuditEntityFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-2 focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">All Modules</option>
                <option value="Expense">Expense</option>
                <option value="Attendance">Attendance</option>
                <option value="Payment">Payment</option>
                <option value="Worker">Worker</option>
                <option value="Project">Project</option>
              </select>

              <select
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-2 focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">All Actions</option>
                <option value="CREATE">CREATE (Add)</option>
                <option value="UPDATE">UPDATE (Edit)</option>
                <option value="DELETE">DELETE (Delete)</option>
                <option value="RESTORE">RESTORE (Rollback)</option>
              </select>

              <Button
                type="button"
                size="sm"
                onClick={fetchAuditLogs}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold"
              >
                Search
              </Button>
            </div>
          </div>

          {/* Activities Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Date &amp; Time</th>
                    <th className="py-3 px-3">User</th>
                    <th className="py-3 px-3">Action</th>
                    <th className="py-3 px-3">Module (Entity)</th>
                    <th className="py-3 px-4">Details</th>
                    <th className="py-3 px-3">Undo Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {auditLoading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-slate-500">
                        Loading activities...
                      </td>
                    </tr>
                  ) : auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-slate-400">
                        No audit records found.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => {
                      return (
                        <tr key={log.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-3 px-4 text-slate-300 font-mono text-[11px] whitespace-nowrap">
                            {formatIST(log.createdAt)}
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-white">{log.userName || log.userEmail || 'System'}</div>
                            <div className="text-[10px] text-slate-400">{log.userRole || 'STAFF'}</div>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            {(() => {
                              const badge = getActionBadge(log.action);
                              return (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${badge.color}`}>
                                  {badge.label}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-300 whitespace-nowrap">
                            {getEntityLabel(log.entityType)}
                          </td>
                          <td className="py-3 px-4 text-slate-300 max-w-xs truncate" title={log.details || ''}>
                            {log.details || '—'}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            {log.isReverted ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/30">
                                Reverted
                              </span>
                            ) : log.canUndo ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                {log.remainingHours}h {log.remainingMinutes}m
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500">
                                Permanent
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedAudit(log)}
                                className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
                                title="View Details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              {log.canUndo && !log.isReverted && (
                                <button
                                  type="button"
                                  disabled={isUndoing === log.id}
                                  onClick={() => handleUndo(log.id)}
                                  className="p-1.5 text-amber-400 hover:bg-amber-500/20 rounded transition font-bold text-[11px] flex items-center gap-1"
                                  title="Undo (Revert)"
                                >
                                  <Undo2 className="w-3.5 h-3.5" />
                                  <span>Undo</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* TAB 3: LOGIN HISTORY (WHO LOGGED IN)                          */}
      {/* ============================================================= */}
      {activeTab === 'logins' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search: user email, name, IP address, or portal..."
                value={loginSearch}
                onChange={(e) => setLoginSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchLogins()}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={loginStatusFilter}
                onChange={(e) => setLoginStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-2 focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">All Status</option>
                <option value="SUCCESS">Success Only</option>
                <option value="FAILED">Failed Only</option>
              </select>

              <Button
                type="button"
                size="sm"
                onClick={fetchLogins}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold"
              >
                Search
              </Button>
            </div>
          </div>

          {/* Login Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Login Timestamp</th>
                    <th className="py-3 px-3">User / Email</th>
                    <th className="py-3 px-3">User ID</th>
                    <th className="py-3 px-3">Role / Portal</th>
                    <th className="py-3 px-3">IP Address</th>
                    <th className="py-3 px-3">Device / Browser</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loginLoading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-slate-500">
                        Loading login history...
                      </td>
                    </tr>
                  ) : logins.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-slate-400">
                        No login history records found.
                      </td>
                    </tr>
                  ) : (
                    logins.map((entry) => {
                      const isMobile = (entry.userAgent || '').toLowerCase().includes('mobile');
                      return (
                        <tr key={entry.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-3 px-4 text-slate-200 font-mono text-[11px] whitespace-nowrap">
                            {formatIST(entry.loginAt)}
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-white">
                              {entry.userName || entry.userEmail}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {entry.userEmail}
                            </div>
                          </td>
                          <td className="py-3 px-3 font-mono text-[10px] text-slate-400">
                            {entry.userId ? (
                              <span className="px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700/80">
                                {entry.userId.slice(-8)}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                              {entry.portal || entry.role || 'PORTAL'}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-slate-300">
                            {entry.ipAddress || '127.0.0.1'}
                          </td>
                          <td className="py-3 px-3 text-slate-400 max-w-xs truncate" title={entry.userAgent || ''}>
                            <div className="flex items-center gap-1.5">
                              {isMobile ? (
                                <Smartphone className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                              ) : (
                                <Monitor className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              )}
                              <span className="text-[11px] truncate">
                                {entry.userAgent || 'Web Browser'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                entry.status === 'SUCCESS'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              }`}
                            >
                              {entry.status === 'SUCCESS' ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Success</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3 h-3" />
                                  <span>Failed</span>
                                </>
                              )}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* AUDIT RECORD RAW DETAIL MODAL                                 */}
      {/* ============================================================= */}
      {selectedAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">
                  Audit Record Inspection
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAudit(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Action</span>
                  <span className="font-bold text-white">{selectedAudit.action}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Entity Type</span>
                  <span className="font-bold text-white">{selectedAudit.entityType} ({selectedAudit.entityId})</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">User</span>
                  <span className="font-bold text-white">{selectedAudit.userName || selectedAudit.userEmail || 'System'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Timestamp</span>
                  <span className="font-bold text-white font-mono">{formatIST(selectedAudit.createdAt)}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block font-bold mb-1">Description:</span>
                <p className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200">
                  {selectedAudit.details || 'No details available'}
                </p>
              </div>

              {selectedAudit.oldValue && (
                <div>
                  <span className="text-slate-400 block font-bold mb-1">Old Value (Before Change):</span>
                  <pre className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-300 font-mono overflow-x-auto max-h-40">
                    {JSON.stringify(JSON.parse(selectedAudit.oldValue), null, 2)}
                  </pre>
                </div>
              )}

              {selectedAudit.newValue && (
                <div>
                  <span className="text-slate-400 block font-bold mb-1">New Value (After Change):</span>
                  <pre className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-emerald-400 font-mono overflow-x-auto max-h-40">
                    {JSON.stringify(JSON.parse(selectedAudit.newValue), null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <span className="text-[11px] text-slate-400">
                {selectedAudit.canUndo && !selectedAudit.isReverted
                  ? `Undo available (${selectedAudit.remainingHours}h ${selectedAudit.remainingMinutes}m remaining)`
                  : selectedAudit.isReverted
                  ? 'This change has already been reverted'
                  : 'The 48-hour rollback window has expired (Permanent)'}
              </span>

              <div className="flex items-center gap-2">
                {selectedAudit.canUndo && !selectedAudit.isReverted && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={isUndoing === selectedAudit.id}
                    onClick={() => {
                      handleUndo(selectedAudit.id);
                      setSelectedAudit(null);
                    }}
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs"
                  >
                    <Undo2 className="w-3.5 h-3.5 mr-1" />
                    Undo (Revert)
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedAudit(null)}
                  className="border-slate-700 text-slate-300"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
