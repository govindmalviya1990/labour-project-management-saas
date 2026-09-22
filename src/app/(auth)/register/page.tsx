'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HardHat, Lock, Mail, User, Phone, ArrowRight, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, mobile, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create account.');
        setIsLoading(false);
        return;
      }

      router.push('/onboarding');
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
          <h1 className="text-2xl font-bold tracking-tight text-white">Create your SaaS account</h1>
          <p className="text-xs text-slate-400">
            Start managing projects, daily attendance, workers, materials, and finances
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
              label="Full Name / Owner Name"
              type="text"
              required
              placeholder="e.g. Ramesh Chandra"
              value={name}
              onChange={(e) => setName(e.target.value)}
              leftIcon={<User className="w-4 h-4" />}
            />

            <Input
              label="Work Email Address"
              type="email"
              required
              placeholder="ramesh@modernway.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4" />}
            />

            <Input
              label="Mobile Number"
              type="tel"
              placeholder="+91 98765 43210"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              leftIcon={<Phone className="w-4 h-4" />}
            />

            <Input
              label="Create Password"
              type="password"
              required
              placeholder="At least 6 characters"
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
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          <div className="mt-6 border-t border-slate-800 pt-5 text-center text-xs text-slate-400">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-amber-400 hover:text-amber-300">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
