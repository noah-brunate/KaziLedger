import Link from '@/components/static-link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';

export function BackButton({
  href,
  label = 'Back',
  className,
}: {
  href: string;
  label?: string;
  className?: string;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      nativeButton={false}
      className={cn('text-slate-600 hover:text-[#2563eb]', className)}
      render={<Link href={href} aria-label={label} />}
    >
      <ArrowLeft />
      {label}
    </Button>
  );
}
