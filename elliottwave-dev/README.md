# elliottwave.dev

The developer hub for elliottwave.studio lab products (today: MOQOM and six10nine). Legal entity: Elliott Wave LLC. Static [Astro](https://astro.build) site, no client-side JavaScript.

## Develop

Requires Node 22.12+ and pnpm 10+.

```sh
pnpm install
pnpm dev        # http://localhost:4321, drafts visible with a DRAFT label
pnpm build      # static output in dist/, drafts excluded
pnpm preview    # serve dist/ locally
```

`pnpm-workspace.yaml` allows esbuild's install script (`allowBuilds`), which pnpm 10+ blocks by default.

## Layout

```
src/
  content/blog/*.md        Blog posts (content collection, schema in src/content.config.ts)
  lib/posts.ts             Post query: drafts shown in dev, excluded from builds
  components/Wave.astro    Generative wave SVG, shared with the studio site
  data/moqom.ts            Benchmarks, footnote, platform status rows, product links, security email. Edit here only
  data/six10nine.ts        six10nine copy (outcome level only), licence, release status
  layouts/Base.astro       <head> (SEO, Open Graph, Twitter), header, footer
  pages/                   /, /open-source (incl. #contribute), /status, /security (incl. #bug-bounty), /donate, /blog, /blog/[slug], 404
  styles/global.css        Brand tokens (amber + cyan)
public/
  og.png / og.svg          Social card (regenerate with `sips -s format png og.svg --out og.png`)
  robots.txt, favicon.svg, .well-known/security.txt
```

## Blog

Add a Markdown file to `src/content/blog/` with frontmatter `title`, `description`, `date`, and optionally `author` and `draft`. Posts with `draft: true` render in `pnpm dev` only; they're not built, linked, or listed in the sitemap. To publish, set `draft: false`.

The seed post, `why-media-over-quic.md`, is a draft. Its review checklist is in an HTML comment at the top of the file.

## Content rules

- Don't describe how MOQOM's or six10nine's technology works. State outcomes only.
- Brand display name is "elliottwave.studio lab"; the legal entity in copyright and legal notices is "Elliott Wave LLC".
- Every benchmark carries "* Built to scale: a Rust media plane and a Go control plane, each scaling out horizontally. Measured in lab, tested to 6,000 viewers on one 4-vCPU relay with zero loss; pending further load testing." (`BENCH_LABEL`).
- `/open-source` must stay consistent with `moqom/docs/OPEN-CORE.md` and `moqom/LICENSING.md`. Where unsure, leave a `TODO` instead of guessing. six10nine is source-available (PolyForm Noncommercial 1.0.0), never "open source".
- `/donate` must stay at that path: repository READMEs and `FUNDING.yml` link to `https://elliottwave.dev/donate/`. No donation URL goes live until the account exists.
- Footer copy is fixed: "© 2026 Elliott Wave LLC. elliottwave.studio lab. All rights reserved. MOQOM and six10nine are trademarks of Elliott Wave LLC. Patents pending." plus the IP ownership line.

## Deploy (Cloudflare Pages, later)

Not deployed yet. When ready:

1. Create a Pages project connected to the repository (or upload `dist/` with `wrangler pages deploy dist`).
2. Settings: framework preset **Astro**, build command `pnpm build`, output directory `dist`, root directory `sites/elliottwave-dev` if this lives in a monorepo.
3. Set `NODE_VERSION=22` (or newer).
4. Add the custom domain `elliottwave.dev`. `.dev` is HSTS-preloaded, so HTTPS is mandatory (Pages provides it).
5. Optional: add a `public/_headers` file for security headers and long cache lifetimes on `/_astro/*`.

## TODOs for Elliott

Search for `TODO(` in `src/`:

- `data/moqom.ts`: the GitHub org link is a placeholder until repositories go public; visionOS/tvOS rows; whether to list the backend SDKs on `/status`.
- `pages/index.astro`: switch the Swift snippet to a tagged release; add a Rust snippet.
- `pages/open-source.astro`: flip statuses as each repository goes public; add a root LICENSE to `moqom-rust`; confirm the player split before `moqom-swift` goes public; confirm BYOC relay distribution wording; GPLv3 question for OBS; link the Copyright Assignment Agreement (`.github/CLA.md`) and finish `CLA_SIGNATURES_TOKEN` setup.
- `data/six10nine.ts`: link the repository once public; add DMG / Homebrew / MCP server links at release (planned October 2026). The six10nine patent analysis says to file before the first public release; check that before deploying this copy.
- `pages/security.astro` / `data/moqom.ts`: `LINKS.hackerone` is a placeholder until the HackerOne program is live, then link it; PGP key; response-time commitments; DRAFT safe harbour (counsel contacted); fill the hall of fame as reports come in.
- `pages/donate.astro`: GitHub Sponsors and Open Collective URLs (show "coming soon" until set); crypto wallet addresses; mirror them in each repository's `.github/FUNDING.yml`.
- `pages/status.astro`: bump the "last updated" date when rows change.
- `content/blog/why-media-over-quic.md`: personal voice, rerun benchmarks, counsel check, then `draft: false`.
- `security.txt`: security contact is now `security@moqom.cloud` (matching the repositories and moqom.dev), with `security@elliottwave.studio` kept as a second Contact. Expires 2027-10-06; renew it before then.
