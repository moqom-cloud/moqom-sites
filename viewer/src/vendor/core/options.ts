// Copied from the viewer repo (packages/core/src/options.ts) by scripts/sync-docs.mjs. Edit it there.
import { checkUrl, extensionOf } from './url.js';

export type Loading = 'auto' | 'lazy' | 'eager';
export type Reveal = 'auto' | 'interaction';

/** Everything an embed can configure. Only src and alt are required. */
export interface ViewerOptions {
  /** GLB or glTF URL. */
  src: string;
  /** Text description of the model for screen readers. Required. */
  alt: string;
  /** USDZ URL for iOS Quick Look. Without it, iOS builds a USDZ from the GLB on the device. */
  iosSrc?: string;
  /** Image shown until the model loads. */
  poster?: string;
  /** Show the "View in your space" AR button on supported devices. Default true. */
  ar?: boolean;
  /** Text of the AR button. Default "View in your space". */
  arLabel?: string;
  /** Turn the model slowly. Off for visitors who ask for reduced motion. Default false. */
  autoRotate?: boolean;
  /** Auto-rotate speed, e.g. "30deg". */
  rotationPerSecond?: string;
  /** Let visitors orbit, zoom and pan. Default true. */
  cameraControls?: boolean;
  /** 0 to 2. Default 1. */
  shadowIntensity?: number;
  /** 0 to 4. Default 1. */
  exposure?: number;
  /** "transparent" or a CSS colour. Default "transparent". */
  background?: string;
  /** CSS height of the viewer, e.g. "480px" or "60vh". Default "480px". */
  height?: string;
  /** When to download the model. Default "lazy" (when it is near the screen). */
  loading?: Loading;
  /** "interaction" waits for a tap before downloading the model. Default "auto". */
  reveal?: Reveal;
  /** Initial camera position, e.g. "0deg 75deg 2.5m". */
  cameraOrbit?: string;
}

export const DEFAULTS = {
  ar: true,
  arLabel: 'View in your space',
  autoRotate: false,
  cameraControls: true,
  shadowIntensity: 1,
  exposure: 1,
  background: 'transparent',
  height: '480px',
  loading: 'lazy',
  reveal: 'auto',
} as const satisfies Partial<ViewerOptions>;

export class ViewerOptionError extends Error {
  constructor(
    readonly field: keyof ViewerOptions,
    message: string,
  ) {
    super(`${field}: ${message}`);
    this.name = 'ViewerOptionError';
  }
}

const MODEL_EXTENSIONS = new Set(['glb', 'gltf']);
const NAMED_COLOR = /^[a-z]{3,24}$/i;
const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNC_COLOR = /^(?:rgb|rgba|hsl|hsla|oklch|oklab)\(\s*[-+0-9.%\s,/a-z]{1,60}\)$/i;
const LENGTH = /^\d{1,4}(?:\.\d{1,3})?(?:px|vh|svh|dvh|rem|em|%)$/;
const ANGLE_SPEED = /^-?\d{1,4}(?:\.\d{1,3})?(?:deg|rad)$/;
const ORBIT_PART = /^(?:auto|-?\d{1,5}(?:\.\d{1,4})?(?:deg|rad|m|cm|mm|%)?)$/;

export function isSafeColor(value: string): boolean {
  return value === 'transparent' || HEX_COLOR.test(value) || NAMED_COLOR.test(value) || FUNC_COLOR.test(value);
}

export function isSafeLength(value: string): boolean {
  return LENGTH.test(value);
}

export function isSafeOrbit(value: string): boolean {
  const parts = value.trim().split(/\s+/);
  return parts.length >= 1 && parts.length <= 3 && parts.every((p) => ORBIT_PART.test(p));
}

export function isSafeRotationSpeed(value: string): boolean {
  return ANGLE_SPEED.test(value);
}

export interface Normalized extends Required<Omit<ViewerOptions, 'iosSrc' | 'poster' | 'rotationPerSecond' | 'cameraOrbit'>> {
  iosSrc?: string;
  poster?: string;
  rotationPerSecond?: string;
  cameraOrbit?: string;
  warnings: string[];
}

function url(field: 'src' | 'iosSrc' | 'poster', value: string): string {
  const result = checkUrl(value);
  if (!result.ok) throw new ViewerOptionError(field, result.reason);
  return result.url;
}

function number(field: 'shadowIntensity' | 'exposure', value: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new ViewerOptionError(field, `must be a number from ${min} to ${max}.`);
  }
  return value;
}

