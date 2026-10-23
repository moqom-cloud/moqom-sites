// Copied from the viewer repo (packages/core/src/url.ts) by scripts/sync-docs.mjs. Edit it there.
export type UrlCheck = { ok: true; url: string } | { ok: false; reason: string };

export interface UrlOptions {
  /** Allow relative and root-relative paths (resolved by the browser against the page). Default true. */
  allowRelative?: boolean;
}

const SCHEME = /^([a-z][a-z0-9+.-]*):/i;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
// Anything below U+0021 (controls and space), DEL, and the backslash, which some parsers treat as "/".
const UNSAFE = /[\u0000-\u0020\u007f\\]/;

/**
 * Accepts https URLs, http URLs on localhost (for development), and relative paths. Rejects every
 * other scheme, including javascript:, data:, blob:, file: and plain http, and protocol-relative
 * URLs ("//host/path"), whose scheme depends on the page.
 */
export function checkUrl(value: unknown, { allowRelative = true }: UrlOptions = {}): UrlCheck {
  if (typeof value !== 'string') return { ok: false, reason: 'URL must be text.' };
  const raw = value.trim();
  if (raw === '') return { ok: false, reason: 'URL is empty.' };
  if (raw.length > 2048) return { ok: false, reason: 'URL is longer than 2048 characters.' };
  if (UNSAFE.test(raw)) return { ok: false, reason: 'URL contains spaces, control characters or a backslash.' };
  if (raw.startsWith('//')) return { ok: false, reason: 'Use a full https:// URL, not one starting with //.' };

  if (!SCHEME.test(raw)) {
    if (!allowRelative) return { ok: false, reason: 'Use a full https:// URL.' };
    try {
      new URL(raw, 'https://example.invalid/');
    } catch {
      return { ok: false, reason: 'URL is not valid.' };
    }
    return { ok: true, url: raw };
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, reason: 'URL is not valid.' };
  }
  if (parsed.protocol === 'https:') {
    if (parsed.username || parsed.password) return { ok: false, reason: 'URL must not contain a user name or password.' };
    return { ok: true, url: parsed.href };
  }
  if (parsed.protocol === 'http:' && LOCAL_HOSTS.has(parsed.hostname)) return { ok: true, url: parsed.href };
  if (parsed.protocol === 'http:') return { ok: false, reason: 'URL must use https://. Browsers block http:// models on https:// pages.' };
  return { ok: false, reason: `The ${parsed.protocol} scheme is not allowed. Use an https:// URL.` };
}

/** File extension of the URL's path in lower case ("glb"), ignoring query and fragment. */
export function extensionOf(url: string): string {
  let path = url;
  try {
    path = new URL(url, 'https://example.invalid/').pathname;
  } catch {
    path = url.split(/[?#]/)[0] ?? '';
  }
  const decoded = safeDecode(path);
  const name = decoded.slice(decoded.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
