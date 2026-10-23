// Copied from the viewer repo (packages/core/src/embed.ts) by scripts/sync-docs.mjs. Edit it there.
// The iframe embed: a page on the docs site that reads options from its query string. These
// helpers build its URL and iframe code, and turn the query string back into validated options.
import { BRAND } from './brand.js';
import { escapeHtml } from './escape.js';
import { ViewerOptionError, normalizeOptions, toAttributes, type Loading, type Normalized, type Reveal, type ViewerOptions } from './options.js';
import { checkUrl } from './url.js';

export const EMBED_PATH = '/embed/';

/** URL of the embed page for these options. Query parameter names are the <ew-viewer> attribute names. */
export function embedUrl(options: ViewerOptions, base: string = BRAND.docsUrl): string {
  const o = normalizeOptions(options);
  for (const field of ['src', 'iosSrc', 'poster'] as const) {
    const value = o[field];
    if (value !== undefined && !/^https:\/\//i.test(value)) throw new ViewerOptionError(field, 'the iframe embed needs a full https:// URL.');
  }
  const url = new URL(EMBED_PATH, base);
  for (const [name, value] of toAttributes(o)) {
    if (name !== 'height') url.searchParams.set(name, value === true ? '1' : value);
  }
  if (!o.ar) url.searchParams.set('ar', '0');
  if (!o.cameraControls) url.searchParams.set('camera-controls', '0');
  return url.href;
}

/** <iframe> code for the embed page. The iframe takes the height; the viewer fills it. */
export function embedIframe(options: ViewerOptions, base: string = BRAND.docsUrl): string {
  const o = normalizeOptions(options);
  const src = embedUrl(options, base);
  return [
    `<iframe src="${escapeHtml(src)}"`,
    `  title="${escapeHtml(`3D model: ${o.alt}`)}"`,
    '  loading="lazy"',
    '  allow="xr-spatial-tracking; fullscreen"',
    '  allowfullscreen',
    '  referrerpolicy="strict-origin-when-cross-origin"',
    `  style="display:block;width:100%;height:${escapeHtml(o.height)};border:0"`,
    '></iframe>',
  ].join('\n');
}

function flag(params: URLSearchParams, name: string): boolean | undefined {
  const value = params.get(name);
  if (value === null) return undefined;
  if (value === '' || value === '1' || value === 'true') return true;
  if (value === '0' || value === 'false') return false;
  return undefined;
}

function remote(field: 'src' | 'iosSrc' | 'poster', value: string | null): string | undefined {
  if (value === null || value === '') return undefined;
  const checked = checkUrl(value, { allowRelative: false });
  if (!checked.ok) throw new ViewerOptionError(field, checked.reason);
  if (!checked.url.startsWith('https://')) throw new ViewerOptionError(field, 'use a full https:// URL.');
  return checked.url;
}

/**
 * Validated options from the embed page's query string. Unknown parameters are ignored. Throws
 * ViewerOptionError for a missing or invalid src or alt, and for any invalid value.
 */
export function embedOptions(params: URLSearchParams): Normalized {
  const input: ViewerOptions = { src: remote('src', params.get('src')) ?? '', alt: params.get('alt') ?? '', height: '100%' };
  const set = <K extends keyof ViewerOptions>(key: K, value: ViewerOptions[K] | undefined) => {
    if (value !== undefined) input[key] = value;
  };
  set('iosSrc', remote('iosSrc', params.get('ios-src')));
  set('poster', remote('poster', params.get('poster')));
  set('ar', flag(params, 'ar'));
  set('arLabel', params.get('ar-label') ?? undefined);
  set('cameraControls', flag(params, 'camera-controls'));
  set('autoRotate', flag(params, 'auto-rotate'));
  set('rotationPerSecond', params.get('rotation-per-second') ?? undefined);
  const number = (name: string) => {
    const value = params.get(name);
    return value === null || value.trim() === '' ? undefined : Number(value);
  };
  set('shadowIntensity', number('shadow-intensity'));
  set('exposure', number('exposure'));
  set('background', params.get('background') ?? undefined);
  set('loading', (params.get('loading') ?? undefined) as Loading | undefined);
  set('reveal', (params.get('reveal') ?? undefined) as Reveal | undefined);
  set('cameraOrbit', params.get('camera-orbit') ?? undefined);
  return normalizeOptions(input);
}
