// Copied from the viewer repo (packages/core/src/platforms.ts) by scripts/sync-docs.mjs. Edit it there.
// Platform-specific paste-in instructions built from one set of options. DOM-free.
import { BRAND } from './brand.js';
import { embedIframe, embedUrl } from './embed.js';
import { normalizeOptions, toAttributes, type ViewerOptions } from './options.js';
import { elementTag, generateShortcode, scriptTag, type ScriptSource } from './snippet.js';

export const PLATFORMS = [
  'html',
  'embed',
  'squarespace',
  'webflow',
  'wix',
  'wordpress',
  'shopify',
  'ghost',
  'hubspot',
  'bigcommerce',
  'duda',
  'square-online',
  'weebly',
  'godaddy',
  'hostinger',
] as const;
export type Platform = (typeof PLATFORMS)[number];

/** Names for pickers and headings. */
export const PLATFORM_LABELS: Record<Platform, string> = {
  html: 'HTML',
  embed: 'Iframe embed',
  squarespace: 'Squarespace',
  webflow: 'Webflow',
  wix: 'Wix',
  wordpress: 'WordPress shortcode',
  shopify: 'Shopify (Custom Liquid)',
  ghost: 'Ghost',
  hubspot: 'HubSpot',
  bigcommerce: 'BigCommerce',
  duda: 'Duda',
  'square-online': 'Square Online',
  weebly: 'Weebly',
  godaddy: 'GoDaddy Websites + Marketing',
  hostinger: 'Hostinger Website Builder',
};

const IFRAME_AR_NOTE = 'AR from inside an iframe depends on the browser and on the iframe\'s allow attribute; check "View in your space" on an iPhone and an Android phone before relying on it.';

export interface PlatformBlock {
  /** Where to paste, in the platform's own words. */
  where: string;
  code: string;
  language: 'html' | 'js' | 'text' | 'liquid';
}

export interface PlatformSnippet {
  platform: Platform;
  blocks: PlatformBlock[];
  notes: string[];
  warnings: string[];
}

