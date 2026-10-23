// Copied from the viewer repo (packages/core/src/element.ts) by scripts/sync-docs.mjs. Edit it there.
import '@google/model-viewer';
import { BRAND } from './brand.js';
import { checkLicense, showsBadge, type LicenseState } from './license-client.js';
import { LICENSING, isPaidPlugin } from './licensing-config.js';
import { DEFAULTS, isSafeColor, isSafeLength, isSafeOrbit, isSafeRotationSpeed } from './options.js';
import { CSS } from './styles.js';
import { checkUrl } from './url.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const AR_ICON = 'M12 2 3 7v10l9 5 9-5V7l-9-5Zm0 2.3L18.6 8 12 11.7 5.4 8 12 4.3ZM5 9.7l6 3.4v6.6l-6-3.3V9.7Zm8 10v-6.6l6-3.4v6.7l-6 3.3Z';
const PHONE_ICON = 'M7 1h10a2 2 0 0 1 2 2v18a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2Zm0 3v15h10V4H7Zm4 16.2a1 1 0 1 0 2 0 1 1 0 0 0-2 0Z';

function icon(d: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', d);
  path.setAttribute('fill', 'currentColor');
  svg.append(path);
  return svg;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function constructedSheet(css: string): CSSStyleSheet | null {
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    return sheet;
  } catch {
    return null;
  }
}

const sharedSheet = typeof CSSStyleSheet === 'function' ? constructedSheet(CSS) : null;

