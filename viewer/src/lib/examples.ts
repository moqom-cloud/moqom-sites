// Example snippets, rendered at build time with the same generator the CLI and the platform
// packages use, so the SRI hash on every page matches the current release.
import { cdnScript, generateShortcode, generateSnippet, platformSnippet, type Platform, type ViewerOptions } from '../vendor/core/snippet-entry';
import { SITE } from '../data/site';

export const SCRIPT = cdnScript(SITE.release);

export const EXAMPLE: ViewerOptions = {
  src: 'https://your-models.web.app/models/chair.glb',
  iosSrc: 'https://your-models.web.app/models/chair.usdz',
  alt: 'Oak chair with a woven seat',
};

export const exampleFor = (platform: Platform, options: ViewerOptions = EXAMPLE) => platformSnippet(platform, options, SCRIPT);
export const exampleHtml = (options: ViewerOptions = EXAMPLE) => generateSnippet(options, SCRIPT);
export const exampleShortcode = (options: ViewerOptions = EXAMPLE) => generateShortcode(options, SITE.shortcode);
