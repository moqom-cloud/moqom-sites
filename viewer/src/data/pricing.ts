// Prices and paid plugins, from the viewer repo's packages/core/src/licensing-config.ts (synced
// into src/vendor). The licence server's Stripe prices must match these numbers.
import { LICENSING, PAID_PLUGINS, PRICES, type PaidPlugin } from '../vendor/core/licensing-config';

export { LICENSING, PAID_PLUGINS, PRICES, type PaidPlugin };

export const PLUGIN_NAMES: Record<PaidPlugin, string> = {
  wordpress: 'WordPress (with Elementor)',
  shopify: 'Shopify',
  wix: 'Wix',
  framer: 'Framer',
  hubspot: 'HubSpot CMS',
  react: 'React and Next.js',
  vue: 'Vue and Nuxt',
};

/** Docs page for each plugin, where the licence-key step is. */
export const PLUGIN_PAGES: Record<PaidPlugin, string> = {
  wordpress: '/platforms/wordpress/#licence',
  shopify: '/platforms/shopify/#licence',
  wix: '/platforms/wix/#licence',
  framer: '/platforms/framer/#licence',
  hubspot: '/platforms/hubspot/#licence',
  react: '/platforms/react/#licence',
  vue: '/platforms/vue/#licence',
};

/** The platform's own address for a site, which a licence can also cover. Formats: verify. */
export const PLATFORM_HOSTS: Partial<Record<PaidPlugin, { label: string; example: string }>> = {
  shopify: { label: 'Your store’s myshopify.com address', example: 'your-store.myshopify.com' },
  wix: { label: 'Your site’s Wix address', example: 'you.wixsite.com' },
  framer: { label: 'Your site’s Framer address', example: 'your-site.framer.website' },
  hubspot: { label: 'Your HubSpot address', example: 'you.hs-sites.com' },
};

export const usd = (n: number) => `$${n}`;
export const PRICE_LINE = `${usd(PRICES.yearly)} a year or ${usd(PRICES.lifetime)} once`;
