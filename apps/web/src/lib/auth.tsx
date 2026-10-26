import type { CurrentUser, MeResponse, PersonRef, Role } from '@ado-metrics/shared';
import { createContext, use, type ReactNode } from 'react';

const MeContext = createContext<MeResponse | null>(null);

export function MeProvider({ value, children }: { value: MeResponse; children: ReactNode }) {
  return <MeContext value={value}>{children}</MeContext>;
}

/** Current session; only usable below the auth gate in AppRoot. */
export function useMe(): MeResponse {
  const me = use(MeContext);
  if (!me) throw new Error('useMe() used outside <MeProvider>');
  return me;
}

/** True when the user has any of the given roles. UI gating only — the API enforces access. */
export function hasRole(user: Pick<CurrentUser, 'roles'>, ...roles: Role[]): boolean {
  return user.roles.some((r) => roles.includes(r));
}

export const PEOPLE_ROLES: Role[] = ['TeamLead', 'Manager', 'Admin'];

/** Team Leads and Managers can edit anyone's task; Designers only their own. */
export function canEditTeamTasks(user: Pick<CurrentUser, 'roles'>): boolean {
  return hasRole(user, 'TeamLead', 'Manager', 'Admin');
}

export function canViewPeople(user: Pick<CurrentUser, 'roles'>): boolean {
  return hasRole(user, ...PEOPLE_ROLES);
}

/** Manager is the top role and owns the Admin area (sync, categories, audit log). */
export function isAdmin(user: Pick<CurrentUser, 'roles'>): boolean {
  return hasRole(user, 'Manager', 'Admin');
}

/** Leads/managers/admins, or the assignee of the item (email match, case-insensitive). */
export function canAddDelayReason(
  user: Pick<CurrentUser, 'roles' | 'email'>,
  assignedTo: PersonRef | null,
): boolean {
  if (hasRole(user, 'TeamLead', 'Manager', 'Admin')) return true;
  const email = assignedTo?.email;
  return !!email && !!user.email && email.toLowerCase() === user.email.toLowerCase();
}
