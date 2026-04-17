'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendOtp, verifyOtp } from '@/lib/auth';
import { Mail, KeyRound, Shield, ArrowLeft } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await sendOtp(email);
    if (error) {
      setError(error);
    } else {
      setStep('otp');
      setMessage('Check your email for a 6-digit code.');
    }
    setLoading(false);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await verifyOtp(email, otpCode);
    if (error) {
      setError(error);
    } else {
      router.push('/dashboard');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-pl-haze/10 rounded-2xl mb-4">
            <Shield className="w-8 h-8 text-pl-haze" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Offboarding Dashboard</h1>
          <p className="text-gray-500 mt-1">Platinumlist HR Portal</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
          {step === 'email' ? (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Sign in</h2>
              <p className="text-sm text-gray-500 mb-6">
                Enter your Platinumlist email to receive a one-time code.
              </p>

              <form onSubmit={handleSendOtp}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@platinumlist.net"
                      className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-pl-haze/50 focus:border-pl-haze outline-none transition-all text-sm"
                      required
                    />
                  </div>
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-pl-haze text-white rounded-lg font-medium hover:bg-pl-haze/90 disabled:opacity-50 transition-all text-sm"
                >
                  {loading ? 'Sending...' : 'Send Code'}
                </button>
              </form>
            </>
          ) : (
            <>
              <button
                onClick={() => { setStep('email'); setError(null); setOtpCode(''); }}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-pl-haze mb-4 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>

              <h2 className="text-lg font-semibold text-gray-900 mb-1">Enter code</h2>
              <p className="text-sm text-gray-500 mb-6">
                We sent a 6-digit code to <span className="font-medium text-gray-700">{email}</span>
              </p>

              {message && (
                <div className="mb-4 p-3 bg-green-50 border border-green-100 rounded-lg">
                  <p className="text-sm text-green-700">{message}</p>
                </div>
              )}

              <form onSubmit={handleVerifyOtp}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    One-time code
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-pl-haze/50 focus:border-pl-haze outline-none transition-all text-sm text-center tracking-[0.3em] text-lg font-mono"
                      maxLength={6}
                      autoFocus
                      required
                    />
                  </div>
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || otpCode.length !== 6}
                  className="w-full py-3 bg-pl-haze text-white rounded-lg font-medium hover:bg-pl-haze/90 disabled:opacity-50 transition-all text-sm"
                >
                  {loading ? 'Verifying...' : 'Verify & Sign In'}
                </button>

                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={loading}
                  className="w-full mt-3 py-2 text-sm text-gray-500 hover:text-pl-haze transition-colors"
                >
                  Resend code
                </button>
              </form>
            </>
          )}
        </div>

        {/* Role Info */}
        <div className="mt-6 p-4 bg-white/50 rounded-lg border border-gray-100">
          <p className="text-xs text-gray-400 text-center">
            Access is determined by your email. HR team gets full access.
            Managers see their team. Employees see their own tasks.
          </p>
        </div>
      </div>
    </div>
  );
}
