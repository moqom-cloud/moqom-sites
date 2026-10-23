// Copied from the viewer repo (packages/core/src/index.ts) by scripts/sync-docs.mjs. Edit it there.
// Browser entry: registers <ew-viewer> (and <model-viewer>) on import.
import { defineViewer } from './element.js';

defineViewer();

export { EwViewerElement, defineViewer, type DecoderLocations } from './element.js';
export * from './snippet-entry.js';
export { checkLicense, clearLicenseCache, showsBadge, type LicenseCheckOptions, type LicenseResult, type LicenseState } from './license-client.js';
