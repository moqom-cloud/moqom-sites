---
title: moqom-mls
description: Room key agreement for MOQOM — a post-quantum subset of MLS (RFC 9420) with ML-KEM-1024 and ML-DSA-87 that produces each epoch's SFrame keys — in Swift, Go and Rust.
---

`moqom-mls` is how the devices in an end-to-end encrypted MOQOM room agree on a key. It
implements the part of [MLS](https://www.rfc-editor.org/rfc/rfc9420) ([RFC 9420](https://www.rfc-editor.org/rfc/rfc9420)) a room needs:
key packages, groups, commits that add and remove members, Welcomes for joiners, the exporter,
and the epoch authenticator. Each epoch it exports the [SFrame](https://www.rfc-editor.org/rfc/rfc9605) base key
([RFC 9605](https://www.rfc-editor.org/rfc/rfc9605) §5.2) that every member encrypts media
under. It can also seal an epoch's base key to a broadcast viewer who is not a member.

Every group is in **`MLS_256_MLKEM1024_AES256GCM_SHA512_MLDSA87`** (`0xF0AC`):
[ML-KEM-1024](https://csrc.nist.gov/pubs/fips/203/final) for every secret a commit or Welcome carries, and [ML-DSA-87](https://csrc.nist.gov/pubs/fips/204/final) for every signature.
It is the only suite. There is nothing to negotiate, and a key package, Welcome or group in any
other suite is refused.

`MoqomKit` uses it on every device in an encrypted room. You would use it directly to build
another MOQOM client, to check key packages and commits in a delivery service of your own, or to
review how room keys are made. If you only call MOQOM from an app or a backend, `MoqomKit` and
the backend SDKs already include it.

| | |
| --- | --- |
| Version | 0.1.0 |
| Swift | product `MoqomMLS`; iOS, macOS, visionOS and tvOS 26 or later |
| Go | package `github.com/moqom-cloud/moqom-security/go/mls`; Go 1.27 or later |
| Rust | crate `moqom-mls`; Rust 1.97 or later |
| License | Apache-2.0 |
| Source | [github.com/moqom-cloud/moqom-security](https://github.com/moqom-cloud/moqom-security) |

All three languages implement a full group member: generating and
verifying key packages, founding a group, committing, joining from a Welcome, processing other
members' commits, exporting, and sealing and opening audience envelopes. They produce the same
bytes and pass the same vectors.

This is not a general MLS implementation and does not interoperate with one. Members are a flat
list rather than a ratchet tree, and messages use MOQOM's own framing; see
[What is and isn't RFC 9420](#what-is-and-isnt-rfc-9420). Ordering commits, and deciding which
device may join under which identity, belong to the delivery service, which in MOQOM is the
control plane. Encrypting media under the exported key is
[`moqom-sframe`](/security/libraries/sframe/)'s job.

## Install

**Swift**, in `Package.swift`:

```swift
dependencies: [
    .package(url: "https://github.com/moqom-cloud/moqom-security", from: "0.1.0"),
],
targets: [
    .target(name: "MyApp", dependencies: [
        .product(name: "MoqomMLS", package: "moqom-security"),
    ]),
]
```

`MoqomMLS` depends on `MoqomSFrame`, which it uses for [SFrame](https://www.rfc-editor.org/rfc/rfc9605) key IDs and keys.

**Go**:

```sh
go get github.com/moqom-cloud/moqom-security/go@v0.1.0
```

```go
import "github.com/moqom-cloud/moqom-security/go/mls"
```

**Rust**:

```sh
cargo add moqom-mls
```

The Rust crate uses AWS-LC through `aws-lc-rs` and `aws-lc-sys`, which need a C compiler to
build.

## A group, from key package to SFrame key

The examples below are compiled and run by each language's test suite. Alice and Bob each
generate a key package in the founding suite. Alice reads Bob's published package, founds a
group and commits to add him. Bob joins from the Welcome. Alice then makes an empty commit,
which refreshes her leaf key, and Bob processes it. Both end at epoch 2 with the same epoch
authenticator and the same [SFrame](https://www.rfc-editor.org/rfc/rfc9605) base key.

The messages pass through their encoded form, as they would through a delivery service. A
committer adopts `next` from its pending commit only once the delivery service has accepted the
commit. The Swift examples are Swift Testing tests, so they check results with `#expect` and
`#require`; the Go examples print what `go test` compares against their `Output:` comments.

### Swift

```swift
import Foundation
import MoqomMLS
import MoqomSFrame

let room = Data("acme/room-42".utf8)
let alice = try MLSKeyPackageBundle.generate(identity: "alice/phone")
let bob = try MLSKeyPackageBundle.generate(identity: "bob/laptop")

// Alice reads Bob's published key package and commits to add him.
let bobPackage = try MLSKeyPackage.decode(bob.keyPackage.encoded)
try bobPackage.verify()
var aliceGroup = try MLSGroup.create(groupID: room, bundle: alice)
let add = try aliceGroup.commit(adding: [bobPackage])
aliceGroup = add.next // once the delivery service accepts add.message

// Bob joins from the Welcome.
let welcome = try MLSWelcome.decode(try #require(add.welcome).encoded)
var bobGroup = try MLSGroup.join(welcome, bundle: bob)

// An empty commit refreshes Alice's leaf key; Bob follows it.
let update = try aliceGroup.commit()
aliceGroup = update.next
guard case let .advanced(next) = try bobGroup.process(MLSCommitMessage.decode(update.message.encoded)) else {
    Issue.record("Bob was removed")
    return
}
bobGroup = next

#expect(aliceGroup.epoch == 2 && bobGroup.epoch == 2)
#expect(aliceGroup.epochAuthenticator == bobGroup.epochAuthenticator)
#expect(aliceGroup.sframeBaseKey(suite: .aes256GcmSha512)
    == (try bobGroup.exporter(label: "SFrame 1.0 Base Key", length: 32)))

// Alice sends under her own KID; Bob holds every member's key.
let sender = SFrameSender(key: aliceGroup.sframeKey(for: aliceGroup.ownLeaf, suite: .aes256GcmSha512))
let receiver = SFrameReceiver()
for key in bobGroup.sframeKeys(suite: .aes256GcmSha512) { receiver.add(key) }
let track = SFrameTrack(namespace: ["moqom", "demo", "alice"], name: "video")
let metadata = SFrameMetadata(track: track, group: 0, object: 0, priority: 128)
let object = try sender.protect(Data("hello".utf8), metadata: metadata)
#expect(try receiver.unprotect(object, metadata: metadata) == Data("hello".utf8))
```

`MLSKeyPackageBundle.generate` uses the founding suite unless given `cipherSuite:`.
`commit(adding:removing:)` defaults both lists to empty. Swift alone has the [SFrame](https://www.rfc-editor.org/rfc/rfc9605) helpers
`sframeBaseKey(suite:)`, `sframeKey(for:suite:)`, `sframeKeys(suite:)` and `MLSSFrameKeys`,
which return `MoqomSFrame` keys with the KID already computed. They do not throw: an SFrame
key is 16 or 32 bytes, far inside the exporter's limit. Each media object is then sealed with
`protect(_:metadata:)`, whose `SFrameMetadata` names the object's track, group, object ID and
priority, so an object moved to another track does not open.

### Go

```go
import (
	"bytes"
	"fmt"
	"log"

	"github.com/moqom-cloud/moqom-security/go/mls"
)

room := []byte("acme/room-42")
alice, err := mls.GenerateKeyPackage("alice/phone", mls.FoundingSuite)
if err != nil {
	log.Fatal(err)
}
bob, err := mls.GenerateKeyPackage("bob/laptop", mls.FoundingSuite)
if err != nil {
	log.Fatal(err)
}

// Alice reads Bob's published key package and commits to add him.
bobPackage, err := mls.ParseKeyPackage(bob.KeyPackage.Encode())
if err != nil {
	log.Fatal(err)
}
aliceGroup, err := mls.CreateGroup(room, alice)
if err != nil {
	log.Fatal(err)
}
add, err := aliceGroup.Commit([]*mls.KeyPackage{bobPackage}, nil)
if err != nil {
	log.Fatal(err)
}
aliceGroup = add.Next // once the delivery service accepts add.Message

// Bob joins from the Welcome.
welcome, err := mls.DecodeWelcome(add.Welcome.Encode())
if err != nil {
	log.Fatal(err)
}
bobGroup, err := mls.Join(welcome, bob)
if err != nil {
	log.Fatal(err)
}

// An empty commit refreshes Alice's leaf key; Bob follows it.
update, err := aliceGroup.Commit(nil, nil)
if err != nil {
	log.Fatal(err)
}
aliceGroup = update.Next
message, err := mls.DecodeCommitMessage(update.Message.Encode())
if err != nil {
	log.Fatal(err)
}
bobGroup, _, err = bobGroup.Process(message)
if err != nil {
	log.Fatal(err)
}

aliceBase, err := aliceGroup.Exporter(mls.SFrameExporterLabel, nil, 32)
if err != nil {
	log.Fatal(err)
}
bobBase, err := bobGroup.Exporter(mls.SFrameExporterLabel, nil, 32)
if err != nil {
	log.Fatal(err)
}
fmt.Println("epoch:", aliceGroup.Epoch(), bobGroup.Epoch())
fmt.Println("leaves:", aliceGroup.OwnLeaf(), bobGroup.OwnLeaf())
fmt.Println("same authenticator:", bytes.Equal(aliceGroup.EpochAuthenticator(), bobGroup.EpochAuthenticator()))
fmt.Println("same SFrame base key:", bytes.Equal(aliceBase, bobBase))
// Output:
// epoch: 2 2
// leaves: 0 1
// same authenticator: true
// same SFrame base key: true
```

### Rust

```rust
use moqom_mls::{
    CipherSuite, CommitMessage, Group, KeyPackage, KeyPackageBundle, Processed,
    SFRAME_EXPORTER_LABEL, Welcome,
};

let room = b"acme/room-42";
let alice = KeyPackageBundle::generate("alice/phone", CipherSuite::FOUNDING)?;
let bob = KeyPackageBundle::generate("bob/laptop", CipherSuite::FOUNDING)?;

// Alice reads Bob's published key package and commits to add him.
let bob_package = KeyPackage::parse(&bob.key_package.encode())?;
let alice_group = Group::create(room, &alice)?;
let add = alice_group.commit(&[bob_package], &[])?;
let alice_group = add.next; // once the delivery service accepts add.message

// Bob joins from the Welcome.
let welcome = Welcome::decode(&add.welcome.expect("Bob was added").encode())?;
let bob_group = Group::join(&welcome, &bob)?;

// An empty commit refreshes Alice's leaf key; Bob follows it.
let update = alice_group.commit(&[], &[])?;
let alice_group = update.next;
let message = CommitMessage::decode(&update.message.encode())?;
let Processed::Advanced(bob_group) = bob_group.process(&message)? else {
    panic!("Bob was removed");
};

assert_eq!((alice_group.epoch(), bob_group.epoch()), (2, 2));
assert_eq!(alice_group.epoch_authenticator(), bob_group.epoch_authenticator());
let base = alice_group.exporter(SFRAME_EXPORTER_LABEL, &[], 32)?;
assert_eq!(base, bob_group.exporter(SFRAME_EXPORTER_LABEL, &[], 32)?);
```

In Go and Rust the [SFrame](https://www.rfc-editor.org/rfc/rfc9605) base key comes from the exporter, as above. Each member's KID is
`(leaf << 4) | (epoch % 16)`, and `moqom-sframe` derives the key from the base key and the KID.

## Checking key packages, and removal

A delivery service checks a key package before accepting it: `ParseKeyPackage` in Go,
`KeyPackage::parse` in Rust, and `MLSKeyPackage.decode` followed by `verify()` in Swift. A
member removed by a commit learns it from processing that commit, and can follow the group no
further.

### Swift

```swift
let alice = try MLSKeyPackageBundle.generate(identity: "alice/phone")
let bob = try MLSKeyPackageBundle.generate(identity: "bob/laptop")
let aliceGroup = try MLSGroup.create(groupID: Data("acme/room-42".utf8), bundle: alice)
let add = try aliceGroup.commit(adding: [bob.keyPackage])
let bobGroup = try MLSGroup.join(try #require(add.welcome), bundle: bob)

let leaf = try #require(add.next.leaf(of: "bob/laptop"))
let removal = try add.next.commit(removing: [leaf])
guard case .removed = try bobGroup.process(removal.message) else {
    Issue.record("Bob followed his own removal")
    return
}
```

### Go

```go
bundle, err := mls.GenerateKeyPackage("bob/laptop", mls.FoundingSuite)
if err != nil {
	log.Fatal(err)
}
data := bundle.KeyPackage.Encode()

k, err := mls.ParseKeyPackage(data)
if err != nil {
	log.Fatal(err)
}
fmt.Println(string(k.Identity), k.CipherSuite)

data[len(data)-1] ^= 1
_, err = mls.ParseKeyPackage(data)
fmt.Println(errors.Is(err, mls.ErrBadSignature))
// Output:
// bob/laptop MLS_256_MLKEM1024_AES256GCM_SHA512_MLDSA87 (0xf0ac)
// true
```

```go
alice, err := mls.GenerateKeyPackage("alice/phone", mls.FoundingSuite)
if err != nil {
	log.Fatal(err)
}
bob, err := mls.GenerateKeyPackage("bob/laptop", mls.FoundingSuite)
if err != nil {
	log.Fatal(err)
}
aliceGroup, err := mls.CreateGroup([]byte("acme/room-42"), alice)
if err != nil {
	log.Fatal(err)
}
add, err := aliceGroup.Commit([]*mls.KeyPackage{bob.KeyPackage}, nil)
if err != nil {
	log.Fatal(err)
}
bobGroup, err := mls.Join(add.Welcome, bob)
if err != nil {
	log.Fatal(err)
}

leaf, _ := add.Next.LeafOf("bob/laptop")
remove, err := add.Next.Commit(nil, []uint32{leaf})
if err != nil {
	log.Fatal(err)
}
_, removed, err := bobGroup.Process(remove.Message)
fmt.Println("removed:", removed, err)
// Output:
// removed: true <nil>
```

### Rust

```rust
use moqom_mls::{CipherSuite, Error, Group, KeyPackage, KeyPackageBundle, Processed};

let alice = KeyPackageBundle::generate("alice/phone", CipherSuite::FOUNDING)?;
let bob = KeyPackageBundle::generate("bob/laptop", CipherSuite::FOUNDING)?;

let mut data = bob.key_package.encode();
*data.last_mut().unwrap() ^= 1;
assert_eq!(KeyPackage::parse(&data), Err(Error::BadSignature("key package")));

let add = Group::create(b"acme/room-42", &alice)?.commit(&[bob.key_package.clone()], &[])?;
let bob_group = Group::join(add.welcome.as_ref().expect("Bob was added"), &bob)?;
let leaf = add.next.leaf_of("bob/laptop").expect("Bob is a member");
let removal = add.next.commit(&[], &[leaf])?;
assert!(matches!(bob_group.process(&removal.message)?, Processed::Removed));
```

## Broadcast viewers

A viewer in a large broadcast is not a member of the group. It makes an [ML-KEM-1024](https://csrc.nist.gov/pubs/fips/203/final) key pair
and gives the public half to the room's committer, which seals each epoch's [SFrame](https://www.rfc-editor.org/rfc/rfc9605) base key to
it. The envelope opens only for the group and epoch it was sealed for. From the base key and the
KID in each frame, the viewer derives any publisher's SFrame key exactly as a member does.
Getting envelopes to viewers is the application's job.

### Swift

```swift
let groupID = Data("acme/room-42".utf8)
let base = Data(count: 32) // from group.sframeBaseKey(suite: .aes256GcmSha512)

let viewer = try MLSAudience.generateKeyPair()
let envelope = try MLSAudience.seal(base, to: viewer.publicKey, groupID: groupID, epoch: 7)

#expect(try MLSAudience.open(envelope, privateKey: viewer.privateKey, groupID: groupID, epoch: 7) == base)
#expect(throws: MLSError.decryptionFailed) {
    try MLSAudience.open(envelope, privateKey: viewer.privateKey, groupID: groupID, epoch: 8)
}
```

### Go

```go
groupID := []byte("acme/room-42")
base := make([]byte, 32) // from Group.Exporter(SFrameExporterLabel, nil, 32)

private, public, err := mls.GenerateAudienceKeyPair()
if err != nil {
	log.Fatal(err)
}
envelope, err := mls.SealAudience(base, public, groupID, 7)
if err != nil {
	log.Fatal(err)
}

opened, err := mls.OpenAudience(envelope, private, groupID, 7)
fmt.Println(bytes.Equal(opened, base), err)
_, err = mls.OpenAudience(envelope, private, groupID, 8)
fmt.Println(errors.Is(err, mls.ErrDecryptionFailed))
// Output:
// true <nil>
// true
```

### Rust

```rust
use moqom_mls::{Error, audience};

let group_id = b"acme/room-42";
let base = [0u8; 32]; // from group.exporter(SFRAME_EXPORTER_LABEL, &[], 32)

let (private, public) = audience::generate_key_pair()?;
let envelope = audience::seal(&base, &public, group_id, 7)?;

assert_eq!(audience::open(&envelope, &private, group_id, 7)?, base);
assert_eq!(audience::open(&envelope, &private, group_id, 8), Err(Error::DecryptionFailed));
```

## API

The three languages have the same shape. A key package bundle holds a key package and its
three private keys. A group value is one member's view of one epoch, and is never changed in
place: `commit` returns a pending commit whose `next` is the following epoch, and `process`
returns the following epoch or reports that this member was removed. Swift names keep the `MLS`
prefix so they cannot collide with SwiftUI's `Group`.

| | Swift | Go | Rust |
| --- | --- | --- | --- |
| Make a key package | `MLSKeyPackageBundle.generate(identity:cipherSuite:)` | `GenerateKeyPackage(identity, suite)` | `KeyPackageBundle::generate(identity, suite)` |
| Read a key package | `MLSKeyPackage.decode(_:)` | `DecodeKeyPackage(data)` | `KeyPackage::decode(&data)` |
| Check a key package | `MLSKeyPackage.verify()`, `.isValid` | `KeyPackage.Verify()` | `KeyPackage::verify()` |
| Read and check | — | `ParseKeyPackage(data)` | `KeyPackage::parse(&data)` |
| Encode a key package | `MLSKeyPackage.encoded` | `KeyPackage.Encode()` | `KeyPackage::encode()` |
| KeyPackageRef | `MLSKeyPackage.reference` | `KeyPackage.Reference()` | `KeyPackage::reference()` |
| Store and restore a bundle | `MLSKeyPackageBundle.privateKeys`, `MLSKeyPackageBundle(keyPackage:initPrivate:encryptionPrivate:signaturePrivate:)` | `KeyPackageBundle.PrivateKeys()`, `NewKeyPackageBundle(...)` | `KeyPackageBundle::private_keys()`, `KeyPackageBundle::new(...)` |
| Found a group | `MLSGroup.create(groupID:bundle:)` | `CreateGroup(id, bundle)` | `Group::create(&id, &bundle)` |
| Add, remove, or update | `MLSGroup.commit(adding:removing:)` | `Group.Commit(adding, removing)` | `Group::commit(&adding, &removing)` |
| Join | `MLSGroup.join(_:bundle:)` | `Join(welcome, bundle)` | `Group::join(&welcome, &bundle)` |
| Follow a commit | `MLSGroup.process(_:)` → `.advanced(group)` or `.removed` | `Group.Process(m)` → `next, removed, err` | `Group::process(&m)` → `Processed::Advanced` or `Processed::Removed` |
| Exporter | `MLSGroup.exporter(label:context:length:)` (throws) | `Group.Exporter(label, context, length)` → `out, err` | `Group::exporter(label, context, length)` → `Result` |
| Error class | `MLSError.errorClass` | `Class(err)` | `Error::class()` |
| Epoch authenticator | `MLSGroup.epochAuthenticator` | `Group.EpochAuthenticator()` | `Group::epoch_authenticator()` |
| Members | `MLSGroup.roster`, `.memberCount`, `.leaf(of:)` | `Group.Members()`, `Group.LeafOf(id)` | `Group::members()`, `Group::leaf_of(id)` |
| Group state | `.groupID`, `.epoch`, `.ownLeaf`, `.cipherSuite` | `GroupID()`, `Epoch()`, `OwnLeaf()`, `CipherSuite()` | `group_id()`, `epoch()`, `own_leaf()`, `cipher_suite()` |
| Messages | `MLSCommitMessage`, `MLSWelcome`: `.decode(_:)`, `.encoded` | `DecodeCommitMessage`, `DecodeWelcome`, `.Encode()` | `CommitMessage`, `Welcome`: `::decode`, `::encode` |
| Is a Welcome for me | `MLSWelcome.isAddressed(to:)` | `Welcome.IsAddressedTo(k)` | `Welcome::is_addressed_to(&k)` |
| Viewer key pair | `MLSAudience.generateKeyPair()` | `GenerateAudienceKeyPair()` | `audience::generate_key_pair()` |
| Seal and open for a viewer | `MLSAudience.seal(_:to:groupID:epoch:)`, `.open(_:privateKey:groupID:epoch:)` | `SealAudience(...)`, `OpenAudience(...)` | `audience::seal(...)`, `audience::open(...)` |
| [SFrame](https://www.rfc-editor.org/rfc/rfc9605) exporter label | `SFrameKeyID.mlsExporterLabel`, in `MoqomSFrame` | `SFrameExporterLabel` | `SFRAME_EXPORTER_LABEL` |
| SFrame keys | `sframeBaseKey(suite:)`, `sframeKey(for:suite:)`, `sframeKeys(suite:)`, `MLSSFrameKeys` | — | — |
| Suite | `MLSCipherSuite.mls256MLKEM1024MLDSA87` (`.default`) | `SuiteMLDSA` (`FoundingSuite`) | `CipherSuite::MLDSA` (`FOUNDING`) |

A delivery service can read a commit's group ID, epoch and sender from the decoded
`CommitMessage` without holding the group, which is all it needs to accept the first commit for
each epoch. The signature, sealed secrets and confirmation tag are checked by `process`.

The [RFC 9420](https://www.rfc-editor.org/rfc/rfc9420) primitives are methods on the suite in every language: `expandWithLabel` /
`ExpandWithLabel` / `expand_with_label`, then `deriveSecret`, `refHash`, `signWithLabel`,
`verifyWithLabel`, `encryptWithLabel` and `decryptWithLabel`, the key pair generators, and the
suite's lengths. The key schedule is `MLSGroupContext` and `MLSEpochSecrets` in Swift,
`GroupContext`, `DeriveEpochSecrets` and `EpochSecrets` in Go, and `GroupContext` and
`EpochSecrets` in Rust.

The length asked of the exporter or of `expandWithLabel` / `ExpandWithLabel` /
`expand_with_label` must be at most 255 times the suite's hash length, HKDF-Expand's limit:
16,320 bytes with `0xF0AC`'s SHA-512. A longer request, or in Swift and Go a
negative one, fails with the `invalid-length` error class in every language: Swift's
`expandWithLabel` throws, Go's `ExpandWithLabel` returns an error, and Rust's
`expand_with_label` returns a `Result`. `deriveSecret` always expands to the hash length, so it
cannot fail.

A key package bundle can be stored and restored: read its three private keys with
`privateKeys` / `PrivateKeys()` / `private_keys()`, store them with the encoded key package,
and rebuild the bundle from both with the Swift initializer, `NewKeyPackageBundle` or
`KeyPackageBundle::new`. Nothing checks that the keys match the package; a mismatch shows up
later, as a Welcome or commit that does not open or a signature that does not verify. The
private keys are secrets and need the same protection as the device's other keys.

## Specification

### Cipher suite

| Value | Name | [HPKE](https://www.rfc-editor.org/rfc/rfc9180) KEM | KDF and AEAD | Signature |
| --- | --- | --- | --- | --- |
| `0xF0AC` | `MLS_256_MLKEM1024_AES256GCM_SHA512_MLDSA87` | `0x0042`, [ML-KEM-1024](https://csrc.nist.gov/pubs/fips/203/final) | HKDF-SHA512, AES-256-GCM | [ML-DSA-87](https://csrc.nist.gov/pubs/fips/204/final) |

There is one suite, and every group is in it. The suite is in the GroupContext, so every
signature and every derived secret is bound to it. A key package, Welcome or group in any other
suite is refused as `unsupported`, never negotiated down to: that includes
[RFC 9420](https://www.rfc-editor.org/rfc/rfc9420)'s mandatory-to-implement `0x0001`, the draft's other suites, and MOQOM's earlier
`0xF0AA` and `0xF0AB`.

Every part of the suite is NIST security category 5: ML-KEM-1024, ML-DSA-87, AES-256 and
SHA-512. It is the category-5 suite of
[draft-ietf-mls-pq-ciphersuites](https://datatracker.ietf.org/doc/draft-ietf-mls-pq-ciphersuites/), which has no IANA value yet,
so `0xF0AC` is a value from RFC 9420's private-use range (§17.1), standing in until IANA assigns
one. Other MLS implementations will not recognise it.

### HPKE

`EncryptWithLabel` is [RFC 9180](https://www.rfc-editor.org/rfc/rfc9180) HPKE in base mode, single-shot, with empty AAD, under
KEM `0x0042` (pure ML-KEM-1024), HKDF-SHA512 and AES-256-GCM. The KEM's shared secret is
ML-KEM-1024's own 32 bytes, as [draft-ietf-hpke-pq](https://datatracker.ietf.org/doc/draft-ietf-hpke-pq/) defines, and `enc` is the 1,568-byte
ciphertext.

- **Swift.** CryptoKit's HPKE does not offer pure ML-KEM-1024, so `moqom-mls` composes
  RFC 9180's key schedule from CryptoKit's `MLKEM1024`, HKDF-SHA512 and AES-256-GCM.
- **Go.** `crypto/hpke` (`hpke.MLKEM1024()`) and `crypto/mlkem`.
- **Rust.** RFC 9180 composed over AWS-LC's ML-KEM-1024, through aws-lc-rs.

The compositions in Swift and Rust are held to Go's `crypto/hpke` by shared test vectors.

ML-DSA-87 is pure ML-DSA ([FIPS 204](https://csrc.nist.gov/pubs/fips/204/final)) with an empty context.

Private keys are kept in RFC 9180's `SerializePrivateKey` form: ML-KEM-1024's 64-byte
decapsulation seed `d || z`. Signature private keys are FIPS 204's 32-byte seed ξ.

### Encoding

Everything is [RFC 9420](https://www.rfc-editor.org/rfc/rfc9420) §2.1's TLS presentation language: big-endian integers, and `vector`
meaning the bytes preceded by a §2.1.2 variable-length size. A size that is not in its shortest
form is refused, as are trailing bytes.

```
KeyPackage       = uint16 version(1) || uint16 suite || vector identity
                   || vector signature_key || vector init_key
                   || vector encryption_key || vector signature
KeyPackageRef    = RefHash("MLS 1.0 KeyPackage Reference", KeyPackage)

GroupContext     = RFC 9420 §8.1, extensions always empty,
                   tree_hash = RefHash("MOQOM 1.0 Member List", Members)
Members          = uint32 count || count × (uint8 0 | uint8 1 || Leaf)
Leaf             = vector identity || vector signature_key || vector encryption_key

CommitMessage    = FramedContent || vector signature || vector confirmation_tag
FramedContent    = vector group_id || uint64 epoch || uint32 sender || vector Commit
Commit           = uint32 n || n × Proposal || vector committer_encryption_key
                   || uint32 m || m × (uint32 leaf || HPKECiphertext)
Proposal         = uint16 1 || vector KeyPackage        (Add)
                 | uint16 3 || uint32 leaf              (Remove)
HPKECiphertext   = vector kem_output || vector ciphertext

Welcome          = uint32 n || n × (vector KeyPackageRef || HPKECiphertext)
                   || vector encrypted_group_info
GroupInfo        = GroupContext || Members || vector confirmation_tag
                   || uint32 signer || vector signature
AudienceEnvelope = HPKECiphertext
```

The identity is the MOQOM identity, `username/device`, as UTF-8. A member is identified by its
leaf index, and an empty leaf is a removed member. A decoder refuses more than 65,536 members
or sealed secrets, and more than 4,096 proposals in one commit.

### Signatures and sealed secrets

`SignWithLabel`, `EncryptWithLabel` and `ExpandWithLabel` are [RFC 9420](https://www.rfc-editor.org/rfc/rfc9420) §5.1's, so every label
below is prefixed with `MLS 1.0 ` on the wire.

| What | How |
| --- | --- |
| Key package | `SignWithLabel(sk, "KeyPackageTBS", KeyPackage without signature)` |
| Commit | `SignWithLabel(sk, "FramedContentTBS", GroupContext(epoch n) \|\| FramedContent)` |
| GroupInfo | `SignWithLabel(sk, "GroupInfoTBS", GroupInfo without signature)` |
| Commit secret, to each remaining member | `EncryptWithLabel(leaf_key, "UpdatePathNode", GroupContext(epoch n+1, new tree hash, confirmed hash of epoch n), commit_secret)` |
| Joiner secret, to each joiner | `EncryptWithLabel(init_key, "Welcome", encrypted_group_info, joiner_secret)` |
| GroupInfo encryption | AEAD with `key = ExpandWithLabel(welcome_secret, "key", "", Nk)`, `nonce = ExpandWithLabel(welcome_secret, "nonce", "", 12)`, empty AAD |
| Audience envelope | `EncryptWithLabel(viewer_key, "MOQOM audience key", vector(group_id) \|\| uint64(epoch), base_key)` |

Verifying a key package checks the signature key's length, that the init key and the
encryption key are [ML-KEM-1024](https://csrc.nist.gov/pubs/fips/203/final) encapsulation keys that FIPS 203's encapsulation-key check
accepts, that the two are different, and then the signature.

### Transcript and key schedule

The transcript hashes are [RFC 9420](https://www.rfc-editor.org/rfc/rfc9420) §8.2's, over this framing:

- `confirmed = Hash(interim || FramedContent || vector(signature))`
- `confirmation_tag = MAC(confirmation_key, confirmed)`
- `interim = Hash(confirmed || vector(confirmation_tag))`

The key schedule is RFC 9420 §8 unchanged. From the previous epoch's `init_secret` and the
commit's `commit_secret`:

- `joiner_secret = ExpandWithLabel(Extract(init_secret, commit_secret), "joiner", GroupContext, Nh)`
- `member = Extract(joiner_secret, psk_secret)`, with `psk_secret` all zeros
- `welcome_secret = DeriveSecret(member, "welcome")`
- `epoch_secret = ExpandWithLabel(member, "epoch", GroupContext, Nh)`
- From `epoch_secret`, by `DeriveSecret`: `"sender data"`, `"encryption"`, `"exporter"`,
  `"external"`, `"confirm"` (the confirmation key), `"membership"`, `"resumption"`,
  `"authentication"` (the epoch authenticator) and `"init"` (the next epoch's `init_secret`)

The exporter is RFC 9420 §8.5's:
`MLS-Exporter(label, context, length) = ExpandWithLabel(DeriveSecret(exporter_secret, label), "exported", Hash(context), length)`.

A new group's epoch 0 starts from random `init_secret` and `commit_secret`, with an empty
confirmed transcript hash and `confirmation_tag = MAC(confirmation_key, "")`.

### SFrame keys

An epoch's [SFrame](https://www.rfc-editor.org/rfc/rfc9605) base key is `MLS-Exporter("SFrame 1.0 Base Key", "", Nk)`, where Nk is the
SFrame suite's key length: 32 bytes for `AES_256_GCM_SHA512` (`0x0005`) and 16 for
`AES_128_GCM_SHA256` (`0x0004`). Every member shares the one base key. Each member sends under
its own KID, RFC 9605 §5.2's with context 0 and E = 4:

```
KID = (leaf << 4) | (epoch % 16)
```

SFrame puts the KID into the derivation of each key and salt, so members holding the same base
key still encrypt under different keys and nonces.

### Commits

A commit is checked in this order, so all three languages report the same error for the same
bytes: group, epoch, sender, signature, proposals, the commit secret sealed to this member, and
the confirmation tag. A committer cannot remove itself; a member that leaves is removed by one
that stays.

Every member applies a commit's proposals the same way:

1. Every Remove.
2. Each Add, in order, into the leftmost empty leaf, or appended.
3. Trailing empty leaves are trimmed.

The committer's leaf then takes the new encryption key carried in the commit. Leaf indices are
never sent, and every member derives the same list. A commit with no proposals is an Update: it
refreshes the committer's leaf key and mixes a fresh commit secret into the key schedule.

Joining from a Welcome opens the joiner secret with the init key, decrypts the GroupInfo, and
checks the GroupInfo signature, the member-list hash and the confirmation tag.

### Sizes

Key and message sizes in bytes, measured.

| | `0xF0AC` |
| --- | --- |
| ML-KEM-1024 encapsulation key (init and leaf keys) | 1,568 |
| ML-KEM-1024 ciphertext (`enc`) | 1,568 |
| ML-KEM-1024 decapsulation seed (private key) | 64 |
| ML-DSA-87 public key | 2,592 |
| ML-DSA-87 signature | 4,627 |
| ML-DSA-87 seed (private key) | 32 |
| Hash length (Nh) | 64 |
| Key package, for the 5-byte identity `bob/b` | 10,373 |
| Commit, for each member it is sealed to | about 1,657 |
| Welcome, for each member of the group | about 4,176 |
| Welcome for a group of 2 members | 14,948 |
| Welcome for a group of 10 | 48,342 |
| Welcome for a group of 50 | 215,342 |
| Welcome for a group of 800 | 3,347,292 |
| Update commit in an 800-member group | 1,329,446 |

Each identity adds its own length plus one byte, for identities under 64 bytes. A commit grows
by one sealed commit secret for each member other than the committer and the members it adds,
and a commit that adds a member also carries that member's key package. A Welcome grows by one
leaf for each member of the group. MOQOM's control plane accepts commits and Welcomes up to
3.5 MiB, which holds a Welcome for an 800-member group.

An audience envelope is about 1,620 bytes (1,619 for a 32-byte base key, 1,603 for a 16-byte
one). A viewer's public key is 1,568 bytes and its private key is a 64-byte seed.

### What is and isn't RFC 9420

Bit-exact with [RFC 9420](https://www.rfc-editor.org/rfc/rfc9420) and checked against the MLS working group's vectors:

- §2.1 encoding, including the §2.1.2 variable-length sizes.
- §5.1 `ExpandWithLabel`, `DeriveSecret`, `SignWithLabel` and `EncryptWithLabel`.
- §5.2 `RefHash` and `KeyPackageRef`.
- §8 key schedule, §8.1 GroupContext, §8.5 exporter and §8.7 epoch authenticator.

MOQOM's own, the same in all three languages:

- **No ratchet tree.** Members are a flat list. A commit seals its commit secret to every
  remaining member's leaf key, which is what TreeKEM reduces to when every parent node is
  blank. The GroupContext's `tree_hash` is a hash of the member list, not RFC 9420's tree hash.
  A commit's size and cost grow linearly with the group, which suits a room's publishers;
  broadcast viewers receive audience envelopes instead.
- **Own framing.** Commits travel as `CommitMessage`, not as RFC 9420's `MLSMessage` or
  `PublicMessage`. The key package has no LeafNode, capabilities, lifetime or extensions, and
  the Welcome and GroupInfo are simplified in the same way. Credentials are a bare identity.
- **Proposals.** Add and Remove only, carried by value inside the commit that applies them. An
  empty commit takes the place of an Update proposal.

Not implemented: proposals by reference and standalone proposals; Update, ReInit,
ExternalInit, PreSharedKey and GroupContextExtensions proposals; PrivateMessage and the secret
tree, since media is encrypted with [SFrame](https://www.rfc-editor.org/rfc/rfc9605) under the exporter; external commits
(`external_secret` is derived but unused); PSKs (`psk_secret` is always zero); resumption;
GroupContext extensions; and any cipher suite other than `0xF0AC`.

## Errors

Every failure is one of these classes. The class names are the ones the test vectors use, and
each language returns them by name: `MLSError.errorClass` in Swift, `mls.Class(err)` in Go and
`Error::class()` in Rust. To handle a particular failure, match the `MLSError` case in Swift,
test with `errors.Is` in Go (returned errors wrap these values and may add detail), and match
the `Error` variant in Rust.

| Class | Swift | Go | Rust | Meaning |
| --- | --- | --- | --- | --- |
| `malformed` | `.malformed` | `ErrMalformed` | `Malformed(reason)` | Does not decode: truncated, trailing bytes, a non-minimal length, a bad tag, too many members or proposals, or a committer encryption key of the wrong length |
| `unsupported` | `.unsupported` | `ErrUnsupported` | `Unsupported(reason)` | A protocol version, cipher suite, proposal type or GroupContext extension that is not implemented |
| `invalid-key-package` | `.invalidKeyPackage` | `ErrInvalidKeyPackage` | `InvalidKeyPackage(reason)` | A key of the wrong length, a KEM key [FIPS 203](https://csrc.nist.gov/pubs/fips/203/final) rejects, or the init key reused as the encryption key |
| `bad-signature` | `.badSignature` | `ErrBadSignature` | `BadSignature(what)` | A key package, commit or GroupInfo signature that does not verify |
| `confirmation-mismatch` | `.confirmationMismatch` | `ErrConfirmationMismatch` | `ConfirmationMismatch` | A confirmation tag or member-list hash that does not match what the epoch derives |
| `decryption-failed` | `.decryptionFailed` | `ErrDecryptionFailed` | `DecryptionFailed` | An [HPKE](https://www.rfc-editor.org/rfc/rfc9180) or AEAD ciphertext that does not open, including an audience envelope for another group or epoch |
| `wrong-epoch` | `.wrongEpoch(expected:got:)` | `ErrWrongEpoch` | `WrongEpoch { expected, got }` | A commit for an epoch other than the group's current one |
| `wrong-group` | `.wrongGroup` | `ErrWrongGroup` | `WrongGroup` | A commit for another group |
| `invalid-proposal` | `.invalidProposal` | `ErrInvalidProposal` | `InvalidProposal(reason)` | Removing an empty leaf or the committer, or adding an existing member (same identity, signature key or encryption key) |
| `unknown-sender` | `.unknownSender` | `ErrUnknownSender` | `UnknownSender(leaf)` | A commit from an empty leaf or from this member's own, or a GroupInfo signed by an empty leaf |
| `not-addressed` | `.notAddressed` | `ErrNotAddressed` | `NotAddressed` | A Welcome or commit that holds nothing for this member |
| `cipher-suite-mismatch` | `.cipherSuiteMismatch(group:other:)` | `ErrCipherSuiteMismatch` | `CipherSuiteMismatch { group, key_package }` | A key package or Welcome in a different suite from the group's |
| `crypto-failure` | `.cryptoFailure` | `ErrCryptoFailure` | `CryptoFailure` | The platform's cryptography refused an operation, such as key generation or a private key that is not one |
| `invalid-length` | `.invalidLength(length:maximum:)` | `ErrInvalidLength` | `InvalidLength { length, max }` | An exporter or ExpandWithLabel length past 255 times the suite's hash length, or, in Swift and Go, a negative one |

Being removed by a commit is an outcome, not an error: Swift returns `.removed`, Go returns
`removed == true` with a nil group, and Rust returns `Processed::Removed`. There is no
`removed` error class.

Rust's `reason` and `what` are fixed strings, such as `"init key reused as encryption key"` or
`"key package"`. Match on the variant, not on the string.

## Security considerations

- **Forward secrecy is dropping old groups.** Every transition returns a new group value and
  leaves the old one unchanged. Once a member lets go of an epoch's group, nothing in the
  library can derive that epoch's secrets again. A committer whose commit loses the race for its
  epoch discards the pending commit and keeps the group it had.
- **Removed members and joiners.** A commit seals its new commit secret to everyone but the
  members it removes, so they cannot derive that epoch or any later one. A Welcome carries only
  the new epoch's joiner secret, so a joiner cannot derive earlier epochs.
- **Healing after a compromise.** Every commit refreshes the committer's leaf key and mixes in
  a fresh commit secret. A compromise of the committer heals at its next commit, and a
  compromise of any member's epoch secrets heals at the next commit by anyone. A member's own
  leaf key changes only when that member commits, so a member rotates it with an empty commit.
- **Identity is the delivery service's.** The library proves that a commit or GroupInfo came
  from a member's signature key. It does not prove that the identity in a key package belongs
  to the person it names: the delivery service decides which device may publish a key package
  under which identity. In MOQOM the control plane accepts a key package only from a token
  whose user and device match it. Every member can see who is in the group, and two people who
  compare the epoch authenticator out of band know that neither is in a group with a member
  the other cannot see.
- **Ordering is the delivery service's.** Two members may commit in the same epoch. The
  delivery service accepts the first commit for each epoch and rejects the rest, and every
  member processes the accepted commits in order.
- **Secret wiping, in Rust.** [HPKE](https://www.rfc-editor.org/rfc/rfc9180)'s shared secrets, extracted keys and AEAD keys are wiped
  when dropped. `EpochSecrets`, `KeyPackageBundle` and `Group` wipe their secrets and private
  keys when dropped, which is why `EpochSecrets`' fields can be read or cloned but not moved
  out. The private keys returned by `generate_key_pair`, `generate_signature_key_pair` and
  `audience::generate_key_pair`, and the bytes the exporter returns, are plain `Vec<u8>`, so
  the caller wipes them. `Debug` output for `Group`, `PendingCommit`, `Processed` and
  `EpochSecrets` leaves out every secret and private key, so logging one does not leak the
  epoch. Swift and Go do not wipe secrets; they are released when no longer referenced.
- **One reviewed `unsafe` block, in Rust.** aws-lc-rs builds an [ML-KEM-1024](https://csrc.nist.gov/pubs/fips/203/final) decapsulation key
  only from the expanded 3,168-byte key, and has no safe way in from the 64-byte seed every
  language stores. `src/mlkem.rs` wraps the seed in [RFC 9935](https://www.rfc-editor.org/rfc/rfc9935)'s 86-byte PKCS#8 seed form and
  passes it to AWS-LC through `aws-lc-sys`: `EVP_parse_private_key` over a `CBS` (any unread
  byte is refused, and AWS-LC runs FIPS 203 KeyGen on the seed), then
  `EVP_PKEY_get_raw_private_key` and `EVP_PKEY_get_raw_public_key` into buffers of their exact
  lengths, then aws-lc-rs's safe `DecapsulationKey::new`. Every return value and length is
  checked, the `EVP_PKEY` is freed exactly once by a guard, the key never leaves the function,
  and the DER buffer and the expanded key are wiped. This is the crate's only `unsafe` code.
  The design document's
  [Unsafe code](https://github.com/moqom-cloud/moqom-security/blob/main/docs/moqom-mls.md#unsafe-code)
  section gives the full argument.
- **No primitive of its own.** Each language composes its platform's ML-KEM-1024, ML-DSA-87,
  HKDF, HMAC, SHA-2 and AES-GCM: CryptoKit in Swift, the standard library in Go, and AWS-LC
  through aws-lc-rs in Rust. The compositions written here, Swift's and Rust's HPKE over
  ML-KEM-1024, are held to Go's `crypto/hpke` by the vectors: each language opens ciphertexts
  the other two sealed.
- **Commit cost is linear.** A commit seals one secret per member, about 1.7 KB each, so a
  group is meant for a room's publishers. Viewers of a large broadcast receive audience
  envelopes, sealed with the same ML-KEM-1024 HPKE.

## Test vectors

All three implementations pass every applicable case in
[`vectors/mls`](https://github.com/moqom-cloud/moqom-security/tree/main/vectors/mls), including
the files the other two languages generated. Every case that follows a group carries the
member's private keys, so any implementation can replay it. A case that must fail names its
error class.

| File | Cases | From | What |
| --- | --- | --- | --- |
| `mlswg-crypto-basics.json` | 1 | [MLS](https://www.rfc-editor.org/rfc/rfc9420) working group | RefHash, ExpandWithLabel, DeriveSecret and DeriveTreeSecret for suite 5 |
| `mlswg-key-schedule.json` | 1 | MLS working group | Every epoch secret, the GroupContext and the exporter, for suite 5 |
| `mlswg-deserialization.json` | 14 | MLS working group | §2.1.2 variable-length headers, both directions |
| `mls-crypto.json` | 12 | Swift | Labelled primitives, with tampered signatures and ciphertexts and a short KEM output |
| `mls-crypto-go.json` | 4 | Go | [ML-DSA-87](https://csrc.nist.gov/pubs/fips/204/final) and [HPKE](https://www.rfc-editor.org/rfc/rfc9180) KEM `0x0042` from Go's standard library, with tampered cases |
| `mls-crypto-rust.json` | 4 | Rust | The same from aws-lc-rs and the crate's HPKE |
| `mls-key-schedule.json` | 1 | Swift | Four epochs: every secret, and the exporter |
| `mls-key-packages.json` | 15 | Swift | A valid package, and a bad signature, a changed identity, the package relabelled to `0x0001`, `0xF0A1`, `0xF0AA`, `0xF0AB` or an unknown suite (all refused), an unknown version, a trailing byte, truncation and bad init keys |
| `mls-group.json` | 4 (23 steps) | Swift | A member following a group through a Welcome and add, remove and empty commits, checking the epoch, leaf, members, epoch authenticator and exporter after each step; forged signatures and confirmation tags, another group, a replay, truncation, a Welcome for another package, a tampered Welcome, and removal |
| `mls-group-go.json` | 1 (5 steps) | Go | A group Go founded and committed to, followed the same way |
| `mls-audience.json` | 6 | Swift | An envelope that opens, and the same envelope for another epoch or group, tampered, with a trailing byte, and truncated |

Every MOQOM-generated case is in `0xF0AC`. No public MLS vectors exist for this suite, so its
HPKE and ML-DSA are held to Go's standard library by the cross-language files. The published MLS
vectors that apply are crypto-basics, key-schedule and deserialization. Suite 5's KDF fields
check `0xF0AC`'s SHA-512 key schedule; suite 5's P-521 signatures and HPKE are not implemented, and
`external_pub` is not checked because external commits are not implemented. The working group's
tree, TreeKEM, message, Welcome, transcript, secret-tree, message-protection, PSK and
passive-client vectors cannot apply, because this library has no ratchet tree, its own
framing, no PrivateMessage and no PSKs.

The MLS working group's files are copied, with a `name` added to each case, from
[github.com/mlswg/mls-implementations](https://github.com/mlswg/mls-implementations) at commit
`2034fe72e0c805a683ba76165660c834f2a8142a`. As the repository's
[NOTICE](https://github.com/moqom-cloud/moqom-security/blob/main/NOTICE) says, they are
Contributions to the IETF under BCP 78 and remain the property of their contributors.
`vectors/mls/published.py` fetches them at that commit, so running it again changes nothing.

Run the vectors, together with the examples on this page:

```sh
swift test --filter MoqomMLSTests     # in the repository root
cd go && go test ./mls/...
cd rust && cargo test -p moqom-mls
```

To regenerate the generated files after a format change:

```sh
MOQOM_MLS_GENERATE=1 swift test --filter MLSVectorGenerator          # the Swift files
cd go && MOQOM_MLS_GENERATE=1 go test ./mls -run TestGenerateVectors # the Go files
cd rust && MOQOM_MLS_GENERATE=1 cargo test -p moqom-mls --test generate  # the Rust file
python3 vectors/mls/published.py                                     # the published files
```

The Go files are fully deterministic, so regenerating them changes nothing. CryptoKit and
AWS-LC take no caller randomness, so the Swift and Rust files are recorded transcripts: their
inputs come from fixed seeds, but their signatures and ciphertexts change when regenerated.

## Source

- Swift: [`Sources/MoqomMLS`](https://github.com/moqom-cloud/moqom-security/tree/main/Sources/MoqomMLS)
- Go: [`go/mls`](https://github.com/moqom-cloud/moqom-security/tree/main/go/mls)
  ([pkg.go.dev](https://pkg.go.dev/github.com/moqom-cloud/moqom-security/go/mls))
- Rust: [`rust/moqom-mls`](https://github.com/moqom-cloud/moqom-security/tree/main/rust/moqom-mls)
  ([docs.rs](https://docs.rs/moqom-mls))
- Design: [`docs/moqom-mls.md`](https://github.com/moqom-cloud/moqom-security/blob/main/docs/moqom-mls.md)
- Vectors: [`vectors/mls`](https://github.com/moqom-cloud/moqom-security/tree/main/vectors/mls)
