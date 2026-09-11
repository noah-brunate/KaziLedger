'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from '@/components/static-link';
import { ArrowLeft } from 'lucide-react';
import { DashboardShell } from '@/components/dashboard-shell';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type Role = 'client' | 'expert';
type Detail = {
  id: string;
  status: string;
  scope_details: Record<string, unknown>;
  rejection_count: number;
  response_due_at?: string | null;
  quote?: { id: string; amount: number; currency: string; status: string; expires_at?: string | null } | null;
  logs: Array<{ action: string; reason?: string | null; timestamp?: string | null }>;
};

export function RequestDetail({ workspace, requestId }: { workspace: Role; requestId: string }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState('');
  const back = workspace === 'client' ? '/dashboard/requests' : '/expert/assignments';
  const load = useCallback(async () => {
    try { setError(''); setDetail(await api<Detail>(`/requests/${requestId}`)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load this request.'); }
  }, [requestId]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true); setError(''); setNotice('');
    try { await action(); setNotice(message); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The action could not be completed.'); }
    finally { setBusy(false); }
  }
  return <DashboardShell workspace={workspace} pageTitle="Request details" pageSubtitle="Review the engagement history and take the next appropriate action."><div className="space-y-5"><Link href={back} className="inline-flex items-center gap-2 text-sm font-medium text-blue-700"><ArrowLeft className="size-4" /> Back to {workspace === 'client' ? 'requests' : 'assignments'}</Link>{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{notice && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}{!detail && !error && <p className="text-sm text-slate-500">Loading request…</p>}{detail && <><Card><CardHeader><CardTitle>Request {detail.id.slice(0, 8)}</CardTitle><CardDescription>Status: {detail.status}</CardDescription></CardHeader><CardContent className="space-y-4"><div><p className="text-sm font-medium">Scope</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">{typeof detail.scope_details.description === 'string' ? detail.scope_details.description : 'No description supplied.'}</p></div>{detail.response_due_at && <p className="text-sm text-slate-500">Response due: {new Date(detail.response_due_at).toLocaleString()}</p>}{detail.quote && <div className="rounded-xl bg-slate-50 p-4"><p className="font-medium">Quote</p><p className="mt-1 text-sm text-slate-600">{detail.quote.currency} {detail.quote.amount} · {detail.quote.status}</p>{workspace === 'client' && detail.quote.status === 'pending' && <div className="mt-3 flex gap-2"><Button disabled={busy} onClick={() => void run(() => api(`/quotes/${detail.quote?.id}/decision`, { method: 'POST', body: JSON.stringify({ action: 'accept' }) }), 'Quote accepted. Continue to Payments to complete escrow checkout.')}>Accept quote</Button><Button disabled={busy} variant="outline" onClick={() => void run(() => api(`/quotes/${detail.quote?.id}/decision`, { method: 'POST', body: JSON.stringify({ action: 'reject' }) }), 'Quote rejected.')}>Reject quote</Button></div>}{workspace === 'client' && detail.quote.status === 'accepted' && <Button className="mt-3" render={<Link href="/dashboard/payments" />}>Go to payment</Button>}</div>}{workspace === 'client' && detail.status === 'needs_info' && <div className="flex flex-wrap gap-2"><Input value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Reply with the requested information" /><Button disabled={busy || !reply} onClick={() => void run(() => api(`/requests/${detail.id}/information`, { method: 'POST', body: JSON.stringify({ scope_details: { description: reply } }) }), 'Information sent to the expert.')}>Send reply</Button></div>}{workspace === 'client' && detail.status === 'delivered' && <Button disabled={busy} onClick={() => void run(() => api(`/requests/${detail.id}/complete`, { method: 'POST' }), 'Delivery accepted and escrow released.')}>Accept delivery</Button>}{workspace === 'expert' && ['funded', 'in_progress'].includes(detail.status) && <Button disabled={busy} onClick={() => void run(() => api(`/requests/${detail.id}/deliver`, { method: 'POST', body: JSON.stringify({ evidence: [] }) }), 'Delivery submitted for client review.')}>Mark delivered</Button>}</CardContent></Card><Card><CardHeader><CardTitle>Request history</CardTitle></CardHeader><CardContent>{detail.logs.length ? <ol className="space-y-3">{detail.logs.map((log, index) => <li key={`${log.action}-${index}`} className="border-l-2 border-blue-200 pl-4"><p className="text-sm font-medium capitalize">{log.action.replace('_', ' ')}</p>{log.reason && <p className="mt-1 text-sm text-slate-600">{log.reason}</p>}{log.timestamp && <p className="mt-1 text-xs text-slate-400">{new Date(log.timestamp).toLocaleString()}</p>}</li>)}</ol> : <p className="text-sm text-slate-500">No history entries are available yet.</p>}</CardContent></Card></>}</div></DashboardShell>;
}
