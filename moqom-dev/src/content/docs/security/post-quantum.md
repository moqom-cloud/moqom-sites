---
title: Post-quantum authentication
description: MOQOM is post-quantum for secrecy and for authentication. Every signature that says who someone is uses ML-DSA-87, so a future quantum computer can neither read recorded calls nor impersonate a contact.
---

Post-quantum cryptography protects two different things. **Secrecy** means a call recorded today
stays unreadable to someone who builds a quantum computer later. **Authentication** means that
same quantum computer can't pretend to be someone it isn't. MOQOM is post-quantum for both.

## Secrecy

Every key that protects content is agreed or sealed with post-quantum cryptography:

- **Room keys.** Devices agree each room's keys with [MLS](https://www.rfc-editor.org/rfc/rfc9420)
  in the cipher suite `MLS_256_MLKEM1024_AES256GCM_SHA512_MLDSA87`, the only suite, whose key
  agreement is [ML-KEM-1024](https://csrc.nist.gov/pubs/fips/203/final). Every part of it is NIST category 5. It is the
  category-5 suite of
  [draft-ietf-mls-pq-ciphersuites](https://datatracker.ietf.org/doc/draft-ietf-mls-pq-ciphersuites/);
  see [moqom-mls](/security/libraries/mls/#cipher-suite).
- **Media.** [SFrame](https://www.rfc-editor.org/rfc/rfc9605) encrypts every frame with
  AES-256-GCM. A 256-bit symmetric key keeps about 128 bits of security against a quantum
  computer.
- **Large broadcasts.** With [sender keys](/guides/e2ee/#viewers-of-a-large-broadcast-sender-keys),
  each viewer's device makes an ML-KEM-1024 key pair, and each epoch's key is sealed to it with
  HPKE over ML-KEM-1024.
- **Connections.** [TLS 1.3](https://www.rfc-editor.org/rfc/rfc8446) runs on every connection,
  and its key exchange is ML-KEM-1024 only, on every device connection (media, sign-in and token
  renewal, MLS key delivery) and on every link between MOQOM's servers. The Swift SDK connects
  through MOQOM's own QUIC and TLS library (rustls with AWS-LC), so the SDK chooses the key
  exchange. Classical-only key exchange is refused everywhere. See
  [End-to-end encryption](/guides/e2ee/#post-quantum) for `api.moqom.cloud`, which browsers also
  reach.

## Authentication

Every signature that says who someone is uses [ML-DSA-87](https://csrc.nist.gov/pubs/fips/204/final)
(FIPS 204):

| What's signed | Algorithm |
| --- | --- |
| Each device's identity key, generated in the Secure Enclave and never exportable | ML-DSA-87 |
| The device credential: the [proof of possession](/security/libraries/proof/) every relay demands | ML-DSA-87 |
| Every MLS KeyPackage | ML-DSA-87 |
| Every MLS commit | ML-DSA-87 |
| Every MLS message signature, handshake and application messages alike | ML-DSA-87 |
| [Direct tickets](/guides/peer-to-peer/#the-handshake-step-by-step) issued by relays | ML-DSA-87 |
| [Join tokens](/security/libraries/token/), signed and then sealed with AES-256-GCM | ML-DSA-87 |
| The room's control log | ML-DSA-87 |

There is no classical signature algorithm anywhere in that list, and none is accepted. Relays
refuse ES256 proofs, verifiers refuse Ed25519 tokens, and a key set that contains an elliptic
curve key is refused when it is loaded.

## Why authentication matters

A quantum computer that can break elliptic curves can work out a private key from its public
key. Public keys are public by design: they're published, exchanged and compared in safety
numbers. Against classical identity keys, that quantum computer could impersonate a contact or
forge identity keys in new sessions. The safety number would still match, because the public key
is the real one; the attacker simply holds its private half too.

Post-quantum secrecy alone doesn't stop this. It keeps recordings unreadable, but an active
attacker who can sign as you can join a new conversation as you. With ML-DSA-87 identity keys,
impersonation is quantum-resistant too.

## Compared with Signal

Signal added post-quantum key agreement with PQXDH in 2023 and its post-quantum ratchet, SPQR, in
2025, so recorded Signal messages stay secret against a future quantum computer. Signal's
identity keys and signatures are Curve25519 and XEdDSA, which are classical. Signal's own
[PQXDH specification](https://signal.org/docs/specifications/pqxdh/) states that its
authentication relies on classical assumptions and isn't secure against an active quantum
attacker. So a future quantum computer couldn't read recorded Signal messages, but it could
impersonate a contact or forge identity keys.

| What's signed | MOQOM | Signal |
| --- | --- | --- |
| Recorded messages stay secret | Yes | Yes |
| Long-term identity key | ML-DSA-87 | Curve25519 |
| Prekeys or KeyPackages signed with | ML-DSA-87 | XEdDSA |
| Impersonation by a future quantum computer | Resisted | Possible in new sessions |

Signal column: our reading of Signal's published specifications as of October 2026.

## What is still classical

Two signatures in the path are made by others with classical algorithms. Neither can sign as an
existing device.

- **Certificate signatures in TLS.** Relay certificates, and the Let's Encrypt certificates on
  MOQOM's public endpoints, are ECDSA or RSA, because the WebPKI has no post-quantum
  certificates yet. The key exchange is post-quantum; the certificate's signature is not. Phones accept only the
  exact relay certificate they were given, every proof is bound to that certificate, and media is
  end-to-end encrypted regardless. Forging the handshake would need a working quantum computer
  during the connection, and would get ciphertext.
- **Apple's sign-in.** Sign in with Apple identity tokens and App Attest are signed by Apple with
  classical algorithms. Someone who could forge one could at most enroll a new device. That
  device joins the room's group as a new ML-DSA-87 key that every member sees; it can't sign as
  an existing device. If your own backend signs people in, how it does so is your choice.

## What it costs

An ML-DSA-87 signature is 4,627 bytes and a public key is 2,592 bytes, against 64 and 32 bytes for
Ed25519. The cost is paid once per handshake or proof, not per media frame, so it adds nothing to
the media itself. Joining and key changes carry larger messages; streaming does not.

## Related

- [End-to-end encryption](/guides/e2ee/#post-quantum): the encryption layers in a room
- [moqom-token](/security/libraries/token/) and [moqom-proof](/security/libraries/proof/): the
  token and proof formats
- [moqom-mls](/security/libraries/mls/): room key agreement
- [Threat model & controls](/security/overview/)
