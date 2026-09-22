import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { MobileNav } from '@/components/layout/MobileNav';
import { FloatingActionButton } from '@/components/layout/FloatingActionButton';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  if (!session.organizationId) {
    redirect('/onboarding');
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      {/* Desktop Sidebar */}
      <Sidebar
        organizationName={session.organizationName}
        userRole={session.role}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-8">
        <Topbar
          userName={session.name}
          userEmail={session.email}
          organizationName={session.organizationName}
          userRole={session.role}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto animate-fade-in">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav />

      {/* Mobile & Desktop Floating Quick Action Button */}
      <FloatingActionButton />
    </div>
  );
}
