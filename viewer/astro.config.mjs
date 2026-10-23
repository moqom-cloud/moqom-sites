import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { csp, sri } from '../_shared/security/csp.mjs';

// <model-viewer> (three.js) turns textures embedded in a GLB into blob: images. Pages that load a
// visitor's own model URL (the generator preview and the URL checker) widen connect-src, img-src
// and worker-src with allowVisitorModels() from src/lib/csp.ts.
// <model-viewer> also renders a static <style> in its shadow root, allowed here by the hash the
// viewer build records in release.json.
// The buy, success and licence pages call the licence server (LICENSING.api in
// src/vendor/core/licensing-config.ts); checkout itself is a navigation to checkout.stripe.com,
// which needs no CSP source.
const release = JSON.parse(readFileSync(new URL('./src/vendor/release.json', import.meta.url), 'utf8'));
const policy = csp({ connect: ['https://licensing.elliottwave.studio'] });
policy.directives = policy.directives.map((d) => (d.startsWith('img-src ') ? d.replace("img-src 'self'", "img-src 'self' blob:") : d));
policy.styleDirective.hashes = release.styleHashes;

export default defineConfig({
  site: 'https://viewer.elliottwave.studio',
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  security: { csp: policy },
  integrations: [sitemap({ filter: (page) => !page.includes('/404') && !page.includes('/embed/') }), sri()],
  // Highlighters emit inline style attributes, which the CSP check rejects.
  markdown: { syntaxHighlight: false },
  vite: {
    // The viewer chunk includes three.js; it is loaded only on pages that show a model.
    // assetsInlineLimit 0: never turn small assets into data: URIs, which the CSP check rejects.
    build: { chunkSizeWarningLimit: 1200, assetsInlineLimit: 0 },
  },
});
