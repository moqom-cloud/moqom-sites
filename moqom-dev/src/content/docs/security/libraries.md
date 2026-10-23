---
title: Security libraries
description: moqom-token, moqom-proof, moqom-sframe and moqom-mls — MOQOM's post-quantum tokens, device proofs, SFrame and MLS, open source in Swift, Go and Rust with one shared set of test vectors.
---

Everything that keeps a MOQOM room private is in four open-source libraries, each in **Swift**,
**Go** and **Rust**, under **Apache-2.0**. They are the code MOQOM's apps, relays and control
plane run, not a separate copy.

Source, design documents and vectors:
[github.com/moqom-cloud/moqom-security](https://github.com/moqom-cloud/moqom-security). The
current release is **0.1.0**; each library's page below has installation, examples in all three
languages, and its specification.

| Library | Does | Standards |
| --- | --- | --- |
| [`moqom-token`](/security/libraries/token/) | Mints and verifies join tokens: tenant, room, grants, expiry, device binding (`cnf.jkt`), key rotation by key ID | Compact [JWS](https://www.rfc-editor.org/rfc/rfc7515), ML-DSA-87 ([FIPS 204](https://csrc.nist.gov/pubs/fips/204/final)) only; Ed25519 tokens are refused |
| [`moqom-proof`](/security/libraries/proof/) | The device's proof that it holds the key its token names: single-use, bound to the token and to the certificate of the peer it is talking to | DPoP shape ([RFC 9449](https://www.rfc-editor.org/rfc/rfc9449)), [JWK](https://www.rfc-editor.org/rfc/rfc7517) thumbprints ([RFC 7638](https://www.rfc-editor.org/rfc/rfc7638)), ML-DSA-87 JWKs (`AKP`) only; ES256 proofs are refused |
| [`moqom-sframe`](/security/libraries/sframe/) | Seals and opens MoQ objects, with the object's full track name, position, priority and properties bound into the tag and a replay window | [RFC 9605](https://www.rfc-editor.org/rfc/rfc9605); binds the fields [draft-ietf-moq-secure-objects](https://datatracker.ietf.org/doc/draft-ietf-moq-secure-objects/) authenticates |
| [`moqom-mls`](/security/libraries/mls/) | Room key agreement that produces SFrame keys: key packages, commits, welcomes, exporter, epoch authenticator, and sealing an epoch's key to broadcast viewers | [RFC 9420](https://www.rfc-editor.org/rfc/rfc9420), `MLS_256_MLKEM1024_AES256GCM_SHA512_MLDSA87` from [draft-ietf-mls-pq-ciphersuites](https://datatracker.ietf.org/doc/draft-ietf-mls-pq-ciphersuites/) (`0xF0AC`, private use until IANA assigns a value) |

To replace your own app's bearer session tokens with post-quantum tokens bound to the device,
start with [Device-bound sign-in](/security/libraries/device-sign-in/). If you mint JWTs from
a login endpoint today, [Replace your app's JWTs](/security/libraries/replace-jwt/) moves you
over step by step.

## No cryptography of our own

Each library composes its platform's audited primitives and implements none:

| | Swift | Go | Rust |
| --- | --- | --- | --- |
| [ML-DSA-87](https://csrc.nist.gov/pubs/fips/204/final) | CryptoKit, including the Secure Enclave | `crypto/mldsa` | AWS-LC (`aws-lc-rs`) |
| [ML-KEM-1024](https://csrc.nist.gov/pubs/fips/203/final) | CryptoKit (`MLKEM1024`) | `crypto/mlkem`, `crypto/hpke` | AWS-LC |
| AES-GCM, HKDF, SHA-2 | CryptoKit | standard library | AWS-LC |

Where a composition is ours — [HPKE](https://www.rfc-editor.org/rfc/rfc9180) over pure ML-KEM-1024, which CryptoKit's HPKE does not offer —
it is held to Go's `crypto/hpke` by shared test vectors.

## One set of test vectors

A library is done in a language when it passes every vector in `vectors/`, not when it passes
its own tests. The vectors are JSON, shared by all three test suites, and cover valid, expired
and tampered tokens; proofs bound to the wrong token or certificate, and replayed ones; [SFrame](https://www.rfc-editor.org/rfc/rfc9605)
seal and open per suite and per metadata change, alongside the published RFC 9605 vectors; and
[MLS](https://www.rfc-editor.org/rfc/rfc9420) key schedules, welcomes and commit sequences. Each failing case names the class of failure
every language must report.

## Installing

```swift
// Package.swift
.package(url: "https://github.com/moqom-cloud/moqom-security", from: "0.1.0"),
// products: MoqomToken, MoqomProof, MoqomSFrame, MoqomMLS
```

```sh
go get github.com/moqom-cloud/moqom-security/go@v0.1.0
# packages: .../go/token, .../go/proof, .../go/sframe, .../go/mls
```

```sh
cargo add moqom-token moqom-proof moqom-sframe moqom-mls
# crates: moqom-token, moqom-proof, moqom-sframe, moqom-mls
```

| Language | Requires |
| --- | --- |
| Swift | iOS, iPadOS, macOS, visionOS or tvOS 26 (CryptoKit's ML-DSA and ML-KEM arrive there) |
| Go | Go 1.27 |
| Rust | Rust 1.97 |

## Versions

All four libraries are released together under one version, in all three languages, so a
version number names the same behaviour everywhere. Swift and Rust are tagged `v0.1.0` and Go
`go/v0.1.0`. Before 1.0, a minor version (0.2) may change an API; a patch (0.1.1) never does.
A wire format only changes under a new algorithm or format identifier. Classical signatures
are the exception: Ed25519 tokens and ES256 proofs are no longer read at all, so that every
token and proof is post-quantum. Release notes are in
[CHANGELOG.md](https://github.com/moqom-cloud/moqom-security/blob/main/CHANGELOG.md).

You don't need these to use MOQOM: `MoqomKit` and the backend SDKs already include them. They
are for reviewing what protects your rooms, building another client, or using the same
post-quantum building blocks in your own system.

## Reporting a vulnerability

Report issues in the libraries the same way as anything else in MOQOM: see
[Responsible disclosure](/security/disclosure/).
