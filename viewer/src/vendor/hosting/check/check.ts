// Copied from the viewer repo (packages/hosting/src/check/check.ts) by scripts/sync-docs.mjs. Edit it there.
// Model URL checker. Runs in Node (viewer-check) and in the browser (docs checker page), so it
// uses only fetch and Web APIs. It reads at most the first 16 bytes of the file and never parses
// or runs the content.
import { MODEL_CONTENT_TYPES, modelKind, type ModelKind } from '../content-types.js';
import type { Server } from './fixes.js';

export type Level = 'pass' | 'warn' | 'fail' | 'info';
export type Topic = 'https' | 'status' | 'cors' | 'content-type' | 'content' | 'size' | 'range' | 'cache';

export interface Finding {
  topic: Topic;
  level: Level;
  title: string;
  detail: string;
}

export interface Report {
  url: string;
  finalUrl: string | null;
  origin: string | null;
  kind: ModelKind | null;
  server: Server;
  size: number | null;
  findings: Finding[];
  /** True when nothing failed. Warnings don't block. */
  ok: boolean;
}

export interface CheckOptions {
  url: string;
  /** The embedding site, e.g. https://www.example.com. Node mode only; browsers send their own. */
  origin?: string;
  /** "node" sends Origin and Range headers. "browser" sends a plain GET as <model-viewer> does. */
  mode?: 'node' | 'browser';
  fetch?: typeof fetch;
  timeoutMs?: number;
}

const LARGE = 15 * 1024 * 1024;
const VERY_LARGE = 50 * 1024 * 1024;
const PROBE_ORIGIN = 'https://viewer-check.invalid';

function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function detectServer(headers: Headers, url: URL): Server {
  const server = (headers.get('server') ?? '').toLowerCase();
  const host = url.hostname;
  if (host === 'firebasestorage.googleapis.com' || host === 'storage.googleapis.com' || host.endsWith('.storage.googleapis.com')) return 'gcs';
  if (host.endsWith('.web.app') || host.endsWith('.firebaseapp.com')) return 'firebase-hosting';
  if (headers.has('x-goog-generation') || headers.has('x-guploader-uploadid') || server.includes('uploadserver')) return 'gcs';
  if (server.includes('amazons3') || headers.has('x-amz-request-id') || /\.s3[.-]/.test(host)) return 's3';
  if (headers.has('x-nf-request-id') || server.includes('netlify') || host.endsWith('.netlify.app')) return 'netlify';
  if (headers.has('x-vercel-id') || server.includes('vercel') || host.endsWith('.vercel.app')) return 'vercel';
  if (server.includes('cloudflare') || headers.has('cf-ray') || host.endsWith('.r2.dev') || host.endsWith('.pages.dev')) return 'cloudflare';
  if (server.includes('nginx')) return 'nginx';
  if (server.includes('apache') || server.includes('litespeed')) return 'apache';
  return 'unknown';
}

function sniff(bytes: Uint8Array): 'glb' | 'zip' | 'json' | 'html' | 'other' {
  const text = String.fromCharCode(...bytes.slice(0, 16));
  if (text.startsWith('glTF')) return 'glb';
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return 'zip';
  const trimmed = text.trimStart();
  if (trimmed.startsWith('{')) return 'json';
  if (trimmed.startsWith('<')) return 'html';
  return 'other';
}

