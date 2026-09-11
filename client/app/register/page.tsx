'use client';

import { useState } from 'react';
import Link from '@/components/static-link';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { api, setToken } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLocationSearch } from '@/lib/browser-location';

export default function RegisterPage() {
  const search = useLocationSearch();
  const searchParams = new URLSearchParams(search ?? '');
  const selectedService = searchParams.get('service');
  const requestedRole = searchParams.get('role');
  const [selectedRole, setSelectedRole] = useState<'client' | 'expert' | null>(null);
  const role = selectedRole ?? (requestedRole === 'expert' ? 'expert' : 'client');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await api<{ access_token: string; role: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase(), password, role, client_type: 'individual', accept_terms: true, marketing_consent: false }),
      });
      setToken(result.access_token);
      window.location.assign(
        role === 'client'
          ? `/dashboard${selectedService ? `?service=${encodeURIComponent(selectedService)}` : ''}`
          : '/expert',
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create the account.');
    } finally {
      setLoading(false);
    }
  }

  return <main className="flex min-h-screen items-center justify-center bg-[#f7f8fa] p-4"><Card className="w-full max-w-md border-0 shadow-xl"><CardHeader><Link href="/" className="mb-3 flex items-center gap-2 text-[#1f3864]"><ShieldCheck /><strong>KaziLedger</strong></Link><CardTitle>Create an account</CardTitle><CardDescription>{selectedService ? 'Create your client account to request the service you selected.' : 'Join as a client or apply as an independent expert.'}</CardDescription></CardHeader><CardContent>{selectedService && <p className="mb-5 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">You will be able to request your selected service after registration.</p>}<div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">{(['client', 'expert'] as const).map((item) => <button type="button" key={item} onClick={() => setSelectedRole(item)} className={`rounded-lg px-3 py-2 text-sm font-semibold capitalize ${role === item ? 'bg-white text-[#1f3864] shadow-sm' : 'text-slate-500'}`}>{item}</button>)}</div><form onSubmit={submit} className="space-y-4"><div className="space-y-2"><Label htmlFor="register-email">Email</Label><Input id="register-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="register-password">Password</Label><Input id="register-password" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /></div>{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<Button disabled={loading} type="submit" className="w-full bg-[#1f3864]">{loading ? 'Creating account…' : 'Create account'} <ArrowRight /></Button></form><p className="mt-5 text-center text-sm text-slate-500">Already registered? <Link className="font-semibold text-blue-600" href="/login">Sign in</Link></p></CardContent></Card></main>;
}
