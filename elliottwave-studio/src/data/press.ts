/**
 * Press kit copy for /press. Outcome-level facts only: nothing here may describe how MOQOM or six10nine work
 * (patents pending). No customers, partners, quotes or coverage that do not exist.
 */

/** Must render beside every headline number, exactly, as "* {PRESS_FOOTNOTE}". Same text as BENCH_LABEL in moqom.ts. */
export const PRESS_FOOTNOTE =
  'Built to scale: a Rust media plane and a Go control plane, each scaling out horizontally. Measured in lab: 6,000 viewers on one 4-vCPU relay, every frame delivered. Full data at moqom.cloud/benchmarks/load-tests.md.';

/**
 * Launch posts. Empty renders "Coming soon".
 * TODO(Elliott): paste each URL here once the post is live, then rebuild.
 */
export const LAUNCH = {
  hackerNews: '',
  productHunt: '',
};

export const BOILERPLATE = {
  company50:
    'elliottwave.studio lab is the technology lab and studio of Elliott Wave LLC, founded and solely owned by Elliott. The lab builds products in categories of their own: MOQOM, real-time video on IETF Media over QUIC; six10nine, consistent keyboard chords across Mac apps; Unify, the iOS group-photo app Apple featured; and Kalopsia, real spaces you walk through.',
  company100:
    'elliottwave.studio lab is the technology lab and studio of Elliott Wave LLC, founded and solely owned by Elliott. The lab builds products in categories of their own. MOQOM is real-time video on Media over QUIC, the IETF’s emerging transport for live media, for both calls and broadcast, end-to-end encrypted and post-quantum in every room. six10nine is a macOS menu bar app that gives every app the same ⌘ chords. Unify, released in 2019, makes group photos where everyone looks their best, and was featured by Apple on the App Store. Kalopsia, in the lab since 2015, turns whole real spaces into places you walk through and teleport between, in VR, AR, visionOS, mobile and web. Elliott Wave LLC owns all intellectual property in its projects, open-source ones included, and has patents pending.',
  moqom50:
    'MOQOM is real-time video built on Media over QUIC Transport, the IETF’s emerging standard for live media. One open protocol carries two-person calls and live broadcasts to thousands, end-to-end encrypted and post-quantum in every room. In lab tests, 720p30 video runs at 56–57 ms median glass-to-glass, and one 4-vCPU relay served 6,000 concurrent viewers with zero loss.*',
  moqom100:
    'MOQOM is real-time video built on Media over QUIC Transport, the IETF’s emerging standard for live media. One open protocol carries two-person calls and live broadcasts to thousands, end-to-end encrypted and post-quantum in every room. In lab tests, 720p30 video runs at 56–57 ms median glass-to-glass, and one 4-vCPU relay served 6,000 concurrent viewers with zero loss.* SDKs for iOS and macOS are available; web, Android and desktop are in progress, coming Q4 2026, and the OBS plugin is scoped. MOQOM Cloud is prepaid and metered on delivery, at cost plus a margin, capped one cent below Agora’s list price. Self-hosted relays pay a platform fee only. Made by elliottwave.studio lab.',
};

export const FOUNDER = {
  name: 'Elliott',
  line: 'Elliott, Founder of elliottwave.studio lab and Elliott Wave LLC.',
  links: [
    { href: 'https://github.com/elliott-io', label: 'GitHub', handle: 'elliott-io' },
    { href: 'https://github.com/elliott-wave-labs', label: 'GitHub organisation', handle: 'elliott-wave-labs' },
    { href: 'https://www.linkedin.com/in/elliottio/', label: 'LinkedIn', handle: 'elliottio' },
    { href: 'https://www.instagram.com/khensu.nu', label: 'Instagram', handle: 'khensu.nu' },
  ],
};

