import { createBrowserRouter, Navigate } from 'react-router';
import { BOARD_ONLY, PROJECT_HOME, TASKS_ENABLED } from '../lib/features';
import { AppRoot, ShellSkeleton } from './AppShell';
import { ForbiddenPage, NotFoundPage, RouteError } from './ErrorPages';
import { ProjectLayout } from './ProjectLayout';
import { RootRedirect } from './RootRedirect';

// Feature pages are code-split; charts (recharts) only load where used.
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppRoot />,
    errorElement: <RouteError />,
    hydrateFallbackElement: <ShellSkeleton />,
    children: [
      {
        errorElement: <RouteError />,
        children: [
          { index: true, element: <RootRedirect /> },
          {
            path: 'dashboard',
            lazy: async () => ({
              Component: (await import('../features/dashboard/DashboardPage')).DashboardPage,
            }),
          },
          {
            path: 'projects/:projectId',
            element: <ProjectLayout />,
            children: [
              { index: true, element: <Navigate to={PROJECT_HOME} replace /> },
              {
                path: 'overview',
                lazy: async () => ({
                  Component: (await import('../features/overview/OverviewPage')).OverviewPage,
                }),
              },
              {
                path: 'board',
                lazy: async () => ({
                  Component: (await import('../features/board/BoardPage')).BoardPage,
                }),
              },
              BOARD_ONLY
                ? { path: 'sprints', element: <Navigate to="../board" replace /> }
                : {
                    path: 'sprints',
                    lazy: async () => ({
                      Component: (await import('../features/sprints/SprintsPage')).SprintsPage,
                    }),
                  },
              BOARD_ONLY
                ? { path: 'delays', element: <Navigate to="../board" replace /> }
                : {
                    path: 'delays',
                    lazy: async () => ({
                      Component: (await import('../features/delays/DelaysPage')).DelaysPage,
                    }),
                  },
              BOARD_ONLY
                ? { path: 'people', element: <Navigate to="../board" replace /> }
                : {
                    path: 'people',
                    lazy: async () => ({
                      Component: (await import('../features/people/PeoplePage')).PeoplePage,
                    }),
                  },
              {
                path: 'work-items/:id',
                lazy: async () => ({
                  Component: (await import('../features/work-item/WorkItemPage')).WorkItemPage,
                }),
              },
            ],
          },
          // Tasks mode is parked (see lib/features.ts); old links land on the dashboard.
          TASKS_ENABLED
            ? {
                path: 'tasks',
                lazy: async () => ({
                  Component: (await import('../features/tasks/TasksLayout')).TasksLayout,
                }),
                children: [
                  { index: true, element: <Navigate to="mine" replace /> },
                  {
                    path: 'mine',
                    lazy: async () => ({
                      Component: (await import('../features/tasks/MyTasksPage')).MyTasksPage,
                    }),
                  },
                  {
                    path: 'team',
                    lazy: async () => ({
                      Component: (await import('../features/tasks/TeamTasksPage')).TeamTasksPage,
                    }),
                  },
                ],
              }
            : { path: 'tasks/*', element: <Navigate to="/dashboard" replace /> },
          {
            path: 'admin',
            lazy: async () => ({
              Component: (await import('../features/admin/AdminLayout')).AdminLayout,
            }),
            children: [
              { index: true, element: <Navigate to="sync" replace /> },
              {
                path: 'sync',
                lazy: async () => ({
                  Component: (await import('../features/admin/SyncTab')).SyncTab,
                }),
              },
              {
                path: 'categories',
                lazy: async () => ({
                  Component: (await import('../features/admin/CategoriesTab')).CategoriesTab,
                }),
              },
              {
                path: 'audit',
                lazy: async () => ({
                  Component: (await import('../features/admin/AuditTab')).AuditTab,
                }),
              },
            ],
          },
          { path: '403', element: <ForbiddenPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
