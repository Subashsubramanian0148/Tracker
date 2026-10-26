import { ListTodo } from 'lucide-react';
import { Outlet } from 'react-router';
import { PageHeader } from '../../app/PageHeader';

/** Mode 1: tasks people log by hand. Everyone sees "Team"; only leads and managers can edit there. */
export function TasksLayout() {
  const tabs = [
    { to: '/tasks/mine', label: 'My tasks' },
    { to: '/tasks/team', label: 'Team' },
  ];
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tasks"
        icon={<ListTodo aria-hidden className="size-7 shrink-0 text-brand-bright" />}
        tabsLabel="Task views"
        tabs={tabs}
      />
      <Outlet />
    </div>
  );
}
