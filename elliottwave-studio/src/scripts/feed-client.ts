// Client for the shared public feed (src/data/feed.ts), plus the on-device store the feed falls back to when no
// service is configured. Used by the /feed player, the ecosystem panel and the ñü.mømëntš studio.
import { FEED_API } from '../data/feed';

export type FeedPost = {
  id: string;
  handle: string;
  caption: string;
  video_url: string;
  poster_url: string;
  duration_s: number;
  width: number;
  height: number;
  created_at: string;
};
export type FeedPage = { posts: FeedPost[]; next: string | null };
export type Stage = 'reading' | 'video' | 'poster' | 'posting' | 'done';
export type Progress = { stage: Stage; fraction: number };

export const REPORT_REASONS = ['spam', 'harassment', 'nudity', 'violence', 'illegal', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

const API_KEY = 'nu.feed.api';
const TOKENS_KEY = 'nu.feed.tokens';

export class FeedError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function cleanUrl(raw: string | null): string {
  if (!raw) return '';
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
    return u.href.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

/** The feed service for this page load: ?feed=, then localStorage nu.feed.api, then FEED_API. Empty = local mode. */
export function feedApi(): { api: string; override: boolean } {
  const param = cleanUrl(new URLSearchParams(location.search).get('feed'));
  if (param) return { api: param, override: param !== cleanUrl(FEED_API) };
  let stored = '';
  try {
    stored = cleanUrl(localStorage.getItem(API_KEY));
  } catch {}
  if (stored) return { api: stored, override: stored !== cleanUrl(FEED_API) };
  return { api: cleanUrl(FEED_API), override: false };
}

export function friendly(status: number, server?: string): string {
  switch (status) {
    case 0:
      return 'The feed service did not answer. Check your connection and try again.';
    case 403:
      return 'That handle belongs to someone else on the shared feed. Pick another handle, or post from the device that first used it.';
    case 413:
      return 'That video is too large for the feed. Trim it shorter and try again.';
    case 415:
      return 'The feed does not take this file type. Post an MP4, MOV or WebM video.';
    case 429:
      return 'Too many posts in a short time. Wait a minute, then try again.';
    default:
      return server ? `The feed said: ${server}` : `The feed service returned an error (${status}). Try again.`;
  }
}

async function call<T>(api: string, path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(api + path, init);
  } catch {
    throw new FeedError(0, friendly(0));
  }
  if (!res.ok) {
    let server = '';
    try {
      const body = await res.json();
      server = body.error || body.message || '';
    } catch {}
    throw new FeedError(res.status, friendly(res.status, server));
  }
  if (res.status === 204) return null as T;
  return res.json() as Promise<T>;
}

export function fetchFeed(api: string, before?: string | null, limit = 20): Promise<FeedPage> {
  const q = new URLSearchParams({ limit: String(limit) });
  if (before) q.set('before', before);
  return call<FeedPage>(api, `/v1/feed?${q}`).then((p) => ({ posts: p.posts || [], next: p.next || null }));
}

export function reportPost(api: string, id: string, reason: ReportReason): Promise<void> {
  return call<void>(api, `/v1/posts/${encodeURIComponent(id)}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
}

// Tokens prove a handle is yours on the service that issued them. Tokens from a test service (?feed=) are kept
// apart so they are never sent to the site's own service, or the other way round.
function tokenKey(api: string, handle: string) {
  return api === cleanUrl(FEED_API) ? handle : `${handle}@${api}`;
}
function readTokens(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(TOKENS_KEY) || '{}') || {};
  } catch {
    return {};
  }
}
function saveToken(api: string, handle: string, token: string) {
  const all = readTokens();
  all[tokenKey(api, handle)] = token;
  localStorage.setItem(TOKENS_KEY, JSON.stringify(all));
}

const graphemes = (s: string) => {
  try {
    return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s)].length;
  } catch {
    return [...s].length;
  }
};
export const normHandle = (raw: string) => raw.trim().replace(/^@/, '').replace(/\.khensu\.nu$/i, '').normalize('NFKC').toLowerCase();
export function handleProblem(handle: string): string {
  const n = graphemes(handle);
  if (!handle || n < 1 || n > 64 || /[\s/\\@:#?%]/.test(handle)) {
    return 'Handles are 1–64 characters in any language, with any diacritics, and no spaces or / @ : # ? %.';
  }
  return '';
}
export const showHandle = (h: string) => '@' + (h.includes('.') ? h : `${h}.khensu.nu`);

function once(el: HTMLMediaElement, ev: string, ms = 8000) {
  return new Promise<void>((res, rej) => {
    const t = setTimeout(() => rej(new Error('timeout')), ms);
    el.addEventListener(ev, () => (clearTimeout(t), res()), { once: true });
    el.addEventListener('error', () => (clearTimeout(t), rej(new Error('decode'))), { once: true });
  });
}

/** Duration, size and a JPEG poster from about 0.5 s into the video. */
export async function probeVideo(blob: Blob, durationHint = 0) {
  const url = URL.createObjectURL(blob);
  const v = document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.preload = 'auto';
  v.src = url;
  try {
    await once(v, 'loadedmetadata');
    let duration = v.duration;
    if (!isFinite(duration)) {
      // Recorded WebM has no duration in its header until the browser has seen the end.
      v.currentTime = 1e7;
      await once(v, 'timeupdate').catch(() => {});
      duration = isFinite(v.duration) ? v.duration : durationHint;
    }
    v.currentTime = Math.min(0.5, (duration || 1) / 2);
    await once(v, 'seeked').catch(() => {});
    const width = v.videoWidth;
    const height = v.videoHeight;
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    c.getContext('2d')!.drawImage(v, 0, 0, width, height);
    const poster = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.85));
    return { duration: Math.round((duration || durationHint) * 100) / 100, width, height, poster };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function put(url: string, blob: Blob, type: string, onProgress: (f: number) => void) {
  return new Promise<void>((res, rej) => {
    const x = new XMLHttpRequest();
    x.open('PUT', url);
    x.setRequestHeader('Content-Type', type);
    x.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    x.onload = () => (x.status >= 200 && x.status < 300 ? res() : rej(new FeedError(x.status, friendly(x.status))));
    x.onerror = () => rej(new FeedError(0, 'The upload stopped. Check your connection and try again.'));
    x.send(blob);
  });
}

async function upload(api: string, kind: 'video' | 'poster', blob: Blob, type: string, onProgress: (f: number) => void) {
  const slot = await call<{ object: string; upload_url: string; public_url: string }>(api, '/v1/uploads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, content_type: type, bytes: blob.size }),
  });
  await put(slot.upload_url, blob, type, onProgress);
  return slot.object;
}

export const videoType = (blob: Blob) => (blob.type || 'video/mp4').split(';')[0].trim().toLowerCase();

/** Upload a video and its poster, then publish the post. Returns the new post. */
export async function postVideo(
  api: string,
  opts: { handle: string; caption: string; video: Blob; durationHint?: number; onProgress?: (p: Progress) => void },
): Promise<FeedPost> {
  const report = opts.onProgress || (() => {});
  const type = videoType(opts.video);
  if (!type.startsWith('video/')) throw new FeedError(415, friendly(415));
  report({ stage: 'reading', fraction: 0 });
  const meta = await probeVideo(opts.video, opts.durationHint).catch(() => null);
  if (!meta || !meta.width) throw new FeedError(415, 'This browser could not read that video. Post an MP4, MOV or WebM video.');
  const video_object = await upload(api, 'video', opts.video, type, (f) => report({ stage: 'video', fraction: f * 0.9 }));
  let poster_object = '';
  if (meta.poster) {
    poster_object = await upload(api, 'poster', meta.poster, 'image/jpeg', (f) => report({ stage: 'poster', fraction: 0.9 + f * 0.05 }));
  }
  report({ stage: 'posting', fraction: 0.97 });
  const token = readTokens()[tokenKey(api, opts.handle)];
  const out = await call<{ post: FeedPost; token?: string }>(api, '/v1/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({
      handle: opts.handle,
      caption: opts.caption,
      video_object,
      poster_object,
      duration_s: meta.duration,
      width: meta.width,
      height: meta.height,
    }),
  });
  if (out.token) saveToken(api, opts.handle, out.token);
  report({ stage: 'done', fraction: 1 });
  return out.post;
}

export const stageLabel = (p: Progress) =>
  ({
    reading: 'Reading the video…',
    video: `Uploading video · ${Math.round((p.fraction / 0.9) * 100)}%`,
    poster: 'Uploading poster…',
    posting: 'Publishing…',
    done: 'Posted.',
  })[p.stage];

// On-device store, shared with the ecosystem panel: profile and posts in localStorage, media blobs in IndexedDB.
export const LOCAL_KEY = 'nu.ecosystem.v1';
export type LocalPost = {
  id: string;
  mine: boolean;
  display: string;
  handle: string;
  hue: number;
  caption: string;
  template?: string;
  look?: string;
  bpm?: number;
  price?: number;
  mediaId?: string;
  src?: string;
  poster?: string;
  type: 'video' | 'image';
  likes: number;
  at?: string;
};
export type LocalState = {
  profile: { display: string; handle: string; style: string; hue: number };
  posts: LocalPost[];
  liked: Record<string, boolean>;
  saved: Record<string, boolean>;
  ledger: { id: string; kind: string; label: string; gross: number; fee: number; net: number; at: string }[];
  payouts: { id: string; amount: number; method: string; at: string }[];
  bi: number;
  media: { id: string; name: string; type: string; at: string }[];
};

export function loadLocal(): LocalState {
  let s: LocalState | null = null;
  try {
    s = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null');
  } catch {}
  if (!s || !s.profile) {
    s = { profile: { display: 'You', handle: 'you', style: 'Glass', hue: 285 }, posts: [], liked: {}, saved: {}, ledger: [], payouts: [], bi: 0, media: [] };
  }
  s.posts = (s.posts || []).filter((p) => !String(p.id).startsWith('seed-'));
  return s;
}
export const saveLocal = (s: LocalState) => localStorage.setItem(LOCAL_KEY, JSON.stringify(s));
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const dbp = new Promise<IDBDatabase>((res, rej) => {
  const r = indexedDB.open('nu-ecosystem', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('media');
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
export async function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await dbp;
  return new Promise((res, rej) => {
    const req = fn(db.transaction('media', mode).objectStore('media'));
    req.onsuccess = () => res(req.result as T);
    req.onerror = () => rej(req.error);
  });
}
export const mediaURL = async (id: string) => {
  const blob = await idb<Blob | undefined>('readonly', (s) => s.get(id));
  return blob ? URL.createObjectURL(blob) : '';
};

/** Local mode: keep the post on this device, in the same store the ecosystem panel reads. */
export async function addLocalPost(blob: Blob, caption: string, name = 'nu.moments.webm'): Promise<LocalPost> {
  const s = loadLocal();
  const mediaId = uid();
  const type = blob.type.startsWith('image') ? 'image' : 'video';
  await idb('readwrite', (st) => st.put(blob, mediaId));
  s.media.unshift({ id: mediaId, name, type, at: new Date().toISOString() });
  const post: LocalPost = {
    id: uid(),
    mine: true,
    display: s.profile.display,
    handle: s.profile.handle,
    hue: s.profile.hue,
    caption: caption || 'Untitled moment',
    mediaId,
    type,
    likes: 0,
    at: new Date().toISOString(),
  };
  s.posts.unshift(post);
  saveLocal(s);
  return post;
}
