/**
 * VenueVue 2.3 - device (tablet) identity.
 *
 * Every write to the API has to carry a `tablet_id` so the owner can tell which
 * physical unit a session belongs to. Staff must never have to type it, so the
 * value lives in localStorage and is injected automatically:
 *
 *   <AuthContext>.login()          -> tablet_id from getTabletId()
 *   <AuthContext>.fetchWithAuth()  -> every JSON body stamped via withTabletId()
 *
 * Both paths are automatic, so no screen ever has to think about it; the
 * second one is what carries sync.php's required `tablet_id` field.
 *
 * The key is `VENUEVUE_TABLET_ID` and falls back to `T-01` on a device that has
 * never been provisioned.
 */

/** Canonical storage key for this device's identifier. */
export const TABLET_ID_STORAGE_KEY = 'VENUEVUE_TABLET_ID';

/** Used when the tablet has never been provisioned. */
export const DEFAULT_TABLET_ID = 'T-01';

/** Pre-2.3 key, still read once so existing tablets keep their identity. */
const LEGACY_TABLET_ID_STORAGE_KEY = 'venuevue.auth.tabletId';

/**
 * Mirrors the rule enforced by backend/auth.php, so a corrupted or hand-edited
 * localStorage value is repaired here instead of coming back as HTTP 422.
 */
const TABLET_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

function readKey(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    /* Storage can be unavailable (private mode / disabled cookies). */
    return null;
  }
}

function writeKey(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Non-fatal: the device simply falls back to the default next time. */
  }
}

function removeKey(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* Ignore. */
  }
}

/** True only for `{}`-literals (and null-prototype objects), not arrays/blobs. */
function isPlainObject(value) {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** True when `value` is a tablet id the backend will accept. */
export function isValidTabletId(value) {
  return typeof value === 'string' && TABLET_ID_PATTERN.test(value.trim());
}

/** Pin this device to a specific identifier. Invalid input is ignored. */
export function setTabletId(tabletId) {
  if (!isValidTabletId(tabletId)) {
    return getTabletId();
  }

  const normalized = tabletId.trim();
  writeKey(TABLET_ID_STORAGE_KEY, normalized);
  return normalized;
}

/**
 * Resolve this device's identifier, provisioning it on first use.
 *
 * Runs on every login, so it is deliberately cheap and never throws.
 *
 * @returns {string} A value that satisfies the backend's tablet_id rule.
 */
export function getTabletId() {
  const stored = readKey(TABLET_ID_STORAGE_KEY);
  if (isValidTabletId(stored)) {
    return stored.trim();
  }

  // One-time migration from the key used before Rev 2.3.
  const legacy = readKey(LEGACY_TABLET_ID_STORAGE_KEY);
  if (isValidTabletId(legacy)) {
    const migrated = legacy.trim();
    writeKey(TABLET_ID_STORAGE_KEY, migrated);
    removeKey(LEGACY_TABLET_ID_STORAGE_KEY);
    return migrated;
  }

  writeKey(TABLET_ID_STORAGE_KEY, DEFAULT_TABLET_ID);
  return DEFAULT_TABLET_ID;
}

/**
 * Stamp a request payload with this device's identifier.
 *
 * A caller-supplied `tablet_id` wins, so an explicit override stays possible,
 * and anything that is not a plain object (null, a string, an array, a
 * FormData) is passed through untouched - a spread would silently reshape it,
 * so wrapping a request can never damage the body it was given.
 *
 * @param {unknown} [payload]
 * @returns {unknown} `payload` plus `tablet_id` when it is a plain object.
 */
export function withTabletId(payload) {
  if (payload === undefined) {
    return { tablet_id: getTabletId() };
  }

  if (!isPlainObject(payload)) {
    return payload;
  }

  if ('tablet_id' in payload) {
    return { ...payload };
  }

  return { ...payload, tablet_id: getTabletId() };
}
