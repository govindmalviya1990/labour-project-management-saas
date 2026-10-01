'use client';

import React from 'react';
import { Bot, Sparkles } from 'lucide-react';

interface AssistantAvatarProps {
  size?: number | 'sm' | 'md' | 'lg' | 'xl';
  isTyping?: boolean;
  isListening?: boolean;
  className?: string;
}

export function AssistantAvatar({
  size = 'md',
  isTyping = false,
  isListening = false,
  className = '',
}: AssistantAvatarProps) {
  // Size mapping in pixels
  let dimension = 40;
  if (typeof size === 'number') {
    dimension = size;
  } else {
    switch (size) {
      case 'sm':
        dimension = 28;
        break;
      case 'md':
        dimension = 40;
        break;
      case 'lg':
        dimension = 50;
        break;
      case 'xl':
        dimension = 64;
        break;
    }
  }

  const isAnimated = isTyping || isListening;

  return (
    <div
      style={{ width: dimension, height: dimension }}
      className={`relative shrink-0 select-none rounded-full overflow-hidden ${
        isAnimated ? 'ring-2 ring-amber-400/80 ring-offset-2 ring-offset-slate-900 animate-pulse' : ''
      } ${className}`}
    >
      {/* Original SVG Avatar: Customer Support Girl with Headset & Mic in Black-and-Cream Doodle Style */}
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full object-cover transition-transform duration-200"
      >
        {/* Circular Base / Background in Warm Cream */}
        <circle cx="50" cy="50" r="48" fill="#FFFDF7" stroke="#1E293B" strokeWidth="3" />

        {/* Neck & Collar */}
        <path d="M46 64 L46 72 L54 72 L54 64 Z" fill="#FFE5D0" stroke="#1E293B" strokeWidth="2.5" strokeLinejoin="round" />
        {/* Blouse / Shoulders */}
        <path d="M26 88 C26 76 36 71 44 71 L56 71 C64 71 74 76 74 88" fill="#1E293B" stroke="#1E293B" strokeWidth="2.5" />
        <path d="M44 71 L50 79 L56 71" fill="#FFFDF7" stroke="#1E293B" strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx="50" cy="82" r="1.5" fill="#F59E0B" />

        {/* Hair Back */}
        <path d="M28 46 C26 58 27 68 35 72 C33 63 32 54 32 46 Z" fill="#1E293B" />
        <path d="M72 46 C74 58 73 68 65 72 C67 63 68 54 68 46 Z" fill="#1E293B" />

        {/* Face Head */}
        <rect x="33" y="32" width="34" height="34" rx="17" fill="#FFE5D0" stroke="#1E293B" strokeWidth="2.5" />

        {/* Cute Bangs / Front Hair */}
        <path d="M33 42 C36 32 45 28 50 32 C55 28 64 32 67 42 C63 37 57 37 51 39 C46 37 38 37 33 42 Z" fill="#1E293B" />

        {/* Eyes: Cute smiling arches */}
        <path d="M40 48 Q44 52 47 48" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M53 48 Q56 52 60 48" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" fill="none" />

        {/* Sweet Cheeks (Blush) */}
        <circle cx="38" cy="53" r="3" fill="#FCA5A5" opacity="0.6" />
        <circle cx="62" cy="53" r="3" fill="#FCA5A5" opacity="0.6" />

        {/* Cute Smile */}
        <path d="M46 56 Q50 60 54 56" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" fill="none" />

        {/* Headset: Over-head band */}
        <path d="M32 44 C32 23 68 23 68 44" stroke="#1E293B" strokeWidth="3" strokeLinecap="round" fill="none" />
        {/* Headset Cushion Accent Top */}
        <path d="M44 26 C47 24.5 53 24.5 56 26" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" fill="none" />

        {/* Left Ear Cushion (Headset) */}
        <rect x="28" y="40" width="6" height="12" rx="3" fill="#F59E0B" stroke="#1E293B" strokeWidth="2" />

        {/* Right Ear Cushion (Headset) */}
        <rect x="66" y="40" width="6" height="12" rx="3" fill="#F59E0B" stroke="#1E293B" strokeWidth="2" />

        {/* Microphone Boom extending to mouth */}
        <path d="M68 49 C68 62 57 63 54 62" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" fill="none" />
        {/* Microphone Tip with amber glow */}
        <circle cx="53" cy="62" r="2.5" fill="#F59E0B" stroke="#1E293B" strokeWidth="1.5" />
      </svg>

      {/* Subtle active status pulse dot */}
      {isAnimated && (
        <span className="absolute bottom-0 right-0 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500 border border-slate-900"></span>
        </span>
      )}
    </div>
  );
}
