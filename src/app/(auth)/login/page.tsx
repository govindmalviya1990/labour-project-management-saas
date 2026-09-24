'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HardHat, Lock, Mail, ArrowRight, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to login. Please check your credentials.');
        setIsLoading(false);
        return;
      }

      if (data.hasOrganization) {
        router.push('/');
      } else {
        router.push('/onboarding');
      }
      router.refresh();
    } catch (err) {
      setError('A network error occurred. Please check your connection.');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-radial from-slate-900 to-slate-950">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/20 mb-2">
            <HardHat className="w-8 h-8 stroke-[2.2]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Sign in to your account</h1>
          <p className="text-xs text-slate-400">
            Labour & Project Management SaaS for Construction Contractors
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-xl">
          {error && (
            <div className="mb-5 flex items-center gap-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email address"
              type="email"
              required
              placeholder="contractor@modernway.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4" />}
            />

            <Input
              label="Password"
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="w-4 h-4" />}
            />

            <Button
              type="submit"
              variant="primary"
              className="w-full mt-2"
              size="lg"
              isLoading={isLoading}
            >
              <span>Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          {/* Quick Worker Self-Service Passbook Portal */}
          <div className="mt-5 pt-4 border-t border-slate-800 text-center space-y-2">
            <p className="text-[11px] text-slate-400">
              क्या आप साइट मज़दूर या कारीगर हैं? (Field Worker?)
            </p>
            <Link
              href="/worker-portal"
              className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-cyan-950/70 hover:bg-cyan-900/60 border border-cyan-500/40 text-cyan-300 font-bold text-xs transition-all shadow-md shadow-cyan-950/40"
            >
              <HardHat className="w-4 h-4 text-cyan-400" />
              <span>मज़दूर हाजिरी व पासबुक (बिना पासवर्ड के रिपोर्ट देखें)</span>
            </Link>
          </div>

          <div className="mt-4 border-t border-slate-800/80 pt-4 text-center text-xs text-slate-400">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="font-semibold text-amber-400 hover:text-amber-300">
              Register company
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
