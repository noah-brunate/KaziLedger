import Link from '@/components/static-link';
import { ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PublicServiceCatalogue } from '@/components/public-service-catalogue';

export default function ServicesPage() {
  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#17243a]">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 font-semibold text-[#1f3864]">
            <ShieldCheck className="size-6" /> KaziLedger
          </Link>
          <div className="flex gap-2">
            <Button variant="ghost" render={<Link href="/login" />}>Sign in</Button>
            <Button className="bg-[#1f3864] hover:bg-[#162c50]" render={<Link href="/register" />}>Create account</Button>
          </div>
        </div>
      </header>
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <Badge className="border-blue-200 bg-blue-50 text-blue-700">Find an expert</Badge>
        <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">Choose the service you need</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">Explore the services offered by verified professionals. The catalogue is kept current by the KaziLedger team.</p>
        <div className="mt-10"><PublicServiceCatalogue /></div>
      </section>
    </main>
  );
}
