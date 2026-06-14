'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';
import { SocialLoginButtons } from './SocialLoginButtons';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      router.push('/');
      router.refresh();
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-8 rounded-2xl border border-zinc-800 bg-zinc-950/80 backdrop-blur-xl shadow-2xl flex flex-col items-center">
      {/* ZenkaiTV Logo Placeholder / Title */}
      <div className="flex flex-col items-center mb-6">
        <h1 className="text-3xl font-extrabold tracking-wider bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent uppercase">
          ZenkaiTV
        </h1>
        <p className="text-xs text-zinc-500 mt-1">Unlock your ultimate anime vault</p>
      </div>

      <h2 className="text-xl font-bold text-white mb-6">Welcome back!</h2>

      {error && (
        <div className="w-full mb-4 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm text-center">
          {error}
        </div>
      )}

      <form onSubmit={handleLogin} className="w-full flex flex-col gap-4">
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

        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400" htmlFor="password">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-red-500 hover:text-red-400 transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            className="w-full py-2.5 px-4 rounded-xl border border-zinc-800 bg-zinc-900/60 focus:bg-zinc-900 focus:border-red-500 text-white placeholder-zinc-600 focus:outline-none transition-all duration-300"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-bold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-900/20 mt-2"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Authenticating...
            </span>
          ) : (
            'Log In'
          )}
        </button>
      </form>

      <div className="w-full flex items-center justify-between my-6">
        <span className="w-1/5 border-t border-zinc-800" />
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">or</span>
        <span className="w-1/5 border-t border-zinc-800" />
      </div>

      <SocialLoginButtons onError={(msg) => setError(msg)} />

      <p className="text-sm text-zinc-500 mt-6">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-red-500 hover:text-red-400 font-semibold transition-colors">
          Sign up
        </Link>
      </p>
    </div>
  );
}
