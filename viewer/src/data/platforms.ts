// Every platform the docs cover, with its status. The /platforms/ index, the sidebar and the
// generated pages in pages/platforms/[slug].astro all read this list. Mirrors docs/PLATFORMS.md in
// the viewer repo; "verify" marks platform details not confirmed against the platform's own docs.
import type { Platform } from '../vendor/core/snippet-entry';
import type { PaidPlugin } from '../vendor/core/licensing-config';

export type Status = 'built' | 'paste-in' | 'planned';

export const STATUS_LABEL: Record<Status, string> = {
  built: 'Built',
  'paste-in': 'Paste-in',
  planned: 'Planned',
};

export interface PlatformEntry {
  slug: string;
  name: string;
  status: Status;
  /** One line for the index. */
  summary: string;
  /** Link target; defaults to /platforms/<slug>/. */
  href?: string;
  /** Paid plugin that needs a licence key. Everything else is free. */
  plugin?: PaidPlugin;
  /** Shown in the sidebar. */
  nav?: boolean;
  group: 'Code' | 'Site builders' | 'Commerce' | 'CMS' | 'Design tools';
  /** Paste-in builders whose page is generated from the snippet generator's blocks. */
  snippet?: Platform;
  /** Plan or account requirements, for generated pages. Mark unconfirmed details "verify". */
  plan?: string;
  /** Planned platforms: what would be built, and what works today. */
  planned?: { what: string; today: string; workaround: 'html' | 'embed' | 'wordpress' | 'none' };
}

