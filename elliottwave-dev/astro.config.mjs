import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { csp, sri } from '../_shared/security/csp.mjs';

export default defineConfig({
  site: 'https://elliottwave.dev',
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  security: { csp: csp() },
  integrations: [sitemap({ filter: (page) => !page.includes('/404') }), sri()],
  markdown: {
    shikiConfig: { theme: 'github-dark-dimmed' },
  },
});
