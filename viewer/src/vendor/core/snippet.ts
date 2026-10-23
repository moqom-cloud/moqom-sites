// Copied from the viewer repo (packages/core/src/snippet.ts) by scripts/sync-docs.mjs. Edit it there.
import { BRAND, cdnUrl } from './brand.js';
import { escapeHtml } from './escape.js';
import { normalizeOptions, toAttributes, type Normalized, type ViewerOptions } from './options.js';
import { checkUrl } from './url.js';

export interface ScriptSource {
  /** URL of ew-viewer.min.js: your own copy (recommended) or the jsDelivr URL. */
  url: string;
  /** SRI hash, e.g. "sha384-…". Required for cross-origin URLs. */
  integrity?: string;
}

/** Shape of dist/release.json, written by the core build. */
export interface Release {
  version: string;
  file: string;
  integrity: string;
  cdnUrl: string;
  modelViewer: string;
  three: string;
  /** CSP hashes for the <style> <model-viewer> puts in its shadow root (style-src). */
  styleHashes?: string[];
}

export interface Snippet {
  /** The <script> tag. Add once per page (or once site-wide). */
  script: string;
  /** The <ew-viewer> element. One per model. */
  element: string;
  /** script + element, ready to paste into a single HTML block. */
  html: string;
  warnings: string[];
}

const INTEGRITY = /^sha(?:256|384|512)-[A-Za-z0-9+/]{43,88}={0,2}$/;

export class SnippetError extends Error {
  override name = 'SnippetError';
}

/** The jsDelivr script source for a release, with its SRI hash. */
export function cdnScript(release: Pick<Release, 'version' | 'integrity'>): ScriptSource {
  return { url: cdnUrl(release.version), integrity: release.integrity };
}

export function scriptTag(source: ScriptSource): string {
  const checked = checkUrl(source.url);
  if (!checked.ok) throw new SnippetError(`script url: ${checked.reason}`);
  const crossOrigin = /^https?:\/\//i.test(checked.url);
  if (source.integrity !== undefined && !INTEGRITY.test(source.integrity)) {
    throw new SnippetError('script integrity must look like "sha384-<base64>".');
  }
  if (crossOrigin && !source.integrity) {
    throw new SnippetError('a script loaded from a full URL needs an integrity (SRI) hash.');
  }
  const parts = [`<script type="module" src="${escapeHtml(checked.url)}"`];
  if (source.integrity) parts.push(` integrity="${escapeHtml(source.integrity)}"`);
  if (crossOrigin) parts.push(' crossorigin="anonymous"');
  parts.push('></script>');
  return parts.join('');
}

export function elementTag(options: Normalized): string {
  const attrs = toAttributes(options).map(([name, value]) => (value === true ? name : `${name}="${escapeHtml(value)}"`));
  const tag = BRAND.tagName;
  if (attrs.length <= 3) return `<${tag} ${attrs.join(' ')}></${tag}>`;
  return `<${tag}\n  ${attrs.join('\n  ')}\n></${tag}>`;
}

/**
 * Builds the paste-in HTML for one model. Throws ViewerOptionError for invalid options and
 * SnippetError for an invalid script source. Every value is validated and attribute-escaped.
 */
export function generateSnippet(options: ViewerOptions, script: ScriptSource): Snippet {
  const normalized = normalizeOptions(options);
  const s = scriptTag(script);
  const element = elementTag(normalized);
  return { script: s, element, html: `${s}\n${element}`, warnings: normalized.warnings };
}

/** WordPress shortcode equivalent of the options, e.g. [viewer src="…" alt="…"]. */
export function generateShortcode(options: ViewerOptions, shortcode: string = BRAND.slug): string {
  const o = normalizeOptions(options);
  const enc = (v: string) => escapeHtml(v).replace(/\[/g, '&#91;').replace(/\]/g, '&#93;');
  const attrs: string[] = [`src="${enc(o.src)}"`];
  if (o.iosSrc) attrs.push(`ios_src="${enc(o.iosSrc)}"`);
  if (o.poster) attrs.push(`poster="${enc(o.poster)}"`);
  attrs.push(`alt="${enc(o.alt)}"`);
  for (const [name, value] of toAttributes(o)) {
    if (['src', 'ios-src', 'poster', 'alt'].includes(name)) continue;
    attrs.push(`${name.replace(/-/g, '_')}="${value === true ? 'true' : enc(value)}"`);
  }
  if (!o.ar) attrs.push('ar="false"');
  if (!o.cameraControls) attrs.push('camera_controls="false"');
  return `[${shortcode} ${attrs.join(' ')}]`;
}
