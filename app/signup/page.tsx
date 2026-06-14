import React from 'react';
import { SignupForm } from '../../components/auth/SignupForm';

export default function SignupPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-black px-4 py-12">
      <SignupForm />
    </div>
  );
}
