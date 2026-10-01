'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, MessageSquare } from 'lucide-react';
import { AssistantDrawer } from './AssistantDrawer';

export function AssistantButton({ userRole = 'PARTNER' }: { userRole?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);

  useEffect(() => {
    // Check if assistant is enabled for this company
    fetch('/api/assistant')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.enabled === false) {
          setIsEnabled(false);
        }
      })
      .catch(() => {});
  }, []);

  if (!isEnabled) {
    return null;
  }

  return (
    <>
      {/* Floating Trigger Button: Left-aligned to avoid clash with FAB and Mobile Bottom Nav */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open AI Assistant"
        className="fixed bottom-20 left-4 lg:bottom-8 lg:left-8 z-40 flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-slate-900/95 hover:bg-slate-800 text-amber-400 border border-amber-500/40 shadow-2xl shadow-amber-950/40 hover:scale-105 active:scale-95 transition-all text-xs font-bold backdrop-blur-xs group"
      >
        <div className="relative">
          <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
          <span className="absolute -top-1 -right-1 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
        </div>
        <span className="hidden sm:inline text-slate-100 font-semibold group-hover:text-amber-300">
          AI Assistant
        </span>
      </button>

      {/* Slide-over Assistant Drawer */}
      <AssistantDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        userRole={userRole}
      />
    </>
  );
}
