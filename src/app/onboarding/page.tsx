'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  FolderPlus,
  UserPlus,
  CalendarCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  HardHat,
  AlertCircle,
} from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Step 1: Organization
  const [orgData, setOrgData] = useState({
    name: 'Modern Way Civil Solutions Pvt Ltd',
    ownerName: 'Ramesh Sharma',
    mobile: '9876543210',
    email: 'contact@modernway.com',
    address: 'Sector 62, Construction Hub',
    city: 'Noida',
    state: 'Uttar Pradesh',
    country: 'India',
    gstNumber: '07AAAAA0000A1Z5',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
  });

  // Step 2: First Project
  const [projectData, setProjectData] = useState({
    name: 'Sunrise Commercial Tower',
    projectCode: 'PRJ-001',
    projectType: 'Commercial',
    location: 'Plot 42, Knowledge Park',
    projectValue: 5000000,
    estimatedLabourCost: 1000000,
    estimatedMaterialCost: 2000000,
    estimatedOtherExpense: 500000,
    status: 'RUNNING',
  });

  // Step 3: First Worker
  const [workerData, setWorkerData] = useState({
    name: 'Ramesh Kumar',
    workerCode: 'WRK-001',
    mobile: '9811223344',
    category: 'Mason',
    dailyWage: 800,
  });

  // Step 4: First Attendance
  const [attendanceData, setAttendanceData] = useState({
    date: new Date().toISOString().split('T')[0],
    status: 'PRESENT',
  });

  const handleNext = () => {
    setError('');
    if (currentStep === 1) {
      if (!orgData.name.trim() || !orgData.mobile.trim()) {
        setError('Please enter company name and mobile number.');
        return;
      }
    } else if (currentStep === 2) {
      if (!projectData.name.trim()) {
        setError('Please enter the project name.');
        return;
      }
    } else if (currentStep === 3) {
      if (!workerData.name.trim()) {
        setError('Please enter the worker name.');
        return;
      }
    }
    setCurrentStep((prev) => prev + 1);
  };

  const handlePrev = () => {
    setError('');
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  const handleFinish = async () => {
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization: orgData,
          project: projectData,
          worker: workerData,
          attendance: attendanceData,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to complete setup. Please check your data.');
        setIsLoading(false);
        return;
      }

      router.push('/');
      router.refresh();
    } catch (err) {
      setError('An error occurred during submission. Please try again.');
      setIsLoading(false);
    }
  };

  const steps = [
    { number: 1, title: 'Company Details', icon: <Building2 className="w-4 h-4" /> },
    { number: 2, title: 'First Project', icon: <FolderPlus className="w-4 h-4" /> },
    { number: 3, title: 'First Worker', icon: <UserPlus className="w-4 h-4" /> },
    { number: 4, title: 'Daily Attendance', icon: <CalendarCheck className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-950 py-10 px-4 flex flex-col items-center justify-center">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500 text-slate-950 font-bold mb-1">
            <HardHat className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Organization Setup</h1>
          <p className="text-xs text-slate-400">
            Let&apos;s configure your construction company and initialize your operational records
          </p>
        </div>

        {/* Stepper Bar */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          {steps.map((step) => {
            const isCompleted = currentStep > step.number;
            const isCurrent = currentStep === step.number;
            return (
              <div key={step.number} className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                    isCompleted
                      ? 'bg-emerald-500 text-slate-950'
                      : isCurrent
                      ? 'bg-amber-500 text-slate-950 ring-4 ring-amber-500/20'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : step.number}
                </div>
                <span
                  className={`hidden sm:inline text-xs font-semibold ${
                    isCurrent ? 'text-white' : 'text-slate-500'
                  }`}
                >
                  {step.title}
                </span>
              </div>
            );
          })}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 sm:p-8 shadow-xl backdrop-blur-sm">
          {/* STEP 1: ORGANIZATION */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-fade-in">
              <div className="border-b border-slate-800 pb-3 mb-4">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-amber-500" />
                  Step 1: Company Profile
                </h2>
                <p className="text-xs text-slate-400">Your organization settings and primary contact details</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Company Name"
                  required
                  placeholder="e.g. Apex Civil Contractors"
                  value={orgData.name}
                  onChange={(e) => setOrgData({ ...orgData, name: e.target.value })}
                />
                <Input
                  label="Owner / Managing Director"
                  required
                  placeholder="e.g. Ramesh Chandra"
                  value={orgData.ownerName}
                  onChange={(e) => setOrgData({ ...orgData, ownerName: e.target.value })}
                />
                <Input
                  label="Mobile Number"
                  required
                  type="tel"
                  placeholder="10-digit mobile"
                  value={orgData.mobile}
                  onChange={(e) => setOrgData({ ...orgData, mobile: e.target.value })}
                />
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="billing@company.com"
                  value={orgData.email}
                  onChange={(e) => setOrgData({ ...orgData, email: e.target.value })}
                />
                <Input
                  label="City"
                  placeholder="City"
                  value={orgData.city}
                  onChange={(e) => setOrgData({ ...orgData, city: e.target.value })}
                />
                <Input
                  label="State"
                  placeholder="State"
                  value={orgData.state}
                  onChange={(e) => setOrgData({ ...orgData, state: e.target.value })}
                />
                <Input
                  label="GST Number (Optional)"
                  placeholder="e.g. 07AAAAA0000A1Z5"
                  value={orgData.gstNumber}
                  onChange={(e) => setOrgData({ ...orgData, gstNumber: e.target.value })}
                />
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Currency & Timezone
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={orgData.currency}
                      onChange={(e) => setOrgData({ ...orgData, currency: e.target.value })}
                      className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:border-amber-500"
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                      <option value="AED">AED (AED)</option>
                    </select>
                    <select
                      value={orgData.timezone}
                      onChange={(e) => setOrgData({ ...orgData, timezone: e.target.value })}
                      className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:border-amber-500"
                    >
                      <option value="Asia/Kolkata">Asia/Kolkata</option>
                      <option value="Asia/Dubai">Asia/Dubai</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: FIRST PROJECT */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div className="border-b border-slate-800 pb-3 mb-4">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <FolderPlus className="w-5 h-5 text-amber-500" />
                  Step 2: Create First Project
                </h2>
                <p className="text-xs text-slate-400">Add the active site or construction project you are currently executing</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Project Name"
                  required
                  placeholder="e.g. Sunrise Heights Tower A"
                  value={projectData.name}
                  onChange={(e) => setProjectData({ ...projectData, name: e.target.value })}
                />
                <Input
                  label="Project Code"
                  required
                  placeholder="PRJ-001"
                  value={projectData.projectCode}
                  onChange={(e) => setProjectData({ ...projectData, projectCode: e.target.value })}
                />
                <Input
                  label="Location / Site Address"
                  placeholder="Plot 42, Sector 12"
                  value={projectData.location}
                  onChange={(e) => setProjectData({ ...projectData, location: e.target.value })}
                />
                <Input
                  label="Project Contract Value (₹)"
                  type="number"
                  placeholder="5000000"
                  value={projectData.projectValue}
                  onChange={(e) => setProjectData({ ...projectData, projectValue: Number(e.target.value) })}
                />
                <Input
                  label="Estimated Labour Cost (₹)"
                  type="number"
                  placeholder="1000000"
                  value={projectData.estimatedLabourCost}
                  onChange={(e) => setProjectData({ ...projectData, estimatedLabourCost: Number(e.target.value) })}
                />
                <Input
                  label="Estimated Material Cost (₹)"
                  type="number"
                  placeholder="2000000"
                  value={projectData.estimatedMaterialCost}
                  onChange={(e) => setProjectData({ ...projectData, estimatedMaterialCost: Number(e.target.value) })}
                />
              </div>
            </div>
          )}

          {/* STEP 3: FIRST WORKER */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-fade-in">
              <div className="border-b border-slate-800 pb-3 mb-4">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-amber-500" />
                  Step 3: Add First Worker
                </h2>
                <p className="text-xs text-slate-400">Register a team member, mason, or helper in your worker directory</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Worker Full Name"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={workerData.name}
                  onChange={(e) => setWorkerData({ ...workerData, name: e.target.value })}
                />
                <Input
                  label="Worker Code"
                  required
                  placeholder="WRK-001"
                  value={workerData.workerCode}
                  onChange={(e) => setWorkerData({ ...workerData, workerCode: e.target.value })}
                />
                <Input
                  label="Mobile Number (Optional)"
                  type="tel"
                  placeholder="9876543210"
                  value={workerData.mobile}
                  onChange={(e) => setWorkerData({ ...workerData, mobile: e.target.value })}
                />
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Category / Skill
                  </label>
                  <select
                    value={workerData.category}
                    onChange={(e) => setWorkerData({ ...workerData, category: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:border-amber-500"
                  >
                    <option value="Mason">Mason (Rajmistri)</option>
                    <option value="Helper">Helper (Beldar)</option>
                    <option value="Carpenter">Carpenter (Badhai)</option>
                    <option value="Electrician">Electrician</option>
                    <option value="Plumber">Plumber</option>
                    <option value="Painter">Painter</option>
                    <option value="Flooring Worker">Flooring Worker</option>
                    <option value="Steel Worker">Steel Worker (Fitter)</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <Input
                  label="Daily Wage (₹ / Day)"
                  type="number"
                  required
                  placeholder="800"
                  value={workerData.dailyWage}
                  onChange={(e) => setWorkerData({ ...workerData, dailyWage: Number(e.target.value) })}
                />
              </div>
            </div>
          )}

          {/* STEP 4: FIRST ATTENDANCE */}
          {currentStep === 4 && (
            <div className="space-y-4 animate-fade-in">
              <div className="border-b border-slate-800 pb-3 mb-4">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <CalendarCheck className="w-5 h-5 text-amber-500" />
                  Step 4: Record First Attendance
                </h2>
                <p className="text-xs text-slate-400">Mark today&apos;s site attendance for your registered worker</p>
              </div>

              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 mb-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Project:</span>
                  <span className="text-white font-semibold">{projectData.name}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Worker:</span>
                  <span className="text-white font-semibold">{workerData.name} ({workerData.category})</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Daily Wage:</span>
                  <span className="text-amber-400 font-semibold">₹{workerData.dailyWage} / day</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Attendance Date"
                  type="date"
                  required
                  value={attendanceData.date}
                  onChange={(e) => setAttendanceData({ ...attendanceData, date: e.target.value })}
                />
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Status
                  </label>
                  <select
                    value={attendanceData.status}
                    onChange={(e) => setAttendanceData({ ...attendanceData, status: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:border-amber-500"
                  >
                    <option value="PRESENT">Present (Full Day - 100% Wage)</option>
                    <option value="HALF_DAY">Half Day (50% Wage)</option>
                    <option value="ABSENT">Absent (0 Wage)</option>
                    <option value="LEAVE">Leave</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Stepper Navigation Buttons */}
          <div className="mt-8 flex items-center justify-between border-t border-slate-800 pt-5">
            {currentStep > 1 ? (
              <Button type="button" variant="outline" size="sm" onClick={handlePrev}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            ) : (
              <div />
            )}

            {currentStep < 4 ? (
              <Button type="button" variant="primary" size="md" onClick={handleNext}>
                <span>Next Step</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                size="md"
                isLoading={isLoading}
                onClick={handleFinish}
              >
                <span>Launch Dashboard</span>
                <CheckCircle2 className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
