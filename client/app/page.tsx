'use client';

import { useState } from 'react';
import Link from '@/components/static-link';
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Check,
  FileText,
  LockKeyhole,
  Menu,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PublicServiceCatalogue } from '@/components/public-service-catalogue';

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="min-h-screen bg-[#fbfcfe] text-[#1d2939]">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-3"
            aria-label="KaziLedger home"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-[#1f3864] text-white">
              <ShieldCheck className="size-6" />
            </span>
            <span>
              <strong className="block leading-4 text-[#17243a]">
                KaziLedger
              </strong>
              <span className="text-[11px] text-slate-500">
                Trusted expert services
              </span>
            </span>
          </Link>
          <nav
            className="ml-auto hidden items-center gap-7 lg:flex"
            aria-label="Public navigation"
          >
            <Link
              href="/services"
              className="text-sm font-medium text-slate-600 hover:text-[#2563eb]"
            >
              Services
            </Link>
            <a
              href="#how-it-works"
              className="text-sm font-medium text-slate-600 hover:text-[#2563eb]"
            >
              How it works
            </a>
            <a
              href="#payments"
              className="text-sm font-medium text-slate-600 hover:text-[#2563eb]"
            >
              Secure payments
            </a>
            <Link
              href="/register?role=expert"
              className="text-sm font-medium text-slate-600 hover:text-[#2563eb]"
            >
              For experts
            </Link>
          </nav>
          <div className="ml-auto hidden items-center gap-3 sm:flex lg:ml-8">
            <Button variant="ghost" render={<Link href="/login" />}>
              Sign in
            </Button>
            <Button
              className="h-10 bg-[#1f3864] px-4 hover:bg-[#162c50]"
              render={<Link href="/register" />}
            >
              Get started <ArrowRight />
            </Button>
          </div>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="ml-auto grid size-10 place-items-center rounded-lg hover:bg-slate-100 sm:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
          >
            <span className="sr-only">Toggle menu</span>
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
        {menuOpen && (
          <div
            id="mobile-menu"
            className="border-t bg-white px-4 py-4 sm:hidden"
          >
            <nav className="grid gap-1">
              <Link
                onClick={() => setMenuOpen(false)}
                href="/services"
                className="rounded-lg px-3 py-3 text-sm font-medium hover:bg-slate-50"
              >
                Services
              </Link>
              <a
                onClick={() => setMenuOpen(false)}
                href="#how-it-works"
                className="rounded-lg px-3 py-3 text-sm font-medium hover:bg-slate-50"
              >
                How it works
              </a>
              <a
                onClick={() => setMenuOpen(false)}
                href="#payments"
                className="rounded-lg px-3 py-3 text-sm font-medium hover:bg-slate-50"
              >
                Secure payments
              </a>
              <Link
                href="/register?role=expert"
                className="rounded-lg px-3 py-3 text-sm font-medium hover:bg-slate-50"
              >
                For experts
              </Link>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button variant="outline" render={<Link href="/login" />}>
                  Sign in
                </Button>
                <Button render={<Link href="/register" />}>Get started</Button>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-slate-200/70 bg-white">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#1f3864] via-[#2563eb] to-[#0f6e56]" />
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-22 lg:grid-cols-[1fr_.9fr] lg:px-8 lg:py-26">
            <div className="max-w-2xl">
              <Badge className="mb-5 border-blue-200 bg-blue-50 text-[#1d4ed8]">
                <Sparkles />
                Vetted professional services
              </Badge>
              <h1 className="text-4xl font-semibold leading-[1.08] tracking-[-0.045em] text-[#17243a] sm:text-5xl lg:text-[62px]">
                Expert help for the work that moves life and business forward.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
                Find trusted specialists across business, legal, technology,
                creative, and financial services. Get clear quotes, follow
                delivery, and protect every professional-fee payment in escrow.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  size="lg"
                  className="h-12 bg-[#1f3864] px-5 text-base hover:bg-[#162c50]"
                  render={<Link href="/services" />}
                >
                  Find an expert <ArrowRight />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 px-5 text-base"
                  render={<Link href="/register?role=expert" />}
                >
                  Join as an expert
                </Button>
              </div>
              <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
                {[
                  'Vetted specialists',
                  'Price-band protection',
                  'MTN & Airtel via Pesapal',
                ].map((item) => (
                  <span key={item} className="flex items-center gap-2">
                    <Check className="size-4 text-[#0f6e56]" />
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-xl lg:mx-0">
              <div className="absolute -inset-8 rounded-full bg-blue-100/50 blur-3xl" />
              <Card className="relative overflow-visible border-0 bg-white p-2 shadow-[0_30px_80px_rgba(31,56,100,.16)] ring-1 ring-slate-200">
                <div className="rounded-xl bg-[#1f3864] p-5 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-blue-200">Protected payment</p>
                      <p className="mt-1 text-2xl font-semibold">UGX 680,000</p>
                    </div>
                    <span className="grid size-11 place-items-center rounded-xl bg-white/10">
                      <LockKeyhole />
                    </span>
                  </div>
                  <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-2/3 rounded-full bg-[#60a5fa]" />
                  </div>
                  <div className="mt-2 flex justify-between text-[11px] text-blue-200">
                    <span>Quote accepted</span>
                    <span>Delivery review</span>
                  </div>
                </div>
                <CardContent className="space-y-1 px-3 py-3">
                  <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Request activity
                  </p>
                  {[
                    [
                      'Website development',
                      'Quote ready',
                      'bg-blue-50 text-blue-700',
                    ],
                    [
                      'Legal contract review',
                      'In progress',
                      'bg-emerald-50 text-emerald-700',
                    ],
                    [
                      'Brand & graphic design',
                      'Delivered',
                      'bg-slate-100 text-slate-600',
                    ],
                  ].map(([name, status, tone]) => (
                    <div
                      key={name}
                      className="flex items-center gap-3 rounded-lg px-2 py-3"
                    >
                      <span className="grid size-9 place-items-center rounded-lg bg-slate-100">
                        <FileText className="size-4 text-slate-600" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{name}</p>
                        <p className="text-xs text-slate-400">
                          Vetted expert assigned
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-medium ${tone}`}
                      >
                        {status}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <div className="absolute -bottom-6 -left-3 flex items-center gap-3 rounded-xl border bg-white p-3 shadow-xl sm:-left-8">
                <span className="grid size-9 place-items-center rounded-full bg-emerald-50 text-[#0f6e56]">
                  <BadgeCheck />
                </span>
                <div>
                  <p className="text-xs font-semibold">Expert verified</p>
                  <p className="text-[11px] text-slate-500">
                    Documents + interview
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="services"
          className="mx-auto max-w-7xl px-4 py-18 sm:px-6 lg:px-8 lg:py-24"
        >
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-[#2563eb]">
              EXPERT SERVICES
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#17243a] sm:text-4xl">
              The right professional for the work in front of you
            </h2>
          </div>
          <div className="mt-10"><PublicServiceCatalogue featured /></div>
        </section>

        <section id="how-it-works" className="bg-[#f0f5fc]">
          <div className="mx-auto max-w-7xl px-4 py-18 sm:px-6 lg:px-8 lg:py-24">
            <div className="text-center">
              <p className="text-sm font-semibold text-[#0f6e56]">
                HOW IT WORKS
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#17243a]">
                From request to delivery, clearly managed
              </h2>
            </div>
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {[
                [
                  '01',
                  'Describe your need',
                  'Choose a service and answer a focused scope form.',
                ],
                [
                  '02',
                  'Review a fair quote',
                  'An available vetted expert responds within the published price band.',
                ],
                [
                  '03',
                  'Pay and track delivery',
                  'Pay the labour fee through Pesapal; escrow releases after approval.',
                ],
              ].map(([n, title, text]) => (
                <div
                  key={n}
                  className="relative rounded-2xl bg-white p-6 shadow-sm"
                >
                  <span className="text-4xl font-semibold text-blue-100">
                    {n}
                  </span>
                  <h3 className="mt-5 text-lg font-semibold text-[#17243a]">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="payments"
          className="mx-auto grid max-w-7xl gap-10 px-4 py-18 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-24"
        >
          <div>
            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
              <ShieldCheck />
              Escrow protection
            </Badge>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-[#17243a] sm:text-4xl">
              Clear money movement at every step
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Only professional labour fees pass through KaziLedger. Deposits
              and statutory charges stay separate, so clients know exactly what
              escrow protects.
            </p>
            <div className="mt-7 space-y-4">
              {[
                'MTN Mobile Money and Airtel Money through Pesapal',
                'Commission deducted only when escrow is released',
                'Dispute window pauses automatic release',
                'Complete wallet and payment transaction history',
              ].map((item) => (
                <div key={item} className="flex gap-3">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-emerald-50">
                    <Check className="size-4 text-[#0f6e56]" />
                  </span>
                  <span className="text-sm text-slate-600">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl bg-[#172c4f] p-7 text-white sm:p-9">
            <Banknote className="size-10 text-blue-300" />
            <p className="mt-8 text-sm text-blue-200">Payment status</p>
            <p className="mt-2 text-3xl font-semibold">Funds protected</p>
            <div className="mt-8 space-y-4 border-t border-white/10 pt-6">
              {[
                ['Labour fee', 'UGX 680,000'],
                ['Platform deposit', 'Not applicable'],
                ['Payment provider', 'Pesapal'],
                ['Release', 'After delivery review'],
              ].map(([key, value]) => (
                <div key={key} className="flex justify-between gap-5 text-sm">
                  <span className="text-blue-200/70">{key}</span>
                  <strong className="text-right font-medium">{value}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#1f3864] text-white">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center lg:px-8">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Ready to find the right expert?
              </h2>
              <p className="mt-2 text-blue-100/75">
                Create a request and meet the right expert for the work.
              </p>
            </div>
            <Button
              size="lg"
              className="h-12 bg-white px-5 text-[#1f3864] hover:bg-blue-50"
              render={<Link href="/services" />}
            >
              Start a request <ArrowRight />
            </Button>
          </div>
        </section>
      </main>
      <footer className="bg-[#142744] text-blue-100/70">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-white">
            <ShieldCheck className="size-5" />
            <strong>KaziLedger</strong>
          </div>
          <p>© 2026 KaziLedger. Trusted expert services.</p>
          <div className="flex gap-5">
            <Link href="/terms" className="hover:text-white">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-white">
              Privacy
            </Link>
            <a
              href="mailto:support@kaziledger.example"
              className="hover:text-white"
            >
              Help
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
