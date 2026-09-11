import Link from '@/components/static-link';
import { ArrowLeft, ArrowRight, Check, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getPublicService, publicServices } from '@/lib/services';

export function generateStaticParams() {
  return publicServices.map((service) => ({ slug: service.slug }));
}

export default async function ServiceDescriptionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = getPublicService(slug);

  if (!service) {
    return <main className="grid min-h-screen place-items-center bg-[#f7f8fa] p-6"><Card><CardContent className="space-y-4 p-7"><h1 className="text-xl font-semibold">Service not found</h1><Button render={<Link href="/services" />}>Browse services</Button></CardContent></Card></main>;
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#17243a]">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 font-semibold text-[#1f3864]"><ShieldCheck className="size-6" /> KaziLedger</Link>
          <Button variant="ghost" render={<Link href="/services" />}>All services</Button>
        </div>
      </header>
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:py-20">
        <Link href="/services" className="inline-flex items-center gap-2 text-sm font-medium text-blue-700"><ArrowLeft className="size-4" /> Back to services</Link>
        <Badge className="mt-8 border-blue-200 bg-blue-50 text-blue-700">Vetted specialist support</Badge>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">{service.name}</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">{service.description}</p>
        <div className="mt-10 grid gap-5 md:grid-cols-[1.2fr_.8fr]">
          <Card className="border-0 bg-white shadow-sm ring-1 ring-slate-200"><CardContent className="p-6"><h2 className="text-xl font-semibold">What this service includes</h2><ul className="mt-5 space-y-4">{service.includes.map((item) => <li key={item} className="flex gap-3 text-slate-600"><Check className="mt-1 size-5 shrink-0 text-[#0f6e56]" />{item}</li>)}</ul></CardContent></Card>
          <Card className="border-0 bg-[#1f3864] text-white shadow-sm"><CardContent className="p-6"><p className="text-sm font-semibold text-blue-200">A good fit for</p><p className="mt-3 leading-7 text-blue-50">{service.suitableFor}</p><p className="mt-7 text-sm text-blue-100">Create an account to request this service and be matched with an available expert.</p><Button className="mt-5 w-full bg-white text-[#1f3864] hover:bg-blue-50" render={<Link href={`/register?service=${service.slug}`} />}>Choose this service <ArrowRight /></Button></CardContent></Card>
        </div>
      </section>
    </main>
  );
}
