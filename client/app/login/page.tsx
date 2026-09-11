'use client';

import { useState } from 'react';
import Link from '@/components/static-link';
import { ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, setToken } from '@/lib/api';

export default function LoginPage() {
  const [visible, setVisible] = useState(false);
  const [role, setRole] = useState<'client' | 'expert' | 'admin'>('client');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await api<{ access_token: string; role: string }>(
        '/auth/login',
        { method: 'POST', body: JSON.stringify({ identifier, password }) },
      );
      if (result.role !== role) throw new Error(`This account is a ${result.role} account.`);
      setToken(result.access_token);
      window.location.assign(role === 'client' ? '/dashboard' : `/${role}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  }
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
          <Card className="border-0 bg-white shadow-xl shadow-slate-200/50">
            <CardHeader className="p-6 pb-2 sm:p-8 sm:pb-3">
              <CardTitle className="text-2xl">Welcome back</CardTitle>
              <CardDescription>
                Choose your workspace and sign in securely.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-4 sm:p-8 sm:pt-4">
              <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-100 p-1">
                {(['client', 'expert', 'admin'] as const).map((item) => (
                  <button
                    key={item}
                    onClick={() => setRole(item)}
                    className={`rounded-lg px-2 py-2 text-xs font-semibold capitalize transition ${role === item ? 'bg-white text-[#1f3864] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <form
                className="mt-6 space-y-4"
                onSubmit={submit}
              >
                <div className="space-y-2">
                  <Label htmlFor="identifier">Email or phone</Label>
                  <Input
                    id="identifier"
                    required
                    placeholder="you@example.com"
                    className="h-11"
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link
                      href="/login?reset=1"
                      className="text-xs font-medium text-[#2563eb]"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      required
                      type={visible ? 'text' : 'password'}
                      placeholder="Enter your password"
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
                <label
                  htmlFor="remember"
                  className="flex items-center gap-2 text-sm text-slate-500"
                >
                  <Checkbox id="remember" />
                  Keep me signed in on this device
                </label>
                {error && (
                  <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </p>
                )}
                <Button disabled={loading} type="submit" className="h-11 w-full bg-[#1f3864]">
                  {loading ? 'Signing in…' : `Sign in to ${role} workspace`} <ArrowRight />
                </Button>
              </form>
              <p className="mt-6 text-center text-sm text-slate-500">
                New to KaziLedger?{' '}
                <Link
                  href="/register"
                  className="font-semibold text-[#2563eb]"
                >
                  Create an account
                </Link>
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
