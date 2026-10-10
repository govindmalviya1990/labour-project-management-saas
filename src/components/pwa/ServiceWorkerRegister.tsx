'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[MWCS PWA] Service worker registered successfully:', reg.scope);
        })
        .catch((err) => {
          console.warn('[MWCS PWA] Service worker registration failed:', err);
        });
    }
  }, []);

  return null;
}
