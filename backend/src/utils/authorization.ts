import { config } from '../config';

/**
 * The single definition of "is this account an administrator".
 *
 * This used to exist only inside requireAdmin, while the frontend independently checked
 * `role === 'ADMIN'`. The two disagreed: an operator granted access via ADMIN_EMAILS — the
 * documented way to grant admin without database access — could call every admin endpoint
 * but saw no admin navigation, because /auth/me never reported the ADMIN_EMAILS grant.
 *
 * Both the middleware and the serialised user payload now derive from this function, so
 * the API and the UI cannot drift apart again.
 */
export function isAdminUser(user: { email?: string | null; role?: string | null }): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;

  const email = (user.email || '').trim().toLowerCase();
  return email.length > 0 && config.adminEmails.includes(email);
}
