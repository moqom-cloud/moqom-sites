// Copied from the viewer repo (packages/core/src/brand.ts) by scripts/sync-docs.mjs. Edit it there.
// Product identity for @elliottwave/viewer. Renaming the product starts here; see RENAMING.md.

export const BRAND = {
  displayName: '3D Viewer',
  slug: 'viewer',
  vendor: 'elliottwave.studio lab',
  legalEntity: 'Elliott Wave LLC',
  docsUrl: 'https://viewer.elliottwave.studio',
  repoUrl: 'https://github.com/elliottwave/viewer',
  licensingEmail: 'licensing@elliottwave.studio',
  securityEmail: 'security@elliottwave.studio',
  /** npm package name of this package. */
  packageName: '@elliottwave/viewer',
  /** Custom element tag. Must contain a hyphen. */
  tagName: 'ew-viewer',
  /** File name of the self-contained browser bundle in dist/. */
  bundleFile: 'ew-viewer.min.js',
  /** Must match package.json "version"; checked by the build. */
  version: '0.1.0',
} as const;

/** Version of Google's <model-viewer> bundled into dist/ew-viewer.min.js. Must match package.json. */
export const MODEL_VIEWER_VERSION = '4.3.1';
/** Version of three.js bundled with it. Must match package.json. */
export const THREE_VERSION = '0.183.2';

/** jsDelivr serves files from the published npm package. Only valid once the version is published. */
export function cdnUrl(version: string = BRAND.version): string {
  return `https://cdn.jsdelivr.net/npm/${BRAND.packageName}@${version}/dist/${BRAND.bundleFile}`;
}
