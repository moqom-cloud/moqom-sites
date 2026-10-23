/** Every benchmark shown on this site must render alongside BENCH_LABEL, as "* {BENCH_LABEL}". */
export const BENCH_LABEL =
  'Built to scale: a Rust media plane and a Go control plane, each scaling out horizontally. Measured in lab: 6,000 viewers on one 4-vCPU relay, every frame delivered. Full data at moqom.cloud/benchmarks/load-tests.md.';

export const LINKS = {
  docs: 'https://moqom.dev',
  console: 'https://moqom.cloud',
  // TODO(Elliott): placeholder org URL; repositories are not public until the OPEN-CORE.md blockers are cleared.
  github: 'https://github.com/moqom-cloud',
  // TODO(Elliott): placeholder until the HackerOne program is live; until then reports go to SECURITY_EMAIL.
  hackerone: 'https://hackerone.com/elliottwave',
};

export const SECURITY_EMAIL = 'security@moqom.cloud';

export const METRICS = [
  { value: '56–57 ms', label: 'median glass-to-glass', note: '720p30 at 1.25 Mbit/s, two iPhone 15 Pros, relay in Los Angeles' },
  { value: '70 ms', label: 'p95 glass-to-glass', note: 'same run, every frame delivered' },
  { value: '6,000', label: 'subscribers, one 4-vCPU relay', note: '5.46 Gbit/s, zero loss' },
];

/** Median glass-to-glass by published resolution, largest first. Source: moqom/docs/BENCHMARKS-AND-SPECS.md. */
export const RESOLUTION_LATENCY = [
  { resolution: '4K (2160p30)', use: 'solo host, broadcast', median: 'results soon', measured: false },
  { resolution: '1080p30', use: 'host / spotlight', median: 'results soon', measured: false },
  { resolution: '720p30, 1.25 Mbit/s', use: 'two-person call', median: '56–57 ms (p95 70 ms)', measured: true },
  { resolution: '540p60, 600 kbps', use: 'co-hosting (publishing and decoding the other host)', median: '69 ms', measured: true },
  { resolution: '360p30', use: 'co-host tiles in shared calls', median: 'results soon', measured: false },
  { resolution: 'shared video calls', use: '360p–540p per tile', median: 'results soon', measured: false },
];

export const RESOLUTION_NOTE =
  'Shared calls publish at the tile’s size (360p–540p), not full frame. Closest references today: 540p60 at 69 ms; 720p30 with the layout changing every 8 s at 61 ms median.';

export const COMPARE_URL = 'https://moqom.dev/getting-started/compare/';

export type PlatformStatus = 'available' | 'building' | 'scoped';

export const PLATFORMS: Array<{ name: string; sdk: string; status: PlatformStatus; note: string }> = [
  { name: 'iOS', sdk: 'MoqomKit (Swift)', status: 'available', note: 'Available' },
  { name: 'macOS', sdk: 'MoqomKit (Swift)', status: 'available', note: 'Available' },
  { name: 'Web', sdk: 'moqom-web', status: 'building', note: 'In progress, coming Q4 2026' },
  { name: 'Android', sdk: 'moqom-android', status: 'building', note: 'In progress, coming Q4 2026' },
  { name: 'Desktop (Windows, macOS, Linux)', sdk: 'moqom-desktop', status: 'building', note: 'In progress, coming Q4 2026' },
  { name: 'OBS plugin', sdk: 'moqom-obs', status: 'scoped', note: 'Scoped, work ongoing' },
];
// TODO(Elliott): MoqomKit also targets visionOS and tvOS (BENCHMARKS-AND-SPECS.md); add rows if you want to list them as available.
// TODO(Elliott): decide whether to list the Go and Rust backend SDKs here once their repositories are public.
