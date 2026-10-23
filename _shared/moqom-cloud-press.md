<!--
Ready-to-paste press section for moqom.cloud (e.g. a /press page or a section on /company).
Same copy as sites/elliottwave-studio/src/data/press.ts and the full kit at elliottwave.studio/press;
change it there first, then here. Numbers from moqom/docs/BENCHMARKS-AND-SPECS.md, and the footnote
must stay beside them, word for word. Outcomes only: nothing about how MOQOM works (patents pending).

TODO(Elliott):
- Create the press@elliottwave.studio mailbox before publishing.
- Fill in the two launch links once the posts are live; until then keep "Coming soon".
- Asset file sizes below were measured on 6 Oct 2026; re-check if the files change.
-->

# Press

Writing about MOQOM? Everything here is free to quote. For interviews and briefings,
email [press@elliottwave.studio](mailto:press@elliottwave.studio). The full press kit,
covering the company, the founder and every product, is at
[elliottwave.studio/press](https://elliottwave.studio/press).

## Launch

| | |
| --- | --- |
| Hacker News (Show HN) | Coming soon |
| Product Hunt | Coming soon |

## About MOQOM

**50 words**

> MOQOM is real-time video built on Media over QUIC Transport, the IETF’s emerging standard for
> live media. One open protocol carries two-person calls and live broadcasts to thousands. In lab
> tests, 720p30 video runs at 56–57 ms median glass-to-glass, and one 4-vCPU relay served 6,000
> concurrent viewers with zero loss.\*

**100 words**

> MOQOM is real-time video built on Media over QUIC Transport, the IETF’s emerging standard for
> live media. One open protocol carries two-person calls and live broadcasts to thousands. In lab
> tests, 720p30 video runs at 56–57 ms median glass-to-glass, and one 4-vCPU relay served 6,000
> concurrent viewers with zero loss.\* SDKs for iOS and macOS are available; web, Android, desktop
> and OBS are in progress. MOQOM Cloud is prepaid and metered on
> delivery, at 15% under Agora’s price at every tier and volume. Self-hosted relays
> pay a platform fee only. Made by elliottwave.studio lab.

## Headline numbers

| | |
| --- | --- |
| **56–57 ms**\* | Median glass-to-glass at 720p30, 1.25 Mbit/s HEVC (p95 70 ms). Two iPhone 15 Pros on home Wi-Fi, relay in Los Angeles, both directions at once. |
| **69 ms**\* | Median glass-to-glass at 540p60, 600 kbps, co-hosting: each phone publishing while decoding the other host. Same relay. |
| **6,000**\* | Viewers on one 4-vCPU relay with zero loss. The largest size tested, not the ceiling. |

\* Built to scale: a Rust media plane and a Go control plane, each scaling out horizontally. Measured in lab: 6,000 viewers on one 4-vCPU relay, every frame delivered. Full data at moqom.cloud/benchmarks/load-tests.md.

Method and raw figures: [Benchmarks](/benchmarks/).

## Facts

| | |
| --- | --- |
| Product | MOQOM, and MOQOM Cloud (the hosted service) |
| Protocol | IETF Media over QUIC Transport (draft-ietf-moq-transport, drafts 22 and 19) |
| Platforms | iOS and macOS available. Web, Android and desktop: in progress, coming Q4 2026. OBS plugin: scoped |
| Pricing | Prepaid, 15% under Agora’s price at every tier and volume band, always at least one cent per 1,000 minutes under. Self-hosted relays: platform fee only, $0.05 per GiB |
| Security | TLS 1.3 on every connection; per-frame end-to-end encryption. No independent audit yet |
| Made by | elliottwave.studio lab, the brand of Elliott Wave LLC |
| Founder | Elliott, Founder of elliottwave.studio lab and Elliott Wave LLC |
| Intellectual property | Owned by Elliott Wave LLC. MOQOM is a trademark of Elliott Wave LLC. Patents pending |

## Brand assets

| File | What | Format |
| --- | --- | --- |
| [og.png](/og.png) | Social card | PNG, 1200×630, 127 KB |
| [og.svg](/og.svg) | Social card | SVG, 1200×630 |
| [favicon.svg](/favicon.svg) | MOQOM mark | SVG |

Standalone SVG logos (wordmark and mark, light and dark) are coming.

- Write “MOQOM” in capitals, and “MOQOM Cloud” for the hosted service.
- The company is “elliottwave.studio lab”, all lowercase; the legal entity is Elliott Wave LLC.
- MOQOM accent: cyan `#22D3EE` on ink `#0A0B0D`.

## Contact

- Press: [press@elliottwave.studio](mailto:press@elliottwave.studio)
- Security: [security@moqom.cloud](mailto:security@moqom.cloud)
- Everything else: [hello@moqom.cloud](mailto:hello@moqom.cloud)
