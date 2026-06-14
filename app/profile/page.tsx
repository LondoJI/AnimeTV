'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.push('/login');
        return;
      }
      setUser(session.user);
      
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (data) {
        setProfile(data);
        setUsername(data.username || '');
      }
      setLoading(false);
    };

    checkUser();
  }, [router]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setUpdating(true);

    try {
      const { error: updateError } = await supabase
        .from('user_profiles')
        .upsert({
          id: user.id,
          username,
          avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
        });

      if (updateError) throw updateError;

      setMessage('Profile updated successfully!');
    } catch (err: any) {
      console.error('Update profile error:', err);
      setError(err.message || 'Could not update profile.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-zinc-950 text-white">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-red-500" />
      </div>
    );
  }

  const avatar = profile?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture || '/logo-round-192.png';

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-black px-4 py-12 text-white">
      <div className="w-full max-w-md p-8 rounded-2xl border border-zinc-800 bg-zinc-950/80 backdrop-blur-xl shadow-2xl flex flex-col items-center">
        <div className="relative mb-6">
          <img src={avatar} alt="Avatar" className="w-24 h-24 rounded-full border-2 border-red-500 object-cover" />
        </div>

        <h1 className="text-2xl font-bold mb-2">User Profile</h1>
        <p className="text-sm text-zinc-500 mb-6">{user.email}</p>

        {error && (
          <div className="w-full mb-4 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {message && (
          <div className="w-full mb-4 p-3 rounded-lg border border-green-500/30 bg-green-500/10 text-green-400 text-sm text-center">
            {message}
          </div>
        )}

        <form onSubmit={handleUpdateProfile} className="w-full flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="Your display name"
              className="w-full py-2.5 px-4 rounded-xl border border-zinc-800 bg-zinc-900/60 focus:bg-zinc-900 focus:border-red-500 text-white focus:outline-none transition-all duration-300"
            />
          </div>

          <button
            type="submit"
            disabled={updating}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-bold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
          >
            {updating ? 'Saving...' : 'Save Profile'}
          </button>
        </form>

        <button
          onClick={() => router.push('/')}
          className="mt-6 text-sm text-zinc-500 hover:text-white transition-colors"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}
