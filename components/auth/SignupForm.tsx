'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { createClient } from '../../lib/supabase/client';
import { SocialLoginButtons } from './SocialLoginButtons';

export function SignupForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) throw signUpError;

      setSuccess(true);
    } catch (err: any) {
      console.error('Signup error:', err);
      setError(err.message || 'Could not register user.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-8 rounded-2xl border border-zinc-800 bg-zinc-950/80 backdrop-blur-xl shadow-2xl flex flex-col items-center">
      <div className="flex flex-col items-center mb-6">
        <h1 className="text-3xl font-extrabold tracking-wider bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent uppercase">
          ZenkaiTV
        </h1>
        <p className="text-xs text-zinc-500 mt-1">Join the ultimate anime streaming platform</p>
      </div>

      <h2 className="text-xl font-bold text-white mb-6">Create Account</h2>

      {error && (
        <div className="w-full mb-4 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm text-center">
          {error}
        </div>
      )}

      {success ? (
        <div className="w-full p-4 rounded-lg border border-green-500/30 bg-green-500/10 text-green-400 text-sm text-center">
          Registration successful! Please check your email inbox to verify your account.
          <Link href="/login" className="block mt-4 text-white underline font-semibold">
            Proceed to Login
          </Link>
        </div>
      ) : (
        <>
          <form onSubmit={handleSignup} className="w-full flex flex-col gap-4">
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
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5" htmlFor="password">
                Password
              </label>
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

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5" htmlFor="confirmPassword">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
                  Registering...
                </span>
              ) : (
                'Sign Up'
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
            Already have an account?{' '}
            <Link href="/login" className="text-red-500 hover:text-red-400 font-semibold transition-colors">
              Log in
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