export function platformSnippet(platform: Platform, options: ViewerOptions, script: ScriptSource): PlatformSnippet {
  const o = normalizeOptions(options);
  const s = scriptTag(script);
  const el = elementTag(o);
  const warnings = o.warnings;
  switch (platform) {
    case 'html':
      return {
        platform,
        blocks: [
          { where: 'Once per page, before </body> (or in <head>)', code: s, language: 'html' },
          { where: 'Where the model should appear', code: el, language: 'html' },
        ],
        notes: ['Self-host ew-viewer.min.js next to your pages for the strictest CSP; then the script tag needs no integrity attribute.'],
        warnings,
      };
    case 'squarespace':
      return {
        platform,
        blocks: [
          { where: 'Code Injection → Footer, once for the whole site (search "code injection" in the Squarespace menu; its location differs between versions)', code: s, language: 'html' },
          { where: 'Edit the page → add a Code block where the model should appear → paste. If the block has a "Display Source" option, leave it off', code: el, language: 'html' },
        ],
        notes: [
          'Squarespace lists Code Injection, and JavaScript in Code Blocks, on the Core, Plus and Advanced plans and some legacy plans, not on Basic. Check your plan before you start.',
          'Squarespace may not run injected scripts while you are logged in and editing. Check the result in a private window.',
        ],
        warnings,
      };
    case 'webflow':
      return {
        platform,
        blocks: [
          { where: 'Site settings → Custom code → Footer code (or Page settings → Before </body> tag)', code: s, language: 'html' },
          { where: 'Add panel → Code Embed, placed where the model should appear', code: el, language: 'html' },
        ],
        notes: [
          'Webflow requires a paid Site plan or a Core, Growth, Agency or Freelancer Workspace for custom code and the Code Embed element.',
          'Custom code runs on the published site, not in the Designer canvas. Publish to your webflow.io domain to see the model.',
        ],
        warnings,
      };
    case 'wix': {
      const attrs = toAttributes(o).map(([name, value]) => `  viewer.setAttribute(${JSON.stringify(name)}, ${JSON.stringify(value === true ? '' : value)});`);
      return {
        platform,
        blocks: [
          { where: 'Add Elements → Embed Code → Custom Element → Choose Source → Server URL', code: script.url, language: 'text' },
          { where: 'Tag Name', code: BRAND.tagName, language: 'text' },
          { where: 'Page code (Dev Mode / Velo). Replace #customElement1 with the element ID', code: `$w.onReady(() => {\n  const viewer = $w('#customElement1');\n${attrs.join('\n')}\n  viewer.setAttribute('height', '100%');\n});`, language: 'js' },
        ],
        notes: [
          'Wix shows custom elements on the live site only with a Premium plan, a connected domain and no Wix ads.',
          'The Server URL field takes no integrity hash. For a pinned, SRI-checked copy, use the Velo file in packages/wix instead.',
        ],
        warnings,
      };
    }
    case 'wordpress':
      return {
        platform,
        blocks: [{ where: 'Shortcode block, Classic editor, or a widget', code: generateShortcode(options), language: 'text' }],
        notes: ['Install the 3D Viewer plugin first. The block editor also has a "3D Viewer" block with the same options.'],
        warnings,
      };
    case 'shopify':
      return {
        platform,
        blocks: [{ where: 'Custom Liquid section or block in the theme editor', code: `${s}\n${el}`, language: 'liquid' }],
        notes: ['The 3D Viewer app block can use the product\'s own 3D media instead of a URL. See the Shopify guide.'],
        warnings,
      };
    case 'embed':
      return {
        platform,
        blocks: [
          { where: 'Builders that accept embed or iframe code', code: embedIframe(options), language: 'html' },
          { where: 'Builders that embed by link (paste the URL)', code: embedUrl(options), language: 'text' },
        ],
        notes: [
          `The iframe shows a page on ${new URL(BRAND.docsUrl).host} that loads your model straight from your URL in the visitor's browser. Nothing is proxied or stored, and the page sets no cookies.`,
          'Model, USDZ and poster URLs must be full https:// URLs, and the server must send CORS headers (check them with the URL checker).',
          IFRAME_AR_NOTE,
        ],
        warnings,
      };
    case 'ghost':
      return {
        platform,
        blocks: [
          { where: 'Settings → Advanced → Code injection → Site footer, once for the whole site', code: s, language: 'html' },
          { where: 'In the post or page editor, add an HTML card where the model should appear', code: el, language: 'html' },
        ],
        notes: ['For one post only, put the script in that post\'s own code injection (post settings → Code injection, footer field) instead.'],
        warnings,
      };
    case 'hubspot':
      return {
        platform,
        blocks: [
          { where: 'With the 3D Viewer module (see the HubSpot guide): Model URL field', code: o.src, language: 'text' },
          { where: 'Alt text field', code: o.alt, language: 'text' },
          { where: 'Without the module: site footer HTML once, then the element in an HTML-capable module (verify which modules keep custom elements)', code: `${s}\n${el}`, language: 'html' },
        ],
        notes: ['The module adds the script itself, with its SRI hash, and escapes every field.'],
        warnings,
      };
    case 'bigcommerce':
      return {
        platform,
        blocks: [
          { where: 'Storefront → Script Manager → Create a script: Location "Footer", Pages "All pages", Category "Essential", Type "Script" (menu names: verify)', code: s, language: 'html' },
          { where: 'Where the model should appear: a Page Builder HTML widget, or the HTML source of a product description (verify that the editor keeps the element)', code: el, language: 'html' },
        ],
        notes: ['Script Manager scripts need the theme to include {{footer.scripts}}; Stencil themes do.'],
        warnings,
      };
    case 'duda':
      return {
        platform,
        blocks: [
          { where: 'Settings → Header HTML → Body End HTML, once for the whole site', code: s, language: 'html' },
          { where: 'Add → Elements → HTML widget, placed where the model should appear', code: el, language: 'html' },
        ],
        notes: ['Custom code runs on the published or preview site; the editor may show the HTML widget as a placeholder.'],
        warnings,
      };
    case 'square-online':
      return {
        platform,
        blocks: [{ where: 'Edit site → + Add → Section → Embed code → paste', code: `${s}\n${el}`, language: 'html' }],
        notes: [
          'Script and element go in the same Embed code section. Whether Square shows embed code inside an iframe is not confirmed (verify); if the model does not appear after publishing, use the iframe embed instead.',
          IFRAME_AR_NOTE,
        ],
        warnings,
      };
    case 'weebly':
      return {
        platform,
        blocks: [{ where: 'Drag an Embed Code element where the model should appear, click it and paste (verify the labels on your editor version)', code: `${s}\n${el}`, language: 'html' }],
        notes: ['For many models, the script can go once in Settings → SEO → Footer Code instead (verify the menu on your plan).'],
        warnings,
      };
    case 'godaddy':
      return {
        platform,
        blocks: [{ where: 'Add section → search "HTML" → Custom Code → paste. Set Forced Height to the viewer height in pixels', code: `${s}\n${el}`, language: 'html' }],
        notes: [
          'GoDaddy puts custom code inside an iframe and has no site-wide code, so each HTML section needs the script and the element together.',
          IFRAME_AR_NOTE,
        ],
        warnings,
      };
    case 'hostinger':
      return {
        platform,
        blocks: [{ where: 'Add elements → Embed code → Enter code → paste → Embed code', code: `${s}\n${el}`, language: 'html' }],
        notes: [
          'Whether Hostinger shows embed code inside an iframe is not confirmed (verify). If the model does not appear on the published site, use the iframe embed.',
          IFRAME_AR_NOTE,
        ],
        warnings,
      };
  }
}