function num(value: string | null, fallback: number, min: number, max: number): number {
  if (value === null || value.trim() === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}

export interface DecoderLocations {
  draco?: string;
  ktx2?: string;
  meshopt?: string;
}

type ModelViewerStatics = {
  dracoDecoderLocation: string;
  ktx2TranscoderLocation: string;
  meshoptDecoderLocation: string;
};

/**
 * <ew-viewer>: a configured <model-viewer> with a progress bar, AR button and AR prompt.
 * All values are validated before they reach <model-viewer>; invalid ones are ignored with a
 * console error. Nothing here evaluates model content as code.
 */
export class EwViewerElement extends HTMLElement {
  static readonly observedAttributes = [
    'src',
    'ios-src',
    'poster',
    'alt',
    'ar',
    'ar-label',
    'camera-controls',
    'auto-rotate',
    'rotation-per-second',
    'shadow-intensity',
    'exposure',
    'background',
    'height',
    'loading',
    'reveal',
    'camera-orbit',
    'plugin',
    'license-key',
    'license-state',
  ];

  /**
   * Draco, KTX2 and meshopt-compressed models need decoders, which <model-viewer> loads from
   * www.gstatic.com by default. Call this with self-hosted copies for strict CSPs.
   */
  static configureDecoders(locations: DecoderLocations): void {
    const MV = customElements.get('model-viewer') as unknown as ModelViewerStatics | undefined;
    if (!MV) return;
    const set = (key: keyof ModelViewerStatics, value: string | undefined) => {
      if (value === undefined) return;
      const checked = checkUrl(value);
      if (checked.ok) MV[key] = checked.url;
      else console.error(`${BRAND.tagName}: decoder URL rejected: ${checked.reason}`);
    };
    set('dracoDecoderLocation', locations.draco);
    set('ktx2TranscoderLocation', locations.ktx2);
    set('meshoptDecoderLocation', locations.meshopt);
  }

  readonly #root: ShadowRoot;
  readonly #mv: HTMLElement;
  readonly #progress: HTMLDivElement;
  readonly #bar: HTMLDivElement;
  readonly #arButton: HTMLButtonElement;
  readonly #arText: HTMLSpanElement;
  readonly #loadButton: HTMLButtonElement;
  readonly #badge: HTMLAnchorElement;
  #licenseRun = 0;
  #licenseInput = '';
  readonly #fallbackStyle: HTMLStyleElement | null = null;
  #instanceSheet: CSSStyleSheet | null = null;
  #revealed = false;
  #warned = new Set<string>();
  #motion: MediaQueryList | null = null;
  readonly #onMotion = () => this.#sync();

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'open' });
    if (sharedSheet) {
      this.#root.adoptedStyleSheets = [sharedSheet];
    } else {
      this.#fallbackStyle = document.createElement('style');
      this.#fallbackStyle.textContent = CSS;
      this.#root.append(this.#fallbackStyle);
    }

    this.#mv = document.createElement('model-viewer');
    this.#mv.setAttribute('ar-modes', 'webxr scene-viewer quick-look');

    this.#progress = el('div', 'progress-bar hide');
    this.#progress.setAttribute('slot', 'progress-bar');
    this.#progress.setAttribute('role', 'progressbar');
    this.#progress.setAttribute('aria-label', 'Loading 3D model');
    this.#progress.setAttribute('aria-valuemin', '0');
    this.#progress.setAttribute('aria-valuemax', '100');
    this.#bar = el('div', 'update-bar');
    this.#progress.append(this.#bar);

    this.#arButton = el('button', 'ar-button');
    this.#arButton.type = 'button';
    this.#arButton.setAttribute('slot', 'ar-button');
    this.#arText = el('span', 'ar-label');
    this.#arButton.append(icon(AR_ICON), this.#arText);

    const prompt = el('div', 'ar-prompt');
    prompt.setAttribute('aria-hidden', 'true');
    prompt.append(icon(PHONE_ICON));

    this.#loadButton = el('button', 'load-button');
    this.#loadButton.type = 'button';
    this.#loadButton.textContent = 'Load 3D model';
    this.#loadButton.hidden = true;
    this.#loadButton.addEventListener('click', () => {
      this.#revealed = true;
      this.#sync();
      this.#mv.focus();
    });

    // Shown only for paid-plugin markup without a valid licence. A plain link: no script, no
    // tracking parameters, and it never covers or stops the model.
    this.#badge = el('a', 'licence-badge');
    this.#badge.textContent = 'Unlicensed';
    this.#badge.target = '_blank';
    this.#badge.rel = 'noopener noreferrer';
    this.#badge.setAttribute('part', 'licence-badge');
    this.#badge.hidden = true;

    this.#mv.append(this.#progress, this.#arButton, prompt);
    this.#root.append(this.#mv, this.#loadButton, this.#badge);

    this.#mv.addEventListener('progress', (event) => this.#onProgress(event as unknown as CustomEvent<{ totalProgress: number }>));
    this.#mv.addEventListener('load', () => this.dispatchEvent(new CustomEvent('ew-load', { bubbles: true, composed: true })));
    this.#mv.addEventListener('error', (event) => {
      const detail = (event as unknown as CustomEvent<unknown>).detail;
      console.error(`${BRAND.tagName}: could not load ${this.getAttribute('src') ?? ''}. Check the URL with ${BRAND.docsUrl}/hosting/own-server/#checker`, detail);
      this.dispatchEvent(new CustomEvent('ew-error', { bubbles: true, composed: true, detail }));
    });
  }

  /** The underlying <model-viewer> element, for its full API. */
  get modelViewer(): HTMLElement {
    return this.#mv;
  }

  connectedCallback(): void {
    if (typeof matchMedia === 'function' && !this.#motion) {
      this.#motion = matchMedia('(prefers-reduced-motion: reduce)');
      this.#motion.addEventListener('change', this.#onMotion);
    }
    this.#sync();
  }

  disconnectedCallback(): void {
    this.#motion?.removeEventListener('change', this.#onMotion);
    this.#motion = null;
  }

  attributeChangedCallback(name: string, previous: string | null, next: string | null): void {
    if (name === 'src' && previous !== next) this.#revealed = false;
    if (this.isConnected) this.#sync();
  }

  #warn(key: string, message: string): void {
    if (this.#warned.has(key)) return;
    this.#warned.add(key);
    console.error(`${BRAND.tagName}: ${message}`);
  }

  #setUrl(name: 'src' | 'ios-src' | 'poster', value: string | null): void {
    if (value === null || value.trim() === '') {
      this.#mv.removeAttribute(name);
      return;
    }
    const checked = checkUrl(value);
    if (checked.ok) {
      this.#mv.setAttribute(name, checked.url);
    } else {
      this.#mv.removeAttribute(name);
      this.#warn(`${name}:${value}`, `${name} ignored: ${checked.reason}`);
    }
  }

  #setOrRemove(name: string, value: string | null): void {
    if (value === null) this.#mv.removeAttribute(name);
    else this.#mv.setAttribute(name, value);
  }

  #sync(): void {
    const reduceMotion = this.#motion?.matches ?? false;
    const reveal = this.getAttribute('reveal') === 'interaction' ? 'interaction' : 'auto';
    const waiting = reveal === 'interaction' && !this.#revealed;

    this.#setUrl('src', waiting ? null : this.getAttribute('src'));
    this.#setUrl('ios-src', this.getAttribute('ios-src'));
    this.#setUrl('poster', this.getAttribute('poster'));
    this.#loadButton.hidden = !waiting;

    const alt = this.getAttribute('alt')?.trim();
    if (alt) this.#mv.setAttribute('alt', alt);
    else {
      this.#mv.setAttribute('alt', '3D model');
      this.#warn('alt', 'add an alt attribute that describes the model for screen-reader users.');
    }
    this.#loadButton.setAttribute('aria-label', `Load 3D model: ${alt || 'untitled'}`);

    const ar = this.hasAttribute('ar');
    this.#setOrRemove('ar', ar ? '' : null);
    this.#arButton.hidden = !ar;
    this.#arText.textContent = (this.getAttribute('ar-label') ?? '').trim().slice(0, 60) || DEFAULTS.arLabel;

    this.#setOrRemove('camera-controls', this.hasAttribute('camera-controls') ? '' : null);
    this.#setOrRemove('auto-rotate', this.hasAttribute('auto-rotate') && !reduceMotion ? '' : null);
    this.#mv.setAttribute('interaction-prompt', reduceMotion ? 'none' : 'auto');

    const speed = this.getAttribute('rotation-per-second');
    this.#setOrRemove('rotation-per-second', speed && isSafeRotationSpeed(speed.trim()) ? speed.trim() : null);
    const orbit = this.getAttribute('camera-orbit');
    this.#setOrRemove('camera-orbit', orbit && isSafeOrbit(orbit) ? orbit.trim() : null);

    this.#mv.setAttribute('shadow-intensity', String(num(this.getAttribute('shadow-intensity'), DEFAULTS.shadowIntensity, 0, 2)));
    this.#mv.setAttribute('exposure', String(num(this.getAttribute('exposure'), DEFAULTS.exposure, 0, 4)));

    const loading = this.getAttribute('loading');
    this.#mv.setAttribute('loading', loading === 'auto' || loading === 'eager' ? loading : DEFAULTS.loading);

    this.#applyVariables();
    this.#syncLicense();
  }

  /**
   * Paid plugins write `plugin` plus either `license-state` (decided on their server, e.g.
   * WordPress) or `license-key` (checked here). Markup without `plugin` (the free snippets) is
   * never checked.
   */
  #syncLicense(): void {
    const plugin = this.getAttribute('plugin');
    const stated = this.getAttribute('license-state');
    const key = this.getAttribute('license-key');
    const input = `${plugin}|${stated}|${key}`;
    if (input === this.#licenseInput) return;
    this.#licenseInput = input;
    const run = ++this.#licenseRun;
    if (!isPaidPlugin(plugin)) {
      this.#showLicense('unknown', '');
      return;
    }
    if (stated !== null) {
      this.#showLicense(stated === 'unlicensed' || stated === 'expired' ? stated : 'licensed', plugin);
      return;
    }
    this.#showLicense('unknown', plugin);
    checkLicense({ plugin, key, hostname: typeof location === 'undefined' ? '' : location.hostname }).then(
      (result) => {
        if (run !== this.#licenseRun) return;
        if (result.reason === 'not-configured') this.#warn('licence-config', 'this build has no licence keys; licence checks are off.');
        this.#showLicense(result.state, plugin);
      },
      () => undefined,
    );
  }

  #showLicense(state: LicenseState, plugin: string): void {
    const show = showsBadge(state);
    this.#badge.hidden = !show;
    if (!show) return;
    this.#badge.href = `${LICENSING.pricingUrl}?plugin=${encodeURIComponent(plugin)}`;
    this.#badge.title = `${BRAND.displayName} ${plugin} plugin: no valid licence for this site. The model still works.`;
    this.#warn(`licence:${state}`, `the ${plugin} plugin has no valid licence for ${location.hostname} (${state}). See ${LICENSING.pricingUrl}`);
  }

  #applyVariables(): void {
    const background = this.getAttribute('background')?.trim() ?? '';
    const height = this.getAttribute('height')?.trim() ?? '';
    const rules: string[] = [];
    if (background) {
      if (isSafeColor(background)) rules.push(`--ew-viewer-background: ${background};`);
      else this.#warn(`background:${background}`, 'background ignored: use "transparent", a hex colour or rgb()/hsl().');
    }
    if (height) {
      if (isSafeLength(height)) rules.push(`--ew-viewer-height: ${height};`);
      else this.#warn(`height:${height}`, 'height ignored: use a CSS length like 480px or 60vh.');
    }
    // Values are interpolated only after passing the strict patterns above.
    const css = `:host { ${rules.join(' ')} }`;
    if (sharedSheet) {
      if (!this.#instanceSheet) {
        this.#instanceSheet = constructedSheet(css);
        if (this.#instanceSheet) this.#root.adoptedStyleSheets = [sharedSheet, this.#instanceSheet];
      } else {
        this.#instanceSheet.replaceSync(css);
      }
    } else if (this.#fallbackStyle) {
      this.#fallbackStyle.textContent = `${CSS}\n${css}`;
    }
  }

  #onProgress(event: CustomEvent<{ totalProgress: number }>): void {
    const progress = Math.max(0, Math.min(1, event.detail.totalProgress));
    this.#bar.style.width = `${progress * 100}%`;
    this.#progress.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
    this.#progress.classList.toggle('hide', progress >= 1);
  }
}

export function defineViewer(tagName: string = BRAND.tagName): void {
  if (!customElements.get(tagName)) customElements.define(tagName, EwViewerElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'ew-viewer': EwViewerElement;
  }
}
