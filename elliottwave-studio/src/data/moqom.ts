/** Every benchmark shown on this site must render alongside BENCH_LABEL, as "* {BENCH_LABEL}". */
export const BENCH_LABEL =
  'Built to scale: a Rust media plane and a Go control plane, each scaling out horizontally. Measured in lab: 6,000 viewers on one 4-vCPU relay, every frame delivered. Full data at moqom.cloud/benchmarks/load-tests.md.';

export const MOQOM_LINKS = {
  cloud: 'https://moqom.cloud',
  docs: 'https://moqom.dev',
  compare: 'https://moqom.dev/getting-started/compare/',
  dev: 'https://elliottwave.dev',
};

/** Median glass-to-glass by published resolution, largest first. Source: moqom/docs/BENCHMARKS-AND-SPECS.md. */
export const RESOLUTION_LATENCY = [
  { resolution: '4K (2160p30)', use: 'Solo host, broadcast', median: 'Results soon', measured: false },
  { resolution: '1080p30', use: 'Host / spotlight', median: 'Results soon', measured: false },
  { resolution: '720p30, 1.25 Mbit/s', use: 'Two-person call', median: '56–57 ms (p95 70 ms)', measured: true },
  { resolution: '540p60, 600 kbps', use: 'Co-hosting (publishing and decoding the other host)', median: '69 ms', measured: true },
  { resolution: '360p30', use: 'Co-host tiles in shared calls', median: 'Results soon', measured: false },
  { resolution: 'Shared video calls', use: 'Group calls, 360p–540p per tile', median: 'Results soon', measured: false },
];

export const RESOLUTION_NOTE =
  'Measured rows: two iPhone 15 Pros, home Wi-Fi, relay in Los Angeles, both directions at once. Shared calls publish at the tile’s size (360p–540p) rather than full frame, so each person’s stream is smaller; the closest references today are 540p60 at 69 ms and 720p30 with the layout changing every 8 s at 61 ms median.';

export const WHY_MOQOM = [
  'One IETF protocol, Media over QUIC Transport, for both calls and broadcast: no second product for the audience.',
  '56–57 ms median glass-to-glass at 720p30, and 6,000 viewers on one 4-vCPU relay with zero loss.',
  'End-to-end encryption required in every room, post-quantum (ML-KEM-1024 and ML-DSA-87), 54 µs per 1080p keyframe, with join tokens bound to the device and 1:1 calls point to point, off the relay.',
  'AI native: agents join rooms over the same protocol and relays as people, with their own scoped keys and an audit log, and never watch in secret.',
  'Self-hostable relays, and prepaid pricing 15% under Agora’s at every tier and volume.',
  'Already ahead for conferences, private rooms and one-to-one calls: they hold a few dozen people, we tested 6,000, and latency and price both come in under Agora.',
  'The last viewer is as fast as the first, because it is Media over QUIC: relays forward the same media to every subscriber and chain like a CDN. WebRTC platforms move big audiences to a slower mode.',
  'Scale is built in, not bolted on: relays shard across cores, scale out and chain to other relays.',
  'Honest gaps: iOS and macOS today, other platforms in progress, no independent audit yet, not yet tested at a million viewers.',
];

export const MOQOM_METRICS = [
  {
    value: '56–57 ms',
    label: 'Median glass-to-glass latency',
    detail: '720p30 at 1.25 Mbit/s HEVC, two iPhone 15 Pros on home Wi-Fi, relay in Los Angeles, both directions at once.',
  },
  {
    value: '70 ms',
    label: 'p95 glass-to-glass latency',
    detail: 'Same run, every frame delivered.',
  },
  {
    value: '6,000',
    label: 'Viewers on one 4-vCPU relay, zero loss',
    detail: '5.46 Gbit/s egress. The largest size tested, not the ceiling.',
  },
  {
    value: '54 µs',
    label: 'End-to-end encryption per frame, required in every room',
    detail: 'One 1080p keyframe, on device, against a 33 ms frame budget.',
  },
];

export const PLATFORMS = [
  { name: 'iOS', status: 'Available' },
  { name: 'macOS', status: 'Available' },
  { name: 'Web', status: 'In progress, coming Q4 2026' },
  { name: 'Android', status: 'In progress, coming Q4 2026' },
  { name: 'Desktop', status: 'In progress, coming Q4 2026' },
  { name: 'OBS plugin', status: 'Scoped, work ongoing' },
];
