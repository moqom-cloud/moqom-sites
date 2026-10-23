// Copied from the viewer repo (packages/core/src/license.ts) by scripts/sync-docs.mjs. Edit it there.
// Licence tokens for the paid plugins: offline verification and host matching. DOM-free; uses
// WebCrypto Ed25519 (browsers since 2025, Node 20+). Format and rules match the Go server in
// services/licensing (internal/token and internal/hosts); shared test vectors keep them in step.
import { isPaidPlugin, type PaidPlugin } from './licensing-config.js';

export interface LicenseClaims {
  v: number;
  kid: string;
  lid: string;
  plugin: string;
  /** Hosts the licence names; local development hosts are covered by rule. */
  hosts: string[];
  plan: 'yearly' | 'lifetime';
  iat: number;
  /** End of the offline grace period (Unix seconds). */
  exp: number;
  until?: number;
}

export type TokenCheck =
  | { ok: true; claims: LicenseClaims }
  | { ok: false; reason: 'malformed' | 'unknown-key' | 'signature' | 'unsupported'; claims?: undefined }
  | { ok: false; reason: 'expired'; claims: LicenseClaims };

const PREFIX = 'ewv1';

function fromBase64Url(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return null;
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function isClaims(x: unknown): x is LicenseClaims {
  const c = x as LicenseClaims;
  return (
    typeof c === 'object' && c !== null && c.v === 1 && typeof c.kid === 'string' && typeof c.plugin === 'string' &&
    Array.isArray(c.hosts) && c.hosts.every((h) => typeof h === 'string') && typeof c.exp === 'number' && typeof c.iat === 'number'
  );
}

const importedKeys = new Map<string, Promise<CryptoKey | null>>();

function importKey(encoded: string): Promise<CryptoKey | null> {
  let key = importedKeys.get(encoded);
  if (!key) {
    const raw = fromBase64Url(encoded);
    const subtle = globalThis.crypto?.subtle;
    key =
      raw && raw.length === 32 && subtle
        ? subtle.importKey('raw', raw as BufferSource, { name: 'Ed25519' }, false, ['verify']).catch(() => null)
        : Promise.resolve(null);
    importedKeys.set(encoded, key);
  }
  return key;
}

/** Verifies a token's signature with `keys` (key ID -> base64url public key) and its expiry. */
export async function verifyToken(token: string, keys: Readonly<Record<string, string>>, nowSeconds = Date.now() / 1000): Promise<TokenCheck> {
  const [prefix, body = '', sig = '', ...rest] = typeof token === 'string' ? token.split('.') : [];
  if (prefix !== PREFIX || rest.length > 0) return { ok: false, reason: 'malformed' };
  const payload = fromBase64Url(body);
  const signature = fromBase64Url(sig);
  if (!payload || !signature || signature.length !== 64) return { ok: false, reason: 'malformed' };
  let claims: unknown;
  try {
    claims = JSON.parse(new TextDecoder().decode(payload));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (!isClaims(claims)) return { ok: false, reason: 'malformed' };
  const encoded = Object.prototype.hasOwnProperty.call(keys, claims.kid) ? keys[claims.kid] : undefined;
  if (!encoded) return { ok: false, reason: 'unknown-key' };
  const key = await importKey(encoded);
  if (!key) return { ok: false, reason: 'unsupported' };
  let valid = false;
  try {
    valid = await globalThis.crypto.subtle.verify({ name: 'Ed25519' }, key, signature as BufferSource, new TextEncoder().encode(`${prefix}.${body}`));
  } catch {
    return { ok: false, reason: 'unsupported' };
  }
  if (!valid) return { ok: false, reason: 'signature' };
  if (nowSeconds >= claims.exp) return { ok: false, reason: 'expired', claims };
  return { ok: true, claims };
}

/** Local development hosts, which every licence covers: localhost, 127.0.0.1, ::1, *.localhost, *.local, *.test. */
export function isLocalHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, '').replace(/^\[(.*)\]$/, '$1');
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || /\.(localhost|local|test)$/.test(h);
}

/** Whether a page's `location.hostname` is covered by a token's host list. */
export function hostCovered(hosts: readonly string[], hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, '');
  if (!h) return false;
  return isLocalHost(h) || hosts.includes(h);
}

/**
 * Platform editor and preview hosts, where plugins never show the badge. Marked "verify" in
 * docs/PLATFORMS.md: taken from the platforms' public behaviour, not their documentation.
 */
export const EDITOR_HOST_SUFFIXES: Readonly<Partial<Record<PaidPlugin, readonly string[]>>> = {
  shopify: ['shopifypreview.com'],
  wix: ['wix.com', 'editorx.com', 'wixstudio.com'],
  framer: ['framercanvas.com'],
};

export function isEditorHost(plugin: string, hostname: string): boolean {
  if (!isPaidPlugin(plugin)) return false;
  const h = hostname.toLowerCase();
  return (EDITOR_HOST_SUFFIXES[plugin] ?? []).some((s) => h === s || h.endsWith(`.${s}`));
}
