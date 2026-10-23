// Copied from the viewer repo (packages/core/src/loader.ts) by scripts/sync-docs.mjs. Edit it there.
// Adds the browser bundle to a page once. Touches the DOM only when called, so importing it is safe
// during server rendering.
import { BRAND } from './brand.js';
import { SnippetError, type ScriptSource } from './snippet.js';
import { checkUrl } from './url.js';

const INTEGRITY = /^sha(?:256|384|512)-[A-Za-z0-9+/]{43,88}={0,2}$/;
const pending = new Map<string, Promise<void>>();

/**
 * Adds `<script type="module" src integrity crossorigin>` for the bundle unless the page already
 * has it, and resolves when <ew-viewer> is defined. Cross-origin URLs need an SRI hash.
 */
export function loadViewerScript(source: ScriptSource, doc: Document = document): Promise<void> {
  const win = doc.defaultView;
  if (!win) return Promise.reject(new SnippetError('loadViewerScript needs a document with a window.'));
  if (win.customElements.get(BRAND.tagName)) return Promise.resolve();

  const checked = checkUrl(source.url);
  if (!checked.ok) return Promise.reject(new SnippetError(`script url: ${checked.reason}`));
  const crossOrigin = /^https?:\/\//i.test(checked.url);
  if (source.integrity !== undefined && !INTEGRITY.test(source.integrity)) {
    return Promise.reject(new SnippetError('script integrity must look like "sha384-<base64>".'));
  }
  if (crossOrigin && !source.integrity) {
    return Promise.reject(new SnippetError('a script loaded from a full URL needs an integrity (SRI) hash.'));
  }

  const url = new URL(checked.url, doc.baseURI).href;
  const existing = pending.get(url);
  if (existing) return existing;
  const defined = () => win.customElements.whenDefined(BRAND.tagName).then(() => undefined);

  const already = [...doc.querySelectorAll<HTMLScriptElement>('script[src]')].some((s) => s.src === url);
  const promise = already
    ? defined()
    : new Promise<void>((resolve, reject) => {
        const script = doc.createElement('script');
        script.type = 'module';
        if (source.integrity) script.setAttribute('integrity', source.integrity);
        if (crossOrigin) script.setAttribute('crossorigin', 'anonymous');
        script.src = url;
        script.addEventListener('load', () => defined().then(resolve, reject));
        script.addEventListener('error', () => {
          pending.delete(url);
          script.remove();
          reject(new Error(`${BRAND.displayName}: could not load ${url}. Check the URL and the integrity hash.`));
        });
        doc.head.append(script);
      });
  pending.set(url, promise);
  return promise;
}
