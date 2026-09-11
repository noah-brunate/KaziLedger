import Link from '@/components/static-link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

export function LegalPage({
  title,
  intro,
  sections,
}: {
  title: string;
  intro: string;
  sections: Array<[string, string]>;
}) {
  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-18 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-[#1f3864]">
            <ShieldCheck />
            <strong>KaziLedger</strong>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-[#2563eb]"
          >
            <ArrowLeft className="size-4" />
            Back home
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="text-sm font-semibold text-[#2563eb]">
          LAST UPDATED 4 SEPTEMBER 2026
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[#17243a]">
          {title}
        </h1>
        <p className="mt-5 text-base leading-7 text-slate-600">{intro}</p>
        <div className="mt-10 space-y-9">
          {sections.map(([heading, body]) => (
            <section key={heading}>
              <h2 className="text-xl font-semibold text-[#17243a]">
                {heading}
              </h2>
              <p className="mt-3 leading-7 text-slate-600">{body}</p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