/** Validates options and fills in defaults. Throws ViewerOptionError on the first invalid field. */
export function normalizeOptions(input: ViewerOptions): Normalized {
  const warnings: string[] = [];
  const src = url('src', input.src);
  const ext = extensionOf(src);
  if (ext && !MODEL_EXTENSIONS.has(ext)) warnings.push(`src ends in .${ext}; <model-viewer> expects a .glb or .gltf file.`);

  const alt = typeof input.alt === 'string' ? input.alt.trim().replace(/\s+/g, ' ') : '';
  if (alt === '') throw new ViewerOptionError('alt', 'describe the model for people using screen readers, e.g. "Red ceramic mug with a curved handle".');
  if (alt.length > 300) throw new ViewerOptionError('alt', 'keep it under 300 characters.');

  const out: Normalized = {
    src,
    alt,
    ar: input.ar ?? DEFAULTS.ar,
    arLabel: (input.arLabel ?? DEFAULTS.arLabel).trim() || DEFAULTS.arLabel,
    autoRotate: input.autoRotate ?? DEFAULTS.autoRotate,
    cameraControls: input.cameraControls ?? DEFAULTS.cameraControls,
    shadowIntensity: number('shadowIntensity', input.shadowIntensity ?? DEFAULTS.shadowIntensity, 0, 2),
    exposure: number('exposure', input.exposure ?? DEFAULTS.exposure, 0, 4),
    background: (input.background ?? DEFAULTS.background).trim(),
    height: (input.height ?? DEFAULTS.height).trim(),
    loading: input.loading ?? DEFAULTS.loading,
    reveal: input.reveal ?? DEFAULTS.reveal,
    warnings,
  };
  if (out.arLabel.length > 60) throw new ViewerOptionError('arLabel', 'keep it under 60 characters.');
  if (!isSafeColor(out.background)) throw new ViewerOptionError('background', 'use "transparent", a hex colour like #ffffff, or rgb()/hsl().');
  if (!isSafeLength(out.height)) throw new ViewerOptionError('height', 'use a CSS length like 480px, 60vh or 30rem.');
  if (!['auto', 'lazy', 'eager'].includes(out.loading)) throw new ViewerOptionError('loading', 'use auto, lazy or eager.');
  if (!['auto', 'interaction'].includes(out.reveal)) throw new ViewerOptionError('reveal', 'use auto or interaction.');

  if (input.iosSrc) {
    out.iosSrc = url('iosSrc', input.iosSrc);
    const iosExt = extensionOf(out.iosSrc);
    if (iosExt && iosExt !== 'usdz' && iosExt !== 'reality') warnings.push(`iosSrc ends in .${iosExt}; iOS Quick Look expects .usdz.`);
  }
  if (input.poster) out.poster = url('poster', input.poster);
  if (input.rotationPerSecond) {
    const v = input.rotationPerSecond.trim();
    if (!isSafeRotationSpeed(v)) throw new ViewerOptionError('rotationPerSecond', 'use an angle like 30deg.');
    out.rotationPerSecond = v;
  }
  if (input.cameraOrbit) {
    const v = input.cameraOrbit.trim().replace(/\s+/g, ' ');
    if (!isSafeOrbit(v)) throw new ViewerOptionError('cameraOrbit', 'use up to three values like "0deg 75deg 2.5m".');
    out.cameraOrbit = v;
  }
  return out;
}

/** Attribute list for <ew-viewer>, in a stable order. `true` means a boolean attribute. */
export function toAttributes(o: Normalized): Array<[string, string | true]> {
  const attrs: Array<[string, string | true]> = [['src', o.src]];
  if (o.iosSrc) attrs.push(['ios-src', o.iosSrc]);
  if (o.poster) attrs.push(['poster', o.poster]);
  attrs.push(['alt', o.alt]);
  if (o.ar) attrs.push(['ar', true]);
  if (o.ar && o.arLabel !== DEFAULTS.arLabel) attrs.push(['ar-label', o.arLabel]);
  if (o.cameraControls) attrs.push(['camera-controls', true]);
  if (o.autoRotate) attrs.push(['auto-rotate', true]);
  if (o.autoRotate && o.rotationPerSecond) attrs.push(['rotation-per-second', o.rotationPerSecond]);
  if (o.shadowIntensity !== DEFAULTS.shadowIntensity) attrs.push(['shadow-intensity', String(o.shadowIntensity)]);
  if (o.exposure !== DEFAULTS.exposure) attrs.push(['exposure', String(o.exposure)]);
  if (o.background !== DEFAULTS.background) attrs.push(['background', o.background]);
  if (o.height !== DEFAULTS.height) attrs.push(['height', o.height]);
  if (o.loading !== DEFAULTS.loading) attrs.push(['loading', o.loading]);
  if (o.reveal !== DEFAULTS.reveal) attrs.push(['reveal', o.reveal]);
  if (o.cameraOrbit) attrs.push(['camera-orbit', o.cameraOrbit]);
  return attrs;
}
