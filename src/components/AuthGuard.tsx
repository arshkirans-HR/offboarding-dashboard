'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { Clock } from 'lucide-react';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Clock className="w-8 h-8 text-pl-haze animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  if (!user.role) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 max-w-md text-center">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">?</span>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">No Access</h2>
          <p className="text-sm text-gray-500 mb-4">
            Your email (<strong>{user.email}</strong>) is not associated with any active offboarding record.
            Please contact HR if you believe this is an error.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="px-4 py-2 bg-pl-haze text-white rounded-xl text-sm font-medium hover:bg-pl-haze/90 transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
