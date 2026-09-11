'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from '@/components/static-link';
import { ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type WorkspaceRole = 'client' | 'expert' | 'admin';
export type WorkspaceSection =
  | 'requests' | 'payments' | 'documents' | 'applications' | 'assignments'
  | 'wallet' | 'disputes' | 'pricing' | 'roles' | 'settings';

type Service = { id: string; name: string; category: string; scope_schema: Record<string, unknown>; active: boolean };
type RequestItem = { id: string; status: string; subcategory_id: string; scope_details: Record<string, unknown>; rejection_count: number };
type Quote = { id: string; request_id: string; amount: number; currency: string; status: string; expires_at?: string };
type Application = { id: string; expert_id: string; subcategory_id: string; status: string; is_available?: boolean };
type Dispute = { id: string; request_id: string; reason: string; status: string };
type Withdrawal = { id: string; amount: number; provider: string; status: string };
type WalletData = { balance: number; currency: string; transactions: Array<{ id: string; type: string; amount: number; status: string; created_at?: string }>; topups: Array<{ id: string; amount: number; status: string; created_at?: string }> };
type UserItem = { id: string; email?: string; phone?: string; role: string; status: string };
type Account = { id: string; email?: string; phone?: string; role: string; client_type: string };

const titles: Record<WorkspaceSection, [string, string]> = {
  requests: ['My requests', 'Create requests, respond to questions, and follow each engagement.'],
  payments: ['Wallet & payments', 'Top up through Pesapal and charge approved quotes from your wallet into escrow.'],
  documents: ['Documents', 'Review information supplied for your requests and delivery evidence from experts.'],
  assignments: ['Assignments', 'Respond to assigned work and keep every client engagement moving.'],
  applications: ['Applications', 'Apply for services or review expert applications.'],
  wallet: ['Wallet', 'Review your available earnings and request a mobile-money payout.'],
  disputes: ['Disputes', 'Review open disputes and decide whether to release or refund escrow.'],
  pricing: ['Service catalogue & pricing', 'Create and maintain the services your marketplace offers, then set their price bands.'],
  roles: ['Roles & access', 'Manage each account’s operational access.'],
  settings: ['Settings', 'Review your account identity and workspace preferences.'],
};

function ErrorNotice({ children }: { children: string }) { return <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{children}</p>; }
function Notice({ children }: { children: string }) { return <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{children}</p>; }
function requestHref(role: WorkspaceRole, id: string) {
  const route = role === 'expert' ? '/expert/assignments/detail' : '/dashboard/requests/detail';
  return `${route}?id=${encodeURIComponent(id)}`;
}

export function WorkflowPanel({ role, section }: { role: WorkspaceRole; section: WorkspaceSection }) {
  const [services, setServices] = useState<Service[]>([]);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [wallet, setWallet] = useState<WalletData>({ balance: 0, currency: 'UGX', transactions: [], topups: [] });
  const [account, setAccount] = useState<Account | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      const calls: Promise<void>[] = [];
      if (['requests', 'applications'].includes(section)) calls.push(api<Service[]>('/services').then(setServices));
      if (role === 'admin' && section === 'pricing') calls.push(api<Service[]>('/admin/services').then(setServices));
      if ((role === 'client' && ['requests', 'payments', 'documents'].includes(section)) || (role === 'expert' && section === 'assignments')) {
        calls.push(api<RequestItem[]>('/requests').then(setRequests)); calls.push(api<Quote[]>('/quotes').then(setQuotes));
      }
      if (role === 'client' && section === 'payments') calls.push(api<WalletData>('/wallet').then(setWallet));
      if (role === 'expert' && section === 'applications') calls.push(api<Application[]>('/expert/applications').then(setApplications));
      if (role === 'expert' && section === 'wallet') calls.push(api<WalletData>('/wallet').then(setWallet));
      if (section === 'settings') calls.push(api<Account>('/auth/me').then(setAccount));
      if (role === 'admin' && section === 'applications') calls.push(api<Application[]>('/expert/applications').then(setApplications));
      if (role === 'admin' && section === 'disputes') calls.push(api<Dispute[]>('/disputes').then(setDisputes));
      if (role === 'admin' && section === 'roles') calls.push(api<UserItem[]>('/admin/users').then(setUsers));
      if (role === 'admin' && section === 'settings') calls.push(api<Withdrawal[]>('/admin/withdrawals').then(setWithdrawals));
      await Promise.all(calls);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load this workspace section.'); }
  }, [role, section]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true); setError(''); setNotice('');
    try { await action(); setNotice(message); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The action could not be completed.'); }
    finally { setBusy(false); }
  }
  const [title, description] = titles[section];
  return <Card className="border-blue-100 bg-white shadow-sm ring-1 ring-blue-100"><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent className="space-y-5">
    {error && <ErrorNotice>{error}</ErrorNotice>}{notice && <Notice>{notice}</Notice>}
    {role === 'client' && section === 'requests' && <ClientRequests services={services} requests={requests} quotes={quotes} busy={busy} run={run} />}
    {role === 'client' && section === 'payments' && <ClientPayments quotes={quotes} wallet={wallet} busy={busy} run={run} />}
    {role === 'client' && section === 'documents' && <ClientDocuments requests={requests} />}
    {role === 'expert' && section === 'assignments' && <ExpertAssignments requests={requests} busy={busy} run={run} />}
    {role === 'expert' && section === 'applications' && <ExpertApplications services={services} applications={applications} busy={busy} run={run} />}
    {role === 'expert' && section === 'wallet' && <ExpertWallet wallet={wallet} busy={busy} run={run} />}
    {role === 'admin' && section === 'applications' && <AdminApplications applications={applications} busy={busy} run={run} />}
    {role === 'admin' && section === 'disputes' && <AdminDisputes disputes={disputes} busy={busy} run={run} />}
    {role === 'admin' && section === 'pricing' && <AdminCatalog services={services} busy={busy} run={run} />}
    {role === 'admin' && section === 'roles' && <AdminRoles users={users} run={run} />}
    {section === 'settings' && <AccountSettings account={account} role={role} withdrawals={withdrawals} busy={busy} run={run} />}
  </CardContent></Card>;
}

