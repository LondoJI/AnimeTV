'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';

export function UserMenu() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id);
      }
    };

    const fetchProfile = async (userId: string) => {
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (data) setProfile(data);
    };

    fetchSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user);
          fetchProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setDropdownOpen(false);
    router.push('/login');
    router.refresh();
  };

  if (!user) {
    return (
      <Link
        href="/login"
        className="py-2 px-5 rounded-xl border border-zinc-800 bg-zinc-950/60 hover:bg-zinc-900 hover:border-red-500 text-white font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-red-500"
      >
        Login
      </Link>
    );
  }

  const avatar = profile?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture || '/logo-round-192.png';
  const username = profile?.username || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-red-500 rounded-full p-0.5 transition-transform hover:scale-105 active:scale-95"
      >
        <img
          src={avatar}
          alt={username}
          className="h-10 w-10 rounded-full border border-red-500 object-cover"
        />
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-xl border border-zinc-800 bg-zinc-950/95 backdrop-blur-xl shadow-2xl py-2 z-50 text-white">
          <div className="px-4 py-2 border-b border-zinc-900 mb-1">
            <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Signed in as</p>
            <p className="text-sm font-bold truncate">{username}</p>
          </div>
          <Link
            href="/profile"
            onClick={() => setDropdownOpen(false)}
            className="block px-4 py-2 text-sm hover:bg-red-500/10 hover:text-red-500 transition-colors"
          >
            Profile
          </Link>
          <Link
            href="/favorites"
            onClick={() => setDropdownOpen(false)}
            className="block px-4 py-2 text-sm hover:bg-red-500/10 hover:text-red-500 transition-colors"
          >
            Favorites
          </Link>
          <Link
            href="/history"
            onClick={() => setDropdownOpen(false)}
            className="block px-4 py-2 text-sm hover:bg-red-500/10 hover:text-red-500 transition-colors"
          >
            Watch History
          </Link>
          <Link
            href="/settings"
            onClick={() => setDropdownOpen(false)}
            className="block px-4 py-2 text-sm hover:bg-red-500/10 hover:text-red-500 transition-colors"
          >
            Settings
          </Link>
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 text-sm hover:bg-red-500/10 hover:text-red-500 border-t border-zinc-900 mt-1 transition-colors"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
