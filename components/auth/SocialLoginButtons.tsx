'use client';

import React, { useState } from 'react';
import { createClient } from '../../lib/supabase/client';

interface SocialLoginButtonsProps {
  onSuccess?: () => void;
  onError?: (message: string) => void;
}

export function SocialLoginButtons({ onSuccess, onError }: SocialLoginButtonsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const supabase = createClient();

  const handleSocialLogin = async (provider: 'google' | 'facebook') => {
    try {
      setLoading(provider);
      const redirectTo = `${window.location.origin}/auth/callback`;
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
        },
      });

      if (error) throw error;
      
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error(`${provider} sign in failed:`, err);
      const msg = err.message || `Could not authenticate with ${provider}.`;
      if (onError) onError(msg);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Continue with Google */}
      <button
        onClick={() => handleSocialLogin('google')}
        disabled={loading !== null}
        className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-zinc-800 bg-zinc-950/60 hover:bg-zinc-900 hover:border-red-500 text-white font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
      >
        {loading === 'google' ? (
          <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              fill="#EA4335"
            />
          </svg>
        )}
        <span>Continue with Google</span>
      </button>

      {/* Continue with Facebook */}
      <button
        onClick={() => handleSocialLogin('facebook')}
        disabled={loading !== null}
        className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-zinc-800 bg-zinc-950/60 hover:bg-zinc-900 hover:border-red-500 text-white font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
      >
        {loading === 'facebook' ? (
          <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          <svg className="h-5 w-5 fill-[#1877F2]" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
        )}
        <span>Continue with Facebook</span>
      </button>
    </div>
  );
}
