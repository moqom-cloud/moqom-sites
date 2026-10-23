// Source: sites/_shared/moqom-cloud-compare.md (competitor facts from each vendor's own pages,
// accessed 6 Oct 2026). Re-check before publishing, and whenever a vendor changes its pricing or docs.

export const ACCESSED = "6 Oct 2026";

export const resolutionRows = [
  {
    res: "4K (2160p30)",
    use: "Solo host, broadcast",
    median: "Not yet measured",
    status: "4K rung in the Swift SDK camera ladder (opt-in)",
  },
  { res: "1080p30", use: "Host / spotlight", median: "Not yet measured", status: "Supported (top rung of default camera ladder)" },
  {
    res: "720p30",
    use: "Two-person call",
    median: "56–57 ms (p95 70 ms)",
    status: "Measured: two iPhone 15 Pros, home Wi-Fi, relay in Los Angeles, both directions at once, 90 s, every frame delivered",
    measured: true,
    lead: true,
  },
  { res: "540p60, 600 kbps", use: "Co-host tiles", median: "69 ms", status: "Measured, same relay", measured: true },
  { res: "360p30", use: "Co-host tiles in shared calls", median: "Not yet measured", status: "Supported (600 kbps rung)" },
  {
    res: "Shared video calls (360p–540p per tile)",
    use: "Group calls, co-host grids",
    median: "Not yet measured",
    status: "Closest references: 540p60 at 69 ms; 720p30 with the layout changing every 8 s at 61 ms",
  },
];

export const why = [
  {
    title: "One protocol for calls and broadcast",
    body: "Built on the IETF's Media over QUIC Transport (speaking drafts 22 and 19 of draft-ietf-moq-transport): the stream that carries a two-person call also reaches an audience of thousands, without moving to a second product.",
  },
  {
    title: "Conversational latency, measured end to end",
    body: "56–57 ms median glass-to-glass at 720p30 (p95 70 ms), camera to screen on two iPhone 15 Pros.*",
  },
  {
    title: "Broadcast scale on modest hardware",
    body: "6,000 viewers on one 4-vCPU relay with zero loss (5.46 Gbit/s), the largest size tested.*",
  },
  {
    title: "Encryption that costs almost nothing",
    body: "Per-frame end-to-end encryption (SFrame, AES-256-GCM) at 54 µs per 1080p keyframe,* with post-quantum key agreement and signatures (ML-KEM, ML-DSA). TLS 1.3 on every connection, always.",
  },
  { title: "Tokens bound to the device", body: "A join token copied off one device does not work on another." },
  { title: "Your relays or ours", body: "Self-host relays and pay only the platform fee." },
  {
    title: "Prepaid, 15% under Agora",
    body: "85% of Agora's list price at every tier and every volume band, always at least 1¢ under, enforced in code.",
  },
  {
    title: "Open-source SDKs",
    body: "Go and Rust backend SDKs and a Swift client shell are open source; the media cores ship as signed binaries.",
  },
];

export const gaps = [
  "Fewer platforms today. MOQOM launches on iOS and macOS only. Android and Desktop are in progress. The OBS plugin is scoped.",
  "No independent audit yet.",
  "Lab numbers. Every number above is from the lab, including the 6,000-viewer load test; full data at moqom.cloud/benchmarks/load-tests.md.",
  "The protocol is still a draft. Media over QUIC Transport is an IETF Internet-Draft, not yet an RFC. MOQOM speaks draft-22 and draft-19.",
  "Post-quantum end-to-end encryption is required in every room, which is why only Apple platforms are supported today.",
];

