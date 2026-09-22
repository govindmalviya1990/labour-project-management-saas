'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Bell,
  AlertTriangle,
  Package,
  TrendingDown,
  CheckCircle2,
  Clock,
  ArrowRight,
  Check,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD' | 'LOW_STOCK' | 'BUDGET_EXCEEDED'>('ALL');
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAllRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllAsRead: true }),
      });
      fetchNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  const markSingleRead = async (id: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      fetchNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = notifications.filter((n) => {
    if (filter === 'UNREAD') return !n.isRead;
    if (filter === 'LOW_STOCK') return n.type === 'LOW_STOCK';
    if (filter === 'BUDGET_EXCEEDED') return n.type === 'BUDGET_EXCEEDED';
    return true;
  });

  return (
    <div className="space-y-6 pb-20 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-100 flex items-center gap-2.5">
            <Bell className="w-7 h-7 text-amber-500" />
            Notifications & System Alerts
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time material shortages, budget thresholds, attendance reminders and payment approvals
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            onClick={markAllRead}
            variant="outline"
            className="text-xs border-slate-700 text-slate-300 hover:bg-slate-800 self-start sm:self-auto"
          >
            <Check className="w-4 h-4 mr-1.5" />
            Mark All as Read
          </Button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto text-xs">
        <button
          onClick={() => setFilter('ALL')}
          className={`px-3 py-1.5 rounded-lg font-bold transition ${
            filter === 'ALL'
              ? 'bg-amber-500 text-slate-950'
              : 'text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800'
          }`}
        >
          All Alerts ({notifications.length})
        </button>

        <button
          onClick={() => setFilter('UNREAD')}
          className={`px-3 py-1.5 rounded-lg font-bold transition ${
            filter === 'UNREAD'
              ? 'bg-amber-500 text-slate-950'
              : 'text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800'
          }`}
        >
          Unread ({unreadCount})
        </button>

        <button
          onClick={() => setFilter('LOW_STOCK')}
          className={`px-3 py-1.5 rounded-lg font-bold transition ${
            filter === 'LOW_STOCK'
              ? 'bg-rose-500 text-white'
              : 'text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800'
          }`}
        >
          Inventory Warnings
        </button>

        <button
          onClick={() => setFilter('BUDGET_EXCEEDED')}
          className={`px-3 py-1.5 rounded-lg font-bold transition ${
            filter === 'BUDGET_EXCEEDED'
              ? 'bg-indigo-500 text-white'
              : 'text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800'
          }`}
        >
          Budget Overruns
        </button>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="p-10 text-center text-slate-500">Checking system alerts...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-xl">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <div className="text-base font-bold text-slate-200">All clear! No alerts.</div>
            <p className="text-xs text-slate-500 mt-1">
              There are no pending warnings or unread notifications at this time.
            </p>
          </div>
        ) : (
          filtered.map((item) => {
            const isLowStock = item.type === 'LOW_STOCK';
            const isBudget = item.type === 'BUDGET_EXCEEDED';

            return (
              <div
                key={item.id}
                className={`p-4 rounded-xl border transition flex items-start justify-between gap-4 ${
                  !item.isRead
                    ? 'bg-slate-900/90 border-slate-700 shadow-sm'
                    : 'bg-slate-950/60 border-slate-800/80 opacity-75'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`p-2.5 rounded-xl shrink-0 ${
                      isLowStock
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : isBudget
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    }`}
                  >
                    {isLowStock ? (
                      <AlertTriangle className="w-5 h-5" />
                    ) : isBudget ? (
                      <TrendingDown className="w-5 h-5" />
                    ) : (
                      <Bell className="w-5 h-5" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-100">{item.title}</h3>
                      {!item.isRead && (
                        <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{item.message}</p>
                    <div className="flex items-center gap-3 mt-2.5">
                      <span className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(item.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>

                      {item.link && (
                        <Link
                          href={item.link}
                          className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1"
                        >
                          View Details <ArrowRight className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>

                {!item.isRead && (
                  <button
                    title="Mark as read"
                    onClick={() => markSingleRead(item.id)}
                    className="text-slate-500 hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-800 transition"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
