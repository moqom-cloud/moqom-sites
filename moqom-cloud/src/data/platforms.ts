export const PLANNED = "Scoped, work ongoing.";
export const BUILDING = "In progress. Coming Q4 2026.";
export const AVAILABLE = "Use it in your iOS and macOS apps and ship today.";

export const STATUS_LABEL = { available: "Available", building: "In progress", planned: "Planned" } as const;
export const STATUS_PILL = { available: "pill pill-ok", building: "pill pill-accent", planned: "pill pill-planned" } as const;
export const STATUS_NOTE = { available: AVAILABLE, building: BUILDING, planned: PLANNED } as const;

export type Platform = {
  name: string;
  status: "available" | "building" | "planned";
  pkg: string;
  license: string;
  summary: string;
  details: string[];
  /** Kept out of every listing. */
  hidden?: boolean;
};

export const CLIENTS: Platform[] = [
  {
    name: "iOS & macOS",
    status: "available",
    pkg: "MoqomKit (Swift)",
    license: "Apache-2.0 SDK · binary core",
    summary: "The Swift SDK for Apple platforms: rooms, roles, publishing, capture and reconnection, written for Swift 6 strict concurrency.",
    details: [
      "iOS, macOS, visionOS and tvOS 26+",
      "Hardware encode and decode through VideoToolbox",
      "QUIC and TLS through MOQOM's own Rust stack, inside the SDK, with ML-KEM-1024 key exchange only",
      "Device keys held in the Secure Enclave",
      "Open-source SDK, with a signed binary core for playback",
    ],
  },
  {
    name: "Android",
    status: "building",
    pkg: "moqom-android",
    license: "Apache-2.0 SDK",
    summary: "A native Android client SDK with the same room model as the Swift SDK.",
    details: ["Same rooms, roles and tokens as the Swift SDK", "Same relays and same wire protocol as every other client"],
  },
  {
    name: "Desktop",
    status: "building",
    pkg: "moqom-desktop",
    license: "Apache-2.0 SDK",
    summary: "A client SDK for Windows, macOS and Linux desktop applications.",
    details: ["Windows, macOS and Linux", "Same rooms, roles and tokens as the mobile SDKs"],
  },
  {
    name: "Web",
    status: "building",
    hidden: true,
    pkg: "moqom-web",
    license: "Apache-2.0 SDK",
    summary: "A browser client over WebTransport, on the same UDP port and the same relays as native apps.",
    details: ["Evergreen browsers with WebTransport", "No plugins and no media server in between"],
  },
  {
    name: "OBS plugin",
    status: "planned",
    pkg: "moqom-obs",
    license: "GPL-2.0-or-later",
    summary: "An OBS Studio output plugin, so you can go live into a MOQOM room from the production tool you already use.",
    details: ["Publish-only output for OBS Studio", "Open source under the GPL, as OBS plugins must be"],
  },
];

export const LISTED_CLIENTS = CLIENTS.filter((c) => !c.hidden);

export const BACKENDS = [
  {
    name: "Go",
    pkg: "github.com/moqom-cloud/moqom-go",
    floor: "Go 1.23+",
    summary: "Mint client tokens, manage rooms and policy, moderate, and stream room events from your Go backend.",
  },
  {
    name: "Rust",
    pkg: "moqom-rust",
    floor: "Stable Rust",
    summary: "The same admin API for Rust backends, with no QUIC stack in your dependency graph.",
  },
];
