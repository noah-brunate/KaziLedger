import { Suspense } from 'react';
import { RequestDetailRoute } from '@/components/request-detail-route';

export default function ExpertAssignmentDetailPage() {
  return (
    <Suspense fallback={null}>
      <RequestDetailRoute workspace="expert" />
    </Suspense>
  );
}
