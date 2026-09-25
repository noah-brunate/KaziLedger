'use client';

import { useState } from 'react';
import Link from '@/components/static-link';
import { ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { BackButton } from '@/components/back-button';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { useLocationSearch } from '@/lib/browser-location';
import { supabase } from '@/lib/supabase';

type Role = 'client' | 'expert' | 'admin';

export default function LoginPage() {
  const search = useLocationSearch();
  const searchParams = new URLSearchParams(search ?? '');
  const resetRequested = searchParams.get('reset') === '1';
  const recovery = searchParams.get('recovery') === '1';
  const passwordUpdated = searchParams.get('passwordUpdated') === '1';
  const confirmed = searchParams.get('confirmed') === '1';
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      if (resetRequested) {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          email.trim().toLowerCase(),
          { redirectTo: `${window.location.origin}/login?recovery=1` },
        );
        if (resetError) throw resetError;
        setMessage(
          'If an account exists for that email, Supabase has sent a password reset link.',
        );
        return;
      }

      if (recovery) {
        const { error: updateError } = await supabase.auth.updateUser({
          password,
        });
        if (updateError) throw updateError;
        await supabase.auth.signOut();
        window.location.assign('/login?passwordUpdated=1');
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInError) throw signInError;

      const profile = await api<{ role: Role }>('/auth/me');
      const destination: Record<Role, string> = {
        client: '/dashboard',
        expert: '/expert',
        admin: '/admin',
      };
      window.location.assign(destination[profile.role]);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Unable to continue.',
      );
    } finally {
      setLoading(false);
    }
  }

  const title = recovery
    ? 'Choose a new password'
    : resetRequested
      ? 'Reset your password'
      : 'Welcome back';
  const description = recovery
    ? 'Enter a new password for your Supabase account.'
    : resetRequested
      ? 'We will send a secure recovery link to your email.'
      : 'Sign in securely and we will open the right workspace for your account.';

  return (
    <div className="grid min-h-screen bg-[#f7f8fa] lg:grid-cols-[.9fr_1.1fr]">
      <aside className="relative hidden overflow-hidden bg-[#172c4f] p-12 text-white lg:flex lg:flex-col">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-[#2563eb]">
            <ShieldCheck />
          </span>
          <strong>KaziLedger</strong>
        </Link>
        <div className="my-auto max-w-lg">
          <p className="text-sm font-semibold text-blue-300">
            TRUSTED EXPERT SERVICES
          </p>
          <h1 className="mt-4 text-5xl font-semibold leading-tight tracking-[-.04em]">
            One workspace for every service engagement.
          </h1>
          <p className="mt-5 text-lg leading-8 text-blue-100/70">
            Manage requests, quotes, escrow, delivery and payouts with a
            complete audit trail.
          </p>
        </div>
        <p className="text-sm text-blue-200/50">
          Secure payments through Pesapal · MTN · Airtel
        </p>
      </aside>
      <main className="flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="mb-8 flex items-center justify-center gap-2 text-[#1f3864] lg:hidden"
          >
            <ShieldCheck />
            <strong>KaziLedger</strong>
          </Link>
          <BackButton href="/" label="Back home" className="mb-4" />
          <Card className="border-0 bg-white shadow-xl shadow-slate-200/50">
            <CardHeader className="p-6 pb-2 sm:p-8 sm:pb-3">
              <CardTitle className="text-2xl">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-4 sm:p-8 sm:pt-4">
              {(passwordUpdated || confirmed) && !error && (
                <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
                  {passwordUpdated
                    ? 'Your password was updated. Sign in with the new password.'
                    : 'Your email is confirmed. You can now sign in.'}
                </p>
              )}
              <form className="mt-6 space-y-4" onSubmit={submit}>
                {!recovery && (
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="you@example.com"
                      className="h-11"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </div>
                )}
                {!resetRequested && (
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label htmlFor="password">
                        {recovery ? 'New password' : 'Password'}
                      </Label>
                      {!recovery && (
                        <Link
                          href="/login?reset=1"
                          className="text-xs font-medium text-[#2563eb]"
                        >
                          Forgot password?
                        </Link>
                      )}
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        required
                        minLength={8}
                        autoComplete={
                          recovery ? 'new-password' : 'current-password'
                        }
                        type={visible ? 'text' : 'password'}
                        placeholder={
                          recovery
                            ? 'At least 8 characters'
                            : 'Enter your password'
                        }
                        className="h-11 pr-10"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setVisible(!visible)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                      >
                        <span className="sr-only">
                          Toggle password visibility
                        </span>
                        {visible ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
                {message && (
                  <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
                    {message}
                  </p>
                )}
                {error && (
                  <p
                    role="alert"
                    className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
                  >
                    {error}
                  </p>
                )}
                <Button
                  disabled={loading}
                  type="submit"
                  className="h-11 w-full bg-[#1f3864]"
                >
                  {loading
                    ? 'Please wait…'
                    : recovery
                      ? 'Update password'
                      : resetRequested
                        ? 'Send reset link'
                        : 'Sign in'}{' '}
                  <ArrowRight />
                </Button>
              </form>
              <p className="mt-6 text-center text-sm text-slate-500">
                {resetRequested || recovery ? (
                  <Link href="/login" className="font-semibold text-[#2563eb]">
                    Back to sign in
                  </Link>
                ) : (
                  <>
                    New to KaziLedger?{' '}
                    <Link
                      href="/register"
                      className="font-semibold text-[#2563eb]"
                    >
                      Create an account
                    </Link>
                  </>
                )}
              </p>
            </CardContent>
          </Card>
          <p className="mt-6 text-center text-xs text-slate-400">
            By continuing, you agree to the Terms of Service and Privacy Policy.
          </p>
        </div>
      </main>
    </div>
  );
}
