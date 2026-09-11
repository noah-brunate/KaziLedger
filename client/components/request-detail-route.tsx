'use client';

import Link from '@/components/static-link';
import { DashboardShell } from '@/components/dashboard-shell';
import { RequestDetail } from '@/components/request-detail';
import { useLocationSearch } from '@/lib/browser-location';

type Workspace = 'client' | 'expert';

export function RequestDetailRoute({ workspace }: { workspace: Workspace }) {
  const search = useLocationSearch();
  const requestId = new URLSearchParams(search ?? '').get('id');

  if (search === null) return null;

  if (requestId) {
    return <RequestDetail workspace={workspace} requestId={requestId} />;
  }

  const back = workspace === 'client' ? '/dashboard/requests' : '/expert/assignments';
  return (
    <DashboardShell
      workspace={workspace}
      pageTitle="Request details"
      pageSubtitle="Choose a request before opening its details."
    >
      <Link className="text-sm font-medium text-blue-700" href={back}>
        Back to {workspace === 'client' ? 'requests' : 'assignments'}
      </Link>
    </DashboardShell>
  );
}
