'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, MessageSquare } from 'lucide-react';
import { AssistantDrawer } from './AssistantDrawer';
import { AssistantAvatar } from './AssistantAvatar';

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
      {/* 
        Floating Trigger Button: 
        Positioned on bottom-right vertically stacked directly above the Quick Action (+) FAB:
        - Mobile: FAB is bottom-20 (80px) + h-14 (56px) + 14px gap = bottom-[150px], right-4
        - Desktop: FAB is lg:bottom-8 (32px) + h-14 (56px) + 14px gap = lg:bottom-[102px], lg:right-8
        - Clean vertical alignment, zero overlap, touch target 56x56px (min 48px)
      */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open AI Assistant"
        className="fixed bottom-[150px] right-4 lg:bottom-[102px] lg:right-8 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-slate-950 border-2 border-amber-500/60 shadow-2xl shadow-slate-950/80 hover:border-amber-400 hover:scale-105 active:scale-95 transition-all focus:outline-none focus:ring-4 focus:ring-amber-500/30 group"
      >
        <AssistantAvatar
          size={50}
          className="transition-transform group-hover:scale-105"
        />

        {/* Online / Active pulse dot indicator */}
        <span className="absolute top-0 right-0 flex h-3.5 w-3.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500 border-2 border-slate-950"></span>
        </span>
      </button>

      {/* Slide-over Assistant Drawer from Right */}
      <AssistantDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        userRole={userRole}
      />
    </>
  );
}
