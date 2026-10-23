---
title: End-to-end encryption
description: Post-quantum end-to-end encryption is required in every room, with no way to turn it off. Media payloads are sealed with SFrame under keys agreed with MLS using ML-KEM and ML-DSA, so relays forward ciphertext they cannot read.
---

MOQOM encrypts media payloads with **[SFrame](https://www.rfc-editor.org/rfc/rfc9605)** ([RFC 9605](https://www.rfc-editor.org/rfc/rfc9605))
carried over MOQT. Only the payload is encrypted, so relays can still cache, prioritise and fan
out objects — they just cannot read them. Tampering with an object's group, object number,
priority or properties causes decryption to fail.

**Not even MOQOM can see the media.** Room keys are agreed between the devices in the room with
**[MLS](https://www.rfc-editor.org/rfc/rfc9420)** ([RFC 9420](https://www.rfc-editor.org/rfc/rfc9420)), so your app does not distribute
them, and MOQOM's relays, control plane and cloud never receive them. Encryption adds no perceptible latency: about
54 µs per 1080p keyframe against a 33 ms frame. Its real cost is bytes, 19 per object, which is
0.9% of a 2 KB video object but a larger share of a small audio packet.

:::note[Which SFrame]
SFrame here is **Secure Frame**, the IETF's end-to-end encryption for real-time media, published
as [RFC 9605](https://www.rfc-editor.org/rfc/rfc9605). It is
unrelated to SFrame, the **Simple Frame** stack-trace format that binutils and the Linux kernel
use for low-overhead unwinding of binaries.
:::

| | |
| --- | --- |
| Default cipher suite | AES-256-GCM (SFrame suite `0x0005`) |
| Also supported | AES-128-GCM |
| Key agreement | MLS with [ML-KEM-1024](https://csrc.nist.gov/pubs/fips/203/final) (post-quantum) |
| Handshake signatures | [ML-DSA-87](https://csrc.nist.gov/pubs/fips/204/final) (post-quantum) |
| Overhead | 19 bytes per object |
| Transport encryption | [TLS 1.3](https://www.rfc-editor.org/rfc/rfc8446) on every [QUIC](https://www.rfc-editor.org/rfc/rfc9000) connection, always — independent of SFrame; [ML-KEM-1024](https://csrc.nist.gov/pubs/fips/203/final) key exchange only, on every device connection and every link between MOQOM's servers ([details](#post-quantum)) |

On-device SFrame cost measured at roughly **7.5 µs** per Opus packet and **54 µs** per 1080p
keyframe, against a 33 ms frame budget.

:::caution[Benchmark note]
\* Built to scale: a Rust media plane and a Go control plane, each scaling out horizontally. Measured in lab: 6,000 viewers on one 4-vCPU relay, every frame delivered. Full data at moqom.cloud/benchmarks/load-tests.md.
:::

## Post-quantum

A call recorded today stays unreadable to someone who builds a quantum computer later. Each layer
that agrees a key does it with post-quantum cryptography, and there is nothing to configure:

| Layer | Algorithms | Post-quantum because |
| --- | --- | --- |
| Room keys ([MLS](https://www.rfc-editor.org/rfc/rfc9420)) | ML-KEM-1024 key agreement, [ML-DSA-87](https://csrc.nist.gov/pubs/fips/204/final) signatures, AES-256-GCM, SHA-512 | ML-KEM and ML-DSA are NIST's post-quantum standards ([FIPS 203](https://csrc.nist.gov/pubs/fips/203/final) and 204); every part is NIST's highest category, 5 |
| Media ([SFrame](https://www.rfc-editor.org/rfc/rfc9605)) | AES-256-GCM | A 256-bit symmetric key keeps about 128 bits of security against a quantum computer, so SFrame didn't change |
| Transport from devices ([TLS 1.3](https://www.rfc-editor.org/rfc/rfc8446)) | ML-KEM-1024 only (`MLKEM1024`) | MoqomKit connects through MOQOM's own QUIC and TLS library, so the SDK, not the operating system, chooses the key exchange |
| Transport between MOQOM's servers ([TLS 1.3](https://www.rfc-editor.org/rfc/rfc8446)) | ML-KEM-1024 only: pure `MLKEM1024`, or hybrid `SecP384r1MLKEM1024` with Go peers | Anything weaker, ML-KEM-768 and every classical-only exchange included, is refused |

Every device connection uses ML-KEM-1024 key exchange and nothing else: media to relays, sign-in
and token renewal, and MLS key delivery. MoqomKit doesn't use Apple's networking stack for
these. It connects through MOQOM's own Rust QUIC and TLS library (rustls with AWS-LC), the same
`moqom-direct-ffi` library that carries [direct paths](/guides/peer-to-peer/), shipped as an
XCFramework inside the SDK. The links between MOQOM's servers (relay to relay, relay to control
plane, the admin API, and the Go SDK to the control plane) accept ML-KEM-1024 and nothing weaker.

`api.moqom.cloud`, which serves billing, the console API and the Go SDK's default address, is
terminated by MOQOM's own TLS server behind a pass-through load balancer. It prefers
ML-KEM-1024, the Go SDK requires hybrid `SecP384r1MLKEM1024` there, and browsers get hybrid
[`X25519MLKEM768`](https://datatracker.ietf.org/doc/draft-ietf-tls-ecdhe-mlkem/), the strongest key exchange any browser offers. Classical-only key
exchange is refused everywhere.

The MLS cipher suite is `MLS_256_MLKEM1024_AES256GCM_SHA512_MLDSA87` (`0xF0AC`): HPKE over pure
ML-KEM-1024, HKDF-SHA512, AES-256-GCM and ML-DSA-87, NIST category 5 throughout. It is the
category-5 suite of
[draft-ietf-mls-pq-ciphersuites](https://datatracker.ietf.org/doc/draft-ietf-mls-pq-ciphersuites/),
and the only suite, so there is nothing to negotiate. The draft has no IANA value yet, so its
code point is from MLS's private-use range, standing in until IANA assigns one.

Join tokens are signed with ML-DSA-87, and so are the entries of each room's control log.

The proof that binds a token to its device is ML-DSA-87 too, made with a key the Secure Enclave
holds. The control plane derives the token's `cnf.jkt` from that key, and relays check every
proof against it.

One thing in MOQOM's own path is still classical: certificate signatures in TLS. Relay
certificates are ECDSA, because the WebPKI has no post-quantum certificates yet. Phones accept
only the exact relay certificate they were given, and media is end-to-end encrypted regardless,
so forging one would need a working quantum computer during the call, not a recording of it.
[Post-quantum authentication](/security/post-quantum/) lists every signature, and what is
still classical, in full.

All of this is in the open-source [security libraries](/security/libraries/).

What it costs: nothing per frame, because media encryption is unchanged. Joining and key changes
carry larger messages, since ML-KEM and ML-DSA keys and signatures are measured in kilobytes
rather than tens of bytes.

## Required in every room

Every room requires end-to-end encryption, and there is no setting that turns it off: the control
plane refuses to create or update a room without it. Each client token carries
`"e2ee": "required"`, and a token without the claim is treated the same way.

MoqomKit:

- **refuses to publish without a key.** `startBroadcast` and `startAudio` throw
  `MoqomError.encryptionRequired` before anything is announced to the relay;
- **drops unencrypted incoming media.** With no key set, media from other participants is
  discarded and `room.events` yields `.encryptionRequired(participant)` once per participant.
  With a key set, an object that does not decrypt is discarded and counted in
  `room.decryptionStatistics`;
- **drops a frame rather than send it in the clear** in the moment between joining and holding
  the room's keys.

It covers more than audio and video:

- **Data** tracks are sealed the same way as media.
- **Catalogs** are sealed by their publisher. The relay is given a small disclosure alongside each
  catalog — every track's name, kind and, for video, size — which is what it needs to route and
  to choose layers. Codecs, bitrates and everything else stay sealed.
- **The room's control log** — who is on stage and which watchdogs are attached — is signed by
  the control plane with [ML-DSA-87](https://csrc.nist.gov/pubs/fips/204/final), and devices apply only entries that verify against the keys
  in `DeviceCredentials.authorityKeys`.

Relays still see track names, object sizes and timing, and each keyframe's codec parameters,
because MoQ relays route on them.

## Managed keys (Swift)

Give the session a key service and a room that requires encryption keys itself. There is no key
to create, store or send:

```swift
let keyDelivery = HTTPMLSDelivery(
    endpoint: RelayEndpoint(host: "keys.example.moqom.cloud"),
    certificateHashes: [keyServiceCertificateHash]   // SHA-256 of its leaf certificate
)

let session = MoqomSession(
    transport: MoqtTransport.network(),
    credentials: DeviceCredentials(
        identity: identity,
        token: issued.token,
        deviceKey: deviceKey,
        expiresAt: issued.expiresAt,
        renew: { try await myBackend.freshToken() },
        keyDelivery: keyDelivery                    // MLS key management
    ),
    tenant: tenant
)

let room = try await session.join(room: RoomID("demo"))
try await room.startBroadcast(from: camera).start()
```

Key delivery is configured on its own, whichever way the device gets its token. An
[invitation link](/reference/device-tokens/#invitation-links) carries the key service's address
(`mls`) and certificate hash (`mlscert`).

What you get:

- **No key distribution.** Each device joins the room's [MLS](https://www.rfc-editor.org/rfc/rfc9420) group when it enters and leaves it
  when it leaves. The SDK starts this whenever the room's token says encryption is required and
  you have not supplied a key yourself.
- **Forward secrecy on removal.** When a device leaves, is kicked, or goes offline, the room moves
  to a new key epoch that the departed device cannot derive. A device that joins later cannot read
  media sent before it arrived.
- **No dropped frames on a key change.** Senders switch to the new epoch's key as soon as it is
  agreed; receivers accept both the old and new keys for a few seconds around the change.
- **The servers see only public keys and sealed handshake messages.** MOQOM's key service orders
  each room's membership changes and passes them between devices; it never holds a key that
  decrypts media.

`await room.groupKeys` reports the current epoch, the members of the group as `username/device`,
and an epoch authenticator. Two devices showing the same authenticator are in the same group with
the same keys, which is the basis for an in-app "verify this call" check.

Until a device is in the group, which takes a moment after joining, it publishes nothing rather
than publishing in the clear.

## Viewers of a large broadcast (sender keys)

Adding every viewer of a broadcast to the group would make every commit carry a ciphertext per
viewer and every arrival a commit. So the group holds the devices that may publish, and the
room's agents; a device whose token grants no publishing is a **viewer** and is not added:

- When it enters, the viewer's device makes an [ML-KEM-1024](https://csrc.nist.gov/pubs/fips/203/final) key pair, keeps the private half in
  memory, and posts the public half to the key service.
- The group member that would commit seals the current epoch's [SFrame](https://www.rfc-editor.org/rfc/rfc9605) base key to each viewer
  that lacks it, with [HPKE](https://www.rfc-editor.org/rfc/rfc9180) over ML-KEM-1024. The viewer derives each publisher's key from that
  base key and the key ID in the frame, as a member does.
- While the room has viewers, the group moves to a new epoch every five minutes, and a viewer
  who has left is not sealed the next one. That bounds how long a departed viewer can keep
  reading.
- The key service refuses a viewer a place in the group, and a token renewed with or without
  publish rights moves the device between the group and the audience.

`await room.audienceKeys` reports the epoch a viewer holds, and the members' `groupKeys.audience`
counts the viewers present.

What a viewer gives up: members see every other member and can compare epoch authenticators, but
the audience is a list the key service hands the committer. A compromised control plane could
add a viewer nobody sees — the same power it has over who gets a viewing token — which is why
anybody who may publish is a member instead.

## Bringing your own key (Swift)

`useEncryption` overrides managed keys for the room. Use it when your app already has a
key-agreement channel of its own:

```swift
let encryption = RoomEncryption.sharedKey(baseKey, keyID: 1)   // AES-256-GCM by default
await room.useEncryption(encryption)
```

`room.encryptionPolicy` is the policy the token carried, and `room.isEncrypted` says whether a
key is set. With neither managed keys nor a `useEncryption` call, `startBroadcast` in a room
that requires encryption throws `MoqomError.encryptionRequired`.

`RoomEncryption.sharedKey` is the simplest scheme that is genuinely end to end: every member holds
one base key. Its limits are real — any member can impersonate any other, and removing a member
means rekeying everyone — so it suits small, trusted calls. Distribute the key over a channel
MOQOM does not see (for example, your own end-to-end encrypted messaging).

`room.decryptionStatistics` reports objects that failed to decrypt, which is the first thing to
check when one participant sees black tiles.

## Recording and classifiers

Encryption is never turned off for recording or moderation. A recorder or classifier that has to
see media joins the room's group as an **agent**: a member under the username
`watchdog.<id>`, which the control plane mints only for a watchdog attached to the room, with no
publish rights. It decrypts on your side, wherever you run it, and MOQOM's servers still see only
ciphertext.

It cannot join unannounced. Every member sees every leaf of the group, and each device holds back
its own media while the group contains an agent that the room's signed control log has not
disclosed. `groupKeys.agents` and `groupKeys.undisclosedAgents` show both. See
[Recording](/guides/recording/).

:::caution[Hosted rooms]
The SDK and control plane support agents today, but hosted rooms don't publish the signed control
log yet, so in a hosted room an agent stays undisclosed and media is held while it is in the
group. Self-hosted deployments that publish the log can use agents now. See
[AI agents](/guides/ai-agents/) for classifiers, transcription and AI hosts.
:::

## What the servers can and cannot do

| | |
| --- | --- |
| Relay sees | Ciphertext, track names, object sizes and timing |
| MOQOM's servers record | Ciphertext only, for good |
| Recording and classifiers | Agents you run, inside the group and visible to every member |
| On-device taps (captions, classification) | Yes — taps receive plaintext on the device that holds the key |
| Moderation (kick, ban, force-mute) | Yes — moderation acts on sessions, not content |

## Limits of managed keys

- **The group is sized for the stage.** Every membership change costs work proportional to the
  number of members, so the group suits up to a few hundred publishers and agents. Audiences of
  any size are viewers outside it.
- **Apple platforms only.** MOQOM launches on iOS and macOS, where device keys live in the Secure
  Enclave and MoqomKit runs the post-quantum group.
- **Personal channels are not keyed yet.** A personal channel's broadcast needs its owner to key
  the audience, and that is not built.
- **MOQOM's own [MLS](https://www.rfc-editor.org/rfc/rfc9420) profile.** The group uses the post-quantum cipher suite above ([ML-KEM-1024](https://csrc.nist.gov/pubs/fips/203/final),
  AES-256-GCM, SHA-512, [ML-DSA-87](https://csrc.nist.gov/pubs/fips/204/final)) and RFC 9420's key schedule, with media keys derived as
  [RFC 9605](https://www.rfc-editor.org/rfc/rfc9605) §5.2 specifies. Its handshake messages are
  MOQOM's own encoding, so it does not interoperate with other MLS implementations.
