export const SITE = {
  name: "MOQOM Cloud",
  url: "https://moqom.cloud",
  docs: "https://moqom.dev",
  parent: "https://elliottwave.studio",
  parentName: "elliottwave.studio lab",
  legalEntity: "Elliott Wave LLC",
  contact: "hello@moqom.cloud",
  security: "security@moqom.cloud",
  contribute: "https://moqom.dev/community/contributing/",
  donate: "https://elliottwave.dev/donate/",
  // TODO: the program is not live yet; link it from /security once it is.
  hackerone: "https://hackerone.com/elliottwave",
  description:
    "Real-time video on Media over QUIC. 56 ms median glass-to-glass in lab tests, post-quantum end-to-end encryption in every room, and prepaid pricing 15% under Agora's list price.",
};

/**
 * Signup. The billing API base URL is set here and nowhere else.
 * The load balancer routes moqom.cloud/v1/* to the billing API, so the form is same-origin.
 * The form is on unless PUBLIC_SIGNUP_ENABLED is exactly "false" at build time.
 */
export const SIGNUP = {
  apiBase: (import.meta.env.PUBLIC_BILLING_API || "https://moqom.cloud").replace(/\/+$/, ""),
  enabled: import.meta.env.PUBLIC_SIGNUP_ENABLED !== "false",
};

/** Public repositories shown in the home page stats strip (hidden if private or unreachable at build time). */
export const STATS_REPOS = ["moqom-cloud/moqom-swift", "moqom-cloud/moqom-go", "moqom-cloud/moqom-rust"];
export const STATS_URL: string = import.meta.env.PUBLIC_MOQOM_STATS_URL || `${SIGNUP.apiBase}/v1/public/stats`;

export const COPYRIGHT =
  "© 2026 Elliott Wave LLC. All rights reserved. MOQOM™ and MOQOM Cloud™ are trademarks of Elliott Wave LLC. MOQOM is built by elliottwave.studio lab. Patents pending.";

export const BENCH_BADGE = "Measured in lab: 6,000 viewers on one 4-vCPU relay, every frame delivered";

export const BENCH_FOOTNOTE =
  "* Built to scale: a Rust media plane and a Go control plane, each scaling out horizontally. Measured in lab: 6,000 viewers on one 4-vCPU relay, every frame delivered. Full data at moqom.cloud/benchmarks/load-tests.md.";

export const PARTNERSHIPS =
  "We plan to partner with Cloudflare, Google Cloud, AWS and other CDNs and content providers. We don't wait to ship: MOQOM runs on Google Cloud today, and you can self-host relays anywhere. No partnership is signed yet.";

export const NAV = [
  { href: "/benchmarks/", label: "Benchmarks" },
  { href: "/compare/", label: "Compare" },
  { href: "/security/", label: "Security" },
  { href: "/platforms/", label: "Platforms" },
  { href: "/pricing/", label: "Pricing" },
  { href: SITE.docs, label: "Docs", external: true },
];
