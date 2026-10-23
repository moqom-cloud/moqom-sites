// Rate card. Mirrors moqom/go/internal/billing/rates.go (DefaultPricing,
// AgoraVolumeBands and RatePer1000); update both together.
//
// Agora source: docs.agora.io, Interactive Live Streaming pricing, and its
// automatic monthly volume discounts, retrieved October 2026. Prices are USD
// per 1,000 participant-minutes.

export type Tier = "audio" | "hd" | "full_hd" | "2k" | "2k_plus";
export type Role = "interactive" | "broadcast";

export const TIERS: { id: Tier; label: string; detail: string }[] = [
  { id: "audio", label: "Audio", detail: "No video" },
  { id: "hd", label: "HD", detail: "Up to 1280×720 aggregate" },
  { id: "full_hd", label: "Full HD", detail: "Up to 1920×1080 aggregate" },
  { id: "2k", label: "2K", detail: "Up to 2560×1440 aggregate" },
  { id: "2k_plus", label: "2K+", detail: "Above 2560×1440 aggregate" },
];

export const AGORA: Record<Role, Record<Tier, number>> = {
  interactive: { audio: 0.99, hd: 3.99, full_hd: 8.99, "2k": 15.99, "2k_plus": 35.99 },
  broadcast: { audio: 0.59, hd: 1.99, full_hd: 4.59, "2k": 7.99, "2k_plus": 17.99 },
};

/** MOQOM's price is this share of Agora's at the same volume band: 15% under. */
export const SHARE = 0.85;

/** Agora's automatic monthly volume discount, applied to the minutes inside each band. */
export const VOLUME_BANDS: { fromMinutes: number; discount: number; label: string }[] = [
  { fromMinutes: 0, discount: 0, label: "First 100,000 minutes" },
  { fromMinutes: 100_000, discount: 0.05, label: "100,000 – 500,000" },
  { fromMinutes: 500_000, discount: 0.07, label: "500,000 – 1,000,000" },
  { fromMinutes: 1_000_000, discount: 0.1, label: "Over 1,000,000" },
];

const cents = (n: number) => Math.round(n * 1e6) / 1e6;

/** Agora's rate in a band, then ours: 85% of it, rounded down to a cent, and never above Agora less 1¢. */
export const agoraAt = (role: Role, tier: Tier, band = 0) => cents(AGORA[role][tier] * (1 - VOLUME_BANDS[band].discount));
export const rateAt = (role: Role, tier: Tier, band = 0) => {
  const agora = agoraAt(role, tier, band);
  return Math.min(Math.floor(cents(agora * SHARE) * 100) / 100, cents(agora - 0.01));
};

/** MOQOM's first-band rate, the most anyone pays. */
export const RATE: Record<Role, Record<Tier, number>> = {
  interactive: Object.fromEntries(TIERS.map((t) => [t.id, rateAt("interactive", t.id)])) as Record<Tier, number>,
  broadcast: Object.fromEntries(TIERS.map((t) => [t.id, rateAt("broadcast", t.id)])) as Record<Tier, number>,
};

/** Current defaults. Commercial settings; the live values are at /v1/rates. */
export const PRICING = {
  // The whole price on a tenant's own relays. Agora's cheapest effective rate is
  // about $0.16/GiB (720p-1080p to a broadcast audience), so this stays 68% under.
  selfHostedFeePerGiB: 0.05,
  minTopUp: 10,
};

/**
 * Illustrative per-participant bitrates the estimator starts from. These are
 * assumptions for the estimate only; real bitrates depend on the encoder and
 * the content, and the bill is metered on actual bytes.
 */
export const ASSUMED_KBPS: Record<Tier, number> = {
  audio: 64,
  hd: 1500,
  full_hd: 3500,
  "2k": 6000,
  "2k_plus": 12000,
};

/**
 * The default camera ladder (MoqomKit `LayerLadder.defaultCamera()` plus the 4K
 * rung), used to price layouts: each tile is sent at the smallest rung at least
 * as tall as the box it is shown in.
 */
export const LADDER = [
  { label: "180p", width: 320, height: 180, kbps: 200 },
  { label: "360p", width: 640, height: 360, kbps: 600 },
  { label: "720p", width: 1280, height: 720, kbps: 1800 },
  { label: "1080p", width: 1920, height: 1080, kbps: 4000 },
  { label: "4K", width: 3840, height: 2160, kbps: 12000 },
] as const;

/** Agora and MOQOM share these boundaries: the sum of pixels received at once. */
export const tierForPixels = (pixels: number): Tier =>
  pixels <= 0 ? "audio" : pixels <= 1280 * 720 ? "hd" : pixels <= 1920 * 1080 ? "full_hd" : pixels <= 2560 * 1440 ? "2k" : "2k_plus";

export const usd = (n: number, digits = 2) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits });
