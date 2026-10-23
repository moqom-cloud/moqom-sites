---
title: Specifications
description: Protocol, relay behaviour, security and platform specifications for MOQOM.
---

## Protocol and transport

| | |
| --- | --- |
| Protocol | IETF [`draft-ietf-moq-transport-22`](https://datatracker.ietf.org/doc/html/draft-ietf-moq-transport-22) and [`-19`](https://datatracker.ietf.org/doc/html/draft-ietf-moq-transport-19), own implementation in Rust and in Swift, written independently |
| Control messages | All 18 in draft-19 |
| Proposed extension | [Hop limit for relays](/specs/relay-hops-proposal/) (`draft-elliottwave-moq-hop-limit-00`) |
| Data plane | Object datagrams, subgroup streams, fetch streams with gap markers |
| Carriers | Raw [QUIC](https://www.rfc-editor.org/rfc/rfc9000) and [WebTransport](https://datatracker.ietf.org/doc/draft-ietf-webtrans-http3/) (HTTP/3) on **one UDP port** |
| QUIC stack (relay) | `quinn`, vendored unmodified |
| QUIC stack (Apple) | MOQOM's own Rust QUIC and TLS library (`quinn` and rustls with AWS-LC, through `moqom-direct-ffi`), shipped as an XCFramework inside the SDK |
| Relay forwarding | Subgroup streams. Datagram forwarding not yet carried |
| Scale-out | Multiple `SO_REUSEPORT` sockets per relay |

## Relay behaviour

| | |
| --- | --- |
| Upstream deduplication | Each track pulled from the publisher once, whatever the audience |
| Slow viewers | Never allowed to stall the room or the publisher |
| Retention | Bounded by groups, bytes and seconds, evicting whole groups; can be disabled |
| Join | New subscribers fetch the group in progress, so playback starts on a keyframe |
| Publisher stop | Every viewer is told explicitly |
| Quotas | Per device and per user: sessions, subscriptions, announcements, watches and fetches |
| Observability | Separate admin port (off by default): Prometheus metrics, JSON snapshots of sessions, rooms and tracks, liveness and readiness, [QUIC](https://www.rfc-editor.org/rfc/rfc9000) RTT / cwnd / loss, track-silence detection |

## Security

| | |
| --- | --- |
| Transport | [TLS 1.3](https://www.rfc-editor.org/rfc/rfc8446), inherent in [QUIC](https://www.rfc-editor.org/rfc/rfc9000), on every media connection; [ML-KEM-1024](https://csrc.nist.gov/pubs/fips/203/final) key exchange only on every device connection (media, sign-in and token renewal, MLS key delivery) and every link between MOQOM's servers; classical-only key exchange refused |
| Tokens | ML-DSA-87-signed, and no other algorithm is accepted (Ed25519 tokens are refused); tenant, room, grants and expiry checked against every namespace a request names |
| Token lifetime | 10 minutes default, 15 minutes maximum; renewed during a session without reconnecting |
| Device binding | Every token is bound to a key in the device's Secure Enclave; the control plane refuses to mint one that isn't. That key is [ML-DSA-87](https://csrc.nist.gov/pubs/fips/204/final) and signs every proof of possession; relays refuse ES256 (P-256) proofs |
| Authentication | Post-quantum: every signature that says who someone is, from device identity keys and proofs to MLS KeyPackages, commits and messages, direct tickets, join tokens and the room's control log, is ML-DSA-87. See [Post-quantum authentication](/security/post-quantum/) |
| Revocation | A ban ends the live session, not only the next join |
| Media encryption | SFrame ([RFC 9605](https://www.rfc-editor.org/rfc/rfc9605)) over MOQT, AES-256-GCM by default, AES-128-GCM supported; payload-only, so relay caching and priority survive |
| E2EE key management | MLS ([RFC 9420](https://www.rfc-editor.org/rfc/rfc9420)) for calls and rooms up to a few hundred devices, one cipher suite, MLS_256_MLKEM1024_AES256GCM_SHA512_MLDSA87 (`0xF0AC`; post-quantum ML-KEM-1024 key agreement, ML-DSA-87 signatures, NIST category 5 throughout); sender keys for large audiences, sealed to each viewer's ML-KEM-1024 key |
| Security libraries | moqom-token, moqom-proof, moqom-sframe, moqom-mls in Swift, Go and Rust, Apache-2.0, one shared set of test vectors. See [Security libraries](/security/libraries/) |

See [Security](/security/overview/).

## Limits

| Limit | Value |
| --- | --- |
| Client token lifetime | ≤ 15 minutes |
| Usage records per report | ≤ 5,000 |
| Usage record interval | ≤ 86,400 seconds |
| Billing request body | ≤ 1 MiB |
| Join request body | ≤ 4 KiB |
| Join rate | 30 / minute / credential |
| Signups | 5 / hour / client address |
| Top-up amount | $10.00 – $10,000.00 |
| Username | ≤ 4,096 UTF-8 bytes, NFC-normalised |
| Default stage slots / watchdog limit | 8 / 8 per room |

## Platforms

| SDK | Floor | Status |
| --- | --- | --- |
| `MoqomKit` (Swift) | iOS, iPadOS, macOS, visionOS, tvOS 26; Swift 6 strict concurrency | **Available** (binary core) |
| `moqom-go` | Go 1.23+ | Available |
| `moqom-rust` | Toolchain pinned in repo | Available |
| Web | Evergreen browsers with [WebTransport](https://datatracker.ietf.org/doc/draft-ietf-webtrans-http3/) | In progress, coming Q4 2026 |
| Android | — | In progress, coming Q4 2026 |
| Desktop | Windows, macOS, Linux | In progress, coming Q4 2026 |
| OBS plugin | OBS Studio | Scoped, work ongoing |

## Not yet, stated so nobody quotes it

- Datagram forwarding at the relay
- Authentication on the relay admin port (which is why it is off by default)
- Global steering and a multi-replica control plane
- [MLS](https://www.rfc-editor.org/rfc/rfc9420) / sender-key E2EE key management