async function head16(response: Response): Promise<Uint8Array> {
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const out = new Uint8Array(16);
  let filled = 0;
  try {
    while (filled < 16) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      const take = value.subarray(0, 16 - filled);
      out.set(take, filled);
      filled += take.length;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return out.subarray(0, filled);
}

function totalSize(response: Response): number | null {
  const range = response.headers.get('content-range')?.match(/\/(\d+)\s*$/);
  if (range?.[1]) return Number(range[1]);
  const length = response.headers.get('content-length');
  if (response.status === 200 && length && /^\d+$/.test(length)) return Number(length);
  return null;
}

export async function checkModelUrl(options: CheckOptions): Promise<Report> {
  const mode = options.mode ?? 'node';
  const fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
  const findings: Finding[] = [];
  const add = (topic: Topic, level: Level, title: string, detail: string) => findings.push({ topic, level, title, detail });
  const report = (partial: Partial<Report>): Report => ({
    url: options.url,
    finalUrl: null,
    origin: options.origin ?? null,
    kind: null,
    server: 'unknown',
    size: null,
    ...partial,
    findings,
    ok: !findings.some((f) => f.level === 'fail'),
  });

  let url: URL;
  try {
    url = new URL(options.url.trim());
  } catch {
    add('https', 'fail', 'Not a valid URL', 'Paste the full address of the file, starting with https://.');
    return report({});
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol === 'https:') add('https', 'pass', 'Served over HTTPS', url.origin);
  else if (url.protocol === 'http:' && local) add('https', 'warn', 'HTTP on localhost', 'Fine for testing. Your live site needs an https:// URL.');
  else {
    add('https', 'fail', `Uses ${url.protocol.replace(':', '')}, not HTTPS`, 'Browsers block http:// files on https:// pages, and AR needs HTTPS. Serve the file over https://.');
    if (url.protocol !== 'http:') return report({});
  }

  let origin: string | null = null;
  if (mode === 'node' && options.origin) {
    try {
      const parsed = new URL(options.origin);
      origin = parsed.origin;
    } catch {
      add('cors', 'fail', 'Origin is not valid', 'Use the form https://www.example.com.');
      return report({});
    }
  }

  const kindFromName = modelKind(url.pathname.split('/').map((p) => { try { return decodeURIComponent(p); } catch { return p; } }).join('/'));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 15000);
  const headers: Record<string, string> = mode === 'node' ? { Origin: origin ?? PROBE_ORIGIN, Range: 'bytes=0-15' } : {};

  let response: Response;
  try {
    response = await fetchFn(url.href, { method: 'GET', headers, redirect: 'follow', signal: controller.signal, ...(mode === 'browser' ? { mode: 'cors' as const, credentials: 'omit' as const } : {}) });
  } catch (error) {
    clearTimeout(timer);
    if (mode === 'browser') {
      add('cors', 'fail', 'The browser could not read the file', 'Usually CORS: the server did not send Access-Control-Allow-Origin for this page. It can also be a wrong URL, a server that is down, or a blocker extension. If you allowed only your own site, this page is expected to fail; run the CLI with --origin to check your site.');
    } else {
      const message = controller.signal.aborted ? 'timed out' : (error as Error).message;
      add('status', 'fail', 'Request failed', `Could not fetch the URL (${message}). Check the address and that the server is reachable.`);
    }
    return report({ kind: kindFromName });
  }
  clearTimeout(timer);

  const finalUrl = response.url ? new URL(response.url) : url;
  const server = detectServer(response.headers, finalUrl);
  if (finalUrl.href !== url.href) {
    if (finalUrl.protocol === 'http:' && !local) add('https', 'fail', 'Redirects to HTTP', `The URL redirects to ${finalUrl.href}. Make the final address HTTPS.`);
    else add('status', 'info', 'Redirected', `Final URL: ${finalUrl.href}. Using it directly saves a round trip.`);
  }

  if (response.status === 200 || response.status === 206) add('status', 'pass', `HTTP ${response.status}`, 'The file was found.');
  else if (response.status === 401 || response.status === 403) {
    add('status', 'fail', `HTTP ${response.status}: access denied`, server === 'gcs'
      ? 'For Firebase Storage, use the download URL that includes &token=…; for a Cloud Storage bucket, make the object publicly readable.'
      : 'The file must be readable without signing in.');
  } else if (response.status === 404) add('status', 'fail', 'HTTP 404: not found', 'Check the path and file name; they are case-sensitive on most servers.');
  else add('status', 'fail', `HTTP ${response.status}`, 'The server did not return the file.');
  const found = response.status === 200 || response.status === 206;

  if (mode === 'browser') {
    add('cors', 'pass', 'Readable from this page', 'The server allowed a cross-origin read from this checker. If you limited CORS to specific sites, confirm your own site with the CLI: viewer-check <url> --origin https://your-site.');
  } else {
    const allow = response.headers.get('access-control-allow-origin');
    if (!allow) {
      add('cors', 'fail', 'No Access-Control-Allow-Origin header', `<model-viewer> loads models with fetch, which needs CORS when the file is on another domain. Allow ${origin ?? 'your site (or *)'}; see the fix for your server below.`);
    } else if (allow.trim() === '*') {
      add('cors', 'pass', 'CORS allows any site (*)', 'Any page can embed this file.');
    } else if (origin && allow.trim() === origin) {
      add('cors', 'pass', `CORS allows ${origin}`, 'Your site can load this file.');
      const vary = (response.headers.get('vary') ?? '').toLowerCase();
      if (!vary.includes('origin') && !vary.includes('*')) add('cors', 'info', 'No "Vary: Origin" header', 'If you allow several sites, send Vary: Origin so caches keep a copy per site.');
    } else {
      add('cors', 'fail', `CORS allows ${allow}, not ${origin ?? 'any site'}`, origin ? `Add ${origin} to the allowed origins.` : 'Re-run with --origin https://your-site to test your site, or allow *.');
    }
  }

  const contentType = (response.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  const kind: ModelKind | null = kindFromName
    ?? (contentType === MODEL_CONTENT_TYPES.glb ? 'glb' : contentType === MODEL_CONTENT_TYPES.usdz ? 'usdz' : contentType === MODEL_CONTENT_TYPES.gltf ? 'gltf' : null);
  if (found) {
    if (!kind) {
      add('content-type', 'info', 'File type unknown', `The URL has no .glb, .gltf or .usdz extension and the Content-Type is "${contentType || 'missing'}". Checked as GLB.`);
    }
    const expected = MODEL_CONTENT_TYPES[kind ?? 'glb'];
    if (contentType === expected) add('content-type', 'pass', `Content-Type ${expected}`, 'Correct.');
    else if (contentType === 'text/html') add('content-type', 'fail', 'Content-Type text/html', 'The server returned a web page, often an error or login page, instead of the model.');
    else if ((kind ?? 'glb') === 'usdz') add('content-type', 'fail', `Content-Type ${contentType || 'missing'}`, `iOS Quick Look expects ${expected}. Set it on the server; see the fix below.`);
    else if (contentType === 'application/octet-stream' || contentType === '' || (kind === 'gltf' && contentType === 'application/json')) {
      add('content-type', 'warn', `Content-Type ${contentType || 'missing'}`, `<model-viewer> usually still loads it, but ${expected} is correct and avoids problems with strict proxies and downloads.`);
    } else add('content-type', 'warn', `Content-Type ${contentType}`, `Expected ${expected}.`);

    const bytes = await head16(response).catch(() => new Uint8Array());
    const seen = bytes.length ? sniff(bytes) : 'other';
    const want = { glb: 'glb', gltf: 'json', usdz: 'zip' }[kind ?? 'glb'];
    if (!bytes.length) add('content', 'warn', 'Could not read the file content', 'The response had no readable body.');
    else if (seen === want) add('content', 'pass', `Content looks like ${(kind ?? 'glb').toUpperCase()}`, 'The first bytes match the format.');
    else if (seen === 'html') add('content', 'fail', 'Content is HTML, not a model', 'The URL returns a web page. Use the direct file URL (for Firebase Storage, the one with alt=media).');
    else add('content', 'fail', `Content is not ${(kind ?? 'glb').toUpperCase()}`, 'The first bytes do not match the format. Re-export the model, or check the URL points at the right file.');
  } else {
    await response.body?.cancel().catch(() => undefined);
  }

  const size = found ? totalSize(response) : null;
  if (size !== null) {
    if (size > VERY_LARGE) add('size', 'warn', `Large file: ${mb(size)}`, 'Phones may run out of memory or data. Compress textures and geometry (for example with gltf-transform) and aim for under 15 MB.');
    else if (size > LARGE) add('size', 'warn', `File is ${mb(size)}`, 'Visitors on mobile wait longer. Aim for under 15 MB; a poster image helps while it loads.');
    else add('size', 'pass', `File is ${mb(size)}`, 'A reasonable size for the web.');
  } else if (found) add('size', 'info', 'Size unknown', 'The server did not report a length.');

  if (mode === 'node' && found) {
    if (response.status === 206) add('range', 'pass', 'Supports range requests', 'Interrupted downloads can resume.');
    else add('range', 'info', 'No range requests', 'Not required: <model-viewer> downloads the whole file either way.');
  }

  if (found) {
    const cache = response.headers.get('cache-control');
    if (!cache) add('cache', 'warn', 'No Cache-Control header', 'Browsers may re-download the model on every visit. Set Cache-Control: public, max-age=86400 (or longer if file names change with content).');
    else if (/no-store|no-cache|max-age=0\b/i.test(cache)) add('cache', 'warn', `Cache-Control: ${cache}`, 'The model is re-downloaded on every visit. Allow caching for at least a day.');
    else add('cache', 'pass', `Cache-Control: ${cache}`, 'Browsers can cache the file.');
  }

  return report({ finalUrl: finalUrl.href, origin, kind, server, size });
}
