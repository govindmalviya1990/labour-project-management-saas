'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Trash2,
  Hammer,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatINR } from '@/lib/calculations';
import { clsx } from 'clsx';

export default function AttendancePage() {
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get('projectId') || '';

  const dateInputRef = useRef<HTMLInputElement>(null);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId);

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

  // Work Record Modal states
  const [selectedWorkerForWork, setSelectedWorkerForWork] = useState<any | null>(null);
  const [isWorkModalOpen, setIsWorkModalOpen] = useState(false);
  const [workForm, setWorkForm] = useState({
    task: 'Waterproofing',
    quantity: '',
    unit: 'sq.ft',
    rate: '',
    description: '',
  });
  const [isSavingWork, setIsSavingWork] = useState(false);
  const [workActionError, setWorkActionError] = useState('');
  const [workActionSuccess, setWorkActionSuccess] = useState('');

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

  const fetchAttendanceSheet = useCallback(async () => {
    if (!selectedProjectId) return;
    setIsLoading(true);
    setError('');
    setSaveSuccess('');
    try {
      const url = `/api/attendance?date=${date}&projectId=${selectedProjectId}`;
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
  }, [date, selectedProjectId]);

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

  // Work Record Handlers
  const openWorkModal = (item: any) => {
    setSelectedWorkerForWork(item);
    setWorkActionError('');
    setWorkActionSuccess('');
    setWorkForm({
      task: 'Waterproofing',
      quantity: '',
      unit: 'sq.ft',
      rate: '',
      description: '',
    });
    setIsWorkModalOpen(true);
  };

  const handleSaveWorkRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkerForWork || !selectedProjectId) return;
    const qty = Number(workForm.quantity);
    const rate = Number(workForm.rate);
    if (!workForm.task.trim()) {
      setWorkActionError('Please enter a task name.');
      return;
    }
    if (isNaN(qty) || qty <= 0) {
      setWorkActionError('Please enter a valid positive quantity.');
      return;
    }
    if (isNaN(rate) || rate < 0) {
      setWorkActionError('Please enter a valid rate.');
      return;
    }

    setIsSavingWork(true);
    setWorkActionError('');
    setWorkActionSuccess('');

    try {
      const res = await fetch('/api/work', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          projectId: selectedProjectId,
          workerId: selectedWorkerForWork.workerId,
          task: workForm.task.trim(),
          quantity: qty,
          unit: workForm.unit.trim() || 'sq.ft',
          rate: rate,
          description: workForm.description.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save work record');

      const createdRecord = data.record;

      // Update worker's workLogs in the sheet state
      setSheet((prev) =>
        prev.map((item) => {
          if (item.workerId !== selectedWorkerForWork.workerId) return item;
          const currentLogs = item.workLogs || [];
          return {
            ...item,
            workLogs: [createdRecord, ...currentLogs],
          };
        })
      );

      // Update currently opened worker's logs
      setSelectedWorkerForWork((prev: any) =>
        prev
          ? {
              ...prev,
              workLogs: [createdRecord, ...(prev.workLogs || [])],
            }
          : null
      );

      setWorkActionSuccess('Work record added successfully!');
      setWorkForm({
        task: 'Waterproofing',
        quantity: '',
        unit: 'sq.ft',
        rate: '',
        description: '',
      });
    } catch (err: any) {
      setWorkActionError(err.message || 'Error saving work record');
    } finally {
      setIsSavingWork(false);
    }
  };

  const handleDeleteWorkRecord = async (recordId: string) => {
    if (!selectedWorkerForWork) return;
    try {
      const res = await fetch(`/api/work/${recordId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete work record');
      }

      setSheet((prev) =>
        prev.map((item) => {
          if (item.workerId !== selectedWorkerForWork.workerId) return item;
          return {
            ...item,
            workLogs: (item.workLogs || []).filter((w: any) => w.id !== recordId),
          };
        })
      );

      setSelectedWorkerForWork((prev: any) =>
        prev
          ? {
              ...prev,
              workLogs: (prev.workLogs || []).filter((w: any) => w.id !== recordId),
            }
          : null
      );
    } catch (err: any) {
      setWorkActionError(err.message || 'Error deleting work record');
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
          siteId: null,
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

      {/* Filter Header: Date & Project */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 sm:p-5 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-500" />
                Attendance Date
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(date);
                    d.setDate(d.getDate() - 1);
                    setDate(d.toISOString().split('T')[0]);
                  }}
                  className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-0.5"
                  title="Pichhla Din (Yesterday)"
                >
                  <ChevronLeft className="w-3 h-3" /> Kal
                </button>
                <button
                  type="button"
                  onClick={() => setDate(new Date().toISOString().split('T')[0])}
                  className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 transition-colors"
                  title="Aaj (Today)"
                >
                  Aaj
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(date);
                    d.setDate(d.getDate() + 1);
                    setDate(d.toISOString().split('T')[0]);
                  }}
                  className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-0.5"
                  title="Agla Din (Next Day)"
                >
                  Next <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div
              className="relative flex items-center cursor-pointer"
              onClick={() => {
                try {
                  dateInputRef.current?.showPicker?.();
                } catch {
                  dateInputRef.current?.focus();
                }
              }}
            >
              <input
                ref={dateInputRef}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                onClick={(e) => {
                  try {
                    (e.target as any).showPicker?.();
                  } catch {}
                }}
                style={{ colorScheme: 'dark' }}
                className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 pr-10 text-xs focus:outline-none focus:border-amber-500 font-mono cursor-pointer [color-scheme:dark]"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  try {
                    dateInputRef.current?.showPicker?.();
                  } catch {
                    dateInputRef.current?.focus();
                  }
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors"
                title="Calendar kholein (Click to choose date)"
              >
                <Calendar className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-amber-500" />
              Select Construction Project
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-amber-500 h-[38px]"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.projectCode})
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
                <th className="py-3 px-3 text-center">Work Record</th>
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

                  {/* Work Record Action */}
                  <td className="py-3 px-3 text-center whitespace-nowrap">
                    {item.workLogs && item.workLogs.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => openWorkModal(item)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-all group"
                        title="View or add work entries"
                      >
                        <Hammer className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
                        <span>{item.workLogs.length} Log{item.workLogs.length > 1 ? 's' : ''}</span>
                        <span className="text-[10px] text-amber-400/80 font-mono">
                          ({formatINR(item.workLogs.reduce((s: number, r: any) => s + (r.totalWorkValue || 0), 0))})
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openWorkModal(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-amber-300 border border-slate-700/80 text-xs font-medium transition-colors"
                        title="Add work record"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Work</span>
                      </button>
                    )}
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

      {/* Work Record Modal */}
      {selectedWorkerForWork && (
        <Modal
          isOpen={isWorkModalOpen}
          onClose={() => {
            setIsWorkModalOpen(false);
            setSelectedWorkerForWork(null);
          }}
          title={`Work Record — ${selectedWorkerForWork.name}`}
          description={`Date: ${date} • ${selectedWorkerForWork.category} (${selectedWorkerForWork.workerCode})`}
          size="lg"
        >
          <div className="space-y-5">
            {/* Alerts inside modal */}
            {workActionError && (
              <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{workActionError}</span>
              </div>
            )}
            {workActionSuccess && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-400">
                <Check className="w-4 h-4 shrink-0" />
                <span>{workActionSuccess}</span>
              </div>
            )}

            {/* List of existing work records logged for this worker today */}
            {selectedWorkerForWork.workLogs && selectedWorkerForWork.workLogs.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Logged Work for Today ({selectedWorkerForWork.workLogs.length})</span>
                  <span className="text-amber-400 font-mono">
                    Total: {formatINR(selectedWorkerForWork.workLogs.reduce((s: number, r: any) => s + (r.totalWorkValue || 0), 0))}
                  </span>
                </h4>
                <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
                  {selectedWorkerForWork.workLogs.map((log: any) => (
                    <div key={log.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{log.task}</span>
                          <span className="text-[11px] text-slate-400">
                            {log.quantity} {log.unit} @ {formatINR(log.rate)}/{log.unit}
                          </span>
                        </div>
                        {log.description && (
                          <p className="text-[11px] text-slate-500 mt-0.5">{log.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-bold text-amber-400 font-mono">
                          {formatINR(log.totalWorkValue || log.quantity * log.rate)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteWorkRecord(log.id)}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition"
                          title="Delete work record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add New Work Record Form */}
            <form onSubmit={handleSaveWorkRecord} className="space-y-4 rounded-xl border border-slate-800/80 bg-slate-950/40 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                Add Work Entry for this Date
              </h4>

              {/* Quick Task Chips */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-400">Activity / Task</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    'Waterproofing',
                    'PU Coating',
                    'Epoxy Flooring',
                    'Brickwork',
                    'Plaster',
                    'Tile Fixing',
                    'Painting',
                    'Site Labour',
                  ].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setWorkForm((prev) => ({ ...prev, task: tag }))}
                      className={clsx(
                        'px-2 py-0.5 rounded text-[11px] font-medium transition-colors border',
                        workForm.task === tag
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:text-white'
                      )}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  required
                  placeholder="Task name (e.g. Waterproofing, Flooring, etc.)"
                  value={workForm.task}
                  onChange={(e) => setWorkForm((prev) => ({ ...prev, task: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:border-amber-500"
                />
              </div>

              {/* Quantity, Unit & Rate */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400">Quantity</label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    placeholder="e.g. 250"
                    value={workForm.quantity}
                    onChange={(e) => setWorkForm((prev) => ({ ...prev, quantity: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400">Unit</label>
                  <select
                    value={workForm.unit}
                    onChange={(e) => setWorkForm((prev) => ({ ...prev, unit: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:border-amber-500 h-[34px]"
                  >
                    <option value="sq.ft">sq.ft (Square Feet)</option>
                    <option value="sq.m">sq.m (Square Meter)</option>
                    <option value="rft">rft (Running Feet)</option>
                    <option value="meter">meter (Meter)</option>
                    <option value="bags">bags (Bags)</option>
                    <option value="nos">nos (Numbers/Units)</option>
                    <option value="hours">hours (Hours)</option>
                    <option value="trips">trips (Trips)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400">Rate (₹ / Unit)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    placeholder="e.g. 15"
                    value={workForm.rate}
                    onChange={(e) => setWorkForm((prev) => ({ ...prev, rate: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Total Calculation Display */}
              <div className="flex items-center justify-between rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs">
                <span className="text-slate-300 font-medium">Estimated Work Value:</span>
                <span className="text-sm font-bold text-amber-400 font-mono">
                  {formatINR((Number(workForm.quantity) || 0) * (Number(workForm.rate) || 0))}
                </span>
              </div>

              {/* Description / Notes */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400">Description / Area Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Terrace parapet waterproofing, block B"
                  value={workForm.description}
                  onChange={(e) => setWorkForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsWorkModalOpen(false)}
                >
                  Close
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isSavingWork}
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  Save Work Entry
                </Button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}