/** Rows with a null value are left off the page. */
export const FACTS: { label: string; value: string | null }[] = [
  { label: 'Company', value: 'Elliott Wave LLC' },
  { label: 'Brand', value: 'elliottwave.studio lab' },
  { label: 'Founder', value: 'Elliott (founder and sole owner)' },
  // TODO(Elliott): founding date (month and year) and location (city, state).
  { label: 'Founded', value: null },
  { label: 'Location', value: null },
  { label: 'Intellectual property', value: 'Owned by Elliott Wave LLC. Patents pending.' },
  { label: 'Website', value: 'elliottwave.studio' },
];

export const PRODUCTS = [
  {
    name: 'MOQOM',
    summary:
      'Real-time video on IETF Media over QUIC Transport (draft-ietf-moq-transport, drafts 22 and 19), for calls and broadcast. iOS and macOS available; web, Android and desktop in progress, coming Q4 2026; OBS plugin scoped.',
    links: [
      { href: 'https://moqom.cloud', label: 'moqom.cloud' },
      { href: 'https://moqom.dev', label: 'moqom.dev' },
    ],
  },
  {
    name: 'six10nine',
    summary:
      'A macOS menu bar app that gives every app the same ⌘ chords. Free and source-available (PolyForm Noncommercial 1.0.0); release planned October 2026.',
    links: [{ href: '/work', label: 'Work' }],
  },
  {
    name: 'Unify',
    summary: 'One-tap group photos where everyone looks their best, built from real Live Photo moments. iOS, released 2019, featured by Apple on the App Store, free to try.',
    links: [{ href: 'https://weunify.app', label: 'weunify.app' }],
  },
  {
    name: 'Kalopsia',
    summary:
      'Whole real spaces you explore instead of scroll: walk through, then teleport to the next. VR, AR, visionOS, mobile and web. In the lab since 2015; first spaces being captured now.',
    links: [{ href: '/kalopsia', label: 'Work' }],
  },
];

export const HEADLINE_NUMBERS = [
  { value: '56–57 ms', label: 'Median glass-to-glass, 720p30', detail: 'p95 70 ms. 1.25 Mbit/s HEVC. Two iPhone 15 Pros on home Wi-Fi, relay in Los Angeles, both directions at once.' },
  { value: '69 ms', label: 'Median glass-to-glass, 540p60', detail: '600 kbps, on a live co-hosted call: each phone publishing while decoding the other host. Same relay.' },
  { value: '6,000', label: 'Viewers on one 4-vCPU relay', detail: 'Zero loss. The largest size tested, not the ceiling.' },
];

/** Files in public/ offered for download. Each is checked at build time; a missing file is left off the page. */
export const ASSETS = [
  { file: 'og.png', label: 'Social card', format: 'PNG, 1200×630' },
  { file: 'og.svg', label: 'Social card', format: 'SVG, 1200×630' },
  { file: 'favicon.svg', label: 'Wave mark, app-icon tile', format: 'SVG, 64×64' },
];
// TODO(Elliott): add standalone SVG logos (wordmark and mark, light and dark) for elliottwave.studio lab and MOQOM to
// public/press/ and list them in ASSETS; a founder headshot too, once public/images/elliott.jpg exists.

export const BRAND = [
  { name: 'Ink', hex: '#0A0B0D', use: 'Background' },
  { name: 'Amber', hex: '#F59E0B', use: 'elliottwave.studio lab accent' },
  { name: 'Cyan', hex: '#22D3EE', use: 'MOQOM accent' },
];

export const NAMING = [
  '“elliottwave.studio lab”, all lowercase, including at the start of a sentence. The company is Elliott Wave LLC.',
  '“MOQOM”, all capitals. “MOQOM Cloud” for the hosted service.',
  '“six10nine”, all lowercase.',
];

export const CONTACT = {
  // TODO(Elliott): create the press@elliottwave.studio mailbox (or alias) before launch day.
  press: 'press@elliottwave.studio',
  security: 'security@moqom.cloud',
};