export const latencyScope: [string, string, string][] = [
  ["MOQOM", "56–57 ms median glass-to-glass, 720p30 (measured in lab)*", "One stream and one protocol for both"],
  [
    "Agora",
    '"<200 ms global latency" (homepage). Docs: Interactive Live Streaming 400–800 ms host to audience; Broadcast Streaming 1,500–2,000 ms',
    "One SDK; the audience latency level affects the price",
  ],
  [
    "Tencent RTC (TRTC)",
    "Average end-to-end under 300 ms globally; live co-anchoring as low as 200 ms, viewing under 1 s",
    "Calls and live rooms in TRTC; CDN delivery through Cloud Streaming Services: LEB 300–1,000 ms, HTTP-FLV 2–3 s, HLS 10–30 s",
  ],
  [
    "AWS IVS Real-Time",
    "Under 300 ms host to viewer",
    "Up to 12 publishers per stage; 10,000 subscribers per stage by default (adjustable); publish up to 720p. Stage broadcast to an IVS channel: those viewers get low latency",
  ],
  ["AWS IVS Low-Latency", "Under 5 s", "Broadcast only"],
  ["AWS Chime SDK", "Not documented", "Meetings: up to 250 participants at 720p, or 25 at 1080p; replication to 10,000 / 1,000"],
  [
    "Google Cloud",
    "No end-to-end figure documented; Live Stream API segments are 2–20 s (default 6 s)",
    "Broadcast: Live Stream API (HLS/DASH) with Media CDN. No Google Cloud real-time video-calling SDK found; Meet Media API (Developer Preview) reads media from Google Meet calls",
  ],
  [
    "Cloudflare",
    "Not documented for MoQ",
    "MoQ relays (beta) on draft-14 and draft-16. Its MoQ docs list no Cloudflare client SDK for MoQ (examples use open-source moq-rs). WebRTC SDKs: RealtimeKit, Realtime SFU",
  ],
];

export const priceProtocol: [string, string, string, string][] = [
  [
    "MOQOM",
    "Prepaid, per 1,000 min $3.39 HD, $7.64 Full HD, $13.59 2K, $30.59 2K+, lower with volume",
    "TLS 1.3 always; post-quantum SFrame E2EE (AES-256-GCM, ML-KEM, ML-DSA), required in every room",
    "IETF MoQ Transport, draft-22 and draft-19",
  ],
  [
    "Agora",
    "Per 1,000 min: $3.99 HD, $8.99 Full HD, $15.99 2K, $35.99 2K+; broadcast audience $1.99–$17.99",
    "Built-in media encryption opt-in; E2EE in beta (web, by request)",
    "Agora SD-RTN™",
  ],
  [
    "Tencent RTC",
    "Per 1,000 min: $3.99 HD, $8.99 Full HD, $15.99 2K, $35.99 4K; live audience $2.00–$18.00",
    "Built-in transport encryption by default; private payload encryption opt-in, not available with cloud recording or CDN relay",
    "UDP-based Tencent protocol; WebRTC on web",
  ],
  [
    "AWS IVS Real-Time",
    "$0.072 per participant-hour (about $1.20 per 1,000 participant-minutes), North America, first 10,000 h, any resolution",
    "Not stated on pages cited",
    "Not stated on pages cited",
  ],
  [
    "AWS IVS Low-Latency",
    "Output per hour delivered: $0.036 SD, $0.072 HD, $0.144 Full HD (North America, first 10,000 h), plus input $0.20–$2.00/h",
    "Not stated on pages cited",
    "RTMP, RTMPS or SRT ingest",
  ],
  ["AWS Chime SDK", "$0.0017 per attendee-minute ($1.70 per 1,000)", "DTLS transport; E2EE not stated on pages cited", "WebRTC"],
  ["Google Cloud", "Not compared (broadcast product)", "Content encryption: AES-128, SAMPLE-AES, MPEG-CENC", "SRT/RTMP in, HLS/DASH out"],
  [
    "Cloudflare",
    "MoQ relays free during beta",
    "Not stated on pages cited (MoQ)",
    "IETF MoQ Transport, draft-14 and draft-16; draft-18 in testing",
  ],
];

export const providerNotes = [
  {
    name: "Agora",
    body: "MOQOM charges 85% of Agora's list price at every tier, after the same automatic volume discount Agora gives, and always at least 1¢ less per 1,000 minutes; the code enforces it. Agora bills by the total pixels a user receives; MOQOM uses the same tier boundaries so the rates compare like with like.",
  },
  {
    name: "Tencent RTC",
    body: "Tencent's video tiers and list prices match Agora's, with the top tier named 4K. TRTC documents that, to meet data-security storage requirements, it stores account and troubleshooting data in the Chinese mainland for Tencent Cloud customers and in Singapore for Tencent Cloud International customers, and that it processes audio and video only to deliver them, without storing them. Teams with data-residency or jurisdiction requirements should check which Tencent entity and region apply to their account. MOQOM runs on Google Cloud today, and you can run relays where you choose.",
  },
  {
    name: "Google Cloud",
    body: "Google Cloud's Live Stream API takes SRT or RTMP in and writes HLS or DASH segments of 2–20 seconds to Cloud Storage for delivery through Media CDN: a broadcast pipeline, not a real-time one. MOQOM runs on Google Cloud today.",
  },
  {
    name: "AWS",
    body: "AWS splits live video across products: IVS Real-Time (under 300 ms, up to 12 publishers, 720p publish), IVS Low-Latency (under 5 s) for large audiences, and the Chime SDK for meetings. Viewers of a stage broadcast to an IVS channel get low latency, not real-time latency. MOQOM carries the call and the broadcast on one stream and one standard.",
  },
  {
    name: "Cloudflare",
    body: "Cloudflare runs MoQ relays across its network (beta, free during the beta), so MoQ is becoming infrastructure, not one company's protocol. Cloudflare's MoQ documentation lists no Cloudflare client SDK for MoQ; its examples use the open-source moq-rs tools, and its client SDKs (RealtimeKit) are WebRTC. MOQOM is the SDK and platform layer. We hope to partner with Cloudflare; no partnership is signed.",
  },
];

