---
title: Standards
description: The IETF and W3C standards MOQOM is built on — MOQT, QUIC, WebTransport, SFrame, and C4M-style tokens.
---

MOQOM builds on open standards and implements them itself rather than wrapping another stack.

| Layer | Standard | Body | How MOQOM uses it |
| --- | --- | --- | --- |
| Media transport | **Media over [QUIC](https://www.rfc-editor.org/rfc/rfc9000) Transport** — [`draft-ietf-moq-transport-19`](https://datatracker.ietf.org/doc/draft-ietf-moq-transport/) | IETF | All 18 control messages of draft-19; object datagrams, subgroup streams, fetch with gap markers. Independent implementations in Rust (relay) and Swift (client). |
| Transport | **QUIC** — [RFC 9000](https://www.rfc-editor.org/rfc/rfc9000) | IETF | Native carrier for apps and relays. [TLS 1.3](https://www.rfc-editor.org/rfc/rfc8446) on every connection. |
| Browser transport | **[WebTransport](https://datatracker.ietf.org/doc/draft-ietf-webtrans-http3/) over HTTP/3** | IETF / W3C | Carrier for browsers; shares the relay's UDP port with raw QUIC. |
| Security | **TLS 1.3** — [RFC 8446](https://www.rfc-editor.org/rfc/rfc8446) | IETF | Inherent in QUIC; always on. |
| Media encryption | **[SFrame](https://www.rfc-editor.org/rfc/rfc9605)** — [RFC 9605](https://www.rfc-editor.org/rfc/rfc9605), and the MoQ secure-objects work | IETF | Payload-only E2EE, AES-256-GCM by default, so relay caching and prioritisation keep working. |
| Group keys | **[MLS](https://www.rfc-editor.org/rfc/rfc9420)** — [RFC 9420](https://www.rfc-editor.org/rfc/rfc9420) | IETF | Manages every room's keys in the Swift SDK, using a subset of MLS, with sender keys for viewers outside the group. See [End-to-end encryption](/guides/e2ee/). |
| Post-quantum cryptography | **ML-KEM** and **ML-DSA** — [FIPS 203](https://csrc.nist.gov/pubs/fips/203/final) and [FIPS 204](https://csrc.nist.gov/pubs/fips/204/final), in MLS through [`draft-ietf-mls-pq-ciphersuites`](https://datatracker.ietf.org/doc/draft-ietf-mls-pq-ciphersuites/) | NIST / IETF | Every room's keys are agreed with ML-KEM-1024 and its handshakes signed with ML-DSA-87. Every device connection and every link between MOQOM's servers uses ML-KEM-1024 key exchange only, and classical-only key exchange is refused. |
| Authorisation | **C4M** (Common Access Token for MoQ) — [`draft-ietf-moq-c4m`](https://datatracker.ietf.org/doc/draft-ietf-moq-c4m/) | IETF | Token scopes follow C4M's `moqt` claim (actions × namespace × track). Tokens are ML-DSA-87-signed JWTs; the CBOR/COSE CAT encoding is the target. |
| Key format | **[JWK](https://www.rfc-editor.org/rfc/rfc7517) thumbprints** — [RFC 7638](https://www.rfc-editor.org/rfc/rfc7638) | IETF | How device keys are identified. |
| Codecs | H.264, HEVC, Opus | ITU-T / ISO / IETF | Hardware encode/decode on Apple platforms. |

:::note[IETF, not IEEE]
Media over QUIC is standardised by the **IETF** MoQ working group. It is sometimes misattributed
to the IEEE.
:::

## Draft tracking

[MoQ Transport](https://datatracker.ietf.org/doc/draft-ietf-moq-transport/) is still an Internet-Draft, so the wire format changes between drafts. MOQOM speaks
draft-19 and negotiates it explicitly (ALPN `moqt-19`). The working group's current draft is 22.
Support for it is in progress: relays will offer `moqt-22` and `moqt-19` side by side, and SDKs
will prefer 22. SDK and relay releases state which drafts they speak. Different drafts don't
interoperate.

We also propose changes to the draft. See [Proposals for draft-23](/architecture/draft-23-proposals/).

## Interoperability

The Swift and Rust codecs were written separately and are tested against each other through a
real relay. Interop testing against other independent MoQ implementations is a planned milestone.
