---
title: moqom-proof
description: Device proof of possession for MoQ sessions — single-use ML-DSA-87 proofs bound to a join token and to the peer's TLS certificate, in Swift, Go and Rust.
---

`moqom-proof` is how a device shows that it holds the key its join token was issued to. A MOQOM
token names a device key by its [JWK](https://www.rfc-editor.org/rfc/rfc7517) thumbprint (`cnf.jkt`, see
[moqom-token](/security/libraries/token/)). On its own, a token is a bearer credential: whoever
copies it can use it. With a proof it is sender-constrained. At connect, and again with every
in-session token renewal, the device signs a fresh proof that commits to the token, to the TLS
leaf certificate of the peer it is talking to, and to the time. The peer checks that the proof
was signed by the key the token names and accepts it once.

Use it if you are building a MOQOM client other than `MoqomKit`, running your own checks in front
of a relay, or want the same kind of device binding in another system that speaks over TLS. The
library is the code MOQOM's relays, control plane and apps run. It is the same in all three
languages, and all three pass the same [test vectors](#test-vectors).

| | |
| --- | --- |
| Swift | product `MoqomProof` |
| Go | package `github.com/moqom-cloud/moqom-security/go/proof` |
| Rust | crate `moqom-proof` |
| Algorithms | ML-DSA-87 ([FIPS 204](https://csrc.nist.gov/pubs/fips/204/final)) only; ES256 and every other classical algorithm are refused |
| Shape | Compact [JWS](https://www.rfc-editor.org/rfc/rfc7515) after [RFC 9449](https://www.rfc-editor.org/rfc/rfc9449) (DPoP), `typ` `MOQT-POP` |
| License | Apache-2.0 |

The library checks the proof, not the token. Verify the token itself (signature, issuer,
expiry, room, grants) with `moqom-token`, then pass its bytes, its `cnf.jkt` and its expiry to
the proof checker.

## Install

**Swift.** In `Package.swift`:

```swift
.package(url: "https://github.com/moqom-cloud/moqom-security", from: "0.1.0"),
```

and add the product to your target:

```swift
.product(name: "MoqomProof", package: "moqom-security"),
```

It needs iOS, macOS, visionOS or tvOS 26, where CryptoKit has [ML-DSA-87](https://csrc.nist.gov/pubs/fips/204/final).

**Go.** Go 1.27 or later, for `crypto/mldsa`:

```sh
go get github.com/moqom-cloud/moqom-security/go@v0.1.0
```

```go
import "github.com/moqom-cloud/moqom-security/go/proof"
```

**Rust.** Rust 1.97 or later. Cryptography is AWS-LC, through `aws-lc-rs`:

```sh
cargo add moqom-proof
```

## Prove and check

A device proves it holds the key its token names. A relay checks the proof against its own
certificate and spends the nonce. A second presentation of the same proof is refused.

The certificate hash is the SHA-256 of the receiving peer's TLS leaf certificate in DER. The
device hashes the certificate the peer presented; the relay hashes its own. In the examples a
string stands in for the certificate and for the token.

The Swift examples use a software key, `MLDSA87.PrivateKey`, so that they run anywhere,
including in `swift test` on a Mac without a Secure Enclave. On a device with one, make the
prover with `Prover(.secureEnclaveMLDSA87(try SecureEnclave.MLDSA87.PrivateKey()))` instead.
That key cannot leave the enclave; everything else is the same.

Swift, from `Tests/MoqomProofTests/ExamplesTests.swift`:

```swift
import CryptoKit
import Foundation
import MoqomProof

// On the device.
let device = Prover(.mlDSA87(try MLDSA87.PrivateKey()))
let jkt = device.thumbprint // the control plane puts this in the token's cnf.jkt
let token = Data("eyJhbGciOiJNTC1EU0EtNjUi...".utf8)
let relayCertificate = Data(SHA256.hash(data: Data("the relay's leaf certificate, DER".utf8)))
let now = Date()
let proof = try device.prove(token: token, certificateHash: relayCertificate, nonce: Prover.nonce(), issuedAt: now)

// On the relay.
let checker = Checker(store: MemoryNonceStore())
let expiry = now.addingTimeInterval(15 * 60)
try checker.check(proof, token: token, certificateHash: relayCertificate, thumbprint: jkt, now: now, until: expiry)
try checker.check(proof, token: token, certificateHash: relayCertificate, thumbprint: jkt, now: now, until: expiry)
// throws ProofError.replayed
```

Go, from `go/proof/example_test.go`:

```go
// On the device.
device, err := proof.GenerateProver(proof.MLDSA87)
if err != nil {
	panic(err)
}
jkt := device.Thumbprint() // the control plane puts this in the token's cnf.jkt
token := []byte("eyJhbGciOiJNTC1EU0EtNjUi...")
relayCertificate := sha256.Sum256([]byte("the relay's leaf certificate, DER"))
now := time.Now()
p, err := device.Prove(token, relayCertificate[:], proof.NewNonce(), now)
if err != nil {
	panic(err)
}

// On the relay.
checker, err := proof.NewChecker(proof.NewDefaultMemoryNonceStore())
if err != nil {
	panic(err)
}
expiry := now.Add(15 * time.Minute)
fmt.Println(checker.Check(p, token, relayCertificate[:], jkt, now, expiry))
fmt.Println(proof.Class(checker.Check(p, token, relayCertificate[:], jkt, now, expiry)))
// Output:
// <nil>
// replayed
```

Rust, from the crate documentation in `rust/moqom-proof/src/lib.rs`:

```rust
use std::time::{Duration, SystemTime};

use aws_lc_rs::digest::{SHA256, digest};
use moqom_proof::{Algorithm, Checker, Error, MemoryNonceStore, Prover, nonce};

// On the device.
let device = Prover::generate(Algorithm::MlDsa87)?;
let jkt = device.thumbprint().to_owned(); // the control plane puts this in cnf.jkt
let token = b"eyJhbGciOiJNTC1EU0EtNjUi...";
let relay_certificate = digest(&SHA256, b"the relay's leaf certificate, DER");
let now = SystemTime::now();
let proof = device.prove(token, relay_certificate.as_ref(), &nonce()?, now)?;

// On the relay.
let checker = Checker::new(MemoryNonceStore::default());
let expiry = now + Duration::from_secs(15 * 60);
let check = || checker.check(&proof, token, Some(relay_certificate.as_ref()), &jkt, now, expiry);
assert_eq!(check(), Ok(()));
assert_eq!(check(), Err(Error::Replayed));
```

What the device sends as `key` when it [asks for a token](/reference/device-tokens/) is its public [JWK](https://www.rfc-editor.org/rfc/rfc7517):
`device.jwk` in Swift (a `Codable` `ProofJWK`; `members` gives it as a dictionary),
`device.JWK()` in Go (a `JWK` that marshals to JSON), and `device.jwk_json()` in Rust (the
canonical JSON). Whoever mints derives `cnf.jkt` from that key rather than trusting a
thumbprint it is given.

## Store and load a device key

An [ML-DSA-87](https://csrc.nist.gov/pubs/fips/204/final) private key is a 32-byte seed. Store it where your platform keeps secrets, and load
it again to get the same thumbprint.

Swift:

```swift
let key = try MLDSA87.PrivateKey()
let seed = key.seedRepresentation

let loaded = Prover(.mlDSA87(try MLDSA87.PrivateKey(seedRepresentation: seed, publicKey: nil)))
// seed.count == 32
// loaded.algorithm == .mlDSA87
// loaded.thumbprint == Prover(.mlDSA87(key)).thumbprint
```

A Secure Enclave key has no seed to store. Keep its `dataRepresentation`, an opaque blob that
only that device's enclave can use.

Go. `proof.NewProver` takes an ML-DSA-87 signer only: an `*mldsa.PrivateKey`, or any
`crypto.Signer` whose public key is ML-DSA-87, so a key in hardware works the same way. A P-256
or other classical key makes no prover (`unsupported`):

```go
key, err := mldsa.GenerateKey(mldsa.MLDSA87())
if err != nil {
	panic(err)
}
seed := key.Bytes()

loaded, err := mldsa.NewPrivateKey(mldsa.MLDSA87(), seed)
if err != nil {
	panic(err)
}
device, err := proof.NewProver(loaded)
if err != nil {
	panic(err)
}
original, _ := proof.NewProver(key)
fmt.Println(len(seed), device.Algorithm(), device.Thumbprint() == original.Thumbprint())
// Output: 32 ML-DSA-87 true
```

Rust. `to_pkcs8` writes PKCS#8 v1 (the seed, for ML-DSA-87), and `from_pkcs8` reads ML-DSA-87
in seed or expanded form, and nothing else:

```rust
use moqom_proof::{Algorithm, Error, Prover};

let device = Prover::generate(Algorithm::MlDsa87)?;
let stored = device.to_pkcs8()?;
let loaded = Prover::from_pkcs8(&stored)?;
assert_eq!(loaded.algorithm(), Algorithm::MlDsa87);
assert_eq!(loaded.thumbprint(), device.thumbprint());

let from_seed = Prover::ml_dsa_87_from_seed(&[7; 32])?;
assert_eq!(from_seed.thumbprint(), "e6Z96eT_vmFBoPYfx8wJ1B6r6stkERsYhS4iadvZec4");
```

## Refusals

Each refusal names the check that failed: a proof made for another token, for another peer, by
a key the token does not name, or too long ago.

Swift:

```swift
let device = Prover(.mlDSA87(try MLDSA87.PrivateKey()))
let stranger = Prover(.mlDSA87(try MLDSA87.PrivateKey()))
let token = Data("eyJhbGciOiJNTC1EU0EtNjUi...".utf8)
let relay = Data(SHA256.hash(data: Data("relay A's leaf certificate".utf8)))
let other = Data(SHA256.hash(data: Data("relay B's leaf certificate".utf8)))
let now = Date()
let expiry = now.addingTimeInterval(15 * 60)
let checker = Checker(store: MemoryNonceStore())
func check(_ proof: Data) throws(ProofError) {
    try checker.check(proof, token: token, certificateHash: relay, thumbprint: device.thumbprint, now: now, until: expiry)
}

let wrongToken = try device.prove(token: Data("another token".utf8), certificateHash: relay, nonce: Prover.nonce(), issuedAt: now)
try check(wrongToken) // throws ProofError.wrongToken
let wrongPeer = try device.prove(token: token, certificateHash: other, nonce: Prover.nonce(), issuedAt: now)
try check(wrongPeer) // throws ProofError.wrongCertificate
let wrongKey = try stranger.prove(token: token, certificateHash: relay, nonce: Prover.nonce(), issuedAt: now)
try check(wrongKey) // throws ProofError.wrongKey
let stale = try device.prove(token: token, certificateHash: relay, nonce: Prover.nonce(), issuedAt: now.addingTimeInterval(-10 * 60))
try check(stale) // throws ProofError.expired
// ProofError.expired.errorClass == "expired"
```

Go:

```go
device, _ := proof.GenerateProver(proof.MLDSA87)
stranger, _ := proof.GenerateProver(proof.MLDSA87)
token := []byte("eyJhbGciOiJNTC1EU0EtNjUi...")
relay := sha256.Sum256([]byte("relay A's leaf certificate"))
other := sha256.Sum256([]byte("relay B's leaf certificate"))
now := time.Now()
expiry := now.Add(15 * time.Minute)
checker, _ := proof.NewChecker(proof.NewDefaultMemoryNonceStore())

check := func(p []byte, at time.Time) {
	fmt.Println(proof.Class(checker.Check(p, token, relay[:], device.Thumbprint(), at, expiry)))
}
p, _ := device.Prove([]byte("another token"), relay[:], proof.NewNonce(), now)
check(p, now)
p, _ = device.Prove(token, other[:], proof.NewNonce(), now)
check(p, now)
p, _ = stranger.Prove(token, relay[:], proof.NewNonce(), now)
check(p, now)
p, _ = device.Prove(token, relay[:], proof.NewNonce(), now.Add(-10*time.Minute))
check(p, now)
// Output:
// wrong_token
// wrong_certificate
// wrong_key
// expired
```

Rust:

```rust
use std::time::{Duration, SystemTime};

use aws_lc_rs::digest::{SHA256, digest};
use moqom_proof::{Algorithm, Checker, Error, MemoryNonceStore, Prover, nonce};

let device = Prover::generate(Algorithm::MlDsa87)?;
let stranger = Prover::generate(Algorithm::MlDsa87)?;
let token = b"eyJhbGciOiJNTC1EU0EtNjUi...";
let relay = digest(&SHA256, b"relay A's leaf certificate");
let other = digest(&SHA256, b"relay B's leaf certificate");
let now = SystemTime::now();
let expiry = now + Duration::from_secs(15 * 60);
let checker = Checker::new(MemoryNonceStore::default());
let check = |proof: &[u8]| {
    checker.check(proof, token, Some(relay.as_ref()), device.thumbprint(), now, expiry)
};

let proof = device.prove(b"another token", relay.as_ref(), &nonce()?, now)?;
assert_eq!(check(&proof), Err(Error::WrongToken));
let proof = device.prove(token, other.as_ref(), &nonce()?, now)?;
assert_eq!(check(&proof), Err(Error::WrongCertificate));
let proof = stranger.prove(token, relay.as_ref(), &nonce()?, now)?;
assert_eq!(check(&proof), Err(Error::WrongKey));
let ten_minutes_ago = now - Duration::from_secs(10 * 60);
let proof = device.prove(token, relay.as_ref(), &nonce()?, ten_minutes_ago)?;
assert_eq!(check(&proof), Err(Error::Expired));
assert_eq!(Error::Expired.class(), "expired");
```

## The nonce store

A checker spends each proof's nonce (`jti`) in a `NonceStore` until the time you pass as
`until`, normally the token's expiry, and never for less than the proof's window: the store is
asked to remember the nonce until the later of `until` and one second past the proof's `iat`
plus the window, so a short or wrong `until` cannot let a proof in twice. Checkers that share a
store share what has been spent, so a proof accepted on one connection is refused on every
other.

Swift:

```swift
let store = MemoryNonceStore()
let first = Checker(store: store)
let second = Checker(store: store)

let device = Prover(.mlDSA87(try MLDSA87.PrivateKey()))
let token = Data("eyJhbGciOiJNTC1EU0EtNjUi...".utf8)
let relay = Data(SHA256.hash(data: Data("the relay's leaf certificate, DER".utf8)))
let now = Date()
let expiry = now.addingTimeInterval(15 * 60)
let proof = try device.prove(token: token, certificateHash: relay, nonce: Prover.nonce(), issuedAt: now)

try first.check(proof, token: token, certificateHash: relay, thumbprint: device.thumbprint, now: now, until: expiry)
try second.check(proof, token: token, certificateHash: relay, thumbprint: device.thumbprint, now: now, until: expiry)
// throws ProofError.replayed
// store.remembered == 1
```

Go:

```go
store := proof.NewDefaultMemoryNonceStore()
first, _ := proof.NewChecker(store)
second, _ := proof.NewChecker(store, proof.WithAlgorithms(proof.MLDSA87))

device, _ := proof.GenerateProver(proof.MLDSA87)
token := []byte("eyJhbGciOiJNTC1EU0EtNjUi...")
relay := sha256.Sum256([]byte("the relay's leaf certificate, DER"))
now := time.Now()
expiry := now.Add(15 * time.Minute)
p, _ := device.Prove(token, relay[:], proof.NewNonce(), now)

fmt.Println(first.Check(p, token, relay[:], device.Thumbprint(), now, expiry))
fmt.Println(proof.Class(second.Check(p, token, relay[:], device.Thumbprint(), now, expiry)))
fmt.Println(store.Remembered())
// Output:
// <nil>
// replayed
// 1
```

Rust. `NonceStore` is implemented for `Arc<S>`:

```rust
use std::sync::Arc;
use std::time::{Duration, SystemTime};

use aws_lc_rs::digest::{SHA256, digest};
use moqom_proof::{Algorithm, Checker, Error, MemoryNonceStore, Prover, nonce};

let store = Arc::new(MemoryNonceStore::default());
let first = Checker::new(Arc::clone(&store));
let second = Checker::new(Arc::clone(&store));

let device = Prover::generate(Algorithm::MlDsa87)?;
let token = b"eyJhbGciOiJNTC1EU0EtNjUi...";
let relay = digest(&SHA256, b"the relay's leaf certificate, DER");
let now = SystemTime::now();
let expiry = now + Duration::from_secs(15 * 60);
let proof = device.prove(token, relay.as_ref(), &nonce()?, now)?;

let jkt = device.thumbprint();
assert_eq!(first.check(&proof, token, Some(relay.as_ref()), jkt, now, expiry), Ok(()));
assert_eq!(
    second.check(&proof, token, Some(relay.as_ref()), jkt, now, expiry),
    Err(Error::Replayed)
);
assert_eq!(store.remembered(), 1);
```

`MemoryNonceStore` is the store the library provides. It holds up to 100,000 unexpired nonces by
default (`MemoryNonceStore.defaultCapacity`, `proof.DefaultCapacity`, `DEFAULT_CAPACITY`) and
forgets each one at its `until`. Expired entries are swept only when the store is full. When it
is full of unexpired nonces it refuses with `overloaded` rather than evicting one, because
evicting would choose which proof becomes replayable. A nonce is spent only after every other
check has passed, so filling the store takes valid proofs from devices holding valid tokens.

The default store is `MemoryNonceStore()` in Swift, `proof.NewDefaultMemoryNonceStore()` in Go
and `MemoryNonceStore::default()` in Rust. To choose the capacity, use `try
MemoryNonceStore(capacity:)`, `proof.NewMemoryNonceStore(capacity)` (which also returns an
error) or `MemoryNonceStore::new(capacity)?`. A capacity that is not positive is refused with
`configuration`, in every language.

To share spent nonces between processes, implement the interface over a shared database. It is
one method in each language, called only for a proof that passed every other check, and must be
safe to call concurrently:

| | Signature |
| --- | --- |
| Swift | `protocol NonceStore: Sendable { func spend(_ nonce: String, until: Date, now: Date) throws(ProofError) }` |
| Go | `type NonceStore interface { Spend(nonce string, until, now time.Time) error }` |
| Rust | `trait NonceStore: Send + Sync { fn spend(&self, nonce: &str, until: SystemTime, now: SystemTime) -> Result<(), Error>; }` |

It returns `replayed` for a nonce already spent and `overloaded` if it cannot record another,
and must record the nonce atomically with that check.

## Checker options

| | Swift | Go | Rust | Default |
| --- | --- | --- | --- | --- |
| Accepted algorithms | `algorithms:` | `WithAlgorithms` | `with_algorithms` | [ML-DSA-87](https://csrc.nist.gov/pubs/fips/204/final), the only algorithm there is |
| Clock window, either way | `window:` | `WithWindow` | `with_window` | 300 seconds |
| Refuse when the checker has no certificate | `requireCertificate:` | `WithCertificateRequired` | `with_certificate_required` | off |

The checker is made with its store and, optionally, these settings: `try Checker(store:
algorithms: window: requireCertificate:)` in Swift, `proof.NewChecker(store, options...)` in Go,
and `Checker::new(store)` followed by the `with_` methods in Rust, of which `with_algorithms`
and `with_window` return a `Result`. `Checker(store:)` in Swift and `Checker::new` in Rust use
the defaults and cannot fail. Settings that cannot work are refused when the checker is made,
with `configuration`, rather than replaced by a default: no store (Go), no algorithms, an
unknown algorithm such as `ES256` (Go), and a window that is not positive. Each language reads the settings
back: Swift's properties, Go's `Store()`, `Algorithms()`, `Window()` and
`CertificateRequired()`, and Rust's `algorithms()`, `window()` and `certificate_required()`.

A checker that has no certificate of its own (an in-process test harness, for instance) passes
none: `nil` in Swift, `None` in Rust, an empty slice in Go. It then accepts only proofs that
name no certificate. Anything that terminates TLS should pass its certificate hash and set the
certificate as required.

## Specification

### Proof

A proof is a compact [JWS](https://www.rfc-editor.org/rfc/rfc7515): `base64url(header) "." base64url(claims) "." base64url(signature)`.
Base64url is [RFC 4648](https://www.rfc-editor.org/rfc/rfc4648) §5 with no padding, and decoding is strict: padding, characters outside
the alphabet, and non-zero unused bits in the last character are all refused, so each value has
one spelling. The signature is over the ASCII bytes `header "." claims` exactly as they arrived,
not over a re-encoding.

Header, as the prover writes it:

```json
{"alg":"ML-DSA-87","typ":"MOQT-POP","jwk":{"alg":"ML-DSA-87","kty":"AKP","pub":"…"}}
```

| Member | Value |
| --- | --- |
| `alg` | `ML-DSA-87`, and it must be the algorithm of the key in `jwk`. Any other `alg`, `ES256` included, is refused as `unsupported`. |
| `typ` | Always `MOQT-POP`, so no other JWS (a token from the same deployment, an [RFC 9449](https://www.rfc-editor.org/rfc/rfc9449) `dpop+jwt`) passes as a proof |
| `jwk` | The device's public key. [ML-DSA-87](https://csrc.nist.gov/pubs/fips/204/final): `kty` `AKP`, `alg` `ML-DSA-87`, `pub` the 2,592-byte raw public key ([draft-ietf-cose-dilithium](https://datatracker.ietf.org/doc/draft-ietf-cose-dilithium/)). An `EC`, `OKP` or `RSA` key is refused as `unsupported`. |

A `jwk` that carries any private-key member — `d`, `p`, `q`, `dp`, `dq`, `qi`, `oth`, `k`, `priv`
or `seed`, with any value including `null` — is refused as `malformed`: the device has published
its key.

Claims, as the prover writes them:

```json
{"ath":"<b64url sha256(token)>","iat":1700000000,"jti":"<nonce>","rel":"<b64url sha256(peer leaf cert)>"}
```

| Claim | Value |
| --- | --- |
| `ath` | Base64url SHA-256 of the token bytes, 43 characters |
| `iat` | Issued-at, integer Unix seconds |
| `jti` | The single-use nonce. The provers make 128 random bits, 22 characters of base64url. Any non-empty string is accepted. |
| `rel` | Base64url SHA-256 of the receiving peer's TLS leaf certificate in DER, 43 characters; empty when the proof names no certificate |

Members other than these are ignored, and claims may come in any order.

### JSON

The header, the key inside it and the claims are each read as one JSON object, the same way in
every language, so that no two parsers can disagree about what a proof says. Each of these is
refused as `malformed`:

- Anything but one object: an array, `null`, or bytes after the object.
- Bytes that are not UTF-8, or a `\u` escape of half a surrogate pair.
- A member named twice in any object at any depth, including inside members the checker
  ignores. Names are compared after unescaping and byte for byte: `jti` and `j\u0074i` are the
  same name, and `jti` and `JTI` are different names.
- `null` for a member the checker reads (`alg`, `typ`, `jwk`; `kty`, `alg`, `pub`;
  `ath`, `iat`, `jti`, `rel`). Absent and `null` are not the same.
- An `iat` that is not an integer literal within 64 bits: `1.7e9`, `1700000000.0` and `-0` are
  refused. `serde_json` reads `-0` as a float, so no implementation reads it as an integer.
- A number too large for a double, such as `1e400`. One too small, such as `1e-400`, is
  accepted.
- Arrays and objects nested more than 127 deep, counting the outermost object.

Every string the checker compares is compared byte for byte after unescaping: `alg`, `typ`,
`kty`, member names, the thumbprint, `ath`, `rel`, and the nonce in the store. Two
spellings that Unicode treats as the same text, such as `é` as one code point and as `e` with a
combining accent, are different values. So a `kty` of `A\u212AP`, with a Kelvin sign, is not
`AKP` and is refused as `unsupported`, and a nonce is a replay only of a nonce with the same
bytes.

### Signatures

| | [ML-DSA-87](https://csrc.nist.gov/pubs/fips/204/final) |
| --- | --- |
| Standard | FIPS 204, pure mode, empty context, as [draft-ietf-cose-dilithium](https://datatracker.ietf.org/doc/draft-ietf-cose-dilithium/) specifies for JOSE |
| Signature | 4,627 bytes |
| Public key in the [JWK](https://www.rfc-editor.org/rfc/rfc7517) | 2,592 bytes |
| Public JWK | about 3.5 KB |
| Whole proof | about 11.1 KB |

Every checker refuses a proof longer than 16 KiB (`Checker.maximumProofBytes`,
`proof.MaxProofBytes`, `MAX_PROOF_BYTES`) before parsing it.

### Thumbprints

The token's `cnf.jkt` is the base64url SHA-256 of the key's canonical JSON: the required members
in lexicographic order, no whitespace, rebuilt from the decoded key so that a key has one
thumbprint however it was spelled.

| Key | Canonical form | Standard |
| --- | --- | --- |
| AKP [ML-DSA-87](https://csrc.nist.gov/pubs/fips/204/final) | `{"alg":"ML-DSA-87","kty":"AKP","pub":"…"}` | [draft-ietf-cose-dilithium](https://datatracker.ietf.org/doc/draft-ietf-cose-dilithium/), following [RFC 7638](https://www.rfc-editor.org/rfc/rfc7638) |

A key of the wrong size, spelled non-canonically, or of another algorithm has no thumbprint: it
is `malformed` or `unsupported`. Every classical key (`EC`, `OKP`, `RSA`) is `unsupported`. The thumbprint functions are `ProofJWK.thumbprint()`
in Swift, `JWK.Thumbprint()` in Go and `Jwk::thumbprint()` in Rust.

### Where proofs travel in MOQOM

- **MOQT.** The proof goes in the `AUTHORIZATION_PROOF` parameter (`0x4D51`, length-prefixed) of
  `CLIENT_SETUP`. The relay checks it against its own leaf certificate. Each in-session token
  renewal carries a new proof for the new token. The proof binds to the sealed token exactly as
  presented.
- **Direct paths.** On a [direct path](/guides/peer-to-peer/#the-handshake-step-by-step), each
  phone presents a relay-issued direct ticket instead of its token, with a proof over the ticket
  from the key the ticket names. The other phone checks it against its own certificate the same
  way.
- **Getting a token.** The device sends its public [JWK](https://www.rfc-editor.org/rfc/rfc7517) as `key`, and whoever mints derives `cnf.jkt`
  from it. See [Getting a token onto a device](/reference/device-tokens/).

A MOQT parameter value can be up to 65,535 bytes, so a `CLIENT_SETUP` with an [ML-DSA-87](https://csrc.nist.gov/pubs/fips/204/final) token
(at most 8 KiB) and an ML-DSA-87 proof fits with room to spare.

### Check order

A checker runs these checks in order and reports the first that fails. No claim is read before
the signature has verified and the key has matched `cnf.jkt`. The nonce is spent last, so a
corrupted copy of a genuine proof cannot burn its nonce. The thumbprint, `ath` and `rel` are
compared in constant time.

1. The proof is 1 byte to 16 KiB (`malformed`).
2. It has three segments, base64url, and a header that is JSON as above, its `jwk` included
   (`malformed`).
3. `typ` is `MOQT-POP` and `alg` is an accepted algorithm (`unsupported`).
4. The header has a `jwk` with no private member (`malformed`), whose key type matches `alg`
   (`unsupported`) and which is well formed (`malformed`).
5. The signature verifies under that key (`bad_signature`).
6. The key's thumbprint equals the token's `cnf.jkt` (`wrong_key`).
7. The claims are JSON as above (`malformed`).
8. `ath` matches the token (`wrong_token`).
9. The checker has a certificate if it requires one, and `rel` matches its certificate hash, or
   is empty when it has none (`wrong_certificate`).
10. `iat` is present (`malformed`) and within the window: too old is `expired`, too far ahead is
    `not_yet_valid`. The edges of the window are accepted.
11. `jti` is present (`malformed`) and is spent in the store until the later of `until` and
    one second past `iat` plus the window (`replayed`, `overloaded`).

## Errors

Every language reports the same classes, the ones the vectors name. Go's `proof.Class(err)`,
Swift's `error.errorClass` and Rust's `error.class()` give the class as a string.

| Class | Swift `ProofError` | Go | Rust `Error` | Meaning |
| --- | --- | --- | --- | --- |
| `malformed` | `.malformed(why)` | `ErrMalformed` | `Malformed(why)` | Not a well-formed proof or key, a claim is missing, or the prover was given an empty nonce |
| `unsupported` | `.unsupported` | `ErrUnsupported` | `Unsupported` | Wrong `typ`, an algorithm this checker does not accept, or an `alg` that is not the key's |
| `bad_signature` | `.badSignature` | `ErrBadSignature` | `BadSignature` | The signature does not verify under the key the proof carries |
| `wrong_key` | `.wrongKey` | `ErrWrongKey` | `WrongKey` | It verified, under a key the token was not issued to |
| `wrong_token` | `.wrongToken` | `ErrWrongToken` | `WrongToken` | It verified, and was made for a different token |
| `wrong_certificate` | `.wrongCertificate` | `ErrWrongCertificate` | `WrongCertificate` | It verified, and was made for another peer, or the checker requires a certificate and has none |
| `expired` | `.expired` | `ErrExpired` | `Expired` | `iat` is further in the past than the window |
| `not_yet_valid` | `.notYetValid` | `ErrNotYetValid` | `NotYetValid` | `iat` is further in the future than the window |
| `replayed` | `.replayed` | `ErrReplayed` | `Replayed` | The nonce has already been spent |
| `overloaded` | `.overloaded` | `ErrOverloaded` | `Overloaded` | The nonce store cannot remember another nonce. The proof is refused. |
| `signing` | `.notSigned` | `ErrSigning` | `Signing` | Proving only: the key refused to sign, or (Rust) the random source failed |
| `configuration` | `.configuration(why)` | `ErrConfiguration` | `Configuration(why)` | Making a checker or store: no store, no algorithms, or a window or capacity that is not positive |

In Go, compare with `errors.Is`. Errors carry detail after the sentinel (`proof is malformed:
header carries no key`), and `ErrSigning` wraps the signer's own error so `errors.Is` finds both.
`Class` returns `""` for nil and for an error the package did not produce. A `Checker` or
`MemoryNonceStore` declared as a zero value rather than made by its constructor refuses every
proof with `ErrConfiguration`. In Rust, `Error` is `#[non_exhaustive]`. Swift's `check` and `prove`
use typed throws, `throws(ProofError)`.

Every refusal should end the session or request the proof came with. None of them means "try the
same proof again": a device that is refused should make a new proof with a new nonce, and only
if the cause is something it can fix (its clock, or the certificate it bound to).

## Classical proofs are refused

Devices on SDKs released before October 2026 held P-256 keys and sent ES256 proofs. Those proofs
are no longer accepted anywhere: every checker refuses an ES256 proof as `unsupported`, and a
device with a P-256 key can make no prover at all. An ES256 proof is ECDSA, so it is classical: a
quantum computer that could solve P-256 discrete logarithms could forge one for that device's
key. Only [ML-DSA-87](https://csrc.nist.gov/pubs/fips/204/final) proofs are accepted, so device binding resists that attack too. See
[Post-quantum authentication](/security/post-quantum/).

## How it differs from DPoP

The proof has the shape of an [RFC 9449](https://www.rfc-editor.org/rfc/rfc9449) DPoP proof — a [JWS](https://www.rfc-editor.org/rfc/rfc7515) carrying its public key, a hash of the
token in `ath`, a time and a unique `jti` — adapted to a MoQ session rather than an HTTP request.
The differences:

- **Bound to the receiving peer's certificate, not a URL.** DPoP binds a proof to an HTTP method
  and URI (`htm`, `htu`). A proof for a URI is good at any server that answers for it, so
  anything that terminates TLS in front of that server (a load balancer, a CDN, or a machine in
  the middle with a certificate for the name) receives a proof it can present itself within the
  window. Here `rel` is the hash of the exact leaf
  certificate of the peer receiving the proof, so a proof captured by one relay, or by a machine
  in the middle presenting its own certificate, is refused at any other. There is no
  `htm`/`htu`; a MoQ session has neither.
- **Single use is required, not recommended.** RFC 9449 asks servers to limit how long they
  accept a proof and suggests tracking `jti` to detect replay. Here every checker needs a nonce
  store, and each nonce stays spent until the token expires, not only for the freshness window.
- **Always bound to the token.** The checker always takes the token and its `cnf.jkt`; there is
  no unbound mode in which a proof stands on its own.
- **Post-quantum only.** RFC 9449 leaves the algorithm open, and deployments mostly use
  ES256 or RS256. Here [ML-DSA-87](https://csrc.nist.gov/pubs/fips/204/final) is the only algorithm, and every classical one is refused.
- **Stricter parsing.** `alg` must match the key's type, base64url is strict, a key must be the
  exact size for its algorithm, the JSON is refused if it repeats a member name, and the proof
  is size-limited before it is parsed.

One thing DPoP has that this does not: a server-supplied nonce (`DPoP-Nonce`). Freshness here
rests on the device's clock being within the window, with replay closed by the nonce store
rather than by a challenge.

## Security considerations

- **The nonce store is per process.** `MemoryNonceStore` lives in memory. It is not shared
  between processes and forgets everything on restart. A proof captured and never delivered
  could be replayed after a restart, within its window and its token's lifetime. `rel` limits
  that to peers holding the certificate the proof was made for. If several processes share one
  certificate, a proof accepted by one can be accepted by another unless they share a store.
  Supply your own `NonceStore` over shared storage to close either gap.
- **`until` cannot shorten the window.** A nonce is remembered until the later of `until` and
  one second past the end of the proof's window, so passing an early `until` by mistake does not
  let the same proof in twice. Pass the token's expiry.
- **Checkers sharing a store should share a clock.** A store forgets a nonce once its time has
  passed by the clock of whichever checker asks. A checker whose clock runs ahead can sweep a
  nonce that one running behind would still accept a proof for, by as much as the clocks differ.
- **Verify the token separately.** The checker binds the proof to the token bytes and to
  `cnf.jkt`; it does not check the token's signature, issuer, expiry or grants.
- **Require the certificate where there is one.** A checker without a certificate accepts proofs
  that name none. In anything that terminates TLS, pass the certificate hash and turn on the
  required-certificate option, so that a misconfigured listener refuses every proof rather than
  accepting unbound ones.
- **Clocks.** The window is symmetric and fixed per checker, five minutes by default. A device
  whose clock is further off than that is refused as `expired` or `not_yet_valid`.
- **Key storage.** Secure Enclave keys cannot be exported. Software keys — Swift's
  `MLDSA87.PrivateKey`, a Go `*mldsa.PrivateKey`, a Rust PKCS#8 document — are only as safe as
  where you store their seed. The provers check nothing about where a key came from.
- **Randomness.** Proofs are signed with fresh randomness in every language: hedged [ML-DSA-87](https://csrc.nist.gov/pubs/fips/204/final).
  Go's `Prover.Deterministic()` returns a prover that signs with ML-DSA's deterministic variant
  instead. It exists to generate test vectors; both forms verify the same way.
- **A full store fails closed.** At capacity the memory store refuses new proofs rather than
  forgetting old ones. Watch `remembered` (`Remembered()` in Go) if you run a checker under heavy
  load.

## Test vectors

[`vectors/proof`](https://github.com/moqom-cloud/moqom-security/tree/main/vectors/proof) holds
the cases every language must pass. They are JSON, with bytes as lowercase hex and times as Unix
seconds.

| File | Cases | What it checks |
| --- | --- | --- |
| `keys.json` | 2 | [ML-DSA-87](https://csrc.nist.gov/pubs/fips/204/final) keys from seeds, with the public [JWK](https://www.rfc-editor.org/rfc/rfc7517) and thumbprint each must produce |
| `thumbprints.json` | 8 | An AKP thumbprint, and 7 keys that have none (`malformed` 1, `unsupported` 6), including every classical key: `EC`, `OKP` and `RSA` |
| `proofs.json` | 89 | Proofs to check against a token, a certificate hash, a thumbprint and a time, with some nonces already spent and some checkers requiring a certificate. 13 are valid and must then be refused as `replayed` on a second check. 76 must be refused: `malformed` 49 (many of them correctly signed proofs whose JSON breaks a rule above), `unsupported` 10 (ES256 proofs among them), `bad_signature` 4, `wrong_key` 2, `wrong_token` 2, `wrong_certificate` 6, `expired` 1, `not_yet_valid` 1, `replayed` 1. |

Each refused case must also leave the store as it was: a refused proof must not spend its
nonce. The window for `proofs.json` is 300 seconds.

Run them, and the examples on this page, from a checkout of the repository:

```sh
# Swift, from the repository root
swift test --filter MoqomProofTests

# Go
cd go && go test ./proof/...

# Rust
cd rust && cargo test -p moqom-proof
```

The vectors are generated by `go/proof/generate_test.go`, signing deterministically, and
regenerating them (`MOQOM_WRITE_VECTORS=1 go test ./proof` in `go/`) is a no-op unless the format
changes.

## Source

- Swift: [`Sources/MoqomProof`](https://github.com/moqom-cloud/moqom-security/tree/main/Sources/MoqomProof)
- Go: [`go/proof`](https://github.com/moqom-cloud/moqom-security/tree/main/go/proof), documented at [pkg.go.dev](https://pkg.go.dev/github.com/moqom-cloud/moqom-security/go/proof)
- Rust: [`rust/moqom-proof`](https://github.com/moqom-cloud/moqom-security/tree/main/rust/moqom-proof), documented at [docs.rs](https://docs.rs/moqom-proof)
- Design document: [`docs/moqom-proof.md`](https://github.com/moqom-cloud/moqom-security/blob/main/docs/moqom-proof.md)

Report a vulnerability as described in [Responsible disclosure](/security/disclosure/).
