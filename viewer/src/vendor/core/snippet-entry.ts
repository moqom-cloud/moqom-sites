// Copied from the viewer repo (packages/core/src/snippet-entry.ts) by scripts/sync-docs.mjs. Edit it there.
// DOM-free entry: options, validation and snippet generation. Safe in Node, editors and builds.
// loadViewerScript uses the DOM only when called.
export { BRAND, MODEL_VIEWER_VERSION, THREE_VERSION, cdnUrl } from './brand.js';
export { escapeHtml } from './escape.js';
export {
  DEFAULTS,
  ViewerOptionError,
  isSafeColor,
  isSafeLength,
  isSafeOrbit,
  isSafeRotationSpeed,
  normalizeOptions,
  toAttributes,
  type Loading,
  type Normalized,
  type Reveal,
  type ViewerOptions,
} from './options.js';
export {
  SnippetError,
  cdnScript,
  elementTag,
  generateShortcode,
  generateSnippet,
  scriptTag,
  type Release,
  type ScriptSource,
  type Snippet,
} from './snippet.js';
export { checkUrl, extensionOf, type UrlCheck, type UrlOptions } from './url.js';
export { loadViewerScript } from './loader.js';
export { EMBED_PATH, embedIframe, embedOptions, embedUrl } from './embed.js';
export { LICENSING, PAID_PLUGINS, PRICES, isPaidPlugin, licenseAttributes, type PaidPlugin } from './licensing-config.js';
export { EDITOR_HOST_SUFFIXES, hostCovered, isEditorHost, isLocalHost, verifyToken, type LicenseClaims, type TokenCheck } from './license.js';
export { PLATFORMS, PLATFORM_LABELS, platformSnippet, type Platform, type PlatformBlock, type PlatformSnippet } from './platforms.js';
