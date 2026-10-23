# moqom.dev

Technical documentation for MOQOM, built with [Astro Starlight](https://starlight.astro.build).

## Develop

Requires Node 22+ (tested on Node 23) and pnpm.

```sh
pnpm install
pnpm dev        # http://localhost:4321
```

## Build

```sh
pnpm build      # static site in dist/
pnpm preview    # serve dist/ locally
```

The build is offline-safe: fonts come from `@fontsource`, and Mermaid diagrams are rendered in the
browser by `astro-mermaid` from the bundled `mermaid` package (no CDN).

## Layout

| Path | Contents |
| --- | --- |
| `src/content/docs/` | Pages (Markdown / MDX) |
| `src/sidebar.mjs` | Sidebar, shared by `astro.config.mjs` and the llms endpoints. Add new pages here. |
| `src/pages/llms.txt.ts`, `src/pages/llms-full.txt.ts` | Build `/llms.txt` (page index) and `/llms-full.txt` (all pages as plain Markdown) for AI assistants, per [llmstxt.org](https://llmstxt.org) |
| `src/lib/llms.ts` | Shared helpers for the llms endpoints (ordering, MDX-to-Markdown) |
| `src/components/Footer.astro` | Footer links and copyright line |
| `src/components/ThemeProvider.astro` | Defaults first-time visitors to the dark theme |
| `src/styles/theme.css` | Brand colours and fonts |
| `public/` | Static files (favicon) |

## Content rules

- Every benchmark number needs a visible aside, with exactly this text (escape the leading `*`
  so it does not become a list item):

  ```md
  :::caution[Benchmark note]
  \* Built to scale: a Rust media plane and a Go control plane, each scaling out horizontally. Measured in lab, tested to 6,000 viewers on one 4-vCPU relay with zero loss; pending further load testing.
  :::
  ```
- Document public APIs and observable behaviour only. Do not describe internals of the private core.
- Never publish real relay IPs or hostnames; use `relay.example.moqom.cloud`.
- Brand: the company is "elliottwave.studio lab"; the legal entity (copyright, ownership) is
  "Elliott Wave LLC". Patents pending, no details.
- No partnerships, customers or statistics that are not true and confirmed.
- Prices on the rate card are launch defaults; keep the "Launch pricing, subject to change before
  general availability" caution until GA.

## TODO

- [ ] Replace the HackerOne placeholder (`https://hackerone.com/elliottwave`) once the program is
      live, and remove the TODO comment in `security/disclosure.md`.
- [ ] Confirm or replace the disclosure response targets beyond "acknowledge within 3 business
      days" (marked "to be confirmed").
- [ ] Update the Copyright Assignment Agreement and safe-harbour wording once legal counsel has
      reviewed them; drop the "We have contacted legal counsel" lines.
- [ ] Replace the benchmark note once the October 2026 load test has run.
- [ ] Remove the "Launch pricing" cautions at general availability.
- [ ] Update platform pages (web, Android, desktop, OBS) when each ships.
- [ ] Link the Contributing page to the public GitHub repositories and their `good first issue`
      lists once `moqom-go` and `moqom-rust` are published.
- [ ] Update the partnerships paragraph on the architecture overview if a partnership is signed.
- [ ] Point the `moqom.dev` DNS A records at the load balancer (below).

## Deploy (Google Cloud)

Hosted on Google Cloud: a Cloud Storage bucket (`gs://moqom-sites/moqom-dev`) behind a global
HTTPS load balancer with Cloud CDN, defined in `moqom/deploy/envs/web`. Build and upload with:

```sh
moqom/deploy/tools/publish-sites.sh moqom-dev
```

`moqom.dev` and `www.moqom.dev` resolve to the load balancer once their DNS A records point at
`34.107.228.246`.