type Runner = (action: () => Promise<unknown>, message: string) => Promise<void>;

function ClientRequests({ services, requests, quotes, busy, run }: { services: Service[]; requests: RequestItem[]; quotes: Quote[]; busy: boolean; run: Runner }) {
  const [serviceId, setServiceId] = useState(''); const [scope, setScope] = useState('');
  return <div className="space-y-6"><form onSubmit={(e) => { e.preventDefault(); void run(() => api('/requests', { method: 'POST', body: JSON.stringify({ subcategory_id: serviceId, scope_details: { description: scope } }) }), 'Request submitted and matching has started.'); setScope(''); }} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_1.5fr_auto] sm:items-end"><div className="space-y-2"><Label htmlFor="request-service">Service</Label><select id="request-service" required value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="h-10 w-full rounded-lg border bg-white px-3 text-sm"><option value="">Choose a service</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></div><div className="space-y-2"><Label htmlFor="request-scope">Scope</Label><Input id="request-scope" required value={scope} onChange={(e) => setScope(e.target.value)} placeholder="Describe the work and deadline" /></div><Button disabled={busy || !serviceId} type="submit">Submit request</Button></form>{!requests.length ? <p className="text-sm text-slate-500">No requests yet. Create your first request above.</p> : <div className="space-y-3">{requests.map((request) => <RequestRow key={request.id} request={request} quote={quotes.find((quote) => quote.request_id === request.id)} workspace="client" />)}</div>}</div>;
}

function RequestRow({ request, quote, workspace }: { request: RequestItem; quote?: Quote; workspace: WorkspaceRole }) {
  const description = request.scope_details.description; const summary = typeof description === 'string' ? description : 'Service request';
  return <Link href={requestHref(workspace, request.id)} className="block rounded-xl border p-4 transition hover:border-blue-300 hover:bg-blue-50/30"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">Request {request.id.slice(0, 8)}</p><p className="mt-1 text-sm text-slate-500">{summary}</p>{quote && <p className="mt-2 text-sm text-slate-700">Quote: <strong>{quote.currency} {quote.amount}</strong> · {quote.status}</p>}</div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">{request.status}</span></div><p className="mt-3 text-xs font-medium text-blue-700">Open request details →</p></Link>;
}

