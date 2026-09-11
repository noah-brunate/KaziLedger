'use client';

import { useEffect, useState } from 'react';
import Link from '@/components/static-link';
import { ArrowRight, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type PublicService = {
  id: string;
  name: string;
  category: string;
  scope_schema: Record<string, unknown>;
};

export function PublicServiceCatalogue({ featured = false }: { featured?: boolean }) {
  const [services, setServices] = useState<PublicService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    void api<PublicService[]>('/services')
      .then(setServices)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (error) return <p className="text-slate-500">The service catalogue is temporarily unavailable. Please try again shortly.</p>;
  if (loading) return <p className="text-slate-500">Loading available services…</p>;
  if (!services.length) return <p className="text-slate-500">New services will be available here soon.</p>;

  const displayed = featured ? services.slice(0, 4) : services;
  return <div className={featured ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-4' : 'grid gap-5 md:grid-cols-2 lg:grid-cols-3'}>
    {displayed.map((service) => {
      const description = typeof service.scope_schema.description === 'string'
        ? service.scope_schema.description
        : `Connect with a vetted ${service.category.toLowerCase()} professional for this work.`;
      return <Card key={service.id} className="border-0 bg-white shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-lg">
        <CardContent className="flex h-full flex-col p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#2563eb]">{service.category}</p>
          <h3 className="mt-3 text-lg font-semibold text-[#17243a]">{service.name}</h3>
          <p className="mt-2 flex-1 text-sm leading-6 text-slate-500">{description}</p>
          <div className="mt-5 flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-xs text-[#0f6e56]"><Check className="size-4" /> Vetted support</span>
            <Button size="sm" className="bg-[#1f3864] hover:bg-[#162c50]" render={<Link href="/register" />}>Request <ArrowRight /></Button>
          </div>
        </CardContent>
      </Card>;
    })}
  </div>;
}
