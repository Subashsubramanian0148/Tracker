import { ShieldCheck } from 'lucide-react';
import { Outlet } from 'react-router';
import { ForbiddenPage } from '../../app/ErrorPages';
import { DarkPill, PageHeader } from '../../app/PageHeader';
import { isAdmin, useMe } from '../../lib/auth';

export function AdminLayout() {
  const me = useMe();
  if (!isAdmin(me.user))
    return <ForbiddenPage description="The Admin area is only available to Managers." />;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Admin"
        badge={
          <DarkPill icon={<ShieldCheck aria-hidden className="size-3.5" />}>Restricted</DarkPill>
        }
        tabsLabel="Admin sections"
        tabs={[
          { to: '/admin/sync', label: 'Sync' },
          { to: '/admin/categories', label: 'Delay categories' },
          { to: '/admin/audit', label: 'Audit log' },
        ]}
      />
      <Outlet />
    </div>
  );
}
