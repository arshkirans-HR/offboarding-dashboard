'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithMagicLink, supabaseAuth } from '@/lib/auth';
import { Mail, ArrowRight, CheckCircle2, AlertCircle, Shield } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  // If already logged in, redirect to dashboard
  useEffect(() => {
    supabaseAuth.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        router.replace('/dashboard');
      }
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: signInError } = await signInWithMagicLink(email);

    if (signInError) {
      setError(signInError);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-pl-sabbath flex items-center justify-center mx-auto mb-4 shadow-lg shadow-pl-sabbath/20">
            <span className="text-white font-bold text-2xl">P</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Offboarding Dashboard</h1>
          <p className="text-gray-500 mt-1">Platinumlist HR Portal</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          {sent ? (
            /* Success state */
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7 text-green-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Check your email</h2>
              <p className="text-gray-500 text-sm mb-4">
                We sent a magic link to <strong className="text-gray-700">{email}</strong>.
                Click the link in the email to sign in.
              </p>
              <p className="text-xs text-gray-400">
                Didn&apos;t receive it? Check your spam folder or{' '}
                <button
                  onClick={() => { setSent(false); setEmail(''); }}
                  className="text-pl-haze hover:underline"
                >
                  try again
                </button>
              </p>
            </div>
          ) : (
            /* Login form */
            <>
              <div className="flex items-center gap-2 mb-6">
                <Shield className="w-5 h-5 text-pl-haze" />
                <h2 className="text-lg font-semibold text-gray-900">Sign in with email</h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Work email address
                  </label>
                  <div className="relative">
                    <Mail className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@platinumlist.net"
                      required
                      className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pl-haze/30 focus:border-pl-haze transition-colors"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Only @platinumlist.net emails are accepted</p>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-pl-haze text-white rounded-xl text-sm font-medium hover:bg-pl-haze/90 transition-colors shadow-md shadow-pl-haze/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    'Sending...'
                  ) : (
                    <>
                      Send Magic Link
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        {/* Role info */}
        <div className="mt-6 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Access levels</h3>
          <div className="space-y-2 text-xs text-gray-500">
            <div className="flex items-start gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 mt-1 shrink-0" />
              <span><strong className="text-gray-700">Employee</strong> â View and complete your own offboarding tasks</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 mt-1 shrink-0" />
              <span><strong className="text-gray-700">Manager</strong> â Track your reports&apos; offboarding + complete manager tasks</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-2 h-2 rounded-full bg-pl-haze mt-1 shrink-0" />
              <span><strong className="text-gray-700">HR</strong> â Full access to all employees and tasks</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
