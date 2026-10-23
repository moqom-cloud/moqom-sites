---
title: moqom-sframe
description: End-to-end encryption for MoQ objects with SFrame (RFC 9605), binding each object's full track name, group, object ID, priority and properties into the tag, in Swift, Go and Rust.
---

`moqom-sframe` seals and opens MoQ objects with [SFrame](https://www.rfc-editor.org/rfc/rfc9605) ([RFC 9605](https://www.rfc-editor.org/rfc/rfc9605)).
Each object's payload is encrypted with AES-GCM under a key that only the room's members hold.
The fields a relay needs to route and schedule the object (its full track name, group, object
ID, priority and object properties) stay in the clear and are bound into the authentication
tag. These are the fields
[draft-ietf-moq-secure-objects](https://datatracker.ietf.org/doc/draft-ietf-moq-secure-objects/)
authenticates, carried in RFC 9605's own framing rather than the draft's. A relay can read those
fields, forward, drop and reorder objects. It cannot read a payload, and if it changes any bound
field, or moves an object to another track, the object fails to open.

The library is the same in Swift (`MoqomSFrame`), Go
(`github.com/moqom-cloud/moqom-security/go/sframe`) and Rust (`moqom-sframe`), and all three
pass one shared set of test vectors, including the published RFC 9605 vectors.

You would use it directly to build a client that interoperates with MOQOM rooms, to inspect
what a relay can and cannot see, or to encrypt MoQ objects end to end in your own system.
`MoqomKit` already includes it, re-exports the module, and adds
`SFrameMetadata(_ object: TrackObject, on track: FullTrackName)`, so an app built on the SDK does
not call it itself.

| | |
| --- | --- |
| Version | 0.1.0 |
| Specification | RFC 9605; AAD binds the fields draft-ietf-moq-secure-objects authenticates |
| Cipher suites | `0x0004` AES-128-GCM-SHA256, `0x0005` AES-256-GCM-SHA512 (default) |
| Overhead | Header (1–17 bytes) plus a 16-byte tag |
| Replay window | 1,024 counters per KID by default, at most 65,536 |
| Cryptography | CryptoKit (Swift), the Go standard library, AWS-LC through `aws-lc-rs` (Rust) |
| License | Apache-2.0 |

## Install

**Swift** (Swift 6.2; iOS, macOS, tvOS and visionOS 26 or later):

```swift
// Package.swift
dependencies: [
    .package(url: "https://github.com/moqom-cloud/moqom-security", from: "0.1.0"),
],
targets: [
    .target(name: "App", dependencies: [
        .product(name: "MoqomSFrame", package: "moqom-security"),
    ]),
]
```

```swift
import MoqomSFrame
```

**Go** (Go 1.27 or later):

```sh
go get github.com/moqom-cloud/moqom-security/go@v0.1.0
```

```go
import "github.com/moqom-cloud/moqom-security/go/sframe"
```

**Rust** (Rust 1.97 or later, edition 2024):

```sh
cargo add moqom-sframe
```

```rust
use moqom_sframe::{CipherSuite, Context, Key, Metadata, Property, Receiver, Sender, Track};
```

## Examples

These examples are the ones in the repository, where each test suite compiles and runs them.
Each language shows the same two flows.

The first derives a key from a base key, seals one object with its MoQ metadata, and opens it.
Before the real open, it shows that a relabelled group, a move to another track and a flipped
bit all fail, and that none of the failures uses up the object's counter. Delivering the object a second time is then
refused as a replay. In a room the base key comes from the [MLS](https://www.rfc-editor.org/rfc/rfc9420) group (see
[Keys](#keys-and-kids)); here it is a fixed value.

The second shows the replay window. With the default window of 1,024, it seals counters 0 to
1,024 and delivers counter 1,024 first. Counter 1, which is 1,023 behind, still opens. Counter 0,
which is 1,024 behind, is refused, and so is counter 1 a second time.

### Swift

From `Tests/MoqomSFrameTests/ExamplesTests.swift`:

```swift
// In a room the base key is exported from the MLS group under
// SFrameKeyID.mlsExporterLabel. Both ends derive the same key from it.
let baseKey = Data(repeating: 0x2A, count: 32)
let key = try SFrameKey(keyID: SFrameKeyID.mls(leaf: 3, epoch: 14), baseKey: baseKey)
let sender = SFrameSender(key: key)
let receiver = SFrameReceiver()
receiver.add(key)

let track = SFrameTrack(namespace: ["moqom", "demo", "alice"], name: "video")
let metadata = SFrameMetadata(track: track, group: 5, object: 2, priority: 64, properties: [
    .integer(0x78, 1_000_000), // capture time
    .integer(0x7A, 1), // temporal layer
])
let object = try sender.protect(Data("frame".utf8), metadata: metadata)
#expect(object.prefix(2) == Data([0x80, 0x3E])) // KID 62, counter 0
#expect(object.count == 2 + 5 + 16)

// A relay that relabels the object's group, moves it to another track,
// or flips a bit, is caught.
var moved = metadata
moved.group = 6
#expect(throws: SFrameError.authenticationFailure) {
    try receiver.unprotect(object, metadata: moved)
}
moved = metadata
moved.track = SFrameTrack(namespace: ["moqom", "demo", "bob"], name: "video")
#expect(throws: SFrameError.authenticationFailure) {
    try receiver.unprotect(object, metadata: moved)
}
var damaged = object
damaged[damaged.endIndex - 1] ^= 0x01
#expect(throws: SFrameError.authenticationFailure) {
    try receiver.unprotect(damaged, metadata: metadata)
}

// Neither failure used up the counter, so the real object still opens.
#expect(try receiver.unprotect(object, metadata: metadata) == Data("frame".utf8))
#expect(throws: SFrameError.replay(counter: 0)) {
    try receiver.unprotect(object, metadata: metadata)
}
```

```swift
let context = try SFrameContext(
    suite: .aes128GcmSha256, keyID: 1, baseKey: Data(repeating: 0x2A, count: 16)
)
let track = SFrameTrack(namespace: ["moqom", "demo", "alice"], name: "audio")
let metadata = SFrameMetadata(track: track, group: 0, object: 0, priority: 128)
let objects = try (0 ... 1024).map { counter in
    try context.seal(Data([UInt8(truncatingIfNeeded: counter)]), metadata: metadata)
}

_ = try context.open(objects[1024], metadata: metadata)
_ = try context.open(objects[1], metadata: metadata) // 1,023 behind: accepted
#expect(throws: SFrameError.replay(counter: 0)) { // 1,024 behind: refused
    try context.open(objects[0], metadata: metadata)
}
#expect(throws: SFrameError.replay(counter: 1)) { // already seen
    try context.open(objects[1], metadata: metadata)
}
```

### Go

From `go/sframe/example_test.go`. `go test` checks the printed output against the `Output:`
comment.

```go
// A publisher seals one MoQ object and a subscriber opens it. Both derive the
// same key from the epoch's base key, which in a room is exported from the MLS
// group under sframe.MLSExporterLabel.
func Example() {
	baseKey := bytes.Repeat([]byte{0x2A}, 32)
	keyID := sframe.MLSKeyID(3, 14) // leaf 3, epoch 14

	key, err := sframe.NewKey(keyID, baseKey, sframe.AES256GCMSHA512)
	if err != nil {
		panic(err)
	}
	sender := sframe.NewSender(key)
	receiver := sframe.NewReceiver(sframe.DefaultReplayWindow)
	receiver.Add(key)

	metadata := sframe.Metadata{
		Track:    sframe.TrackOf([]string{"moqom", "demo", "alice"}, "video"),
		Group:    5,
		Object:   2,
		Priority: 64,
		Properties: []sframe.Property{
			sframe.IntegerProperty(0x78, 1_000_000), // capture time
			sframe.IntegerProperty(0x7A, 1),         // temporal layer
		},
	}
	object, err := sender.ProtectObject([]byte("frame"), metadata)
	if err != nil {
		panic(err)
	}
	fmt.Println("object:", len(object), "bytes, header", hex.EncodeToString(object[:2]))

	// A relay that relabels the object's group, moves it to another track, or
	// flips a bit, is caught.
	moved := metadata
	moved.Group = 6
	_, err = receiver.UnprotectObject(object, moved)
	fmt.Println("moved to group 6:", sframe.Class(err))

	moved = metadata
	moved.Track = sframe.TrackOf([]string{"moqom", "demo", "bob"}, "video")
	_, err = receiver.UnprotectObject(object, moved)
	fmt.Println("moved to bob's track:", sframe.Class(err))

	damaged := bytes.Clone(object)
	damaged[len(damaged)-1] ^= 0x01
	_, err = receiver.UnprotectObject(damaged, metadata)
	fmt.Println("one bit flipped:", sframe.Class(err))

	// Neither failure used up the counter, so the real object still opens.
	payload, err := receiver.UnprotectObject(object, metadata)
	fmt.Printf("opened: %q %v\n", payload, err)

	_, err = receiver.UnprotectObject(object, metadata)
	fmt.Println("delivered again:", sframe.Class(err))

	// Output:
	// object: 23 bytes, header 803e
	// moved to group 6: authentication_failure
	// moved to bob's track: authentication_failure
	// one bit flipped: authentication_failure
	// opened: "frame" <nil>
	// delivered again: replay
}
```

```go
// The replay window accepts objects that arrive out of order, up to 1,023
// counters behind the highest seen with the default window of 1,024.
func Example_replayWindow() {
	ctx, err := sframe.NewContext(sframe.AES128GCMSHA256, 1, bytes.Repeat([]byte{0x2A}, 16))
	if err != nil {
		panic(err)
	}
	metadata := sframe.Metadata{
		Track:    sframe.TrackOf([]string{"moqom", "demo", "alice"}, "audio"),
		Priority: 128,
	}

	objects := make([][]byte, 1025) // counters 0 to 1024
	for i := range objects {
		objects[i], err = ctx.Seal([]byte{byte(i)}, metadata)
		if err != nil {
			panic(err)
		}
	}

	for _, counter := range []int{1024, 1, 0, 1} {
		_, err := ctx.Open(objects[counter], metadata)
		var replay *sframe.ReplayError
		switch {
		case err == nil:
			fmt.Println(counter, "opened")
		case errors.As(err, &replay):
			fmt.Println(counter, "refused as a replay of counter", replay.Counter)
		default:
			fmt.Println(counter, err)
		}
	}

	// Output:
	// 1024 opened
	// 1 opened
	// 0 refused as a replay of counter 0
	// 1 refused as a replay of counter 1
}
```

### Rust

From the crate documentation in `rust/moqom-sframe/src/lib.rs`, which `cargo test` runs as
doctests. Both run inside a function returning `Result<(), Error>`.

```rust
use moqom_sframe::{
    CipherSuite, Error, Key, Metadata, Property, Receiver, Sender, Track, mls_key_id,
};

let base_key = [0x2a; 32];
let key = Key::new(mls_key_id(3, 14), &base_key, CipherSuite::Aes256GcmSha512)?; // leaf 3, epoch 14
let sender = Sender::new(key.clone());
let receiver = Receiver::default();
receiver.add(key);

let metadata = Metadata {
    track: Track::new(["moqom", "demo", "alice"], "video"),
    group: 5,
    object: 2,
    priority: 64,
    properties: vec![
        Property::integer(0x78, 1_000_000), // capture time
        Property::integer(0x7a, 1),         // temporal layer
    ],
};
let object = sender.protect_object(b"frame", &metadata)?;
assert_eq!(object[..2], [0x80, 0x3e]); // KID 62, counter 0
assert_eq!(object.len(), 2 + 5 + 16);

// A relay that relabels the object's group, moves it to another track, or
// flips a bit, is caught.
let moved = Metadata { group: 6, ..metadata.clone() };
assert_eq!(receiver.unprotect_object(&object, &moved), Err(Error::AuthenticationFailure));
let moved = Metadata { track: Track::new(["moqom", "demo", "bob"], "video"), ..metadata.clone() };
assert_eq!(receiver.unprotect_object(&object, &moved), Err(Error::AuthenticationFailure));
let mut damaged = object.clone();
*damaged.last_mut().unwrap() ^= 0x01;
assert_eq!(receiver.unprotect_object(&damaged, &metadata), Err(Error::AuthenticationFailure));

// Neither failure used up the counter, so the real object still opens.
assert_eq!(receiver.unprotect_object(&object, &metadata)?, b"frame");
assert_eq!(
    receiver.unprotect_object(&object, &metadata),
    Err(Error::Replay { counter: 0 })
);
```

```rust
use moqom_sframe::{CipherSuite, Context, Error, Metadata, Track};

let context = Context::new(CipherSuite::Aes128GcmSha256, 1, &[0x2a; 16])?;
let track = Track::new(["moqom", "demo", "alice"], "audio");
let metadata = Metadata { track, group: 0, object: 0, priority: 128, properties: vec![] };
let objects = (0..=1024u32)
    .map(|counter| context.seal(&counter.to_be_bytes(), &metadata))
    .collect::<Result<Vec<_>, _>>()?;

context.open(&objects[1024], &metadata)?;
context.open(&objects[1], &metadata)?; // 1,023 behind: accepted
assert_eq!(context.open(&objects[0], &metadata), Err(Error::Replay { counter: 0 })); // 1,024 behind
assert_eq!(context.open(&objects[1], &metadata), Err(Error::Replay { counter: 1 })); // already seen
```

## API

There are three pieces, with the same names and shape in each language.

- A **context** holds one key for both directions: `seal(payload, metadata)` returns an [SFrame](https://www.rfc-editor.org/rfc/rfc9605)
  object and `open(object, metadata)` returns the payload. It is for two ends that share one
  base key and KID.
- A **sender** encrypts under one key at a time and owns the counter. A room uses one sender per
  outgoing key. A sender can start with no key and refuses to encrypt until it gets one.
- A **receiver** holds keys for any number of KIDs, keeps a replay window for each, and can ask a
  resolver for a KID it does not hold.

| | Swift | Go | Rust |
| --- | --- | --- | --- |
| Context | `SFrameContext(suite:keyID:baseKey:replayWindow:)` | `NewContext`, `NewContextWindow` | `Context::new`, `Context::with_replay_window`, `key()` |
| Seal, open | `seal(_:metadata:)`, `open(_:metadata:)` | `Seal`, `Open` | `seal`, `open` |
| Key | `SFrameKey(keyID:baseKey:suite:)` | `NewKey(keyID, baseKey, suite)` | `Key::new(key_id, base_key, suite)` |
| Sender | `SFrameSender(key:)`, `SFrameSender()` | `NewSender(key)`, `NewSender(nil)` | `Sender::new(key)`, `Sender::empty()` |
| Encrypt an object | `protect(_:metadata:)` | `ProtectObject` | `protect_object` |
| Rotate, stop | `rekey(_:)`, `clearKey()` | `Rekey`, `ClearKey` | `rekey`, `clear_key` |
| Counters used | `issuedCounters` | `IssuedCounters()` | `issued_counters()` |
| Receiver | `SFrameReceiver(replayWindow:)` | `NewReceiver(window)` | `Receiver::new(window)`, `Receiver::default()` |
| Load, forget a key | `add(_:)`, `remove(keyID:)` | `Add`, `Remove` | `add`, `remove` |
| Resolver | `setResolver(_:)`, `setResolver(nil)` | `SetResolver`, `SetResolver(nil)` | `set_resolver`, `clear_resolver` |
| Decrypt an object | `unprotect(_:metadata:)` | `UnprotectObject` | `unprotect_object` |
| Track | `SFrameTrack(namespace:name:)` | `Track`, `TrackOf(namespace, name)` | `Track::new(namespace, name)` |
| Metadata | `SFrameMetadata(track:group:object:priority:properties:)`, `.integer(_:_:)`, `.bytes(_:_:)` | `Metadata`, `IntegerProperty`, `BytesProperty` | `Metadata`, `Property::integer`, `Property::bytes` |
| Raw AAD | `protectRaw(_:aad:)`, `unprotectRaw(_:aad:)` | `ProtectRaw`, `UnprotectRaw` | `protect_raw`, `unprotect_raw` |
| [MLS](https://www.rfc-editor.org/rfc/rfc9420) KID | `SFrameKeyID.mls(leaf:epoch:)` | `MLSKeyID(leaf, epoch)` | `mls_key_id(leaf, epoch)` |
| Header | `SFrameHeader`, `.encoded`, `read(from:)` | `Header`, `Encode`, `ReadHeader` | `Header`, `encode`, `Header::read` |

The default suite is AES-256-GCM-SHA512 in all three: an argument default in Swift,
`sframe.DefaultCipherSuite` in Go, and `CipherSuite::default()` in Rust. The default replay
window is 1,024 in all three (`DefaultReplayWindow`, `DEFAULT_REPLAY_WINDOW`).

Creating a key or a context checks the base key's length and throws, or returns an error, with
`invalid_base_key` if it is not the suite's `Nk` bytes.

Every MoQ form takes metadata with a track, so there is no way to seal or open a MoQ object
without binding one. The raw forms append whatever bytes they are given to the header as AAD
and bind no track. They are what RFC 9605's own vectors use, and they are for non-MoQ uses that
bind their own context.

A resolver is called, outside the receiver's lock, with a KID the receiver does not hold. The
key it returns is used for that object only, and is added as though by `add` once the object
authenticates under it, so forged objects naming made-up KIDs cannot fill the receiver with
keys. A key whose KID does not match fails with `unknown_key`. It is for schemes where a
receiver can derive a sender's key without being sent it, such as a shared base key with a
random KID per sender.

In Rust a property's type is the field `code`, because `type` is a keyword. Rust's `Key` is
`Clone` and cheap to clone, so one derivation can serve a sender and a receiver.

## Specification

### Object

An [SFrame](https://www.rfc-editor.org/rfc/rfc9605) object is:

```
header || ciphertext || tag
```

The ciphertext is the same length as the payload and the tag is 16 bytes, so an object is the
payload plus the header plus 16 bytes. There is no padding: a relay can see each payload's
length.

### Header

The header is [RFC 9605](https://www.rfc-editor.org/rfc/rfc9605) §4.3, unchanged. It starts with one config byte laid out as `X KKK Y CCC`
(most significant bit first):

| Bits | Meaning |
| --- | --- |
| `X` | 0: `KKK` is the KID itself (0–7). 1: `KKK + 1` KID bytes follow |
| `KKK` | The KID, or the number of KID bytes minus one |
| `Y` | 0: `CCC` is the counter itself (0–7). 1: `CCC + 1` counter bytes follow |
| `CCC` | The counter, or the number of counter bytes minus one |

The KID bytes, if any, come first, then the counter bytes. Both are big-endian. The encoder uses
the fewest bytes, so a KID and a counter below 8 fit in one byte, and the longest header, with
an 8-byte KID and an 8-byte counter, is 17 bytes.

| KID | Counter | Header |
| --- | --- | --- |
| 3 | 5 | `35` |
| 62 | 0 | `80 3e` |
| 62 | 8 | `88 3e 08` |
| 0x123 | 0x4567 | `99 01 23 45 67` |

The decoder also accepts a value written in more bytes than it needs. The tag covers the header
bytes exactly as received, so nobody without the key can produce such a header for an existing
object. A header that says more bytes follow than there are is `malformed_header`.

### Cipher suites

| Suite | AEAD | Hash | `Nk` (key) | `Nn` (nonce) | `Nt` (tag) |
| --- | --- | --- | --- | --- | --- |
| `0x0004` | AES-128-GCM | SHA-256 | 16 | 12 | 16 |
| `0x0005` | AES-256-GCM | SHA-512 | 32 | 12 | 16 |

The AES-CTR + HMAC suites, `0x0001` to `0x0003`, are not implemented. Go and Rust refuse any
other suite number with `unsupported_suite`; Swift's suite type cannot hold one.

### Keys and KIDs

Each key is derived from a base key and a KID, as [RFC 9605](https://www.rfc-editor.org/rfc/rfc9605) §4.4.2 specifies, with the suite's
hash:

```
secret = HKDF-Extract(salt = "", base_key)
key    = HKDF-Expand(secret, "SFrame 1.0 Secret key "  || KID (8 bytes) || suite (2 bytes), Nk)
salt   = HKDF-Expand(secret, "SFrame 1.0 Secret salt " || KID (8 bytes) || suite (2 bytes), 12)
```

The KID and suite are big-endian, and the labels include the trailing space. Because both are
in the labels, an object sealed under one KID or suite never opens under another.

In a room, the base key for an [MLS](https://www.rfc-editor.org/rfc/rfc9420) epoch is `MLS-Exporter("SFrame 1.0 Base Key", "", Nk)`
(`mlsExporterLabel`, `MLSExporterLabel`, `MLS_EXPORTER_LABEL`), and each member's KID follows
RFC 9605 §5.2 with context 0 and `E = 4`:

```
KID = (leaf << 4) | (epoch mod 16)
```

So each member has its own KID, and therefore its own key and counter, in every epoch. The
receiver can tell up to 16 epochs apart from the KID alone (`epochTag`, `EpochTag`,
`epoch_tag`), which is more than are live at once. The MLS group itself is in
[`moqom-mls`](/security/libraries/mls/).

### Nonce

```
nonce = salt XOR (0x00000000 || counter as 8 big-endian bytes)
```

The counter occupies the low eight bytes of the 12-byte nonce; the high four bytes of the salt
pass through unchanged.

### Counter

The sender owns the counter. It starts at 0 for each KID and goes up by one for every object
sealed, and no API lets a caller choose it. A sender remembers where each KID's counter stopped:
`rekey` to a KID it has not sealed under starts at 0, and `rekey` back to one it has, including
after `clearKey`, carries on from where it stopped. The last value, 2^64 − 1, is never issued:
once the counter reaches it, the sender refuses with `counter_exhausted` rather than wrap.

### AAD and MoQ metadata

The AAD is the header bytes, as sent or as received, followed by the object's metadata in a
canonical encoding:

```
AAD = header || metadata
```

The metadata encoding starts with the track's Serialized Full Track Name, as
[draft-ietf-moq-secure-objects](https://datatracker.ietf.org/doc/draft-ietf-moq-secure-objects/) §3.3.1 defines it, followed by the MOQT wire encoding of the
object's other fields. Integers are QUIC varints ([RFC 9000](https://www.rfc-editor.org/rfc/rfc9000) §16) in their shortest form, at most
2^62 − 1:

```
varint(number of namespace fields)
  || for each namespace field: varint(length) || bytes
  || varint(name length) || name bytes
  || varint(group) || varint(object) || priority (1 byte)
  || varint(number of properties)
  || for each property, sorted by type:
       varint(type − previous type)
       || even type: varint(value)
       || odd type:  varint(length) || bytes        (length at most 65,535)
```

A track has 1 to 32 namespace fields, and at most 4,096 bytes in its fields and name together,
which are MOQT's limits. Fields and the name are bytes; the `String` and `&str` constructors use
UTF-8, as MOQT does. Because every field is length-prefixed, `moqom/demo` and `moqomd/emo` are
different tracks.

The property sort is stable, so properties with the same type keep the order they were given in.
The caller's order of different types does not change the encoding, so a relay reordering
properties does not stop an object from opening. The first property's delta is from 0.

For the examples above (track `moqom`, `demo`, `alice` named `video`; group 5, object 2,
priority 64; capture time `0x78` = 1,000,000 and temporal layer `0x7A` = 1) the metadata is:

```
03 05 6d 6f 71 6f 6d 04 64 65 6d 6f 05 61 6c 69 63 65 05 76 69 64 65 6f   track
05 02 40                                                                  group, object, priority
02 40 78 80 0f 42 40 02 01                                                two properties
```

With KID 62 at counter 0 the AAD is `80 3e` followed by those 36 bytes.

Key derivation does not involve the track: the labels are [RFC 9605](https://www.rfc-editor.org/rfc/rfc9605)'s (see
[Keys and KIDs](#keys-and-kids)). That keeps the
RFC 9605 vectors valid and lets one key serve every track a member publishes, while a relay that
moves an object between them still fails the tag.

Metadata that has no encoding is refused with `invalid_metadata` before anything is sealed or
opened: a track with no namespace fields, more than 32, or more than 4,096 bytes; an even type
with bytes, an odd type with an integer, any value at or above 2^62, or a byte value longer than
65,535 bytes. MOQOM's own property types are capture time `0x78`, decoder configuration `0x79`,
temporal layer `0x7A`, silence `0x7C`, catalog disclosure `0x7D` and authority signature `0x7F`.

### Replay window

A receiver keeps a window per KID: the highest counter it has accepted, and a bitmap of the
counters at and below it.

- A counter above the highest is accepted, however far ahead.
- A counter at or below the highest is accepted only if it is less than the window size behind
  and has not been seen. With the default window of 1,024, the highest minus 1,023 is accepted
  and the highest minus 1,024 is refused with `replay`.
- A counter is recorded only after the object authenticates, so a forged object cannot use up
  the counter of the real one behind it.
- Adding a key, or a resolver supplying one, starts a new window for that KID. Removing a key
  removes its window.

The window size is set when the receiver or context is created. Sizes above 65,536 behave as
65,536, so a configuration mistake cannot allocate an unbounded bitmap; a window of 0 accepts
only counters above the highest. The bitmap is a ring of 64-bit words with one word more than
the window needs: 17 words (136 bytes) per KID for 1,024, and 1,025 words (about 8 KiB) at the
cap.

### Order of checks

A receiver checks, in order: that the metadata has an encoding (for the metadata forms); the
header; that a key is held or resolved for the KID; the replay window; and finally the tag. The
error is from the first check that fails.

## Errors

Every failure is one of these classes. The shared vectors name the class each failing case must
produce, and every language reports the same one. Swift's `SFrameError.errorClass`, Go's
`sframe.Class(err)` and Rust's `Error::class()` return the class name.

| Class | Swift `SFrameError` | Go | Rust `Error` | Meaning |
| --- | --- | --- | --- | --- |
| `malformed_header` | `.malformedHeader` | `ErrMalformedHeader` | `MalformedHeader` | The input is empty, or the header says more KID or counter bytes follow than there are. |
| `unknown_key` | `.unknownKey(kid)` | `*UnknownKeyError{KeyID}`, matches `ErrUnknownKey` | `UnknownKey(kid)` | No key is held for the header's KID, and the resolver returned none. Recoverable: key distribution and media travel separately, so the key may still be on its way. Hold the object and retry once it arrives. |
| `authentication_failure` | `.authenticationFailure` | `ErrAuthentication` | `AuthenticationFailure` | The tag does not verify, or the input after the header is shorter than a tag. The payload, header or metadata was changed, or the object was sealed under another key. Do not report it onward in any more detail. |
| `replay` | `.replay(counter:)` | `*ReplayError{Counter}`, matches `ErrReplay` | `Replay { counter }` | The counter has already been accepted under this KID, or is at least the window size behind the highest. |
| `counter_exhausted` | `.counterExhausted` | `ErrCounterExhausted` | `CounterExhausted` | The sender has used every counter under its key. Rekey; the sender does not wrap. |
| `no_key` | `.noKey` | `ErrNoKey` | `NoKey` | The sender has no key yet, or its key was cleared. It refuses rather than send the payload in the clear. |
| `invalid_metadata` | `.invalidMetadata` | `ErrInvalidMetadata` | `InvalidMetadata` | The metadata, including its track, has no canonical encoding (see [AAD and MoQ metadata](#aad-and-moq-metadata)). |
| `invalid_base_key` | `.invalidBaseKey` | `ErrInvalidBaseKey` | `InvalidBaseKey` | A base key that is not the suite's `Nk` bytes, when creating a key or context. |
| `unsupported_suite` | — | `ErrUnsupportedSuite` | `UnsupportedSuite(suite)` | A suite number other than 4 or 5: from Go's `NewKey` and `NewContext`, and Rust's `CipherSuite::try_from`. |

In Go, use `errors.Is(err, sframe.ErrUnknownKey)` to test the class, and `errors.As` with an
`*sframe.UnknownKeyError` or `*sframe.ReplayError` to read the KID or counter.

## Security considerations

**Never seal two objects under one key and counter.** A repeated AES-GCM nonce leaks the XOR of
the two payloads and lets an attacker forge tags under that key. The library prevents this
within one sender, because the sender owns the counter. It cannot prevent it across senders:

- Use one sender per key. Two senders under the same key, in one process or on two devices,
  issue the same counters. Members sharing a base key need different KIDs.
- A sender's counters are in memory. After a process restarts, do not derive the same key (the
  same base key and KID) again. In a MOQOM room this holds by construction: [MLS](https://www.rfc-editor.org/rfc/rfc9420) group state is
  not persisted, so a restarted device comes back only through a commit that adds it, which
  starts a new epoch with new keys. A shared-key room in MoqomKit sends under a random 64-bit
  KID per session.

**Rotate keys.** `rekey` switches a sender to a new key, whose counter starts at 0, which is safe
because the new key has its own salt. In a MOQOM room the base key changes with every MLS
epoch, and the epoch is in the KID, so each commit gives every member a new key. To rotate
without dropping objects, add the new key to receivers before senders switch to it, keep the
old key until objects sealed under it have arrived, then remove it. Removing a key is how a
receiver stops accepting a member who has left: anything still in flight under that key fails
with `unknown_key`. When a member leaves its group, `clearKey` makes its sender refuse rather
than keep sealing under a key the room has finished with. `issuedCounters` reports how many
counters the current key has used, for a sender that rotates on volume.

**Base keys.** A base key must be `Nk` bytes of secret key material, such as the MLS exporter
output; any other length is refused with `invalid_base_key`. [RFC 9605](https://www.rfc-editor.org/rfc/rfc9605)'s own vectors use a
16-byte base key with suite 5, so the libraries run them through an internal derivation that
skips the check.

**What is protected.**

| | Encrypted | Authenticated |
| --- | --- | --- |
| Payload | yes | yes |
| SFrame header (KID, counter) | no | yes |
| Group, object ID, priority | no | yes |
| Object properties, including their types and number | no | yes |
| Track namespace and name | no | yes |
| Subgroup, delivery timeout, and other MOQT fields not listed above | no | no |
| Payload length, timing, which objects exist | no | no |

A relay can drop, delay and reorder objects; the receiver sees only gaps in counters. It cannot
move an object to another track, even one sealed under the same key with the same group, object
ID, priority and properties: the receiver opens it as belonging to the track it arrived on, and
the tag fails.

**Replay protection is per receiver.** Each receiver keeps its own windows in memory. A
receiver that is recreated, or that adds a key again, accepts counters it has seen before.

**Do not reveal why an object failed.** Tell `unknown_key`, which is worth retrying, apart from
everything else, but do not report `authentication_failure` or `replay` onward in any more
detail: which objects fail to authenticate is information an attacker can use.

## Test vectors

The vectors are JSON files in
[`vectors/sframe`](https://github.com/moqom-cloud/moqom-security/tree/main/vectors/sframe), read
by all three test suites. A failing case names the error class it must produce.

| File | Cases | What it covers |
| --- | --- | --- |
| `rfc9605.json` | 297 | [RFC 9605](https://www.rfc-editor.org/rfc/rfc9605) Appendix C as published: 289 headers (C.1), 3 AES-CTR + HMAC cases (C.2) and 5 SFrame cases (C.3). All three languages run the 291 cases for suites 4 and 5, checking every header, and for C.3 the labels, secret, key, salt, nonce, AAD and ciphertext. The 6 cases for suites 1 to 3 are marked `skip`. |
| `metadata.json` | 24 | Canonical encodings, including the track, at each varint size boundary: sorting, repeated types, empty and two-byte-length byte values, large type deltas, an empty namespace field and name, 32 namespace fields and a 4,096-byte track. 9 have no encoding, including a track with no namespace, 33 fields, or 4,097 bytes. |
| `kid.json` | 14 | [MLS](https://www.rfc-editor.org/rfc/rfc9420) KIDs, epoch tags, and the header each produces at counter 0. |
| `nonce.json` | 40 | Key, salt, nonce and header for both suites and two KIDs, at counters from 0 to 2^64 − 1. |
| `seal-open.json` | 10 (32 objects) | Sealing with a context must reproduce each object byte for byte, and opening must return each payload. Includes empty payloads, the largest KID, and a counter crossing into the extended form. |
| `open.json` | 62 | For each suite, every metadata field changed: the track name, the namespace, a namespace field added, the namespace split differently, group, object ID, priority, each property, and a property added, removed or retyped. An object sealed with the same metadata on another track is refused, and a missing track is `invalid_metadata`. Also ciphertext, tag and counter changes, a changed KID, truncation, malformed headers, the other suite, another base key, invalid metadata, a non-minimal header (opens) and reordered properties (open). |
| `replay.json` | 22 (100 steps) | Duplicates, reordering, the edges of windows of 1,024, 64 and 8, a forward jump, the 65,536 cap, a forgery that does not use up its counter, and the top of the counter space. |

`rfc9605.json` is extracted from the RFC text by `vectors/sframe/extract-rfc9605.py` and
matches the working group's `test-vectors.json` for every case. The other files are generated by
the Swift implementation. `counter_exhausted`, which takes 2^64 seals to reach, `no_key`, which
a context cannot produce, `invalid_base_key`, resolvers, counters resuming after `rekey`, and
concurrent opens are covered by unit tests rather than vectors.

To run the vectors, the examples and the unit tests, from a clone of the repository:

```sh
swift test --filter MoqomSFrameTests     # in the repository root
cd go && go test ./sframe/...
cd rust && cargo test -p moqom-sframe
```

To check that the generated vectors are current, or to regenerate them after a format change:

```sh
swift test --filter SFrameVectorGeneration                         # fails if they differ
MOQOM_WRITE_VECTORS=1 swift test --filter SFrameVectorGeneration   # rewrites them
```

## Source

- Swift: [`Sources/MoqomSFrame`](https://github.com/moqom-cloud/moqom-security/tree/main/Sources/MoqomSFrame)
- Go: [`go/sframe`](https://github.com/moqom-cloud/moqom-security/tree/main/go/sframe)
  ([pkg.go.dev](https://pkg.go.dev/github.com/moqom-cloud/moqom-security/go/sframe))
- Rust: [`rust/moqom-sframe`](https://github.com/moqom-cloud/moqom-security/tree/main/rust/moqom-sframe)
  ([crates.io](https://crates.io/crates/moqom-sframe), [docs.rs](https://docs.rs/moqom-sframe))
- Design: [`docs/moqom-sframe.md`](https://github.com/moqom-cloud/moqom-security/blob/main/docs/moqom-sframe.md)

Report vulnerabilities as described in [Responsible disclosure](/security/disclosure/).
