'use client';

import React, { useState } from 'react';
import { Bot, Sparkles } from 'lucide-react';

interface AssistantAvatarProps {
  size?: number | 'sm' | 'md' | 'lg' | 'xl';
  isTyping?: boolean;
  isListening?: boolean;
  className?: string;
  showFallbackOnHover?: boolean;
}

export function AssistantAvatar({
  size = 'md',
  isTyping = false,
  isListening = false,
  className = '',
}: AssistantAvatarProps) {
  const [hasError, setHasError] = useState(false);

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
        dimension = 52;
        break;
      case 'xl':
        dimension = 64;
        break;
    }
  }

  const isAnimated = isTyping || isListening;

  if (hasError) {
    return (
      <div
        style={{ width: dimension, height: dimension }}
        className={`rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 ${className}`}
      >
        <Sparkles className="w-1/2 h-1/2" />
      </div>
    );
  }

  return (
    <div
      style={{ width: dimension, height: dimension }}
      className={`relative shrink-0 select-none rounded-full overflow-hidden ${
        isAnimated ? 'ring-2 ring-amber-400/80 ring-offset-2 ring-offset-slate-900 animate-pulse' : ''
      } ${className}`}
    >
      <img
        src="/assistant-avatar.svg"
        alt="AI Assistant"
        onError={() => setHasError(true)}
        className="w-full h-full object-cover transition-transform duration-200"
        loading="eager"
      />

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
