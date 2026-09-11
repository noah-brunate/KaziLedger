import { DashboardShell } from '@/components/dashboard-shell';
import type { WorkspaceSection } from '@/components/workflow-panel';

type Role = 'client' | 'expert' | 'admin';

export function WorkspacePage({
  workspace,
  title,
  description,
  section,
}: {
  workspace: Role;
  title: string;
  description: string;
  section: WorkspaceSection;
}) {
  return (
    <DashboardShell
      workspace={workspace}
      pageTitle={title}
      pageSubtitle={description}
      section={section}
    />
  );
}