export const sources: [string, string][] = [
  ["Agora pricing", "https://docs.agora.io/en/interactive-live-streaming/overview/pricing"],
  ["Agora latency by product", "https://docs.agora.io/en/api-reference/faq/product/streaming_difference"],
  ["Agora homepage (\"<200ms global latency\")", "https://www.agora.io/en/"],
  ["Agora media stream encryption", "https://docs.agora.io/en/realtime-media/rtc/build/secure-and-protect-channels/media-stream-encryption"],
  ["Agora end-to-end encryption (Beta)", "https://docs.agora.io/en/realtime-media/rtc/build/secure-and-protect-channels/end-to-end-encryption"],
  ["Tencent RTC pricing", "https://trtc.io/pricing"],
  ["Tencent RTC audio/video duration billing", "https://trtc.io/document/42734"],
  ["Tencent RTC live audience billing", "https://trtc.io/document/66078"],
  ["Tencent RTC latency (FAQs for Beginners)", "https://trtc.io/document/38104"],
  ["Tencent Cloud Streaming Services protocol latency", "https://www.tencentcloud.com/document/product/1071/39477"],
  ["Tencent LEB latency", "https://www.tencentcloud.com/document/product/267/42226"],
  ["Tencent RTC security and default encryption", "https://trtc.io/document/53568"],
  ["Tencent RTC private encryption API", "https://www.tencentcloud.com/document/product/647/35125"],
  ["Tencent RTC private encryption limits", "https://cloud.tencent.com/document/product/647/106173"],
  ["Tencent RTC data storage", "https://www.tencentcloud.com/document/product/647/53569"],
  ["Tencent RTC data processing module", "https://intl.cloud.tencent.com/document/product/647/48828"],
  ["Google Cloud Live Stream API overview", "https://cloud.google.com/livestream/docs/overview"],
  ["Google Live Stream API segment settings", "https://github.com/googleapis/googleapis/blob/master/google/cloud/video/livestream/v1/outputs.proto"],
  ["Google Meet Media API", "https://developers.google.com/workspace/meet/media-api/guides/overview"],
  ["AWS IVS Low-Latency", "https://docs.aws.amazon.com/ivs/latest/LowLatencyUserGuide/what-is.html"],
  ["AWS IVS Real-Time", "https://docs.aws.amazon.com/ivs/latest/RealTimeUserGuide/what-is.html"],
  ["AWS IVS Real-Time quotas", "https://docs.aws.amazon.com/ivs/latest/RealTimeUserGuide/service-quotas.html"],
  ["AWS IVS pricing", "https://aws.amazon.com/ivs/pricing/"],
  ["AWS Chime SDK", "https://docs.aws.amazon.com/chime-sdk/latest/dg/meetings-sdk.html"],
  ["AWS Chime SDK pricing", "https://aws.amazon.com/chime/chime-sdk/pricing/"],
  ["Cloudflare MoQ docs", "https://developers.cloudflare.com/moq/"],
  ["Cloudflare MoQ launch", "https://blog.cloudflare.com/moq/"],
  ["Cloudflare MoQ relay API, draft-14 and draft-16", "https://blog.cloudflare.com/moq-relays/"],
  ["Cloudflare Realtime", "https://developers.cloudflare.com/realtime/"],
  ["Cloudflare RealtimeKit", "https://developers.cloudflare.com/realtime/realtimekit/"],
  ["IETF MoQ Transport", "https://datatracker.ietf.org/doc/draft-ietf-moq-transport/"],
];