function ClientPayments({ quotes, wallet, busy, run }: { quotes: Quote[]; wallet: WalletData; busy: boolean; run: Runner }) {
  const accepted = quotes.filter((quote) => quote.status === 'accepted');
  return <div className="space-y-5"><div className="rounded-xl bg-[#1f3864] p-5 text-white"><p className="text-sm text-blue-100">Available wallet balance</p><p className="mt-1 text-3xl font-semibold">{wallet.currency} {wallet.balance}</p><p className="mt-2 text-xs text-blue-200">Top up whenever you need to. Quotes are charged from this balance only after you approve them.</p></div><WalletTopUp busy={busy} run={run} />{accepted.length ? <div className="space-y-3"><h3 className="font-semibold">Approved quotes</h3>{accepted.map((quote) => <div key={quote.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"><div><p className="font-medium">Escrow charge</p><p className="text-sm text-slate-500">Quote {quote.id.slice(0, 8)} · {quote.currency} {quote.amount}</p></div><Button disabled={busy || wallet.balance < quote.amount} onClick={() => void run(() => api(`/quotes/${quote.id}/charge`, { method: 'POST' }), 'Your wallet was charged and the labour fee is now protected in escrow.')}>Charge wallet</Button>{wallet.balance < quote.amount && <p className="w-full text-xs text-amber-700">Top up at least {quote.amount - wallet.balance} {quote.currency} to fund this quote.</p>}</div>)}</div> : <p className="text-sm text-slate-500">No approved quotes are waiting for a wallet charge.</p>}{wallet.transactions.length > 0 && <div className="space-y-2"><h3 className="font-semibold">Wallet activity</h3>{wallet.transactions.slice(0, 6).map((transaction) => <p key={transaction.id} className="rounded-lg border p-3 text-sm"><span className="capitalize">{transaction.type.replace('_', ' ')}</span><strong className="float-right">{transaction.amount}</strong></p>)}</div>}</div>;
}

function WalletTopUp({ busy, run }: { busy: boolean; run: Runner }) {
  const [amount, setAmount] = useState(''); const [email, setEmail] = useState(''); const [phone, setPhone] = useState(''); const [checkoutUrl, setCheckoutUrl] = useState('');
  return <div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><p className="font-semibold">Top up with Pesapal</p><p className="mt-1 text-sm text-slate-600">Choose any amount. It becomes available in your wallet after Pesapal confirms payment.</p>{!checkoutUrl ? <><div className="mt-4 grid gap-3 sm:grid-cols-3"><Input required type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount (UGX)" /><Input required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Payment email" type="email" /><Input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Mobile number" /></div><Button className="mt-4" disabled={busy || !amount || !email || !phone} onClick={() => void run(async () => { const payment = await api<{ redirect_url: string }>('/wallet/topups/pesapal', { method: 'POST', body: JSON.stringify({ amount, email, phone, first_name: 'Kazi', last_name: 'Client' }) }); setCheckoutUrl(payment.redirect_url); }, 'Secure Pesapal top-up checkout is ready below.')}>Top up wallet</Button></> : <div className="mt-4 space-y-3"><iframe title="Pesapal wallet top-up" src={checkoutUrl} className="h-[620px] w-full rounded-lg border bg-white" sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-top-navigation-by-user-activation" /><p className="text-xs text-slate-600">After completion, refresh this page to see the confirmed wallet balance. If embedded checkout is blocked, use the secure new-tab option.</p><a className="inline-flex h-9 items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm font-medium hover:bg-accent" href={checkoutUrl} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /> Open Pesapal in a new tab</a></div>}</div>;
}

function ClientDocuments({ requests }: { requests: RequestItem[] }) { return <div className="space-y-3">{!requests.length && <p className="text-sm text-slate-500">No request documents are available yet.</p>}{requests.map((request) => { const evidence = Array.isArray(request.scope_details.delivery_evidence) ? request.scope_details.delivery_evidence : []; return <Link key={request.id} href={requestHref('client', request.id)} className="block rounded-xl border p-4 hover:border-blue-300"><p className="font-medium">Request {request.id.slice(0, 8)}</p><p className="mt-1 text-sm text-slate-500">{evidence.length ? `${evidence.length} delivery evidence item(s) available.` : 'No delivery evidence has been submitted yet.'}</p></Link>; })}</div>; }

function ExpertAssignments({ requests, busy, run }: { requests: RequestItem[]; busy: boolean; run: Runner }) {
  const [amounts, setAmounts] = useState<Record<string, string>>({}); const [reasons, setReasons] = useState<Record<string, string>>({});
  return <div className="space-y-3">{!requests.length && <p className="text-sm text-slate-500">No assignments are waiting for you.</p>}{requests.map((request) => <div key={request.id} className="space-y-3 rounded-xl border p-4"><Link href={requestHref('expert', request.id)} className="flex justify-between gap-3"><p className="font-medium">Request {request.id.slice(0, 8)}</p><span className="text-xs text-blue-700">Open details →</span></Link>{request.status === 'matching' && <><div className="flex gap-2"><Input type="number" value={amounts[request.id] ?? ''} onChange={(e) => setAmounts({ ...amounts, [request.id]: e.target.value })} placeholder="Quote amount" /><Button disabled={busy || !amounts[request.id]} onClick={() => void run(() => api('/quotes', { method: 'POST', body: JSON.stringify({ request_id: request.id, amount: amounts[request.id] }) }), 'Quote submitted within the price band.')}>Create quote</Button></div><div className="flex flex-wrap gap-2"><Input value={reasons[request.id] ?? ''} onChange={(e) => setReasons({ ...reasons, [request.id]: e.target.value })} placeholder="Reason for clarification or rejection" /><Button disabled={busy || !reasons[request.id]} variant="outline" onClick={() => void run(() => api(`/requests/${request.id}/respond`, { method: 'POST', body: JSON.stringify({ action: 'more_info', reason: reasons[request.id] }) }), 'Information request sent to the client.')}>Ask for info</Button><Button disabled={busy || !reasons[request.id]} variant="ghost" onClick={() => void run(() => api(`/requests/${request.id}/respond`, { method: 'POST', body: JSON.stringify({ action: 'reject', reason: reasons[request.id] }) }), 'Request reassignment started.')}>Reject</Button></div></>}{['funded', 'in_progress'].includes(request.status) && <Button disabled={busy} onClick={() => void run(() => api(`/requests/${request.id}/deliver`, { method: 'POST', body: JSON.stringify({ evidence: [] }) }), 'Delivery submitted for client review.')}>Mark delivered</Button>}</div>)}</div>;
}

function ExpertApplications({ services, applications, busy, run }: { services: Service[]; applications: Application[]; busy: boolean; run: Runner }) { const [serviceId, setServiceId] = useState(''); const [documentName, setDocumentName] = useState(''); return <div className="space-y-5"><form className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); void run(() => api('/expert/applications', { method: 'POST', body: JSON.stringify({ subcategory_id: serviceId, documents: documentName ? [{ name: documentName }] : [] }) }), 'Application submitted for review.'); }}><div className="space-y-2"><Label>Service</Label><select required value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="h-10 w-full rounded-lg border bg-white px-3 text-sm"><option value="">Choose a service</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></div><div className="space-y-2"><Label>Document reference</Label><Input value={documentName} onChange={(e) => setDocumentName(e.target.value)} placeholder="Private document reference" /></div><Button disabled={busy || !serviceId} type="submit">Submit application</Button></form><div className="space-y-3">{applications.map((application) => <div key={application.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-4"><span className="flex-1 text-sm">Application {application.id.slice(0, 8)} · {application.status}</span>{application.status === 'approved' && <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => api(`/expert/services/${application.id}/availability`, { method: 'PATCH', body: JSON.stringify({ is_available: !application.is_available }) }), `Availability ${application.is_available ? 'paused' : 'enabled'}.`)}>{application.is_available ? 'Pause' : 'Enable'}</Button>}</div>)}</div></div>; }
function ExpertWallet({ wallet, busy, run }: { wallet: WalletData; busy: boolean; run: Runner }) { const [amount, setAmount] = useState(''); const [phone, setPhone] = useState(''); return <div className="space-y-5"><form className="space-y-4 rounded-xl border p-4" onSubmit={(e) => { e.preventDefault(); void run(() => api('/wallet/withdrawals', { method: 'POST', body: JSON.stringify({ amount, provider: 'mtn', phone }) }), 'Withdrawal queued for provider confirmation.'); }}><div><p className="text-sm text-slate-500">Available to withdraw</p><p className="text-2xl font-semibold">{wallet.currency} {wallet.balance}</p><p className="mt-1 text-xs text-slate-500">Completed jobs are credited here after the escrow release window.</p></div><div className="grid gap-3 sm:grid-cols-2"><Input required type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" /><Input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="MTN mobile number" /></div><Button disabled={busy} type="submit">Request payout</Button></form><div className="space-y-2"><h3 className="font-semibold">Earnings and payouts</h3>{wallet.transactions.length ? wallet.transactions.map((transaction) => <p key={transaction.id} className="rounded-lg border p-3 text-sm"><span className="capitalize">{transaction.type.replace('_', ' ')}</span><strong className="float-right">{transaction.amount}</strong></p>) : <p className="text-sm text-slate-500">Your released earnings and withdrawals will appear here.</p>}</div></div>; }
function AdminApplications({ applications, busy, run }: { applications: Application[]; busy: boolean; run: Runner }) { const [notes, setNotes] = useState<Record<string, string>>({}); return <div className="space-y-3">{!applications.length && <p className="text-sm text-slate-500">No applications are awaiting review.</p>}{applications.map((application) => <div key={application.id} className="flex flex-wrap items-center gap-2 rounded-xl border p-4"><span className="flex-1 text-sm">Application {application.id.slice(0, 8)} · {application.status}</span><Input className="max-w-xs" value={notes[application.id] ?? ''} onChange={(e) => setNotes({ ...notes, [application.id]: e.target.value })} placeholder="Review note" /><Button size="sm" disabled={busy} onClick={() => void run(() => api(`/admin/applications/${application.id}/review`, { method: 'POST', body: JSON.stringify({ action: 'approve', interview_outcome: notes[application.id] }) }), 'Application approved.')}>Approve</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => api(`/admin/applications/${application.id}/review`, { method: 'POST', body: JSON.stringify({ action: 'reject', reason: notes[application.id] }) }), 'Application rejected.')}>Reject</Button></div>)}</div>; }
function AdminDisputes({ disputes, busy, run }: { disputes: Dispute[]; busy: boolean; run: Runner }) { return <div className="space-y-3">{!disputes.length && <p className="text-sm text-slate-500">There are no open disputes.</p>}{disputes.map((dispute) => <div key={dispute.id} className="flex flex-wrap items-center gap-2 rounded-xl border p-4"><span className="flex-1 text-sm">{dispute.reason}</span><Button size="sm" disabled={busy} onClick={() => void run(() => api(`/admin/disputes/${dispute.id}/resolve`, { method: 'POST', body: JSON.stringify({ resolution: 'release', note: 'Evidence reviewed and work released.' }) }), 'Escrow released.')}>Release</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => api(`/admin/disputes/${dispute.id}/resolve`, { method: 'POST', body: JSON.stringify({ resolution: 'refund', note: 'Evidence reviewed and client refunded.' }) }), 'Escrow refunded.')}>Refund</Button></div>)}</div>; }
function AdminCatalog({ services, busy, run }: { services: Service[]; busy: boolean; run: Runner }) {
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState({ name: '', category: '', description: '' });
  const [band, setBand] = useState({ subcategory_id: '', client_type: 'business', minimum: '', maximum: '', currency: 'UGX' });
  const activeServices = services.filter((service) => service.active);
  function edit(service: Service) {
    setEditing(service);
    setForm({ name: service.name, category: service.category, description: typeof service.scope_schema.description === 'string' ? service.scope_schema.description : '' });
  }
  function reset() { setEditing(null); setForm({ name: '', category: '', description: '' }); }
  return <div className="space-y-8">
    <section className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
      <div className="mb-4"><h3 className="font-semibold">{editing ? 'Edit service' : 'Add a new service'}</h3><p className="mt-1 text-sm text-slate-600">Active services appear in the public catalogue and can be requested by clients.</p></div>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); const body = { name: form.name, category: form.category, scope_schema: form.description ? { description: form.description } : {} }; void run(() => api(editing ? `/admin/services/${editing.id}` : '/admin/services', { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(body) }), editing ? 'Service updated.' : 'Service created and published.').then(reset); }}>
        <div className="space-y-2"><Label htmlFor="service-name">Service name</Label><Input id="service-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Legal contract review" /></div>
        <div className="space-y-2"><Label htmlFor="service-category">Category</Label><Input id="service-category" required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Legal & compliance" /></div>
        <div className="space-y-2 sm:col-span-2"><Label htmlFor="service-description">Public description (optional)</Label><Input id="service-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="A short explanation of the service for clients." /></div>
        <div className="flex flex-wrap gap-2 sm:col-span-2"><Button disabled={busy} type="submit">{editing ? 'Save changes' : 'Create service'}</Button>{editing && <Button disabled={busy} type="button" variant="outline" onClick={reset}>Cancel</Button>}</div>
      </form>
    </section>
    <section><div className="mb-3 flex items-baseline justify-between"><h3 className="font-semibold">All services</h3><span className="text-sm text-slate-500">{activeServices.length} active · {services.length} total</span></div><div className="space-y-3">{!services.length ? <p className="rounded-xl border border-dashed p-4 text-sm text-slate-500">No services yet. Create the first one above.</p> : services.map((service) => <div key={service.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-4"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{service.name}</p><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${service.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{service.active ? 'Active' : 'Inactive'}</span></div><p className="mt-1 text-sm text-slate-500">{service.category}{typeof service.scope_schema.description === 'string' ? ` · ${service.scope_schema.description}` : ''}</p></div><Button size="sm" variant="outline" disabled={busy} onClick={() => edit(service)}>Edit</Button><Button size="sm" variant={service.active ? 'ghost' : 'default'} disabled={busy} onClick={() => void run(() => api(`/admin/services/${service.id}`, { method: 'PATCH', body: JSON.stringify({ active: !service.active }) }), service.active ? 'Service hidden from new requests.' : 'Service made available to clients.')}>{service.active ? 'Deactivate' : 'Activate'}</Button></div>)}</div></section>
    <section className="border-t pt-6"><div className="mb-4"><h3 className="font-semibold">Add a price band</h3><p className="mt-1 text-sm text-slate-600">Set the quote range for an active service and client type.</p></div><form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void run(() => api('/admin/price-bands', { method: 'POST', body: JSON.stringify({ ...band, minimum: Number(band.minimum), maximum: Number(band.maximum) }) }), 'Price band created.'); }}><select required value={band.subcategory_id} onChange={(e) => setBand({ ...band, subcategory_id: e.target.value })} className="h-10 rounded-lg border bg-white px-3 text-sm"><option value="">Choose an active service</option>{activeServices.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select><Input required value={band.client_type} onChange={(e) => setBand({ ...band, client_type: e.target.value })} placeholder="Client type" /><Input required type="number" value={band.minimum} onChange={(e) => setBand({ ...band, minimum: e.target.value })} placeholder="Minimum (UGX)" /><Input required type="number" value={band.maximum} onChange={(e) => setBand({ ...band, maximum: e.target.value })} placeholder="Maximum (UGX)" /><Button disabled={busy || !activeServices.length} type="submit">Add price band</Button></form></section>
  </div>;
}
function AdminRoles({ users, run }: { users: UserItem[]; run: Runner }) { return <div className="space-y-3">{users.map((user) => <div key={user.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-4"><span className="flex-1 text-sm">{user.email ?? user.phone ?? user.id.slice(0, 8)}</span><select value={user.role} onChange={(e) => void run(() => api(`/admin/users/${user.id}/role`, { method: 'PATCH', body: JSON.stringify({ role: e.target.value }) }), 'Account role updated.')} className="h-9 rounded-lg border bg-white px-2 text-sm"><option value="client">Client</option><option value="expert">Expert</option><option value="admin">Admin</option></select></div>)}</div>; }
function AccountSettings({ account, role, withdrawals, busy, run }: { account: Account | null; role: WorkspaceRole; withdrawals: Withdrawal[]; busy: boolean; run: Runner }) { return <div className="space-y-4"><div className="rounded-xl border p-4"><p className="text-sm text-slate-500">Signed-in account</p>{account ? <><p className="mt-1 font-medium">{account.email ?? account.phone}</p><p className="mt-1 text-sm text-slate-500 capitalize">{account.role} · {account.client_type}</p></> : <p className="mt-2 text-sm text-slate-500">Loading account details…</p>}</div>{role === 'admin' && <div className="space-y-3"><Button disabled={busy} onClick={() => void run(() => api('/admin/jobs/process', { method: 'POST' }), 'Scheduled maintenance jobs processed.')}>Process scheduled jobs</Button>{withdrawals.map((withdrawal) => <p key={withdrawal.id} className="rounded-lg border p-3 text-sm">Withdrawal {withdrawal.id.slice(0, 8)} · {withdrawal.provider} · {withdrawal.amount} · {withdrawal.status}</p>)}</div>}</div>; }
