'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'md',
  size,
  closeOnBackdropClick = false,
  closeOnEscape = false,
}: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const [isLockedPulse, setIsLockedPulse] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (closeOnEscape) {
          onClose();
        } else {
          // Trigger subtle visual pulse indicating modal is locked
          setIsLockedPulse(true);
          const t = setTimeout(() => setIsLockedPulse(false), 250);
          return () => clearTimeout(t);
        }
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, closeOnEscape]);

  if (!isOpen || !mounted) return null;

  const effectiveWidth = size || maxWidth;
  const widthClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  }[effectiveWidth];

  const handleBackdropClick = (e: React.MouseEvent) => {
    // Only intercept when clicking directly on the backdrop area outside the modal
    if (e.target === e.currentTarget) {
      if (closeOnBackdropClick) {
        onClose();
      } else {
        // Trigger subtle visual pulse indicating modal is locked in place
        setIsLockedPulse(true);
        setTimeout(() => setIsLockedPulse(false), 250);
      }
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto"
      onClick={handleBackdropClick}
    >
      <div
        className={`relative w-full ${widthClass} max-h-[85vh] sm:max-h-[88vh] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl transition-all duration-200 overflow-hidden my-auto shrink-0 ${
          isLockedPulse
            ? 'scale-[1.015] ring-2 ring-amber-500/60 shadow-amber-500/20'
            : 'scale-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 p-4 sm:p-5 shrink-0 bg-white dark:bg-slate-900 z-10">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
            {description && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0 overscroll-contain">{children}</div>

        {footer && (
          <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3 sm:p-4 flex justify-end gap-3 shrink-0 z-10">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
