import type { SessionUser } from '../common/session.types';

/**
 * The one local sign-in user (AUTH_MODE=dev, never allowed in production). Everyone has the same
 * access, so there is nothing to choose between. The email matches the demo data from
 * `npm run seed:demo`.
 */
export const DEV_USER: SessionUser = {
  id: 'dev-user',
  displayName: 'Subash',
  email: 'subash@contoso.dev',
  jobTitle: 'UI/UX Designer',
  roles: ['Admin'],
};
