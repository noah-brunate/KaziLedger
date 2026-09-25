'use client';

import { useState } from 'react';
import Link from '@/components/static-link';
import { ArrowRight, ShieldCheck } from 'lucide-react';
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
import { useLocationSearch } from '@/lib/browser-location';
import { BackButton } from '@/components/back-button';
import { supabase } from '@/lib/supabase';

export default function RegisterPage() {
  const search = useLocationSearch();
  const searchParams = new URLSearchParams(search ?? '');
  const selectedService = searchParams.get('service');
  const requestedRole = searchParams.get('role');
  const [selectedRole, setSelectedRole] = useState<'client' | 'expert' | null>(
    null,
  );
  const role =
    selectedRole ?? (requestedRole === 'expert' ? 'expert' : 'client');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [createdEmail, setCreatedEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault();
    setError('');
    setCreatedEmail('');
    setLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login?confirmed=1`,
          data: {
            role,
            client_type: 'individual',
            marketing_consent: false,
          },
        },
      });
      if (signUpError) throw signUpError;
      if (data.session) await supabase.auth.signOut();
      setCreatedEmail(email.trim().toLowerCase());
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Unable to create the account.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fa] p-4">
      <Card className="w-full max-w-md border-0 shadow-xl">
        <CardHeader>
          <div className="mb-3 flex items-center justify-between gap-3">
            <Link href="/" className="flex items-center gap-2 text-[#1f3864]">
              <ShieldCheck />
              <strong>KaziLedger</strong>
            </Link>
            <BackButton href="/" label="Back home" />
          </div>
          <CardTitle>
            {createdEmail ? 'Verify your email' : 'Create an account'}
          </CardTitle>
          <CardDescription>
            {createdEmail
              ? 'Your account was created successfully.'
              : selectedService
                ? 'Create your client account to request the service you selected.'
                : 'Join as a client or apply as an independent expert.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {createdEmail ? (
            <div className="space-y-5">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
                <p className="font-semibold">Check your inbox</p>
                <p className="mt-2 text-sm leading-6">
                  We sent a verification link to <strong>{createdEmail}</strong>
                  . Open the email and verify your account before signing in.
                </p>
              </div>
              <Button
                nativeButton={false}
                render={<Link href="/login" />}
                className="h-11 w-full bg-[#1f3864]"
              >
                Go to sign in <ArrowRight />
              </Button>
              <p className="text-center text-xs leading-5 text-slate-500">
                If you do not see the email, check your spam or junk folder.
              </p>
            </div>
          ) : (
            <>
              {selectedService && (
                <p className="mb-5 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
                  You will be able to request your selected service after
                  registration.
                </p>
              )}
              <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
                {(['client', 'expert'] as const).map((item) => (
                  <button
                    type="button"
                    key={item}
                    onClick={() => setSelectedRole(item)}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold capitalize ${role === item ? 'bg-white text-[#1f3864] shadow-sm' : 'text-slate-500'}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-email">Email</Label>
                  <Input
                    id="register-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">Password</Label>
                  <Input
                    id="register-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
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
                  className="w-full bg-[#1f3864]"
                >
                  {loading ? 'Creating account…' : 'Create Supabase account'}{' '}
                  <ArrowRight />
                </Button>
              </form>
              <p className="mt-5 text-center text-sm text-slate-500">
                Already registered?{' '}
                <Link className="font-semibold text-blue-600" href="/login">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
