'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CalendarCheck,
  CheckCircle2,
  Users,
  Building2,
  Calendar,
  Save,
  Check,
  RefreshCw,
  AlertCircle,
  IndianRupee,
  Layers,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatINR } from '@/lib/calculations';
import { clsx } from 'clsx';

export default function AttendancePage() {
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get('projectId') || '';

  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [projectSites, setProjectSites] = useState<any[]>([]);

  const [sheet, setSheet] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({
    totalWorkers: 0,
    markedCount: 0,
    present: 0,
    halfDay: 0,
    absent: 0,
    leave: 0,
    totalLabourCost: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [error, setError] = useState('');

  // Fetch projects for dropdown
  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await fetch('/api/projects?status=RUNNING');
        if (!res.ok) return;
        const data = await res.json();
        setProjects(data.projects || []);
        if (!selectedProjectId && data.projects?.length > 0) {
          setSelectedProjectId(data.projects[0].id);
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadProjects();
  }, [selectedProjectId]);

  // Update sites when selected project changes
  useEffect(() => {
    if (!selectedProjectId) {
      setProjectSites([]);
      setSelectedSiteId('');
      return;
    }
    const currentProj = projects.find((p) => p.id === selectedProjectId);
    if (currentProj && currentProj.sites) {
      setProjectSites(currentProj.sites);
      setSelectedSiteId(currentProj.sites[0]?.id || '');
    } else {
      setProjectSites([]);
      setSelectedSiteId('');
    }
  }, [selectedProjectId, projects]);

  const fetchAttendanceSheet = useCallback(async () => {
    if (!selectedProjectId) return;
    setIsLoading(true);
    setError('');
    setSaveSuccess('');
    try {
      const url = `/api/attendance?date=${date}&projectId=${selectedProjectId}${
        selectedSiteId ? `&siteId=${selectedSiteId}` : ''
      }`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load attendance sheet');
      const data = await res.json();
      setSheet(data.sheet || []);
      setSummary(data.summary || {});
    } catch (err: any) {
      setError(err.message || 'Error fetching sheet');
    } finally {
      setIsLoading(false);
    }
  }, [date, selectedProjectId, selectedSiteId]);

  useEffect(() => {
    fetchAttendanceSheet();
  }, [fetchAttendanceSheet]);

  // Handler to change single worker status
  const handleStatusChange = (workerId: string, status: string) => {
    setSheet((prev) =>
      prev.map((item) => {
        if (item.workerId !== workerId) return item;
        let wage = 0;
        if (status === 'PRESENT') wage = item.dailyWage;
        if (status === 'HALF_DAY') wage = item.dailyWage / 2;
        if (item.overtimeHours > 0) {
          wage += (item.dailyWage / 8) * item.overtimeHours;
        }
        return {
          ...item,
          status,
          wageForDay: wage,
        };
      })
    );
  };

  // Handler to change overtime hours
  const handleOvertimeChange = (workerId: string, hours: number) => {
    setSheet((prev) =>
      prev.map((item) => {
        if (item.workerId !== workerId) return item;
        let base = 0;
        if (item.status === 'PRESENT') base = item.dailyWage;
        if (item.status === 'HALF_DAY') base = item.dailyWage / 2;
        const wage = base + (hours > 0 ? (item.dailyWage / 8) * hours : 0);
        return {
          ...item,
          overtimeHours: hours,
          wageForDay: wage,
        };
      })
    );
  };

  // One-click MARK ALL PRESENT
  const handleMarkAllPresent = () => {
    setSheet((prev) =>
      prev.map((item) => ({
        ...item,
        status: 'PRESENT',
        wageForDay: item.dailyWage + ((item.dailyWage / 8) * (item.overtimeHours || 0)),
      }))
    );
  };

  const handleClearAttendance = async (workerId: string, attendanceId?: string) => {
    try {
      if (attendanceId) {
        await fetch(`/api/attendance?id=${attendanceId}`, { method: 'DELETE' });
      } else {
        await fetch(`/api/attendance?workerId=${workerId}&date=${date}`, { method: 'DELETE' });
      }
      setSheet((prev) =>
        prev.map((item) =>
          item.workerId === workerId
            ? { ...item, status: 'UNMARKED', attendanceId: null, wageForDay: 0, overtimeHours: 0 }
            : item
        )
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveSheet = async () => {
    if (!selectedProjectId) {
      setError('Please select a project before saving.');
      return;
    }

    setIsSaving(true);
    setError('');
    setSaveSuccess('');

    const records = sheet
      .filter((item) => item.status !== 'UNMARKED')
      .map((item) => ({
        workerId: item.workerId,
        status: item.status,
        shift: item.shift || 'DAY',
        overtimeHours: Number(item.overtimeHours) || 0,
        notes: item.notes || '',
      }));

    if (records.length === 0) {
      setError('No workers are marked. Please mark attendance before saving.');
      setIsSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          projectId: selectedProjectId,
          siteId: selectedSiteId || null,
          records,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save attendance');

      setSaveSuccess(`Attendance successfully saved for ${data.count} workers!`);
      fetchAttendanceSheet();
    } catch (err: any) {
      setError(err.message || 'Error saving attendance');
    } finally {
      setIsSaving(false);
    }
  };

  const livePresentCount = sheet.filter((s) => s.status === 'PRESENT').length;
  const liveHalfDayCount = sheet.filter((s) => s.status === 'HALF_DAY').length;
  const liveAbsentCount = sheet.filter((s) => s.status === 'ABSENT').length;
  const liveLeaveCount = sheet.filter((s) => s.status === 'LEAVE').length;
  const liveTotalLabourCost = sheet.reduce((acc, curr) => acc + (Number(curr.wageForDay) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Page Title & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-amber-500" />
            Daily Site Attendance Sheet
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Log worker turnout, half days, overtime, and automatically update daily project labour costs
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10 font-semibold"
            onClick={handleMarkAllPresent}
          >
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            Mark All Present
          </Button>

          <Button
            size="sm"
            variant="primary"
            isLoading={isSaving}
            onClick={handleSaveSheet}
          >
            <Save className="w-4 h-4 mr-1.5" />
            Save Attendance Sheet
          </Button>
        </div>
      </div>

      {/* Filter Header: Date, Project, Site */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 sm:p-5 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-500" />
              Attendance Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-amber-500" />
              Select Construction Project
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-amber-500"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.projectCode})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-500" />
              Site / Tower / Wing
            </label>
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-amber-500"
            >
              <option value="">General / All Sites</option>
              {projectSites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Live Counters */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-slate-400">
              Total Workers: <strong className="text-white">{sheet.length}</strong>
            </span>
            <span className="text-emerald-400 font-medium">
              Present: <strong>{livePresentCount}</strong>
            </span>
            <span className="text-amber-400 font-medium">
              Half Day: <strong>{liveHalfDayCount}</strong>
            </span>
            <span className="text-rose-400 font-medium">
              Absent: <strong>{liveAbsentCount}</strong>
            </span>
            <span className="text-blue-400 font-medium">
              Leave: <strong>{liveLeaveCount}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2 bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/20 font-bold text-amber-400">
            <IndianRupee className="w-4 h-4" />
            <span>Today&apos;s Labour Cost: {formatINR(liveTotalLabourCost)}</span>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {saveSuccess && (
        <div className="flex items-center gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400 animate-fade-in">
          <Check className="w-4 h-4 shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {/* Attendance Sheet List */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="border-b border-slate-800 bg-slate-950/60 uppercase font-semibold text-slate-400">
              <tr>
                <th className="py-3 px-4">Worker / Skill</th>
                <th className="py-3 px-3">Daily Wage</th>
                <th className="py-3 px-3 text-center">Turnout Status</th>
                <th className="py-3 px-3 text-center">Overtime (Hours)</th>
                <th className="py-3 px-4 text-right">Calculated Wage</th>
                <th className="py-3 px-3 text-center">Reset</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {sheet.map((item) => (
                <tr key={item.workerId} className="hover:bg-slate-800/30 transition-colors">
                  {/* Worker Name & Category */}
                  <td className="py-3 px-4">
                    <p className="font-semibold text-white text-sm">{item.name}</p>
                    <div className="flex items-center gap-2 text-slate-400 mt-0.5">
                      <span className="font-mono text-[10px] text-amber-400">{item.workerCode}</span>
                      <span>•</span>
                      <span>{item.category}</span>
                    </div>
                  </td>

                  {/* Daily Wage Rate */}
                  <td className="py-3 px-3 font-semibold text-slate-200">
                    {formatINR(item.dailyWage)} / day
                  </td>

                  {/* Status Toggle Buttons */}
                  <td className="py-3 px-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleStatusChange(item.workerId, 'PRESENT')}
                        className={clsx(
                          'px-2.5 py-1 rounded text-[11px] font-bold transition-all',
                          item.status === 'PRESENT'
                            ? 'bg-emerald-500 text-slate-950 ring-2 ring-emerald-500/40 shadow-sm'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        )}
                      >
                        P
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(item.workerId, 'HALF_DAY')}
                        className={clsx(
                          'px-2.5 py-1 rounded text-[11px] font-bold transition-all',
                          item.status === 'HALF_DAY'
                            ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-500/40 shadow-sm'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        )}
                      >
                        HD
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(item.workerId, 'ABSENT')}
                        className={clsx(
                          'px-2.5 py-1 rounded text-[11px] font-bold transition-all',
                          item.status === 'ABSENT'
                            ? 'bg-rose-500 text-slate-950 ring-2 ring-rose-500/40 shadow-sm'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        )}
                      >
                        A
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(item.workerId, 'LEAVE')}
                        className={clsx(
                          'px-2.5 py-1 rounded text-[11px] font-bold transition-all',
                          item.status === 'LEAVE'
                            ? 'bg-blue-500 text-slate-950 ring-2 ring-blue-500/40 shadow-sm'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        )}
                      >
                        L
                      </button>
                    </div>
                  </td>

                  {/* Overtime Hours */}
                  <td className="py-3 px-3 text-center">
                    <input
                      type="number"
                      min="0"
                      max="16"
                      step="0.5"
                      value={item.overtimeHours || ''}
                      onChange={(e) => handleOvertimeChange(item.workerId, Number(e.target.value))}
                      placeholder="0"
                      className="w-16 bg-slate-950 border border-slate-700 text-center text-slate-200 rounded px-2 py-1 text-xs focus:border-amber-500"
                    />
                  </td>

                  {/* Wage For Day */}
                  <td className="py-3 px-4 text-right">
                    <p className="font-bold text-amber-400 text-sm">
                      {formatINR(item.wageForDay)}
                    </p>
                    {item.status === 'HALF_DAY' && (
                      <p className="text-[10px] text-slate-500">50% Day Rate</p>
                    )}
                    {item.overtimeHours > 0 && (
                      <p className="text-[10px] text-emerald-400">+{item.overtimeHours}h OT</p>
                    )}
                  </td>

                  {/* Reset / Clear Attendance */}
                  <td className="py-3 px-3 text-center">
                    <button
                      type="button"
                      title="Clear / Unmark Attendance"
                      onClick={() => handleClearAttendance(item.workerId, item.attendanceId)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
