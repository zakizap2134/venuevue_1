/**
 * VenueVue 2.3 - back-office display data.
 *
 * Everything here is sample data for the owner console. The audit rows mirror the
 * shape of the `audit_logs` table and the actions the backend actually writes
 * (auth.php logs LOGIN_OK and LOGIN_FAIL, sync.php logs ORDER_COMMIT, the router
 * logs RBAC_DENIED), but nothing on this screen reads or writes the table: the
 * audit viewer is presentational until it is wired to an endpoint.
 *
 * `network` is likewise a literal. It is the address tablets type into the
 * browser on the shop hotspot, so it is configuration rather than something the
 * page can detect - a tablet reaching this screen is, by definition, already on
 * that network.
 */

/** Where the register is served to the venue floor. */
export const VENUE_NETWORK = {
  host: '192.168.137.1',
  port: 5173,
  label: 'Venue hotspot',
};

/** Owners only ever land on one route; this is the destination they delegate to. */
export const REGISTER_ROUTE = '/pos';

/**
 * Recent audit-trail entries, newest first.
 *
 * `tone` is a StatusPill tone, so the mapping from an action to a colour is data
 * rather than a branch inside the table: green for a session opened cleanly,
 * sky for a committed transaction, amber for an inventory warning, red for a
 * refused or failed event.
 */
export const DEMO_AUDIT_EVENTS = [
  {
    id: 'aud-8841',
    at: '08:26:40',
    action: 'LOGOUT',
    tone: 'neutral',
    actor: 'owner',
    ip: '192.168.137.24',
    detail: 'Session closed at the counter terminal',
  },
  {
    id: 'aud-8840',
    at: '08:24:03',
    action: 'LOGIN_FAIL',
    tone: 'out',
    actor: 'unknown',
    ip: '192.168.137.55',
    detail: 'auth.php · bad credentials · tablet T-01',
  },
  {
    id: 'aud-8839',
    at: '08:19:47',
    action: 'SYNC_OK',
    tone: 'in',
    actor: 'tablet',
    ip: '192.168.137.1',
    detail: '12 lines re-priced from the product table',
  },
  {
    id: 'aud-8838',
    at: '08:14:22',
    action: 'STOCK_LOW',
    tone: 'low',
    actor: 'system',
    ip: '127.0.0.1',
    detail: 'Iced Salted Caramel Latte below its reorder point',
  },
  {
    id: 'aud-8837',
    at: '08:11:08',
    action: 'RBAC_DENIED',
    tone: 'out',
    actor: 'barista',
    ip: '192.168.137.1',
    detail: 'Route /admin refused · OWNER required',
  },
  {
    id: 'aud-8836',
    at: '08:07:33',
    action: 'ORDER_COMMIT',
    tone: 'info',
    actor: 'barista',
    ip: '192.168.137.1',
    detail: 'sync.php · order #1041 · ₱150.00 · GCash',
  },
  {
    id: 'aud-8835',
    at: '08:04:51',
    action: 'ORDER_COMMIT',
    tone: 'info',
    actor: 'barista',
    ip: '192.168.137.1',
    detail: 'sync.php · order #1042 · ₱290.00 · Cash',
  },
  {
    id: 'aud-8834',
    at: '08:02:14',
    action: 'LOGIN_OK',
    tone: 'in',
    actor: 'owner',
    ip: '192.168.137.24',
    detail: 'auth.php · token issued · tablet T-01',
  },
];

/** Headline counts for the audit panel, derived so they cannot drift from the rows. */
export function auditSummary(events = DEMO_AUDIT_EVENTS) {
  const count = (action) => events.filter((event) => event.action === action).length;

  return {
    total: events.length,
    commits: count('ORDER_COMMIT'),
    denied: count('RBAC_DENIED') + count('LOGIN_FAIL'),
  };
}

/**
 * The read-only query behind the audit panel, kept runnable as-is.
 *
 * The trailing `--` comments are not decoration: every line the viewer renders
 * is a line an operator can paste into a MySQL client and get the same rows the
 * table above is showing.
 */
export const AUDIT_QUERY = `-- Audit trail is append-only: no UPDATE, no DELETE.
SELECT audit_log_id,
       action,
       user_id,
       ip_address,
       created_at
  FROM audit_logs
 WHERE created_at >= CURDATE()
 ORDER BY audit_log_id DESC
 LIMIT 20;`;
