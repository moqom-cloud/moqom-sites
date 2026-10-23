// Copied from the viewer repo (packages/core/src/license-client.ts) by scripts/sync-docs.mjs. Edit it there.
// Licence check for client-side plugins (React, Vue, Framer, Wix, Shopify, HubSpot), run by
// <ew-viewer> when a plugin writes `plugin` and `license-key` attributes.
//
// One GET per key per page, to an endpoint whose answer depends only on key and plugin, so
// Cloud CDN and the browser cache it (about weekly). No cookies, no referrer, nothing about the
// visitor is sent. The token is public and bound to the licence's hosts, so publishing the key
// in the page is expected.
//
// Fails open: if the server can't be reached and nothing is cached, or the token can't be
// verified in this browser, the result is "unknown" and no badge is shown.
import { LICENSING, isPaidPlugin } from './licensing-config.js';
import { hostCovered, isEditorHost, isLocalHost, verifyToken } from './license.js';

export type LicenseState = 'licensed' | 'unlicensed' | 'expired' | 'unknown' | 'local' | 'editor';

export interface LicenseResult {
  state: LicenseState;
  reason?: string;
}

export interface LicenseCheckOptions {
  plugin: string;
  key: string | null;
  hostname: string;
  /** Overrides for tests. */
  fetch?: typeof fetch;
  keys?: Readonly<Record<string, string>>;
  api?: string;
  now?: number;
}

/** Whether a state shows the "Unlicensed" badge. */
export const showsBadge = (state: LicenseState): boolean => state === 'unlicensed' || state === 'expired';

const pending = new Map<string, Promise<LicenseResult>>();

export function clearLicenseCache(): void {
  pending.clear();
}

export function checkLicense(options: LicenseCheckOptions): Promise<LicenseResult> {
  const id = `${options.api ?? ''}|${options.plugin}|${options.key ?? ''}|${options.hostname}`;
  let result = pending.get(id);
  if (!result) {
    result = run(options);
    pending.set(id, result);
  }
  return result;
}

async function run(o: LicenseCheckOptions): Promise<LicenseResult> {
  if (!isPaidPlugin(o.plugin)) return { state: 'unknown', reason: 'not-a-plugin' };
  if (isLocalHost(o.hostname)) return { state: 'local' };
  if (isEditorHost(o.plugin, o.hostname)) return { state: 'editor' };
  const keys = o.keys ?? LICENSING.publicKeys;
  if (Object.keys(keys).length === 0) return { state: 'unknown', reason: 'not-configured' };
  const key = (o.key ?? '').trim();
  if (!key) return { state: 'unlicensed', reason: 'no-key' };

  const doFetch = o.fetch ?? globalThis.fetch?.bind(globalThis);
  if (!doFetch) return { state: 'unknown', reason: 'no-fetch' };
  const url = `${o.api ?? LICENSING.api}/v1/token?plugin=${encodeURIComponent(o.plugin)}&key=${encodeURIComponent(key)}`;
  const init: RequestInit = { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' };

  let response: Response | null = null;
  try {
    response = await doFetch(url, { ...init, cache: 'default' });
  } catch {
    response = null;
  }
  if (!response || response.status >= 500) {
    // Server unreachable: use the last cached answer, however old. The token's own expiry is
    // the grace period.
    try {
      response = await doFetch(url, { ...init, cache: 'force-cache' });
    } catch {
      return { state: 'unknown', reason: 'unreachable' };
    }
    if (response.status >= 500) return { state: 'unknown', reason: 'unreachable' };
  }

  let body: { status?: string; token?: string } = {};
  try {
    body = await response.json();
  } catch {
    return { state: 'unknown', reason: 'bad-response' };
  }
  if (response.status === 403 || response.status === 404) {
    return { state: body.status === 'expired' ? 'expired' : 'unlicensed', reason: body.status ?? String(response.status) };
  }
  if (!response.ok || typeof body.token !== 'string') return { state: 'unknown', reason: 'bad-response' };

  const check = await verifyToken(body.token, keys, o.now);
  if (!check.ok && check.reason !== 'expired') return { state: 'unknown', reason: check.reason };
  const claims = check.claims;
  if (claims.plugin !== o.plugin) return { state: 'unlicensed', reason: 'wrong-plugin' };
  if (!hostCovered(claims.hosts, o.hostname)) return { state: 'unlicensed', reason: 'wrong-host' };
  if (!check.ok) return { state: 'expired', reason: 'grace-over' };
  return { state: 'licensed' };
}
