'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Bell,
  LogOut,
  User,
  Calendar,
  Building2,
  HardHat,
  Sun,
  Moon,
} from 'lucide-react';
import { useTheme } from '@/lib/theme/ThemeContext';

interface TopbarProps {
  userName?: string;
  userEmail?: string;
  organizationName?: string;
  userRole?: string;
  selectedDateFilter?: string;
  onDateFilterChange?: (filter: string) => void;
}

export function Topbar({
  userName = 'User',
  userEmail,
  organizationName = 'Modern Way Civil',
  userRole = 'OWNER',
  selectedDateFilter = 'today',
  onDateFilterChange,
}: TopbarProps) {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-800 bg-slate-950/90 px-4 backdrop-blur-md lg:px-6">
      {/* Mobile Branding */}
      <div className="flex items-center gap-2 lg:hidden">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-slate-950 font-bold">
          <HardHat className="w-4 h-4" />
        </div>
        <span className="text-xs font-bold text-white tracking-tight truncate max-w-[150px]">
          Modern Way Civil Solution
        </span>
      </div>

      {/* Global Search Bar (Desktop) */}
      <form onSubmit={handleSearchSubmit} className="hidden md:flex items-center w-80">
        <div className="relative w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search projects, workers, materials..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 pl-9 pr-4 py-1.5 rounded-lg text-xs focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 placeholder:text-slate-500 transition-colors"
          />
        </div>
      </form>

      {/* Right Controls: Filters, Notifications, Profile */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Dark / Light Mode Toggle Button */}
        <button
          type="button"
          onClick={toggleTheme}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-900 hover:text-amber-400 transition-colors border border-slate-800"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-amber-500" />
          )}
        </button>

        {/* Date Filter Dropdown */}
        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-lg text-xs text-slate-300">
          <Calendar className="w-3.5 h-3.5 text-amber-400" />
          <select
            value={selectedDateFilter}
            onChange={(e) => onDateFilterChange?.(e.target.value)}
            className="bg-transparent border-none text-slate-200 text-xs focus:outline-none cursor-pointer"
          >
            <option value="today" className="bg-slate-900">Today</option>
            <option value="week" className="bg-slate-900">This Week</option>
            <option value="month" className="bg-slate-900">This Month</option>
            <option value="custom" className="bg-slate-900">Custom Range</option>
          </select>
        </div>

        {/* Notifications Icon with Badge */}
        <button
          type="button"
          onClick={() => router.push('/notifications')}
          className="relative rounded-lg p-2 text-slate-400 hover:bg-slate-900 hover:text-white transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
        </button>

        {/* User Profile Trigger */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-slate-900 transition-colors border border-transparent hover:border-slate-800"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-amber-400 font-semibold text-xs border border-slate-700">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="hidden lg:block text-left">
              <p className="text-xs font-semibold text-white leading-tight">{userName}</p>
              <p className="text-[10px] text-slate-400 capitalize">{userRole.toLowerCase()}</p>
            </div>
          </button>

          {/* User Dropdown Menu */}
          {showUserMenu && (
            <div
              className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-800 bg-slate-900 p-2 shadow-2xl z-50 animate-fade-in"
              onClick={() => setShowUserMenu(false)}
            >
              <div className="px-3 py-2 border-b border-slate-800 mb-1">
                <p className="text-xs font-semibold text-white">{userName}</p>
                {userEmail && <p className="text-[11px] text-slate-400 truncate">{userEmail}</p>}
                <span className="inline-block mt-1 text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20 uppercase font-medium">
                  {userRole}
                </span>
              </div>

              <button
                type="button"
                onClick={() => router.push('/settings')}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <Building2 className="w-4 h-4 text-slate-400" />
                <span>Organization Settings</span>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors mt-1"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
