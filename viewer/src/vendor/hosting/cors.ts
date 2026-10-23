// Copied from the viewer repo (packages/hosting/src/cors.ts) by scripts/sync-docs.mjs. Edit it there.
export type OriginCheck = { ok: true; origin: string } | { ok: false; reason: string };

const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * An origin is scheme + host (+ port) with no path, e.g. https://www.example.com. "*" allows any
 * site. http is accepted only for localhost.
 */
export function checkOrigin(value: string): OriginCheck {
  const raw = value.trim();
  if (raw === '*') return { ok: true, origin: '*' };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: `"${value}" is not an origin. Use the form https://www.example.com.` };
  }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && LOCAL.has(url.hostname))) {
    return { ok: false, reason: `"${value}" must start with https://.` };
  }
  if (url.username || url.password || (url.pathname !== '/' && url.pathname !== '') || url.search || url.hash) {
    return { ok: false, reason: `"${value}" has a path or query. An origin is only https://host, e.g. ${url.origin}.` };
  }
  if (raw.replace(/\/$/, '') !== url.origin) {
    return { ok: false, reason: `"${value}" is not in canonical form. Use ${url.origin}.` };
  }
  return { ok: true, origin: url.origin };
}

export interface CorsRule {
  origin: string[];
  method: string[];
  responseHeader: string[];
  maxAgeSeconds: number;
}

/** Cloud Storage CORS configuration (the file `gcloud storage buckets update --cors-file` takes). */
export function corsConfig(origins: readonly string[]): CorsRule[] {
  return [
    {
      origin: origins.length ? [...new Set(origins)] : ['*'],
      method: ['GET', 'HEAD'],
      responseHeader: ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges', 'Range'],
      maxAgeSeconds: 3600,
    },
  ];
}

/**
 * A static header carries one value, so a single origin is echoed and anything else becomes "*".
 * Models embedded on public pages are public anyway; "*" does not expose cookies or credentials.
 */
export function allowOriginHeader(origins: readonly string[]): string {
  const unique = [...new Set(origins)];
  return unique.length === 1 && unique[0] ? unique[0] : '*';
}
