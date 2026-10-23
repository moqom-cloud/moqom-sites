---
title: Threat model & controls
description: What MOQOM defends against, the controls in place, and what you are responsible for.
---

This page summarises MOQOM's security posture for integrators and security reviewers. Report
vulnerabilities to **security@moqom.cloud** — see [Responsible disclosure](/security/disclosure/).

## Zero trust

MOQOM is built zero trust: no network position, server or credential is trusted on its own.

- **Every device proves itself on every connection.** Tokens are bound to a key in the device's
  Secure Enclave and are worthless without it.
- **Every server proves itself too.** The control plane, relays and admin API talk only over an
  OpenZiti overlay with enrolled identities, and have no public management ports at all.
- **Relays are untrusted by design.** Media is end-to-end encrypted and required in every room,
  so a relay, or someone who breaks into one, sees only ciphertext.
- **Certificate authorities aren't trusted either.** Phones pin the exact certificates they
  expect.
- **Tokens are sealed.** Every token is signed and then encrypted for MOQOM's control plane and
  relays alone, so the app, your backend and anything that logs it see opaque bytes.
- **Post-quantum throughout, for secrecy and authentication.** Room keys are agreed over
  [ML-KEM-1024](https://csrc.nist.gov/pubs/fips/203/final), so recordings stay secret. Every device connection
  and every link between MOQOM's servers uses ML-KEM-1024 key exchange only, because the Swift
  SDK connects through MOQOM's own QUIC and TLS library. Classical-only key exchange is refused. Device identity keys, proofs, tokens, tickets and every MLS signature are
  [ML-DSA-87](https://csrc.nist.gov/pubs/fips/204/final), so nobody can be impersonated either.

:::tip[Post-quantum authentication, not just secrecy]
Many messengers now keep recorded messages secret against a future quantum computer, but still
sign identities with classical elliptic curves, so that computer could impersonate a contact.
In MOQOM every signature that says who someone is uses ML-DSA-87, and no classical signature is
accepted. See [Post-quantum authentication](/security/post-quantum/).
:::

## Assets

| Asset | Why it matters |
| --- | --- |
| Media content | Private calls, paid broadcasts, minors in age-gated rooms |
| Participant identity and IP addresses | Stalking and doxxing risk, especially for creators |
| API keys | A backend key administers a whole tenant |
| Client tokens | Admit a device to a room with specific rights |
| Moderation state and audit log | Safety decisions and appeals depend on them |
| Prepaid credit | Direct financial value |

## Threats and controls

| Threat | Controls |
| --- | --- |
| **Eavesdropping on media** | [TLS 1.3](https://www.rfc-editor.org/rfc/rfc8446) on every [QUIC](https://www.rfc-editor.org/rfc/rfc9000) connection. [SFrame E2EE](/guides/e2ee/) is required in every room and cannot be turned off: the SDK will not publish media without a key and drops unencrypted media it receives, so relays carry only ciphertext. Catalogs are sealed by their publisher too. |
| **Silently weakening a room** | There is no weaker setting: the control plane refuses any `e2ee` policy but required, and a token without the claim is treated as required. A recorder or classifier that decrypts must join the group as a disclosed agent, and devices hold back media while an undisclosed one is present. |
| **A removed participant keeps listening** | With managed keys, removing a device from a room moves the room to a new [MLS](https://www.rfc-editor.org/rfc/rfc9420) epoch whose keys it cannot derive; a later joiner cannot read earlier media either. |
| **Tampering with media in transit** | QUIC/TLS integrity; with SFrame, altering an object's group, number, priority or properties fails authentication. |
| **Stolen client token** | **A token on its own admits nothing.** Every token names one device's key: an [ML-DSA-87](https://csrc.nist.gov/pubs/fips/204/final) key generated inside that device's Secure Enclave, which can't be exported, copied or backed up. A relay accepts the token only with a fresh proof signed by that key (and a peer on a direct path accepts only a relay-issued ticket with the same kind of proof), and each proof is single-use and tied to the TLS certificate of whoever receives it, so a copied token, a replayed request or a machine in the middle gets nothing. Binding is mandatory, which is stricter than DPoP ([RFC 9449](https://www.rfc-editor.org/rfc/rfc9449)) ([comparison](https://moqom.cloud/security/#dpop)). Tokens are signed with ML-DSA-87, so they can't be forged even with a quantum computer, and then [sealed](/security/libraries/token/#sealed-tokens) with AES-256-GCM under a key only the control plane and relays hold, so a token that leaks into a log or a crash report reveals nothing about who it names or what it grants. They're scoped to one tenant, room and set of grants, checked on every request, and renewed silently inside the open session. |
| **Reaching our servers to attack them** | **Zero trust, on an [OpenZiti](https://openziti.io) overlay.** The link from each relay to the control plane, each relay's admin port and the admin API are *dark* services: they have no public listening port to scan, probe or flood. Reaching one takes an enrolled cryptographic identity that the overlay's policy allows, checked on every connection, so being on our network or holding a password grants nothing. Relays only dial out, inside the overlay the link is mutual TLS as well, and revoking an identity cuts it off at once. See [Zero-trust management plane](/guides/peer-to-peer/#zero-trust-management-plane). |
| **Registry hijack or mis-issued certificate** | Phones pin the exact certificates of relays and the token service and never consult a certificate authority, so a certificate obtained by taking over DNS can't intercept a session or collect a token or an enrollment. Our domains publish CAA for two authorities and no wildcards, are DNSSEC-signed and registrar-locked, and Certificate Transparency is checked nightly for any certificate our load balancers don't hold. |
| **Flaws in our cryptographic code** | Tokens, proofs, SFrame and MLS are the open-source [security libraries](/security/libraries/), in Swift, Go and Rust, checked against one shared set of test vectors including the RFC 9605 vectors. They compose platform primitives and implement none. |
| **Leaked API key** | recognisable `mqk_` prefix, so a key pasted into public code is easy to spot; secrets stored only as hashes; revoke instantly with `DELETE /v1/keys/{id}`; separate `relay` keys that can only report usage. |
| **Privilege escalation via minting** | A service account can never mint a token more powerful than its own ceiling; ownership is not grantable; no secret ships in any app, and Apple sign-in hosted by MOQOM mints only publish grants for rooms you list, never moderation, ownership or a new room. |
| **Moderator abuse** | Capabilities are sets with a strict-superset rule; owners are immune; every action is attributed (`service_account`, `on_behalf_of`) in an append-only audit log; reading the log is a separate capability. |
| **Evading a ban** | Bans by account, device or address; checked on every subscribe and publish; a ban ends the live session, not only the next join. |
| **Replayed moderation from a retrying queue** | Idempotency keys on every mutating call. |
| **Missed events while your backend is down** | **Durable event streams.** Every join, mute, grant change and moderation decision is written to the database before it is streamed, numbered contiguously per room, and never reused. A backend that crashed, restarted or lost its connection resumes from its last sequence (`after_sequence`) and receives everything it missed, in order, so a moderation verdict is never lost between two reads. See [Events](/guides/events-and-billing/#durable-event-streams). |
| **Hidden observers** | Recorders and classifiers must be attached as watchdogs, which are disclosed to the room; rooms can prohibit recording entirely. |
| **Cross-tenant access** | Every call names a tenant and must match the credential's; resources in other tenants return `NOT_FOUND`, so existence cannot be probed. |
| **Credential probing** | Authentication failures never say which part of a credential was wrong; comparisons are constant-time. |
| **Abuse of public endpoints** | Signups limited per address. Apple sign-in hosted by MOQOM requires an App Attest attestation from your genuine app on a real Apple device, plus Sign in with Apple, and every renewal carries a fresh App Attest assertion. |
| **A peer impersonating someone on a direct path** | Peers never show each other their tokens. The relay issues each participant a [direct ticket](/guides/peer-to-peer/#the-handshake-step-by-step) about once a minute, signed by the relay with ML-DSA-87 and naming the room, the person, the device key and what they may publish; a phone admits a direct connection only with a valid ticket for this room and a proof over it from the key the ticket names. |
| **IP exposure between peers** | Rooms and broadcasts go through relays, so participants never learn each other's addresses. [1:1 calls are point to point](/guides/peer-to-peer/): both people are told first that the other will see their address, and an app can keep a call on the relay. Larger private rooms go direct only when everyone agrees, and audiences never do. |
| **Denial of wallet** | Prepaid credit: spend is bounded by your balance; auto top-up only runs one charge at a time. |
| **Malformed protocol input** | Every decoder is fuzzed continuously; strict body parsing rejects unknown fields. |

## Authentication on every track

- **Tokens refresh automatically.** Give `DeviceCredentials` a `renew` closure that asks your
  backend for a new token. Two minutes before the current one expires, the SDK fetches the next
  and presents it to the relay inside the open session, without reconnecting, retrying every 15
  seconds if your backend is briefly unreachable. Without a `renew` closure the session ends when
  its token does. Your backend mints each token (the tenant credential never ships in an app),
  from the same endpoint that issued the first one, on Cloud and self-hosted alike:
  [app and server code](/guides/ios-macos/#who-does-what).
- **Every stream carries auth.** The relay checks every announce, subscribe and fetch against
  the session's token: tenant, room, user, device and grants. Media and data tracks use the same
  namespaces, so chat, game state and telemetry are authorized exactly like audio and video.
- **Renewal can't escalate.** A renewed token must name the same holder and the same permissions.
  Promotions and room moves arrive as control-plane directives, not as a swapped token.

## Things to know

- **The relay admin port is unauthenticated** and **off by default**. If you self-host, bind it to
  a private interface only.
- **E2EE key management** is built in: with a key service configured, devices agree each room's
  keys with [MLS](https://www.rfc-editor.org/rfc/rfc9420), and a device that leaves or is removed cannot decrypt anything sent afterwards.
  MOQOM's servers order the group's handshake messages but never hold a key that decrypts media.
  A shared key you distribute yourself still works and overrides managed keys. With neither, a
  room that requires encryption will not let a device publish. See
  [End-to-end encryption](/guides/e2ee/#managed-keys-swift).
- **Server-side features vs E2EE.** MOQOM's servers never see plaintext, so server-side recording
  and classification run only as agents you operate, inside the encrypted group and disclosed to
  everyone in it; on-device taps still work. See
  [Recording and classifiers](/guides/e2ee/#recording-and-classifiers).

## Your responsibilities

- Authenticate your users before minting tokens. If you have no backend, use
  [Sign in with Apple](/reference/device-tokens/) rather than minting for whoever asks.
- Keep backend keys on servers. Never ship one in an app.
- Give each self-hosted relay its own relay key and rotate on staff or host changes.
- Pass `on_behalf_of` on moderation calls so the audit trail names the human.
- Disclose any media you tap and send off-device; attach a watchdog to do it.
- Perform age verification yourself before asserting `age_verified`.

## Data residency

Each room has a `residency_zone`, fixed at creation, that governs where the room's data —
including recordings, inference outputs and moderation evidence — may live.
