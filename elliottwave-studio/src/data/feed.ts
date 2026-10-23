// The shared public feed service. Empty means not configured: the feed stays on this device (local mode).
// For testing, a page can point at another service with ?feed=<url> (that page load only) or the localStorage key
// nu.feed.api.
export const FEED_API = 'https://khensu-feed-449257903768.us-central1.run.app';

// Extra CSP sources for pages that read or post to the feed. Videos and posters come from each post's public URL,
// which can be a storage bucket on another origin, and ?feed= can point at a local service while testing.
export const FEED_CSP_SOURCES = 'https: http://127.0.0.1:* http://localhost:*';

type CspTarget = { csp?: { insertDirective(d: string): void } };

export function allowFeed(astro: CspTarget) {
  for (const d of ['connect-src', 'media-src', 'img-src']) astro.csp?.insertDirective(`${d} ${FEED_CSP_SOURCES}`);
}
