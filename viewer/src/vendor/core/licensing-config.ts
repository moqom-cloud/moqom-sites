// Copied from the viewer repo (packages/core/src/licensing-config.ts) by scripts/sync-docs.mjs. Edit it there.
// Licence server and token keys for the paid plugins. The core element and snippets are free
// and never check a licence; only markup a paid plugin writes (a `plugin` attribute) does.
//
// publicKeys: key ID -> Ed25519 public key (base64url), printed by
// `go run ./services/licensing/cmd/licensing-keygen`. Keep in step with EW_VIEWER_LICENSE_KEYS
// in packages/wordpress/elliottwave-viewer/includes/config.php (a test checks). While it is
// empty, plugins can't verify tokens and never show the "Unlicensed" badge.
import { BRAND } from './brand.js';

export const LICENSING = {
  api: 'https://licensing.elliottwave.studio',
  pricingUrl: `${BRAND.docsUrl}/pricing/`,
  publicKeys: {} as Readonly<Record<string, string>>,
} as const;

/** Plugins that need a licence. Elementor is part of "wordpress". */
export const PAID_PLUGINS = ['wordpress', 'shopify', 'wix', 'framer', 'hubspot', 'react', 'vue'] as const;
export type PaidPlugin = (typeof PAID_PLUGINS)[number];

export const PRICES = { yearly: 99, lifetime: 500, currency: 'USD' } as const;

/** The attributes a client-side plugin adds so <ew-viewer> checks its licence in the browser. */
export function licenseAttributes(plugin: PaidPlugin, licenseKey: string | null | undefined): Record<string, string> {
  const key = (licenseKey ?? '').trim();
  return key ? { plugin, 'license-key': key } : { plugin };
}

export function isPaidPlugin(value: unknown): value is PaidPlugin {
  return typeof value === 'string' && (PAID_PLUGINS as readonly string[]).includes(value);
}
