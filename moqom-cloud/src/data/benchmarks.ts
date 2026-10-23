// Lab results from August 2026 builds. Every figure rendered from this file
// must sit next to <BenchBadge />: none of these are production SLAs.

export const headline = {
  latencyMedian: "56–57 ms",
  latencyP95: "70 ms",
  fanoutSubscribers: "6,000",
  fanoutThroughput: "5.46 Gbit/s",
  fanoutMachine: "4 vCPU",
  perVcpu: "~1.3–1.4 Gbit/s",
  sframeCost: "54 µs",
};

export const latencyBars = [
  { label: "720p30 · median", value: 57, display: "56–57 ms" },
  { label: "720p30 · p95", value: 70, display: "70 ms" },
  { label: "720p30 · layout changing every 8 s", value: 61, display: "61 ms" },
  { label: "720p30 · alongside a shared AR game", value: 66, display: "66 ms" },
  { label: "540p60 · 600 kbps", value: 69, display: "69 ms" },
];

export const fanoutBars = [
  { label: "4,000 subscribers", value: 3.57, display: "3.57 Gbit/s" },
  { label: "4,500 subscribers", value: 4.11, display: "4.11 Gbit/s" },
  { label: "5,000 subscribers", value: 4.59, display: "4.59 Gbit/s" },
  { label: "5,500 subscribers", value: 5.04, display: "5.04 Gbit/s" },
  { label: "6,000 subscribers", value: 5.46, display: "5.46 Gbit/s" },
];

// Median delivery latency on the 4-vCPU relay as the audience grows, from the
// clean August 2026 runs. Bars use the slower of the two load generators.
export const fanoutLatencyBars = [
  { label: "4,000 viewers", value: 18.9, display: "16–19 ms" },
  { label: "4,500 viewers", value: 28.1, display: "24–28 ms" },
  { label: "5,000 viewers", value: 31.5, display: "30–32 ms" },
  { label: "5,500 viewers", value: 38.2, display: "38 ms" },
  { label: "6,000 viewers", value: 61.3, display: "61 ms" },
];

// Delivery latency on the 4-vCPU relay (publisher send to viewer receive), from
// the August 2026 fan-out runs; the range covers the two load generators.
export const fanoutLatency = {
  at6000: { p50: "61 ms", p95: "135 ms", slowest: "0.38 s" },
  at3500: { p50: "13–17 ms" },
};

// The same 6,000-viewer load on Google Cloud (MOQOM's relay, August 2026) and on Cloudflare's
// (22 October 2026). On Cloudflare, sessions opened at 100 per second per
// generator and frames counted only once all were in, matching how the MOQOM
// runs count. Ranges cover the load generators.
export const cloudflareVersus = [
  { what: "Viewers receiving video", gcp: "6,000 of 6,000", cloudflare: "5,759 of 6,000" },
  { what: "Viewers who missed frames", gcp: "0", cloudflare: "0" },
  { what: "Median delivery", gcp: "61 ms", cloudflare: "16–20 ms" },
  { what: "p95 delivery", gcp: "134–136 ms", cloudflare: "25–31 ms" },
  { what: "Slowest frame", gcp: "0.38 s", cloudflare: "0.17–0.69 s" },
  { what: "Delivery confirmed by the relay's own counters", gcp: "Yes", cloudflare: "No, none exposed" },
  { what: "Infrastructure", gcp: "One 4-vCPU VM running MOQOM's relay, at 97% CPU", cloudflare: "Cloudflare's global network (beta)" },
];

export const cloudflareLimits = [
  { feature: "Post-quantum end-to-end encryption (SFrame, MLS room keys)", cloudflare: "Yes, keys from MOQOM", moqom: "Yes" },
  { feature: "Protocol version", cloudflare: "draft-16", moqom: "draft-22, and draft-19" },
  { feature: "Catch-up and late join from cache (FETCH)", cloudflare: "No", moqom: "Yes" },
  { feature: "Pause, resume and priority changes (REQUEST_UPDATE)", cloudflare: "No", moqom: "Yes" },
  { feature: "Graceful relay migration (GOAWAY)", cloudflare: "No", moqom: "Yes" },
  { feature: "Per-viewer tokens", cloudflare: "No, 10 tokens per relay, shared", moqom: "Yes, device-bound" },
  { feature: "Token kept out of logs", cloudflare: "No, it travels in the URL path", moqom: "Yes, in-band" },
  { feature: "Admission tickets, kick and ban, spend limits", cloudflare: "No", moqom: "Yes" },
  { feature: "Relay counters, metering, events, recording", cloudflare: "No", moqom: "Yes" },
  { feature: "Relay-side layer and bitrate adaptation", cloudflare: "No", moqom: "Yes" },
  { feature: "Direct (peer-to-peer) calls", cloudflare: "No", moqom: "Yes" },
];

