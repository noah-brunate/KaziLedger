import { Suspense } from 'react';
import { RequestDetailRoute } from '@/components/request-detail-route';

export default function ClientRequestDetailPage() {
  return (
    <Suspense fallback={null}>
      <RequestDetailRoute workspace="client" />
    </Suspense>
  );
}
