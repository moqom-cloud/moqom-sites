---
title: moqom-token
description: Mint, seal and verify MOQOM join tokens — compact JWS signed with ML-DSA-87, sealed with AES-256-GCM, bound to a device key, at most fifteen minutes long — in Swift, Go and Rust.
---

`moqom-token` mints and verifies the token a MOQOM client joins a relay with. A token is a
compact [JWS](https://www.rfc-editor.org/rfc/rfc7515) signed with **ML-DSA-87** ([FIPS 204](https://csrc.nist.gov/pubs/fips/204/final)), the post-quantum signature. It says who the
holder is (tenant and user), which device key it was issued to (`cnf.jkt`), which room they may
join and what they may do there. MOQOM's tokens are then [sealed](#sealed-tokens): encrypted with
AES-256-GCM for MOQOM's control plane and relays, so to everyone else they are opaque bytes.

A MOQOM token is not a bearer token. It's bound to one device's key, and nothing accepts it
without a fresh proof from that key, so a token copied off a device, out of a log or from the
network is worthless. See [Why a stolen token is worthless](#why-a-stolen-token-is-worthless).

The control plane uses it to mint and seal tokens, and relays use it to open and verify them.
You would use it directly if you run your own token issuer, or build a relay or another client.
MOQOM's own tokens are sealed for MOQOM's servers only, so neither an app nor its backend can
read one; what the device needs to know comes back beside the token
([the token response](/reference/device-tokens/#the-token-response)). Tokens you mint yourself,
sealed or not, you verify with this library as before. If you only call MOQOM from an app or a
backend, `MoqomKit` and the backend SDKs already include it.

| | |
| --- | --- |
| Version | 0.1.0 |
| Swift | product `MoqomToken`; iOS, macOS, visionOS and tvOS 26 or later |
| Go | package `github.com/moqom-cloud/moqom-security/go/token`; Go 1.27 or later |
| Rust | crate `moqom-token`; Rust 1.97 or later |
| License | Apache-2.0 |
| Source | [github.com/moqom-cloud/moqom-security](https://github.com/moqom-cloud/moqom-security) |

The library only signs and verifies. It does not decide which capability bits exist, which
rooms a user may enter, or what a relay link may carry; those are rules of the product that
issues the token. Proving that a session holds the device key a token names is
[`moqom-proof`](/security/libraries/proof/)'s job.

## Why a stolen token is worthless

MOQOM's relays check five things together, and an attacker needs all of them:

1. **The device's key.** `cnf.jkt` names an [ML-DSA-87](https://csrc.nist.gov/pubs/fips/204/final) key generated inside the device's Secure
   Enclave. The key can't be exported, copied or backed up, and the token is refused without a
   proof signed by it. Binding is mandatory: there is no unbound token to fall back to.
2. **A fresh proof for this exact connection.** Each [`moqom-proof`](/security/libraries/proof/)
   proof is single-use and tied to the TLS certificate of whoever receives it. A captured proof
   can't be sent again, and a machine in the middle with its own certificate gets a proof the
   real relay refuses.
3. **The issuer's signature.** Tokens are signed with ML-DSA-87, so they can't be forged or
   altered, even by someone with a quantum computer.
4. **The grant.** A token names one tenant, one room and one set of permissions, and the relay
   checks it on every announce, subscribe and fetch, not only at the door.
5. **Time.** A token lasts at most fifteen minutes, and the SDK renews it silently inside the
   open session two minutes before it expires. The short life isn't what protects the token,
   since the device binding already does; it means a permission you revoke, or a device you
   remove, is gone within minutes everywhere without a revocation list.

## Four keys, four jobs

Your API key, the key that signs tokens, the device key behind each proof, and the keys that
encrypt media are separate on purpose. Each one does one job and can't do the others, so no
single key, and no single party holding one, gets to your users' media.

| Key | Who holds it | What it does | What it can't do |
| --- | --- | --- | --- |
| **Your API key** | Your backend only; it never ships in your app | Lets your backend ask MOQOM's control plane for tokens and manage rooms | Sign a token itself, act as a device, or decrypt anything |
| **Token-signing key** | On MOQOM Cloud, the control plane, with the seed in Google Secret Manager; self-hosted, your own control plane | Signs each token: who the user is, which device key, which room, what they may do | Make a token work without that device's key, or decrypt anything |
| **Device key** | The Secure Enclave of one iPhone or Mac; it can't be exported, so MOQOM only ever sees its public half | Signs a fresh, single-use [proof](/security/libraries/proof/) each time the device connects | Grant itself a room or a permission |
| **Media keys** | Each room's [MLS](/security/libraries/mls/) group, derived on members' devices | Encrypt audio, video and data with AES-256-GCM | Leave the devices; MOQOM's servers never hold them |

Your backend uses the API key so that MOQOM never needs your user database: you authenticate
your users however you already do, then ask for a token naming one of them. A user's device
uses its own key, so a token is worthless anywhere else. Media keys are agreed among the devices
in the room, so relays carry only ciphertext.

**What this means on MOQOM Cloud.** MOQOM runs the control plane and the relays, and still can't
see or hear your rooms:

- **Relays forward ciphertext.** They see track names, object sizes and timing, which they need
  to route, but never a key that decrypts media.
- **The key service passes sealed messages.** It orders each room's membership changes and
  hands MLS handshake messages between devices. It holds public keys only.
- **Recordings are ciphertext.** Anything MOQOM's servers store stays encrypted for good. A
  recorder or classifier that needs plaintext is an agent you run, inside the group, and every
  member can see it.

**If a key leaks.** Each case stays limited to that key's job:

- **Your API key.** Whoever has it can ask for tokens for your tenant. Every device they join
  with appears in the room's member list as `username/device`, and can't read anything sent
  before it joined. [Revoke it](/guides/api-keys/#revoke) and issue a new one.
- **A token.** On its own, it does nothing (`wrong_key`).
- **One device, unlocked and running malware.** The attacker can use that device while you let
  them, but can't copy its key elsewhere. Ban the device; its live connection closes at once.

The limit, stated plainly: whoever signs tokens decides who may join, so they could let in a
device you didn't intend. It can't join unseen: every device that publishes is a member of the
group, listed to every other member, and two devices can compare `groupKeys`' epoch
authenticator to check that nobody else holds the keys. Viewers of a large broadcast are the
exception, as [Viewers of a large broadcast](/guides/e2ee/#viewers-of-a-large-broadcast-sender-keys)
explains.

## Post-quantum

Tokens are signed with ML-DSA-87, the lattice-based signature NIST standardised as [FIPS 204](https://csrc.nist.gov/pubs/fips/204/final) for
the era of quantum computers. A large enough quantum computer would let its owner recover an
RSA, ECDSA or Ed25519 private key from the public key, and then mint any token it liked. An
issuer key is long-lived and its public half is published, so that is the key worth protecting
first. ML-DSA-87 has no known quantum attack, and it is NIST's category 5, comparable to AES-256.

The cost is size: an ML-DSA-87 signature is 4,627 bytes against Ed25519's 64, so a token is
about 6.8 KB. Verifying one takes well under a millisecond.

A token is a signature, not a key exchange. Keeping a connection secret against recorded-now,
decrypted-later attacks is the job of TLS's key exchange, which should be post-quantum. Every MOQOM
device connection and server link uses ML-KEM-1024 key exchange only
([details](/guides/e2ee/#post-quantum)). In MOQOM rooms, media keys come from
[`moqom-mls`](/security/libraries/mls/) over [ML-KEM-1024](https://csrc.nist.gov/pubs/fips/203/final).

## Sealed tokens

A signed token's claims are readable by anyone who holds it: base64url is an encoding, not
encryption. A sealed token is the same signed token encrypted for its verifiers. To everyone
else, the device and app holding it, your backend and your logs included, it is opaque bytes.
Every token MOQOM mints is sealed.

```text
base64url( 0x01 | key ID (8 bytes) | nonce (12 bytes) | AES-256-GCM(segments) )
```

- **Additional data:** the version byte and the key ID, so neither can be changed without the
  token failing to open.
- **Segments:** the JWS header and claims, each after a two-byte big-endian length, then the
  signature, all as raw bytes rather than base64url. A sealed MOQOM token is about 6.6 KB.
- **Key ID:** eight random bytes, not a name, so it says nothing about whose token it is.
- **Keys:** [RFC 7517](https://www.rfc-editor.org/rfc/rfc7517) `oct` JWKs,
  `{"kty":"oct","alg":"A256GCM","kid":…,"k":…}`, with an eight-byte `kid` and a 32-byte `k`.
  The issuer and every verifier hold them, and nobody else. Rotate a key well before it has
  sealed 2³² tokens, NIST SP 800-38D's limit for random nonces; verifiers hold several by ID, as
  they do signing keys.
- **No extra authority:** sealing adds confidentiality only. A verifier opens the token, then
  verifies the signature and claims exactly as for a signed token, so holding a seal key doesn't
  let anyone mint.

A verifier given seal keys refuses a token that isn't sealed (`unsupported`), unless it's told to
accept both while its issuer moves to sealing. Opening fails as `malformed` for a token cut short
or not base64url, `unsupported` for another version, `unknown_key` for a key ID it doesn't hold,
and `bad_signature` for anything that doesn't authenticate. Relays open and verify offline, with
no round trip to the control plane.

| | Swift | Go | Rust |
| --- | --- | --- | --- |
| A seal key | `SealKey(id:secret:)` | `NewSealKey` | `SealKey` |
| Generate one | `SealKey.generate()` | `GenerateSealKey()` | `SealKey::generate()` |
| Read a key set | `SealKey.parseSet(_:)` | `ParseSealKeySet(doc)` | `SealKey::parse_set(doc)` |
| Seal a signed token | `try key.seal(jws)` | `key.Seal(jws)` | `key.seal(&jws)` |
| Open without verifying | `SealKey.open(_:keys:)` | `Open` | `open` |
| Whether a token is sealed | `SealKey.isSealed` | `IsSealed` | `is_sealed` |
| Open and verify | `Verifier(issuer:tenant:keys:sealKeys:acceptsUnsealed:)` | `NewVerifier(iss, keys...).WithSealKeys(sealKeys...)` | `Verifier::new(iss, keys).with_seal_keys(seal_keys)` |
| Accept unsealed tokens too, during a move | `acceptsUnsealed: true` | `AcceptingUnsealed()` | `accepting_unsealed()` |

**On MOQOM.** The control plane seals every token, and MOQOM's relays hold the seal keys by key
ID and rotate them like signing keys. [BYOC relays](/guides/self-hosting/) receive their own
per-tenant seal keys over their link to the control plane, so a self-hosted relay opens only its
own tenant's tokens. A [`moqom-proof`](/security/libraries/proof/) proof binds to the sealed
bytes exactly as presented.

**In your own app.** Sealing is optional for tokens you issue yourself. If you'd rather your
tokens not tell anyone who holds them, seal them with a `SealKey` that only your servers hold;
see [Replace your app's JWTs](/security/libraries/replace-jwt/#optional-seal-your-tokens).

## Use it for your own app's sign-in

The same token, with a [`moqom-proof`](/security/libraries/proof/) proof on every request,
replaces an app's bearer session tokens: a stolen token is useless without the device's Secure
Enclave key, a captured request cannot be sent again, and an interceptor with its own
certificate gets a proof the real server refuses. [Device-bound sign-in](/security/libraries/device-sign-in/)
walks through it end to end, with a server and client in Go and an app in Swift.
If your app hands out JWTs from a login endpoint today,
[Replace your app's JWTs](/security/libraries/replace-jwt/) changes it over step by step.

## Install

**Swift**, in `Package.swift`:

```swift
dependencies: [
    .package(url: "https://github.com/moqom-cloud/moqom-security", from: "0.1.0"),
],
targets: [
    .target(name: "MyApp", dependencies: [
        .product(name: "MoqomToken", package: "moqom-security"),
    ]),
]
```

**Go**:

```sh
go get github.com/moqom-cloud/moqom-security/go@v0.1.0
```

```go
import "github.com/moqom-cloud/moqom-security/go/token"
```

**Rust**:

```sh
cargo add moqom-token
```

The Rust crate uses AWS-LC through `aws-lc-rs`, which needs a C compiler to build.

## Minting and verifying

The examples below are compiled and run by each language's test suite. Each one generates an
[ML-DSA-87](https://csrc.nist.gov/pubs/fips/204/final) key and keeps its seed, loads the key again under a named key ID, mints a ten-minute
token for user `ada` in tenant `acme` with a grant for `room-42`, publishes the key as a [JWK](https://www.rfc-editor.org/rfc/rfc7517) set,
and verifies the token with a verifier pinned to the issuer and the tenant.

The thumbprint in `cnf.jkt` is the [RFC 7638](https://www.rfc-editor.org/rfc/rfc7638) SHA-256 thumbprint of the device's public key. In a
real issuer it comes from the device's key, which `moqom-proof` computes; the examples use a fixed
value.

### Swift

```swift
import CryptoKit
import Foundation
import MoqomToken

// Generate a key once and keep its 32-byte seed in your secret store.
let seed = try MLDSA87.PrivateKey().seedRepresentation

// Load it under the key ID your JWK set publishes.
let signer = try Signer(seed: seed, keyID: "2026-10")

let now = Int64(Date().timeIntervalSince1970)
let jws = try signer.sign(Claims(
    issuer: "https://api.example.com",
    subject: "ada",
    tenant: "acme",
    id: "c6c1f2d0",
    issuedAt: now,
    expires: now + 600,
    // The RFC 7638 thumbprint of the device's key, from MoqomProof.
    thumbprint: "MpXqvQAmv7Y3Kk9dHnJpLwRtUvXyZaBcDeFgHiJkLmM",
    grant: Grant(room: "room-42", publish: 3, owner: true)
))

// A relay reads the published JWK set and verifies.
let document = Data(#"{"keys":[\#(signer.publicKey.jwk)]}"#.utf8)
let keys = try PublicKey.parseSet(document)
let verifier = Verifier(issuer: "https://api.example.com", tenant: "acme", keys: keys)
let claims = try verifier.verify(jws, now: Date())
#expect(claims.subject == "ada" && claims.grant.room == "room-42")
```

### Go

```go
// Generate a key once and keep its 32-byte seed in your secret store.
generated, err := token.GenerateSigner()
if err != nil {
	log.Fatal(err)
}
seed := generated.Seed()

// Load it under the key ID your JWK set publishes.
signer, err := token.NewSigner(seed)
if err != nil {
	log.Fatal(err)
}
signer = signer.WithID("2026-10")

now := time.Now()
jws, err := signer.Sign(token.Claims{
	Issuer:   "https://api.example.com",
	Subject:  "ada",
	Tenant:   "acme",
	ID:       "c6c1f2d0",
	IssuedAt: now.Unix(),
	Expires:  now.Add(10 * time.Minute).Unix(),
	// The RFC 7638 thumbprint of the device's key, from moqom-proof.
	Confirmation: token.Confirmation{Thumbprint: "MpXqvQAmv7Y3Kk9dHnJpLwRtUvXyZaBcDeFgHiJkLmM"},
	Grant:        token.Grant{Room: "room-42", Publish: 3, Owner: true},
})
if err != nil {
	log.Fatal(err)
}

// A relay reads the published JWK set and verifies.
jwk, err := signer.PublicKey().JWK()
if err != nil {
	log.Fatal(err)
}
keys, err := token.ParseJWKSet([]byte(`{"keys":[` + string(jwk) + `]}`))
if err != nil {
	log.Fatal(err)
}
verifier := token.NewVerifier("https://api.example.com", keys...).ForTenant("acme")
claims, err := verifier.Verify(jws, time.Now())
if err != nil {
	log.Fatal(err)
}
fmt.Println(claims.Subject, claims.Tenant, claims.Grant.Room, claims.Grant.Publish, claims.Grant.Owner)
// Output: ada acme room-42 3 true
```

### Rust

```rust
use std::time::{SystemTime, UNIX_EPOCH};

use moqom_token::{Claims, Confirmation, Grant, PublicKey, Signer, Verifier};

// Generate a key once and keep its 32-byte seed in your secret store.
let seed = *Signer::generate()?.seed();

// Load it under the key ID your JWK set publishes.
let signer = Signer::from_seed(&seed)?.with_id("2026-10");

let now = SystemTime::now();
let iat = i64::try_from(now.duration_since(UNIX_EPOCH)?.as_secs())?;
let jws = signer.sign(&Claims {
    iss: "https://api.example.com".into(),
    sub: "ada".into(),
    tenant: "acme".into(),
    jti: "c6c1f2d0".into(),
    iat,
    exp: iat + 600,
    // The RFC 7638 thumbprint of the device's key, from moqom-proof.
    cnf: Confirmation { jkt: "MpXqvQAmv7Y3Kk9dHnJpLwRtUvXyZaBcDeFgHiJkLmM".into() },
    grant: Grant { room: "room-42".into(), publish: 3, owner: true, ..Grant::default() },
    ..Claims::default()
})?;

// A relay reads the published JWK set and verifies.
let document = format!(r#"{{"keys":[{}]}}"#, signer.public_key().jwk());
let keys = PublicKey::parse_set(&document)?;
let verifier = Verifier::new("https://api.example.com", keys).for_tenant("acme");
let claims = verifier.verify(jws.as_bytes(), SystemTime::now())?;
assert_eq!((claims.sub.as_str(), claims.grant.room.as_str()), ("ada", "room-42"));
```

## Expired tokens and the wrong key

Each example mints a ten-minute token and then shows three refusals: the token checked eleven
minutes later (`expired`), a verifier that does not hold the token's key ID (`unknown_key`), and
a verifier holding a different key published under the token's key ID (`bad_signature`).

### Swift

```swift
let signer = Signer(privateKey: try MLDSA87.PrivateKey())
let now = Date()
let iat = Int64(now.timeIntervalSince1970)
let jws = try signer.sign(Claims(
    subject: "ada", tenant: "acme", issuedAt: iat, expires: iat + 600,
    thumbprint: "MpXqvQAmv7Y3Kk9dHnJpLwRtUvXyZaBcDeFgHiJkLmM"
))
let verifier = Verifier(keys: [signer.publicKey])

// Eleven minutes on, the ten-minute token is past its expiry and the 30-second skew.
#expect(throws: TokenError.expired) {
    try verifier.verify(jws, now: now + 11 * 60)
}

// A verifier that does not hold the token's key ID.
let other = try MLDSA87.PrivateKey()
#expect(throws: TokenError.unknownKey) {
    try Verifier(keys: [Signer(privateKey: other).publicKey]).verify(jws, now: now)
}

// Another key published under the same key ID.
let impostor = Signer(privateKey: other, keyID: signer.keyID).publicKey
#expect(throws: TokenError.badSignature) {
    try Verifier(keys: [impostor]).verify(jws, now: now)
}
```

### Go

```go
signer, err := token.GenerateSigner()
if err != nil {
	log.Fatal(err)
}
now := time.Now()
jws, err := signer.Sign(token.Claims{
	Subject:      "ada",
	Tenant:       "acme",
	IssuedAt:     now.Unix(),
	Expires:      now.Add(10 * time.Minute).Unix(),
	Confirmation: token.Confirmation{Thumbprint: "MpXqvQAmv7Y3Kk9dHnJpLwRtUvXyZaBcDeFgHiJkLmM"},
})
if err != nil {
	log.Fatal(err)
}
verifier := token.NewVerifier("", signer.PublicKey())

// Eleven minutes on, the ten-minute token is past its expiry and the 30-second skew.
_, err = verifier.Verify(jws, now.Add(11*time.Minute))
fmt.Println(errors.Is(err, token.ErrExpired), token.Class(err))

other, err := token.GenerateSigner()
if err != nil {
	log.Fatal(err)
}
_, err = token.NewVerifier("", other.PublicKey()).Verify(jws, now)
fmt.Println(errors.Is(err, token.ErrUnknownKey), token.Class(err))

impostor := other.WithID(signer.ID()).PublicKey()
_, err = token.NewVerifier("", impostor).Verify(jws, now)
fmt.Println(errors.Is(err, token.ErrBadSignature), token.Class(err))
// Output:
// true expired
// true unknown_key
// true bad_signature
```

### Rust

```rust
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use moqom_token::{Claims, Confirmation, Error, Signer, Verifier};

let signer = Signer::generate()?;
let now = SystemTime::now();
let iat = i64::try_from(now.duration_since(UNIX_EPOCH)?.as_secs())?;
let jws = signer.sign(&Claims {
    sub: "ada".into(),
    tenant: "acme".into(),
    iat,
    exp: iat + 600,
    cnf: Confirmation { jkt: "MpXqvQAmv7Y3Kk9dHnJpLwRtUvXyZaBcDeFgHiJkLmM".into() },
    ..Claims::default()
})?;
let verifier = Verifier::new("", [signer.public_key()]);

// Eleven minutes on, the ten-minute token is past its expiry and the 30-second skew.
let later = now + Duration::from_secs(11 * 60);
let expired = verifier.verify(jws.as_bytes(), later).unwrap_err();
assert_eq!((expired, expired.class()), (Error::Expired, "expired"));

// A verifier that does not hold the token's key ID.
let other = Signer::generate()?;
let unknown = Verifier::new("", [other.public_key()]).verify(jws.as_bytes(), now);
assert_eq!(unknown, Err(Error::UnknownKey));

// Another key published under the same key ID.
let impostor = other.with_id(signer.id()).public_key();
let forged = Verifier::new("", [impostor]).verify(jws.as_bytes(), now);
assert_eq!(forged, Err(Error::BadSignature));
```

## API

The three languages have the same shape: a `Signer` holds one [ML-DSA-87](https://csrc.nist.gov/pubs/fips/204/final) key and its key ID, a
`Verifier` holds a set of public keys, an optional issuer and an optional tenant, and `verify`
returns the claims only when every check passes. No function returns claims from a token whose
signature has not been checked.

| | Swift | Go | Rust |
| --- | --- | --- | --- |
| Load a key from its seed | `Signer(seed:keyID:)` | `NewSigner(seed)` | `Signer::from_seed(&seed)` |
| Generate a key | `Signer(privateKey: MLDSA87.PrivateKey())` | `GenerateSigner()` | `Signer::generate()` |
| The seed, to store | `Signer.seed` | `Signer.Seed()` | `Signer::seed()` |
| Name the key | `keyID:` argument | `Signer.WithID(id)` | `Signer::with_id(id)` |
| Mint a token | `Signer.sign(_:)` | `Signer.Sign(claims)` | `Signer::sign(&claims)` |
| Sign other bytes with the key | `Signer.signature(for:)` | `Signer.SignMessage(msg)` | `Signer::sign_message(msg)` |
| The public key | `Signer.publicKey` | `Signer.PublicKey()` | `Signer::public_key()` |
| A public key from raw bytes | `PublicKey(id:algorithm:rawRepresentation:)` | `NewPublicKey(alg, id, raw)` | `PublicKey::ml_dsa_87(id, bytes)` |
| Read a [JWK](https://www.rfc-editor.org/rfc/rfc7517) set | `PublicKey.parseSet(_:)` | `ParseJWKSet(doc)` | `PublicKey::parse_set(doc)` |
| Write a JWK | `PublicKey.jwk` | `PublicKey.JWK()` | `PublicKey::jwk()` |
| Derived key ID | `PublicKey.derivedID(for:)` | `KeyID(raw)` | `key_id(raw)` |
| Verify a token | `Verifier(issuer:tenant:keys:).verify(_:now:)` | `NewVerifier(iss, keys...).ForTenant(t).Verify(jws, now)` | `Verifier::new(iss, keys).for_tenant(t).verify(bytes, now)` |
| Pin a relay pool | `pool:` argument | `Verifier.ForPool(pool)` | `Verifier::for_pool(pool)` |
| A verifier's key by ID | `Verifier.key(_:)` | `Verifier.Key(id)` | `Verifier::key(id)` |
| Whether it holds no key | `Verifier.isEmpty` | `Verifier.IsEmpty()` | `Verifier::is_empty()` |
| The error class | `TokenError.errorClass`, `PublicKey.SetError.errorClass` | `Class(err)` | `Error::class()`, `KeyError::class()` |
| Thumbprint check | `Claims.isValidThumbprint(_:)` | `ValidThumbprint(s)` | `valid_thumbprint(s)` |
| Limits | `TokenLimits` | `Type`, `MaxLifetime`, `ClockSkew`, `MaxTokenBytes` | `TOKEN_TYPE`, `MAX_LIFETIME`, `CLOCK_SKEW`, `MAX_TOKEN_BYTES` |

In Swift, `Signer(privateKey:keyID:)` takes a CryptoKit `MLDSA87.PrivateKey`, and a nil
`keyID` means the derived one. `Verifier.verify` accepts the token as `String` or `Data` and
throws `TokenError`. In Rust, `verify` takes the token as bytes, and the seed returned by
`Signer::seed()` is wiped when the signer is dropped. Loading a key, a key set
or a seed fails with the crate's `KeyError`; see [Errors](#errors).

`Signer.signature(for:)`, `SignMessage` and `sign_message` exist for protocols that share the
token key, such as the room control log. The caller owns domain separation: the message must
never be a valid [JWS](https://www.rfc-editor.org/rfc/rfc7515) signing input, or the signature could be spliced into a token. Starting the
message with a fixed context string that is not base64url is enough.

## Specification

### Token

`base64url(header) "." base64url(claims) "." base64url(signature)`

| | |
| --- | --- |
| Encoding | base64url without padding, canonical: padding, characters outside the alphabet (line breaks included) and non-zero trailing bits are refused |
| Signed bytes | The first two segments exactly as received, with the `.` between them |
| Maximum length | 8,192 bytes, checked before anything is decoded. A typical token is about 6.8 KB. |
| Maximum lifetime | 900 seconds from `iat` to `exp` |
| Clock skew | 30 seconds, either way. Times are compared in whole Unix seconds. |

### Header

The header has exactly these three members. Any other parameter (`crit`, `jku`, `x5u`, …) makes
the token malformed, because a parameter this build does not know could change what the
signature means.

```json
{"alg":"ML-DSA-87","typ":"MOQT","kid":"2026-10"}
```

| Member | Value |
| --- | --- |
| `alg` | `ML-DSA-87`, the only algorithm accepted. Must equal the algorithm of the key `kid` names. |
| `typ` | `MOQT`, so a [JWS](https://www.rfc-editor.org/rfc/rfc7515) minted for anything else cannot be presented to a relay |
| `kid` | The key ID. Selects the key from the verifier's set; there is no fallback to another key. |

### Keys and signatures

| Algorithm | JOSE `alg` | [JWK](https://www.rfc-editor.org/rfc/rfc7517) | Public key | Signature | Used to |
| --- | --- | --- | --- | --- | --- |
| ML-DSA-87 ([FIPS 204](https://csrc.nist.gov/pubs/fips/204/final)) | `ML-DSA-87` | `{"kty":"AKP","alg":"ML-DSA-87","kid":…,"pub":…}` | 2,592 bytes | 4,627 bytes | Sign and verify |

ML-DSA-87 is the only algorithm. A token with any other `alg`, `EdDSA` included, is refused, and
a key set that holds an `OKP` (Ed25519) or `EC` key is refused with `key_unsupported`.

- A private key is stored as its 32-byte FIPS 204 seed.
- A key that nobody names gets a derived ID: `base64url(SHA-256(raw public key)[:8])`, which is
  11 characters. It depends only on the key, so a key has one name everywhere.
- A JWK set is read as a bare array or as `{"keys": [...]}`. The whole document is read
  first, by the same JSON rules as a token (see [Parsing](#parsing)): member names are exact, a
  `null` or repeated member is refused, each key is an object, and every key needs a `kty` and
  a non-empty `kid`. Then each key in order: it must be `AKP` / `ML-DSA-87`, its public key must be canonical base64url of exactly the right length, and its
  `kid` must not repeat an earlier key's, byte for byte. A key that doesn't fit makes the whole set an error
  rather than being skipped. Members a key doesn't need, such as `use` and `key_ops`, are
  ignored.
- Signing is hedged (randomized) in all three languages, so two tokens from the same claims
  differ in their signatures.

### Claims

The signer writes the members in this order:

| Member | Type | Signer writes | Meaning |
| --- | --- | --- | --- |
| `iss` | string | always | Issuer. Compared byte for byte when the verifier pins one. |
| `sub` | string | always | User. Required. |
| `aud` | string | always | Tenant. Required. Compared byte for byte when the verifier pins one. |
| `jti` | string | always | Token ID |
| `iat` | integer | always | Issued at, in Unix seconds. A verifier reads 0 or absent as unknown. |
| `exp` | integer | always | Expires, in Unix seconds. Required. |
| `cnf` | `{"jkt": string}` | always | The [RFC 7638](https://www.rfc-editor.org/rfc/rfc7638) SHA-256 thumbprint of the device key, base64url (43 characters, 32 bytes). Required. |
| `moqt` | object | always | The grant |
| `via` | string | when not empty | The user whose following brought the holder in. Provenance only; it grants nothing. |
| `pool` | string | when not empty | The [relay pool](/guides/private-networks/) a private tenant's token is confined to. Absent means the shared fleet. Tokens are sealed, so clients never read it. |

The grant, `moqt`:

| Member | Type | Signer writes | Meaning |
| --- | --- | --- | --- |
| `room` | string | when not empty | The room the token admits the holder to. Empty names none. |
| `pub` | integer, 0–255 | always | Media kinds the holder may publish, as a bitmask. 0 is a viewer. |
| `cap` | integer, 32 bits | always | Capability bits |
| `own` | bool | when true | Room owner |
| `bs` | bool | when true | Backstage |
| `age` | bool | when true | Age verified |
| `rly` | bool | when true | Another relay's link to this one |

The library carries `room`, `pub` and `cap` without interpreting them; the bit positions and
what a token may do in a room belong to the product. In MOQOM, a token with no room admits its
holder to no room. The relay lets it publish only on the holder's own personal channel and read
personal channels in its tenant, refuses every room and backstage name, and refuses a relay link
(`rly`) that names no room. The control plane refuses to deliver room keys to a token with no
room, and refuses to mint one that has `via` but no room, or an agent token with no room.

A signer refuses to mint a token that:

- has no `sub`, `aud` or `cnf.jkt` (`incomplete`);
- has a `cnf.jkt` that is not 43 characters of canonical base64url decoding to 32 bytes
  (`thumbprint`);
- has no `iat`, an `exp` that is not after `iat`, or a lifetime over 900 seconds (`lifetime`).

The claims are taken exactly as given: nothing is filled in, rounded or clamped.

### Parsing

The header and the claims are read the same way in Swift, Go and Rust, so that no two verifiers
can disagree about what a token says. Anything outside these rules makes the token `malformed`
(`header is not JSON` or `claims are not JSON`), even when its signature is good:

- Each segment is one JSON object ([RFC 8259](https://www.rfc-editor.org/rfc/rfc8259)), with only whitespace around it: not an array, a
  string or `null`, and no byte order mark.
- The bytes are UTF-8, with no overlong forms or encoded surrogates. A `\u` escape of a
  surrogate must be half of a pair, and a string may not hold a raw control character.
- No object in the header or the claims, at any depth, may name a member twice. Names are
  compared after unescaping (`s\u0075b` is `sub`) and byte for byte, so `sub` and `Sub` are
  different names and Unicode normalization plays no part. JSON parsers disagree about which of
  two duplicates wins, so a token with one would mean different things to different verifiers.
- A known member has the type in the tables above or is absent. A member set to `null` is
  refused rather than read as absent, and a `cnf` or `moqt` written as an array is refused.
- `iat`, `exp`, `pub` and `cap` are integer literals in range: no fraction, no exponent and not
  `-0`. So `1.8e9`, `1800000000.0` and `3e0` are refused, as are a negative `pub`, a `pub` above
  255, a `cap` above 2³²−1 and an `exp` beyond 64 bits. A bool is `true` or `false`, never `1`
  or `"true"`.
- No number anywhere may be too large for a double (`1e400`; `1e-400` is fine), and arrays and
  objects nest at most 127 deep, counting the outermost object.
- Unknown top-level claims are ignored whatever their value, so an issuer can add one before
  every verifier has been upgraded.
- An unknown member of `moqt` makes the token malformed. A grant field added later is as likely
  to narrow a grant as to widen it, and a verifier that skipped it would grant more than was
  issued.

Issuer, tenant and key ID are compared byte for byte too, so `café` written with a combining
accent is a different tenant from `café` written with a precomposed `é`.

### Canonical encoding

The signer's JSON is identical in all three languages, and the sign vectors pin it byte for byte:
no whitespace, no HTML escaping, `\b \f \n \r \t` as short escapes, other control characters as
lowercase `\u00xx`, U+2028 and U+2029 escaped, and DEL left raw.

### Verification order

A verifier holding seal keys first opens the token as in [Sealed tokens](#sealed-tokens), and
the checks below run on what it opened. The checks run in this order and stop at the first
failure:

1. The length is 1 to 8,192 bytes (`malformed`).
2. There are three segments (`malformed`).
3. The header decodes (`malformed`).
4. `typ` is `MOQT` (`unsupported`).
5. `kid` is in the key set (`unknown_key`).
6. `alg` matches that key's algorithm (`unsupported`).
7. The signature segment decodes (`malformed`).
8. The signature verifies (`bad_signature`).
9. The claims decode (`malformed`).
10. `iss` matches, if the verifier pins an issuer (`wrong_issuer`).
11. `exp` is present (`malformed`).
12. Not expired: `now − 30 > exp` fails (`expired`).
13. Already valid: when `iat` is set, `now + 30 < iat` fails (`not_yet_valid`).
14. Not too long: `exp − iat > 900` fails when `iat` is set, and `exp − now > 930` when it is
    not (`lifetime`).
15. `sub`, `aud` and `cnf.jkt` are all present (`incomplete`).
16. `cnf.jkt` is 43 characters of canonical base64url decoding to 32 bytes (`thumbprint`).
17. `aud` matches, if the verifier pins a tenant (`wrong_tenant`).
18. `pool` matches, if the verifier pins a pool (`wrong_pool`). Pinning the empty pool means
    the shared fleet, which refuses every token that names a pool.

No claim is read before step 8. Whether the session holds the key `cnf.jkt` names is checked by
`moqom-proof`.

## Errors

Every failure is one of these classes. The class names are the ones the test vectors use, and
each language returns them from `errorClass`, `Class` and `class()`.

| Class | Swift | Go | Rust | Meaning |
| --- | --- | --- | --- | --- |
| `malformed` | `.malformed(reason)` | `ErrMalformed` | `Malformed(reason)` | Not a well-formed token |
| `unsupported` | `.unsupported` | `ErrUnsupported` | `Unsupported` | `typ` is not `MOQT`, or `alg` is not the key's algorithm |
| `unknown_key` | `.unknownKey` | `ErrUnknownKey` | `UnknownKey` | `kid` is not in the verifier's key set |
| `bad_signature` | `.badSignature` | `ErrBadSignature` | `BadSignature` | The signature does not verify with that key |
| `expired` | `.expired` | `ErrExpired` | `Expired` | Past `exp` by more than 30 seconds |
| `not_yet_valid` | `.notYetValid` | `ErrNotYetValid` | `NotYetValid` | `iat` is more than 30 seconds in the future |
| `lifetime` | `.lifetime` | `ErrLifetime` | `Lifetime` | Longer than fifteen minutes; when signing, also no `iat` or `exp` not after `iat` |
| `wrong_issuer` | `.wrongIssuer` | `ErrWrongIssuer` | `WrongIssuer` | `iss` is not the pinned issuer |
| `wrong_tenant` | `.wrongTenant` | `ErrWrongTenant` | `WrongTenant` | `aud` is not the pinned tenant |
| `wrong_pool` | `.wrongPool` | `ErrWrongPool` | `WrongPool` | `pool` is not the pinned relay pool |
| `incomplete` | `.incomplete` | `ErrIncomplete` | `Incomplete` | `sub`, `aud` or `cnf.jkt` is missing |
| `thumbprint` | `.thumbprint` | `ErrThumbprint` | `Thumbprint` | `cnf.jkt` is not a SHA-256 thumbprint |

Swift's type is `TokenError` and Rust's is `moqom_token::Error`. In Go, test with `errors.Is`:
the returned errors wrap these values and add detail, such as when the token expired. Match on
the class, not on the message.

The `malformed` reason is one of these strings, the same in all three languages:

| Reason | Cause |
| --- | --- |
| `token length is out of range` | Empty, or longer than 8,192 bytes |
| `expected three segments` | Not exactly two `.` separators |
| `header is not base64url` | The header segment is not canonical base64url |
| `header is not JSON` | Breaks a [parsing](#parsing) rule: not a JSON object, an unknown parameter, a `null`, the wrong type, or a duplicate member |
| `signature is not base64url` | The signature segment is not canonical base64url |
| `claims are not base64url` | The claims segment is not canonical base64url |
| `claims are not JSON` | Breaks a [parsing](#parsing) rule: not a JSON object, an unknown grant member, a `null`, the wrong type, a number that is not an integer in range, or a duplicate member |
| `no expiry` | `exp` is absent or 0 |

When signing, Go also returns `ErrMalformed` for a claim that is not valid UTF-8, which cannot
happen with Swift or Rust strings. Swift's `Signer.sign` rethrows CryptoKit's errors unchanged.

### Loading keys

Reading a [JWK](https://www.rfc-editor.org/rfc/rfc7517) set, making a public key from raw bytes, or loading a seed, fails with one of these
classes. The key set vectors use the same names, and each language returns them from
`errorClass`, `Class` and `class()`.

| Class | Swift (`PublicKey.SetError`) | Go | Rust (`KeyError`) | Meaning |
| --- | --- | --- | --- | --- |
| `set_malformed` | `.malformed(reason)` | `ErrKeySetMalformed` | `Malformed(reason)` | Breaks a [parsing](#parsing) rule, not an array or `{"keys": [...]}`, a key that is not an object, a member that is `null`, of the wrong type or named twice, or a key with no `kty` or no `kid` |
| `key_unsupported` | `.unsupported(kid:)` | `ErrKeyUnsupported` | `Unsupported { kid }` | Not `AKP` / `ML-DSA-87`, such as an `OKP` (Ed25519) or `EC` key |
| `key_invalid` | `.invalid(kid:reason:)` | `ErrKeyInvalid` | `Invalid { kid, reason }`, `Seed` | A public key that is not canonical base64url or not the algorithm's length, or a seed that will not load |
| `duplicate_kid` | `.duplicateKeyID(kid)` | `ErrDuplicateKeyID` | `DuplicateKeyId(kid)` | Two keys in the set share a `kid` |

A public key from raw bytes of the wrong length is `key_invalid` in all three:
`PublicKey(id:algorithm:rawRepresentation:)` throws `.invalid(kid:reason:)`, `NewPublicKey` returns
`ErrKeyInvalid`, and `PublicKey::ml_dsa_87` returns `KeyError::Invalid`. In
Go, `NewPublicKey` and `NewSigner` return these errors, and test with `errors.Is`. Rust's
`Signer::generate` returns `KeyError::Random`, class `random`, if the system random number
generator fails; no vector names it. Swift's `Signer(seed:)` rethrows CryptoKit's error.

## Legacy compatibility

- **Ed25519 tokens are no longer accepted.** Tokens were signed with Ed25519 before the move to
  [ML-DSA-87](https://csrc.nist.gov/pubs/fips/204/final). A key set can't hold an Ed25519 key
  (`key_unsupported`), and a token with `alg` `EdDSA` never matches an ML-DSA-87 key
  (`unsupported`), so no verifier accepts one. The Ed25519 key constructors are removed from all
  three libraries.
- **Tokens without `iat` still verify.** This library never mints one, but a verifier accepts
  one and measures its lifetime from the current time instead: `exp` may be at most 930 seconds
  ahead. Leaving `iat` out cannot buy a longer token.
- **Unknown top-level claims are ignored**, so tokens from a newer issuer still verify with an
  older library. Unknown grant members are not ignored; see [Parsing](#parsing).

## Security considerations

- **The key decides the algorithm.** The header's `alg` is never trusted on its own. That rules
  out `none`, HMAC keyed with the public key, and an Ed25519 signature checked against an ML-DSA
  key ID, all of which the vectors cover.
- **Pin the issuer and the tenant.** An empty issuer or tenant accepts any. A relay should pin
  the issuer, so a token from another deployment that reuses a key ID is refused, and a
  tenant-scoped service should pin the tenant.
- **Always check the proof as well.** This library verifies the token; `moqom-proof` verifies
  that the request comes from the device the token names. MOQOM's relays require both, every time, so a token alone admits nothing. If you use the token in your
  own service, require the proof too: a service that checks only the token would accept it from
  anyone who copied it.
- **Sealing hides, it doesn't authorize.** A seal key opens tokens but can't mint one, so a
  verifier that holds seal keys still needs the signing public keys, and still checks the
  signature.
- **Replay is stopped by the proof.** The library doesn't track `jti`. Each proof is single-use
  and tied to the receiver's TLS certificate, which is what stops a captured request being sent
  again.
- **One key per key ID.** A set that names a `kid` twice is refused when it is loaded, rather
  than letting the parser decide which key a token selects. Give each key its own ID, or let the
  library derive one.
- **Rotation.** Publish the new key, move signing to it, and keep the old key in the set until
  the last token it signed has expired: fifteen minutes and thirty seconds. An unknown `kid` is
  refused, never retried against another key.
- **Keep the seed secret.** The 32-byte seed is the whole private key. Store it in a secret
  manager or keychain, not beside the code.
- **Sharing the key.** If another protocol signs with the token key through `SignMessage`,
  `sign_message` or `signature(for:)`, its messages must never parse as a [JWS](https://www.rfc-editor.org/rfc/rfc7515) signing input.
- **Inputs are bounded.** The length is checked before anything is decoded, the header is
  limited to three members, and nesting stops at 127 levels.
- **One reading of the bytes.** Duplicate members, invalid UTF-8, unpaired surrogates,
  non-integer times and out-of-range numbers are refused rather than resolved, so every
  verifier reads the same claims from the same bytes.

## Test vectors

All three implementations pass every case in
[`vectors/token`](https://github.com/moqom-cloud/moqom-security/tree/main/vectors/token). The Go
tests generate the files from fixed seeds with `now = 1800000000`; each file's `keys` array lists
every key's ID, algorithm, seed and public key.

- `verify.json` has 120 cases. Each gives a token, a time, an issuer, a tenant and a key set,
  and either the claims it yields or the error class. They cover valid [ML-DSA-87](https://csrc.nist.gov/pubs/fips/204/final) tokens,
  legacy Ed25519 ones that must be refused, rotation, expiry and not-yet-valid at the skew boundary, unknown key IDs,
  tampered claims and signatures, algorithm confusion, lifetimes over the cap, issuer and tenant
  pins (compared byte for byte), incomplete identities, grant strictness, duplicate member names
  at every depth (one spelled with an escape), every `malformed` reason including non-canonical
  base64url and line breaks inside a segment, and `cnf.jkt` values of every wrong shape. Correctly
  signed tokens that break each [parsing](#parsing) rule must be refused as `malformed`, and
  the edge cases must pass: nesting exactly 127 deep, `1e-400`, a `null` unknown claim, a
  surrogate pair, escaped names, whitespace, and `pub` and `cap` at their limits.
- `sign.json` has 18 cases: five claim sets with their exact signing input and a deterministic
  token, and thirteen that a signer must refuse.
- `seal.json` pins the sealed format byte for byte: seal keys, the signed tokens they seal, the
  sealed result, and tokens that must fail to open with each error class.
- `keysets.json` has 49 cases. Each gives a [JWK](https://www.rfc-editor.org/rfc/rfc7517) set document and either the key IDs it yields,
  in order, or the error class. They cover both shapes, the empty set, ignored members, duplicate
  key IDs, every `set_malformed` cause including the parsing rules a key set can break,
  unsupported key types and bad key material.

Run them, together with the examples on this page:

```sh
swift test --filter MoqomTokenTests           # in the repository root
cd go && go test ./token/...
cd rust && cargo test -p moqom-token
```

To regenerate the files after a format change (otherwise the Go test checks that the committed
files are what the current code would write):

```sh
cd go && MOQOM_WRITE_VECTORS=1 go test ./token -run TestVectors
```

## Source

- Swift: [`Sources/MoqomToken`](https://github.com/moqom-cloud/moqom-security/tree/main/Sources/MoqomToken)
- Go: [`go/token`](https://github.com/moqom-cloud/moqom-security/tree/main/go/token)
  ([pkg.go.dev](https://pkg.go.dev/github.com/moqom-cloud/moqom-security/go/token))
- Rust: [`rust/moqom-token`](https://github.com/moqom-cloud/moqom-security/tree/main/rust/moqom-token)
  ([docs.rs](https://docs.rs/moqom-token))
- Design: [`docs/moqom-token.md`](https://github.com/moqom-cloud/moqom-security/blob/main/docs/moqom-token.md)
- Vectors: [`vectors/token`](https://github.com/moqom-cloud/moqom-security/tree/main/vectors/token)
