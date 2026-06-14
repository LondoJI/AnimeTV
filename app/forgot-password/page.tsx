'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { createClient } from '../../lib/supabase/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/profile`,
      });

      if (resetError) throw resetError;

      setSuccess(true);
    } catch (err: any) {
      console.error('Reset error:', err);
      setError(err.message || 'Could not send reset link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-black px-4 py-12">
      <div className="w-full max-w-md p-8 rounded-2xl border border-zinc-800 bg-zinc-950/80 backdrop-blur-xl shadow-2xl flex flex-col items-center">
        <div className="flex flex-col items-center mb-6">
          <h1 className="text-3xl font-extrabold tracking-wider bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent uppercase">
            ZenkaiTV
          </h1>
          <p className="text-xs text-zinc-500 mt-1">Recover account access</p>
        </div>

        <h2 className="text-xl font-bold text-white mb-6">Reset Password</h2>

        {error && (
          <div className="w-full mb-4 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {success ? (
          <div className="w-full p-4 rounded-lg border border-green-500/30 bg-green-500/10 text-green-400 text-sm text-center">
            Password reset link sent! Check your inbox.
            <Link href="/login" className="block mt-4 text-white underline font-semibold">
              Back to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleReset} className="w-full flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5" htmlFor="email">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="goku@zenkai.com"
                className="w-full py-2.5 px-4 rounded-xl border border-zinc-800 bg-zinc-900/60 focus:bg-zinc-900 focus:border-red-500 text-white placeholder-zinc-600 focus:outline-none transition-all duration-300"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-bold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-900/20 mt-2"
            >
              {loading ? 'Sending link...' : 'Send Reset Link'}
            </button>

            <Link href="/login" className="text-sm text-zinc-500 hover:text-white text-center mt-4 transition-colors">
              Back to Login
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
