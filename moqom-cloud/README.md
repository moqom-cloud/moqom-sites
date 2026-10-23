# moqom.cloud

Marketing site for **MOQOM Cloud**, built with [Astro](https://astro.build) as a fully static site. Pages are
HTML and CSS. Charts are inline SVG generated at build time. Liquid glass and the Apple-style scroll effects are CSS
only (scroll-driven animations); there is no animation JavaScript. The only JavaScript is three small inline islands:
the pricing estimator, the signup form (only when signups are enabled) and the live signup count.

## Develop

```sh
pnpm install
pnpm dev          # http://localhost:4321
pnpm build        # static output in dist/
pnpm preview      # serve dist/ locally
pnpm check        # type-check .astro and .ts (fetches @astrojs/check + TypeScript 6 on demand)
pnpm og           # re-render public/og.png from public/og.svg after editing it
```

Requires Node 20+ and pnpm 10+ (the repo pins `pnpm@11.17.0` via `packageManager`).

## Environment variables

All are inlined at **build time**, so change them and rebuild. Copy `.env.example` to `.env` for local overrides.

| Variable                 | Default                                  | Used by                                                       |
| ------------------------ | ---------------------------------------- | ------------------------------------------------------------- |
| `PUBLIC_BILLING_API`     | `https://moqom.cloud`                    | `SIGNUP.apiBase` in `src/data/site.ts`; `/signup` POSTs to `${apiBase}/v1/signup` (the load balancer routes `moqom.cloud/v1/*` to the billing API) |
| `PUBLIC_SIGNUP_ENABLED`  | unset (on)                               | `/signup` renders the form unless this is exactly `false` |
| `PUBLIC_MOQOM_STATS_URL` | `${apiBase}/v1/public/stats`             | Signup count in the home page stats strip (hidden if unreachable) |
| `GITHUB_TOKEN`           | unset                                    | Optional, at build time: lifts the GitHub rate limit for the stats strip |

### Signups

Signups are live. The sites load balancer routes `moqom.cloud/v1/*` to the `moqom-control-billing` backend, so the
form posts same-origin and the key is issued on the spot. `billing.CORS` in `moqom/go/internal/billing/http.go` also
allows `MOQOM_BILLING_CORS_ORIGINS` for other origins.

Until the Stripe secrets (`moqom-dev-stripe-secret-key`, `moqom-dev-stripe-webhook-secret`) have versions, the control
plane runs billing without Stripe: signup still issues the tenant and API key, `checkout_url` comes back empty, and the
form sends people to `/account/` instead of checkout.

## Layout

```
src/
  styles/tokens.css     shared Elliott Wave design tokens (colours, type, spacing)
  styles/glass.css      liquid glass (.glass, .glass--strong, .glass--interactive, .glass-bar, .glass-field)
  styles/scroll.css     CSS scroll-driven effects (.reveal, .depth-1/2/3, .hero-zoom, .pin-stage, .text-sweep)
  styles/global.css     base styles and utility classes; sets --glass-tint to MOQOM cyan
  data/                 single source for numbers: benchmarks, pricing, price-cards, compare, platforms, site links
  lib/github.ts         build-time GitHub repo stats for LiveStats
  components/           BarChart (SVG), FlowDiagram (SVG), BenchBadge, BenchFootnote, PriceCards, LiveStats,
                        ResolutionTable, Estimator, CodeWindow, …
  layouts/              Base (SEO/OG meta, glass field, header, footer) and Legal (DRAFT banner)
  pages/                /, /pricing, /benchmarks, /compare, /security, /platforms, /signup, /company, /press, /legal/*
public/                 favicon, og.png/og.svg, robots.txt
scripts/og.mjs          SVG → PNG for the social card
```

### Copies of shared files

These are copies, so the site builds standalone. **The canonical copies live in `sites/_shared`**: edit there, then
re-copy. Each copy has a header comment saying so, and differs only in its import path.

| Site copy                         | Canonical                                   |
| --------------------------------- | ------------------------------------------- |
| `src/styles/glass.css`            | `sites/_shared/glass/glass.css`             |
| `src/styles/scroll.css`           | `sites/_shared/glass/scroll.css`            |
| `src/components/PriceCards.astro` | `sites/_shared/pricing/PriceCards.astro`    |
| `src/data/price-cards.ts`         | `sites/_shared/pricing/price-cards.ts`      |
| `src/components/LiveStats.astro`  | `sites/_shared/stats/LiveStats.astro`       |
| `src/lib/github.ts`               | `sites/_shared/stats/github.ts`             |
| `src/data/compare.ts` (content)   | `sites/_shared/moqom-cloud-compare.md`      |
| `src/pages/press.astro` (content) | `sites/_shared/moqom-cloud-press.md`        |

`scroll.css` sets `color: transparent` on `.text-sweep` while sweeping with `currentColor`, which would hide the
swept-in half. `global.css` overrides `.text-sweep { color }` to fix this; the fix belongs upstream in `_shared`.

### Motion and accessibility

Every scroll effect is progressive enhancement. Browsers without `animation-timeline`, and visitors who prefer reduced
motion, get a fully readable static page. Glass panels carry a base fill that meets 4.5:1 on its own; reduced
transparency and forced colours get solid panels. `global.css` raises `--text-faint` to `#8a9097` so faint text also
clears 4.5:1 on glass.

### Rules for editing content

- **Benchmarks.** Every benchmark number must sit next to `<BenchBadge />` ("Measured in lab; pending load test
  (Oct 2026)") and `<BenchFootnote />` ("* Built to scale: … pending load test (Oct 2026)."). Never present them as
  SLAs. Numbers live in `src/data/benchmarks.ts`. Update them only from a committed run.
- **Pricing.** `src/data/pricing.ts` mirrors `moqom/go/internal/billing/rates.go`. Change both together. Agora
  list prices were retrieved October 2026 and need rechecking periodically. `src/data/price-cards.ts` is computed
  from the billing formula; don't edit its numbers by hand.
- **Comparison.** Competitor facts on `/compare` come from `sites/_shared/moqom-cloud-compare.md` (accessed
  6 Oct 2026). Re-check before publishing and whenever a vendor changes its pricing or docs.
- **Mechanisms.** Describe what MOQOM *does* (outcomes), not *how* it does it. Check with Elliott Wave LLC before
  adding any technical detail about how a feature works internally.
- **Patents.** Say "Patents pending" and nothing more.
- **Partnerships.** None is signed. Don't imply one.

## Deploy

Hosting is a Google Cloud Storage bucket behind an HTTPS load balancer. Build and upload with:

```sh
moqom/deploy/tools/publish-sites.sh moqom-cloud
```

It runs `pnpm install --frozen-lockfile && pnpm build` here and rsyncs `dist/` to `gs://moqom-sites/moqom-cloud`
(HTML cached for five minutes, hashed `/_astro` assets for a year). Set the `PUBLIC_*` variables in the environment
before running it.

**Firebase-ready.** The site is moving to Firebase Hosting. The static `dist/` output works there unchanged
(`public: "dist"`, `cleanUrls`, `404.html`). Security and cache headers will go in `firebase.json` when that happens
(the old Cloudflare `public/_headers` file was removed because nothing read it):

- `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`,
  `Permissions-Policy: camera=(), microphone=(), geolocation=()`,
  `Strict-Transport-Security: max-age=31536000; includeSubDomains` on `**`
- `Cache-Control: public, max-age=31536000, immutable` on `/_astro/**`

The site has no server runtime, so no functions or adapter are needed.

## TODO

- `/press`: create the `press@elliottwave.studio` mailbox before publishing, and fill in the Show HN and Product Hunt
  links in `src/pages/press.astro` once the posts are live (they read "Coming soon" until then). Copy comes from
  `sites/_shared/moqom-cloud-press.md`; change it upstream first.
- HackerOne: link `SITE.hackerone` (`https://hackerone.com/elliottwave`) from `/security` once the program is live.
  Until then reports go to security@moqom.cloud.
- Signups: see "Signups: what is still needed" above.
- Stats strip: the signup figure stays hidden until the billing API has a public host. GitHub figures show for
  repositories that are public at build time.
- Upstream the `.text-sweep` colour fix into `sites/_shared/glass/scroll.css`.
