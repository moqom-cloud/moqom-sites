import type { AstroGlobal } from 'astro';

// For pages with the snippet generator preview or the URL checker, which load a visitor's own
// model URL from any https: origin. Astro applies insertDirective only when called from the page
// itself, not from a component, so each such page calls this in its frontmatter.
export function allowVisitorModels(astro: AstroGlobal): void {
  const csp = astro.csp;
  if (!csp) throw new Error('allowVisitorModels: security.csp is not enabled in astro.config.mjs');
  csp.insertDirective("connect-src 'self' https:");
  csp.insertDirective("img-src 'self' blob: https:");
  csp.insertDirective("worker-src 'self' blob:");
}
