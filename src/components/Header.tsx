'use client';

import { RefreshCw, BarChart3, LogOut, Shield, User, Users } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from './AuthProvider';
import { signOut } from '@/lib/auth';
import { useRouter } from 'next/navigation';

const roleBadgeStyles: Record<string, string> = {
  HR: 'bg-pl-haze/20 text-pl-haze border-pl-haze/30',
  Manager: 'bg-amber-100 text-amber-700 border-amber-200',
  Employee: 'bg-green-100 text-green-700 border-green-200',
};

const roleIcons: Record<string, React.ReactNode> = {
  HR: <Shield className="w-3 h-3" />,
  Manager: <Users className="w-3 h-3" />,
  Employee: <User className="w-3 h-3" />,
};

export default function Header({ onRefresh }: { onRefresh?: () => void }) {
  const [syncing, setSyncing] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch('/api/sync', { method: 'POST' });
      onRefresh?.();
    } catch (e) {
      console.error('Sync failed:', e);
    } finally {
      setSyncing(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <header className="bg-pl-sabbath sticky top-0 z-10 shadow-lg shadow-pl-sabbath/20">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-pl-haze flex items-center justify-center">
            <span className="text-white font-bold text-lg">P</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Offboarding Dashboard</h1>
            <p className="text-sm text-pl-monday/70">
              Platinumlist Â· Track and manage employee offboarding
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* User info & role badge */}
          {user && (
            <div className="flex items-center gap-2 mr-2">
              {user.role && (
                <span className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium border rounded-full ${roleBadgeStyles[user.role] || ''}`}>
                  {roleIcons[user.role]}
                  {user.role}
                </span>
              )}
              <span className="text-xs text-pl-monday/60 hidden sm:inline">
                {user.email}
              </span>
            </div>
          )}

          <Link
            href="/stats"
            className="flex items-center gap-2 px-4 py-2 text-pl-monday/70 hover:text-white rounded-lg text-sm font-medium transition-colors"
          >
            <BarChart3 className="w-4 h-4" />
            Analytics
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-4 py-2 text-pl-monday/70 hover:text-white rounded-lg text-sm font-medium transition-colors"
          >
            Dashboard
          </Link>

          {/* Sync button only for HR */}
          {user?.role === 'HR' && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 bg-pl-haze text-white rounded-lg text-sm font-medium hover:bg-pl-haze/90 transition-colors shadow-md shadow-pl-haze/30 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync & Refresh'}
            </button>
          )}

          {/* Sign out */}
          {user && (
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-3 py-2 text-pl-monday/60 hover:text-white rounded-lg text-sm transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