export const PLATFORM_LIST: PlatformEntry[] = [
  { slug: 'html', name: 'HTML', status: 'paste-in', group: 'Code', nav: true, summary: 'One script tag and one element on any page.' },
  { slug: 'embed', name: 'Iframe embed', status: 'paste-in', group: 'Code', nav: true, summary: 'For builders that allow iframes but not scripts: Notion, Google Sites, Carrd and others.' },
  { slug: 'react', plugin: 'react', name: 'React and Next.js', status: 'built', group: 'Code', nav: true, summary: '<Viewer3D> component; SSR-safe, works in the Next.js App Router.' },
  { slug: 'vue', plugin: 'vue', name: 'Vue and Nuxt', status: 'built', group: 'Code', nav: true, summary: '<Viewer3D> component for Vue 3; SSR-safe.' },
  { slug: 'frameworks', name: 'Svelte, Angular, Astro, static site generators', status: 'paste-in', group: 'Code', nav: true, summary: 'The custom element works as is; examples for Svelte, Angular, Astro, Hugo, Jekyll and Eleventy.' },

  { slug: 'wordpress', plugin: 'wordpress', name: 'WordPress', status: 'built', group: 'CMS', nav: true, summary: 'Plugin with a block, a shortcode and an Elementor widget. Tested in WordPress 6.5 to 7.1.' },
  { slug: 'elementor', plugin: 'wordpress', name: 'Elementor', status: 'built', group: 'CMS', href: '/platforms/wordpress/#elementor', summary: 'Widget inside the WordPress plugin, loaded only when Elementor is active.' },
  { slug: 'ghost', name: 'Ghost', status: 'paste-in', group: 'CMS', snippet: 'ghost', summary: 'Code injection once, then an HTML card per model.', plan: 'Code injection and HTML cards are available on self-hosted Ghost and on Ghost(Pro); check your plan (verify).' },
  { slug: 'hubspot', plugin: 'hubspot', name: 'HubSpot CMS', status: 'built', group: 'CMS', nav: true, summary: 'Custom module with fields for every option. Not yet tested inside HubSpot.' },
  { slug: 'drupal', name: 'Drupal', status: 'planned', group: 'CMS', summary: 'Module with a field formatter and a block.', planned: { what: 'A Drupal module: a field formatter for file and link fields, a block, and a text-format filter. It would load the same bundle from the module folder.', today: 'Allow the script in a text format that keeps it (Full HTML), or add it in your theme, then paste the element. Text formats that filter HTML may strip the custom element.', workaround: 'html' } },
  { slug: 'joomla', name: 'Joomla', status: 'planned', group: 'CMS', summary: 'Module and content plugin.', planned: { what: 'A Joomla package: a site module and a content plugin for a {viewer} tag, with the bundle in the media folder.', today: 'Use a custom module that allows scripts, or your template, for the script; then paste the element. The editor\'s filter settings may strip it (verify for your editor).', workaround: 'html' } },

  { slug: 'squarespace', name: 'Squarespace', status: 'paste-in', group: 'Site builders', nav: true, summary: 'Code Injection once, then a Code Block per model. Squarespace has no plugin system.' },
  { slug: 'webflow', name: 'Webflow', status: 'paste-in', group: 'Site builders', nav: true, summary: 'Footer code once, then a Code Embed per model.' },
  { slug: 'wix', plugin: 'wix', name: 'Wix', status: 'built', group: 'Site builders', nav: true, summary: 'Velo custom element file with the pinned script; Wix App Market app planned.' },
  { slug: 'framer', plugin: 'framer', name: 'Framer', status: 'built', group: 'Site builders', nav: true, summary: 'Code component with property controls, pasted into your project.' },
  { slug: 'duda', name: 'Duda', status: 'paste-in', group: 'Site builders', snippet: 'duda', summary: 'Body End HTML once, then an HTML widget per model.', plan: 'If an agency manages your Duda site, it may need to give you permission to edit custom code (verify).' },
  { slug: 'godaddy', name: 'GoDaddy Websites + Marketing', status: 'paste-in', group: 'Site builders', snippet: 'godaddy', summary: 'HTML section per model (GoDaddy runs it in an iframe).', plan: 'GoDaddy places custom code in an iframe and has no site-wide code option, so every HTML section carries the script and the element.' },
  { slug: 'hostinger', name: 'Hostinger Website Builder', status: 'paste-in', group: 'Site builders', snippet: 'hostinger', summary: 'Embed code element per model.' },
  { slug: 'weebly', name: 'Weebly', status: 'paste-in', group: 'Site builders', snippet: 'weebly', summary: 'Embed Code element per model.' },
  { slug: 'notion', name: 'Notion', status: 'paste-in', group: 'Site builders', href: '/platforms/embed/#notion', summary: 'Paste the embed link into an /embed block (verify).' },
  { slug: 'google-sites', name: 'Google Sites', status: 'paste-in', group: 'Site builders', href: '/platforms/embed/#google-sites', summary: 'Insert → Embed → Embed code, with the iframe code.' },
  { slug: 'carrd', name: 'Carrd', status: 'paste-in', group: 'Site builders', href: '/platforms/embed/#carrd', summary: 'Embed element with the iframe code; Carrd Pro (verify).' },
  { slug: 'bubble', name: 'Bubble', status: 'planned', group: 'Site builders', summary: 'Bubble plugin with a visual element.', planned: { what: 'A Bubble plugin with a "3D Viewer" visual element whose fields map to the viewer options, published through Bubble\'s plugin marketplace.', today: 'Bubble\'s HTML element accepts the script and the element together (verify that scripts run in your app\'s HTML element).', workaround: 'html' } },
  { slug: 'webflow-app', name: 'Webflow App', status: 'planned', group: 'Site builders', summary: 'Designer Extension that inserts the snippet.', planned: { what: 'A Webflow Designer Extension that inserts the Code Embed and adds the footer script, so nobody copies code by hand.', today: 'The paste-in snippet works on every paid Webflow site.', workaround: 'html' } },
  { slug: 'wix-app', name: 'Wix App Market app', status: 'planned', group: 'Site builders', summary: 'Site widget with a settings panel.', planned: { what: 'A Wix app with a site widget and a settings panel, installed from the Wix App Market.', today: 'The Velo custom element file works on Premium sites with a connected domain.', workaround: 'html' } },
  { slug: 'framer-marketplace', name: 'Framer Marketplace', status: 'planned', group: 'Site builders', summary: 'Not listed: the component is sold directly.', planned: { what: 'Not planned: a Marketplace listing would be sold through Framer\'s billing and terms (verify) instead of a licence key.', today: 'Paste the code component into your project and enter your licence key.', workaround: 'none' } },

  { slug: 'shopify', plugin: 'shopify', name: 'Shopify', status: 'built', group: 'Commerce', nav: true, summary: 'Theme section and theme app extension block using product 3D media; App Store listing planned.' },
  { slug: 'woocommerce', plugin: 'wordpress', name: 'WooCommerce', status: 'paste-in', group: 'Commerce', href: '/platforms/wordpress/#woocommerce', summary: 'The WordPress plugin\'s shortcode in a product description. Not yet tested with WooCommerce.' },
  { slug: 'bigcommerce', name: 'BigCommerce', status: 'paste-in', group: 'Commerce', snippet: 'bigcommerce', summary: 'Script Manager once, then an HTML widget or product description.', plan: 'Script Manager is for Stencil storefronts; headless storefronts add the script in their own code.' },
  { slug: 'square-online', name: 'Square Online', status: 'paste-in', group: 'Commerce', snippet: 'square-online', summary: 'Embed code section per model.' },
  { slug: 'adobe-commerce', name: 'Adobe Commerce (Magento)', status: 'planned', group: 'Commerce', summary: 'Page Builder content type.', planned: { what: 'A Magento module with a Page Builder content type and a product attribute for the model URL.', today: 'Add the script to your theme\'s footer and the element to a CMS block or an HTML Code element in Page Builder (verify that it keeps custom elements).', workaround: 'html' } },

  { slug: 'canva', name: 'Canva', status: 'planned', group: 'Design tools', summary: 'Canva embeds only from supported providers.', planned: { what: 'Either an oEmbed endpoint that Canva\'s embed provider accepts, or a Canva app. Both need a server or Canva\'s review; neither exists yet.', today: 'Canva\'s Embed only accepts links from providers it supports (verify). Use a link or image to a page with the viewer.', workaround: 'none' } },
  { slug: 'figma', name: 'Figma Sites', status: 'planned', group: 'Design tools', summary: 'Embed or code layer in Figma Sites.', planned: { what: 'Instructions for Figma Sites\' embed and code layers once they are tested, or a Figma plugin that inserts the embed.', today: 'Try the iframe embed in a Figma Sites embed (verify that Figma Sites accepts it).', workaround: 'embed' } },
  { slug: 'oembed', name: 'Medium and other oEmbed sites', status: 'planned', group: 'Design tools', summary: 'Needs an oEmbed endpoint and the platforms\' approval.', planned: { what: 'An oEmbed endpoint that returns the iframe embed for a model URL, plus registration with embed providers. It needs a server; the docs site is static.', today: 'Medium and similar sites embed only from approved providers. Link to a page with the viewer instead.', workaround: 'none' } },
];

export const hrefOf = (p: PlatformEntry) => p.href ?? `/platforms/${p.slug}/`;
export const GROUPS = ['Code', 'CMS', 'Site builders', 'Commerce', 'Design tools'] as const;
