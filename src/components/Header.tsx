'use client';

import { RefreshCw, BarChart3, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function Header({ onRefresh }: { onRefresh?: () => void }) {
  const [syncing, setSyncing] = useState(false);

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
              Platinumlist · Track and manage employee offboarding
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
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
            <LogOut className="w-4 h-4" />
            Dashboard
          </Link>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-pl-haze text-white rounded-lg text-sm font-medium hover:bg-pl-haze/90 transition-colors shadow-md shadow-pl-haze/30 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync & Refresh'}
          </button>
        </div>
      </div>
    </header>
  );
}
