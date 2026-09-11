'use client';

import { useMemo, useState } from 'react';
import Link from '@/components/static-link';
import {
  Activity,
  BadgeCheck,
  Banknote,
  Bell,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  Gavel,
  Home,
  LogOut,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  WalletCards,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { WorkflowPanel } from '@/components/workflow-panel';
import type { WorkspaceSection } from '@/components/workflow-panel';
import { clearToken } from '@/lib/api';
import { useLocationPathname } from '@/lib/browser-location';

type Role = 'client' | 'expert' | 'admin';
type NavItem = { label: string; href: string; icon: typeof Home };

const profiles = {
  client: {
    name: 'Brian Mugisha',
    short: 'BM',
    type: 'SME client',
    greeting: 'Brian',
    subtitle: 'Track requests, quotes, payments and delivery.',
    accent: '#0f6e56',
  },
  expert: {
    name: 'Grace Nansubuga',
    short: 'GN',
    type: 'Verified expert',
    greeting: 'Grace',
    subtitle: 'Manage assignments, delivery and your wallet.',
    accent: '#2563eb',
  },
  admin: {
    name: 'Amina Kato',
    short: 'AK',
    type: 'Super Admin',
    greeting: 'Amina',
    subtitle: 'Review risk, operations and platform performance.',
    accent: '#d97706',
  },
};

const navigation: Record<Role, NavItem[]> = {
  client: [
    { label: 'Overview', href: '/dashboard', icon: Home },
    {
      label: 'My requests',
      href: '/dashboard/requests',
      icon: BriefcaseBusiness,
    },
    { label: 'Wallet & payments', href: '/dashboard/payments', icon: WalletCards },
    { label: 'Documents', href: '/dashboard/documents', icon: FileCheck2 },
  ],
  expert: [
    { label: 'Overview', href: '/expert', icon: Home },
    {
      label: 'Assignments',
      href: '/expert/assignments',
      icon: BriefcaseBusiness,
    },
    { label: 'Applications', href: '/expert/applications', icon: BadgeCheck },
    { label: 'Wallet', href: '/expert/wallet', icon: WalletCards },
  ],
  admin: [
    { label: 'Overview', href: '/admin', icon: Home },
    { label: 'Applications', href: '/admin/applications', icon: BadgeCheck },
    { label: 'Disputes', href: '/admin/disputes', icon: Gavel },
    {
      label: 'Services & pricing',
      href: '/admin/pricing',
      icon: SlidersHorizontal,
    },
    { label: 'Roles & access', href: '/admin/roles', icon: ShieldCheck },
  ],
};

function Sidebar({
  role,
  mobileClose,
}: {
  role: Role;
  mobileClose?: () => void;
}) {
  const locationPathname = useLocationPathname();
  const pathname = (locationPathname ?? '').replace(/\/$/, '') || '/';
  const profile = profiles[role];
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#162c50] text-white">
      <Link
        href="/"
        onClick={mobileClose}
        className="flex h-20 shrink-0 items-center gap-3 border-b border-white/10 px-5"
      >
        <span className="grid size-10 place-items-center rounded-xl bg-[#2563eb]">
          <ShieldCheck className="size-6" />
        </span>
        <span>
          <strong className="block">KaziLedger</strong>
          <span className="text-xs text-blue-200/65">
            Trusted expert services
          </span>
        </span>
      </Link>
      <nav
        className="min-h-0 flex-1 overflow-y-auto px-3 py-5"
        aria-label={`${role} navigation`}
      >
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[.14em] text-blue-200/50">
          {role} workspace
        </p>
        <div className="space-y-1">
          {navigation[role].map(({ label, href, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={label}
                href={href}
                onClick={mobileClose}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${active ? 'bg-white/12 font-medium text-white' : 'text-blue-100/70 hover:bg-white/8 hover:text-white'}`}
              >
                <Icon className="size-[18px]" />
                {label}
              </Link>
            );
          })}
        </div>
        <p className="px-3 pb-2 pt-7 text-[11px] font-semibold uppercase tracking-[.14em] text-blue-200/50">
          Account
        </p>
        <Link
          href={role === 'client' ? '/dashboard/settings' : role === 'expert' ? '/expert/settings' : '/admin/settings'}
          onClick={mobileClose}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${pathname === (role === 'client' ? '/dashboard/settings' : role === 'expert' ? '/expert/settings' : '/admin/settings') ? 'bg-white/12 font-medium text-white' : 'text-blue-100/70 hover:bg-white/8 hover:text-white'}`}
        >
          <Settings className="size-[18px]" />
          Settings
        </Link>
      </nav>
      <div className="shrink-0 border-t border-white/10 p-3">
        <Link
          href="/login"
          onClick={() => clearToken()}
          className="flex items-center gap-3 rounded-xl p-2 hover:bg-white/8"
        >
          <span
            className="grid size-9 place-items-center rounded-full text-sm font-semibold"
            style={{ background: profile.accent }}
          >
            {profile.short}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {profile.name}
            </span>
            <span className="block truncate text-xs text-blue-200/55">
              {profile.type}
            </span>
          </span>
          <LogOut className="size-4 text-blue-200/55" />
        </Link>
      </div>
    </div>
  );
}

function StatusBadge({
  children,
  tone = 'blue',
}: {
  children: React.ReactNode;
  tone?: 'blue' | 'green' | 'amber' | 'red' | 'slate';
}) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    slate: 'bg-slate-100 text-slate-600',
  };
  return <Badge className={`border-0 ${tones[tone]}`}>{children}</Badge>;
}

function Metric({
  label,
  value,
  note,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  note: string;
  icon: typeof Home;
  color: string;
}) {
  return (
    <Card className="border-0 bg-white shadow-sm ring-1 ring-slate-200/70">
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-[#17243a]">
            {value}
          </p>
          <p className="mt-1 text-xs text-slate-400">{note}</p>
        </div>
        <span
          className="grid size-10 place-items-center rounded-xl"
          style={{ backgroundColor: `${color}12`, color }}
        >
          <Icon className="size-5" />
        </span>
      </CardContent>
    </Card>
  );
}

function ClientView({
  openRequest,
  openPayment,
}: {
  openRequest: () => void;
  openPayment: () => void;
}) {
  const rows = [
    [
      'SR-2048',
      'Monthly bookkeeping',
      'Grace N.',
      'Quote ready',
      'UGX 680,000',
      'blue',
    ],
    [
      'SR-2041',
      'Tax return preparation',
      'Daniel K.',
      'In progress',
      'UGX 420,000',
      'green',
    ],
    [
      'SR-2029',
      'Business registration',
      'Sarah A.',
      'Delivered',
      'UGX 350,000',
      'slate',
    ],
  ];
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Active requests"
          value="3"
          note="1 needs your review"
          icon={BriefcaseBusiness}
          color="#2563eb"
        />
        <Metric
          label="Held in escrow"
          value="UGX 1.10m"
          note="Protected by Pesapal"
          icon={ShieldCheck}
          color="#0f6e56"
        />
        <Metric
          label="Completed"
          value="12"
          note="2 this month"
          icon={FileCheck2}
          color="#1f3864"
        />
        <Metric
          label="Awaiting action"
          value="1"
          note="Quote expires tomorrow"
          icon={Clock3}
          color="#d97706"
        />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_.8fr]">
        <Card id="requests" className="border-0 bg-white shadow-sm">
          <CardHeader className="border-b">
            <CardTitle>My requests</CardTitle>
            <CardDescription>
              Every stage from matching to completion.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {rows.map(([id, service, expert, status, amount, tone]) => (
                <button
                  key={id}
                  className="grid w-full grid-cols-[1fr_auto] items-center gap-3 px-5 py-4 text-left hover:bg-slate-50 sm:grid-cols-[1.4fr_1fr_120px_120px_auto]"
                >
                  <div>
                    <p className="font-medium text-[#17243a]">{service}</p>
                    <p className="text-xs text-slate-400">{id}</p>
                  </div>
                  <span className="hidden text-sm text-slate-500 sm:block">
                    {expert}
                  </span>
                  <StatusBadge tone={tone as 'blue'}>{status}</StatusBadge>
                  <strong className="hidden text-sm sm:block">{amount}</strong>
                  <ChevronRight className="size-4 text-slate-400" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card id="payments" className="border-0 bg-[#1f3864] text-white">
          <CardContent className="p-6">
            <StatusBadge tone="amber">Action needed</StatusBadge>
            <CircleDollarSign className="mt-8 size-9 text-blue-300" />
            <h2 className="mt-5 text-xl font-semibold">Your quote is ready</h2>
            <p className="mt-2 text-sm leading-6 text-blue-100/70">
              Grace quoted UGX 680,000 for monthly bookkeeping.
            </p>
            <div className="mt-5 rounded-xl bg-white/8 p-4">
              <p className="text-xs text-blue-200">
                Escrow-protected labour fee
              </p>
              <p className="mt-1 text-2xl font-semibold">UGX 680,000</p>
            </div>
            <Button
              onClick={openPayment}
              className="mt-5 w-full bg-[#2563eb] hover:bg-blue-500"
            >
              Review & pay <ChevronRight />
            </Button>
          </CardContent>
        </Card>
      </div>
      <Button
        onClick={openRequest}
        className="fixed bottom-5 right-5 h-12 rounded-full px-5 shadow-xl sm:hidden"
      >
        <Plus />
        New request
      </Button>
    </>
  );
}

function ExpertView() {
  const [available, setAvailable] = useState(true);
  const [withdrawn, setWithdrawn] = useState(false);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="New assignments"
          value="2"
          note="Respond within 24 hours"
          icon={BriefcaseBusiness}
          color="#2563eb"
        />
        <Metric
          label="Wallet balance"
          value="UGX 2.84m"
          note="Ready to withdraw"
          icon={WalletCards}
          color="#0f6e56"
        />
        <Metric
          label="Jobs in progress"
          value="4"
          note="1 due today"
          icon={Activity}
          color="#1f3864"
        />
        <Metric
          label="Client rating"
          value="4.9"
          note="From 38 completed jobs"
          icon={BadgeCheck}
          color="#d97706"
        />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_.8fr]">
        <Card id="assignments" className="border-0">
          <CardHeader className="border-b">
            <CardTitle>Assignment inbox</CardTitle>
            <CardDescription>
              Only requests matching your approved services.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            {[
              [
                'Monthly bookkeeping',
                'Nile & Pine Traders',
                '18h left',
                'UGX 450k–800k',
              ],
              [
                'Payroll management',
                'Lakeview Foods',
                '22h left',
                'UGX 300k–550k',
              ],
            ].map(([service, client, time, band]) => (
              <div key={service} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{service}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {client} · SME
                    </p>
                  </div>
                  <StatusBadge tone="amber">
                    <Clock3 />
                    {time}
                  </StatusBadge>
                </div>
                <p className="mt-4 text-xs text-slate-400">
                  Allowed quote band
                </p>
                <p className="mt-1 text-sm font-semibold">{band}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm">Create quote</Button>
                  <Button size="sm" variant="outline">
                    Ask for information
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-600">
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Availability</CardTitle>
              <CardDescription>
                Controls new round-robin assignments.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="font-medium">Accept new work</p>
                <p className="text-xs text-slate-500">Monthly bookkeeping</p>
              </div>
              <Switch
                aria-label="Accept new monthly bookkeeping assignments"
                checked={available}
                onCheckedChange={setAvailable}
              />
            </CardContent>
          </Card>
          <Card id="wallet" className="border-0 bg-[#1f3864] text-white">
            <CardContent className="p-6">
              <Banknote className="size-8 text-blue-300" />
              <p className="mt-7 text-sm text-blue-200">Available balance</p>
              <p className="mt-1 text-3xl font-semibold">UGX 2,840,000</p>
              <p className="mt-2 text-xs text-blue-200/65">
                Commission already deducted
              </p>
              <Button
                onClick={() => setWithdrawn(true)}
                className="mt-5 w-full bg-white text-[#1f3864] hover:bg-blue-50"
              >
                {withdrawn ? 'Withdrawal queued' : 'Withdraw to mobile money'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function AdminView() {
  const [applications, setApplications] = useState([
    [
      'EX-284',
      'Moses Okello',
      'Tax preparation',
      'Interview complete',
      'amber',
    ],
    [
      'EX-281',
      'Joan Achieng',
      'Monthly bookkeeping',
      'Documents pending',
      'blue',
    ],
    [
      'EX-277',
      'Peter Ssemanda',
      'Payroll management',
      'Ready to review',
      'green',
    ],
  ]);
  const remove = (id: string) =>
    setApplications((items) => items.filter((item) => item[0] !== id));
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Pending applications"
          value="8"
          note="3 interviews completed"
          icon={BadgeCheck}
          color="#2563eb"
        />
        <Metric
          label="Open escrow"
          value="UGX 18.4m"
          note="Across 26 jobs"
          icon={ShieldCheck}
          color="#0f6e56"
        />
        <Metric
          label="Open disputes"
          value="3"
          note="Oldest is 19 hours"
          icon={Gavel}
          color="#d97706"
        />
        <Metric
          label="Commission revenue"
          value="UGX 4.28m"
          note="This month"
          icon={Banknote}
          color="#1f3864"
        />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.55fr_.8fr]">
        <Card id="applications">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Expert applications</CardTitle>
                <CardDescription>
                  Document review and offline interview outcomes.
                </CardDescription>
              </div>
              <Button size="sm" variant="outline">
                View all
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Applicant</th>
                    <th className="px-5 py-3 font-medium">Subcategory</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {applications.map(([id, name, service, status, tone]) => (
                    <tr key={id}>
                      <td className="px-5 py-4">
                        <p className="font-medium">{name}</p>
                        <p className="text-xs text-slate-400">{id}</p>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{service}</td>
                      <td className="px-5 py-4">
                        <StatusBadge tone={tone as 'amber'}>
                          {status}
                        </StatusBadge>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => remove(id)}>
                            <CheckCircle2 />
                            Approve
                          </Button>
                          <Button
                            aria-label="More application actions"
                            size="icon-sm"
                            variant="ghost"
                          >
                            <MoreHorizontal />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {applications.length === 0 && (
                <div className="p-8 text-center text-sm text-slate-500">
                  Application queue cleared.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        <Card id="disputes" className="border-0 bg-[#1f3864] text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <Gavel className="size-8 text-amber-300" />
              <StatusBadge tone="amber">3 open</StatusBadge>
            </div>
            <h2 className="mt-7 text-xl font-semibold">Dispute DSP-031</h2>
            <p className="mt-2 text-sm leading-6 text-blue-100/70">
              Delivery quality challenged. Escrow release is paused while
              evidence is reviewed.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-white/8 p-4 text-sm">
              <div>
                <p className="text-xs text-blue-200">Escrow</p>
                <p className="mt-1 font-semibold">UGX 680k</p>
              </div>
              <div>
                <p className="text-xs text-blue-200">Age</p>
                <p className="mt-1 font-semibold">19 hours</p>
              </div>
            </div>
            <Button className="mt-5 w-full bg-[#2563eb]">Open mediation</Button>
          </CardContent>
        </Card>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card id="pricing">
          <CardHeader>
            <CardTitle>Catalog & price bands</CardTitle>
            <CardDescription>
              Quote limits by subcategory and client type.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              ['Monthly bookkeeping', 'SME', 'UGX 450k–800k'],
              ['Tax preparation', 'Individual', 'UGX 180k–420k'],
              ['Payroll management', 'SME', 'UGX 300k–550k'],
            ].map((row) => (
              <div
                key={row[0]}
                className="flex items-center justify-between gap-4 rounded-xl border p-3"
              >
                <div>
                  <p className="text-sm font-medium">{row[0]}</p>
                  <p className="text-xs text-slate-400">{row[1]}</p>
                </div>
                <strong className="text-sm">{row[2]}</strong>
              </div>
            ))}
            <Button variant="outline" className="w-full">
              <Plus />
              Add price band
            </Button>
          </CardContent>
        </Card>
        <Card id="roles">
          <CardHeader>
            <CardTitle>Roles & access</CardTitle>
            <CardDescription>
              Database-backed permissions enforced by the API.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              ['Super Admin', '1 user', 'All permissions'],
              ['Reviewer', '3 users', 'Applications, documents'],
              ['Finance', '2 users', 'Escrow, wallets, payouts'],
            ].map(([role, users, scope]) => (
              <div
                key={role}
                className="flex items-center gap-3 rounded-xl border p-3"
              >
                <span className="grid size-9 place-items-center rounded-lg bg-blue-50 text-[#2563eb]">
                  <ShieldCheck className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{role}</p>
                  <p className="truncate text-xs text-slate-400">{scope}</p>
                </div>
                <span className="text-xs text-slate-500">{users}</span>
              </div>
            ))}
            <Button variant="outline" className="w-full">
              <Plus />
              Create role
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export function DashboardShell({
  workspace,
  pageTitle,
  pageSubtitle,
  section,
  children,
}: {
  workspace: Role;
  pageTitle?: string;
  pageSubtitle?: string;
  section?: WorkspaceSection;
  children?: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [requestOpen, setRequestOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const role = workspace;
  const profile = profiles[role];
  const action =
    role === 'client'
      ? 'New service request'
      : role === 'expert'
        ? 'Update availability'
        : 'Review applications';
  const filteredHint = useMemo(
    () => (search ? `Showing matches for “${search}”` : ''),
    [search],
  );
  return (
    <div className="min-h-screen bg-[#f7f8fa] text-[#202936]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">
        <Sidebar role={role} />
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-18 items-center gap-3 border-b bg-white/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" className="lg:hidden" />
              }
            >
              <Menu />
              <span className="sr-only">Open navigation</span>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[min(86vw,280px)] border-0 p-0"
            >
              <SheetTitle className="sr-only">{role} navigation</SheetTitle>
              <Sidebar role={role} mobileClose={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="relative hidden w-full max-w-md sm:block">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 bg-slate-50 pl-9"
              placeholder="Search this workspace"
            />
          </div>
          <Button
            aria-label="Open notifications"
            variant="ghost"
            size="icon"
            className="ml-auto relative"
            onClick={() => setNotice('You’re all caught up.')}
          >
            <Bell />
            <span className="absolute right-1 top-1 size-2 rounded-full bg-amber-500 ring-2 ring-white" />
          </Button>
          <div className="hidden items-center gap-2 rounded-xl border px-2 py-1.5 sm:flex">
            <span
              className="grid size-7 place-items-center rounded-full text-[10px] font-semibold text-white"
              style={{ background: profile.accent }}
            >
              {profile.short}
            </span>
            <div className="pr-1">
              <p className="text-xs font-medium">{profile.name}</p>
              <p className="text-[10px] text-slate-400">{profile.type}</p>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <div className="flex items-center gap-2">
                <Link
                  href="/"
                  className="text-sm text-slate-400 hover:text-[#2563eb]"
                >
                  KaziLedger
                </Link>
                <ChevronRight className="size-3 text-slate-300" />
                <span className="text-sm capitalize text-slate-500">
                  {role}
                </span>
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-.035em] text-[#17243a]">
                {pageTitle ?? `Good morning, ${profile.greeting}`}
              </h1>
              <p className="mt-2 text-sm text-slate-500">{pageSubtitle ?? profile.subtitle}</p>
            </div>
            <Button
              onClick={() =>
                role === 'client'
                  ? setRequestOpen(true)
                  : setNotice(
                      role === 'expert'
                        ? 'Availability settings saved.'
                        : 'Application queue is ready for review.',
                    )
              }
              className="h-11 bg-[#1f3864] px-4 hover:bg-[#162c50]"
            >
              <Plus />
              {action}
            </Button>
          </div>
          {filteredHint && (
            <p className="mt-5 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
              {filteredHint}
            </p>
          )}
          {notice && (
            <output className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              <span>{notice}</span>
              <button
                aria-label="Dismiss notification"
                onClick={() => setNotice('')}
              >
                <XCircle className="size-4" />
              </button>
            </output>
          )}
          <div className="mt-7">
            {children ?? (pageTitle ? (
              <Card className="border-0 bg-white shadow-sm ring-1 ring-slate-200/70">
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-slate-500">{role} workspace</p>
                  <h2 className="mt-2 text-xl font-semibold text-[#17243a]">{pageTitle}</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{pageSubtitle}</p>
                </CardContent>
              </Card>
            ) : role === 'client' ? (
              <ClientView
                openRequest={() => setRequestOpen(true)}
                openPayment={() => setPaymentOpen(true)}
              />
            ) : role === 'expert' ? (
              <ExpertView />
            ) : (
              <AdminView />
            ))}
          </div>
          {section && <WorkflowPanel role={role} section={section} />}
        </main>
      </div>
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create a service request</DialogTitle>
            <DialogDescription>
              We’ll match you with the next available expert in this
              subcategory.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setRequestOpen(false);
              setNotice(
                'Request SR-2052 created. Expert matching has started.',
              );
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="service">Accounting service</Label>
              <select
                id="service"
                required
                className="h-10 w-full rounded-lg border bg-white px-3 text-sm"
              >
                <option value="">Choose a service</option>
                <option>Monthly bookkeeping</option>
                <option>Tax return preparation</option>
                <option>Business registration</option>
                <option>Payroll management</option>
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="type">Client type</Label>
                <select
                  id="type"
                  className="h-10 w-full rounded-lg border bg-white px-3 text-sm"
                >
                  <option>SME</option>
                  <option>Individual</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Preferred start</Label>
                <Input id="date" type="date" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="scope">Scope details</Label>
              <Textarea
                id="scope"
                required
                className="min-h-28"
                placeholder="Reporting period, records available, transaction volume and expected outcome"
              />
            </div>
            <p className="rounded-lg bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
              Only the labour fee is collected into platform escrow. Statutory
              fees remain separate.
            </p>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRequestOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Submit request</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pay labour fee</DialogTitle>
            <DialogDescription>
              Continue securely through Pesapal using MTN or Airtel Money.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {['MTN Mobile Money', 'Airtel Money'].map((provider, index) => (
              <button
                key={provider}
                aria-label={`Select ${provider}`}
                aria-pressed={index === 0}
                className={`flex w-full items-center justify-between rounded-xl p-4 text-left ${index === 0 ? 'border-2 border-blue-500 bg-blue-50' : 'border'}`}
              >
                <span>
                  <strong className="block text-sm">{provider}</strong>
                  <span className="text-xs text-slate-500">
                    UGX mobile money payment
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className={`size-5 rounded-full border-2 ${index === 0 ? 'border-blue-600 bg-blue-600 shadow-[inset_0_0_0_4px_white]' : 'border-slate-300'}`}
                />
              </button>
            ))}
          </div>
          <div className="flex justify-between border-t pt-4 text-sm">
            <span className="text-slate-500">Escrow total</span>
            <strong>UGX 680,000</strong>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setPaymentOpen(false);
                setNotice('Secure Pesapal checkout initiated.');
              }}
            >
              Continue to Pesapal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
