---
title: "Backend: Rust"
description: Use moqom-sdk to mint tokens, manage rooms, moderate and follow room events from a Rust backend.
---

`moqom-sdk` (repository `moqom-rust`) is the server-side SDK for Rust. Like the Go SDK it is for
your **backend**: tokens, rooms, moderation and room events over the control-plane gRPC API.
There is **no [QUIC](https://www.rfc-editor.org/rfc/rfc9000) in its dependency graph** — it is built on `tonic`.

| | |
| --- | --- |
| Crate | `moqom-sdk` |
| Runtime | Tokio |
| Talks to | The control-plane gRPC API at `https://api.moqom.cloud` |
| Licence | Apache-2.0 |

```toml
[dependencies]
moqom-sdk = { git = "https://github.com/moqom-cloud/moqom-rust" }
tokio = { version = "1", features = ["rt-multi-thread", "macros"] }
```

Generated gRPC code is checked in, so building needs no `protoc`.

## Connect

```rust
use moqom_sdk::Client;

let client = Client::builder("https://api.moqom.cloud")
    .tenant(std::env::var("MOQOM_TENANT")?)
    .credential(std::env::var("MOQOM_API_KEY")?) // backend key, mqk_…
    .connect()
    .await?;
```

Builder options: `.actor(Actor)` for a default actor, `.retry(attempts, base)`, `.tls(config)`,
and `.with_channel(channel)` for tests.

## Mint a token

```rust
use moqom_sdk::{Preset, Publish, TokenRequest};

let token = client
    .mint_token(TokenRequest {
        username: "bob".into(),
        device_thumbprint: thumbprint, // from the client SDK's device key
        room: "live/42".into(),
        publish: Publish::CAMERA,       // audio + video
        preset: Some(Preset::None),
        ..Default::default()
    })
    .await?;
```

Fields mirror the [Go SDK](/guides/backend-go/#mint-a-token): `username`, `device_thumbprint`,
`room`, `publish`, `moderation`/`preset`, `owner`, `backstage`, `age_verified`, `lifetime`
(default 10 minutes, maximum 15).

:::note[Out of credit]
A tenant without credit gets a `FailedPrecondition` error from `mint_token`. Moderation is never
blocked by credit.
:::

## Rooms

```rust
use moqom_sdk::NewRoom;

let created = client
    .create_room(NewRoom { name: "live/42".into(), owner: "alice".into(), ..Default::default() })
    .await?;

let room = client.room("live/42");
let state = room.get().await?;
let people = room.participants(Default::default()).await?;
```

Also: `client.rooms(query)`, `room.update_policy(update)`, `room.close(code, actor)`,
`room.participant(&identity)`, `room.attach_watchdog(..)`, `room.detach_watchdog(id, actor)`,
`room.watchdogs()`.

## Moderate

```rust
use std::time::Duration;
use moqom_sdk::{Actor, BanRequest, Code, KickRequest, banned_account, target};

let room = client.room("live/42");

let entry = room
    .kick(KickRequest {
        target: target("carol"),
        code: Code::Harassment,
        actor: Actor::on_behalf_of("jane").because("repeated slurs in chat"),
    })
    .await?;

if !entry.enforced {
    // The record exists; enforcement on live sessions is still completing.
}

room.ban(
    BanRequest::lasting(banned_account("carol"), Duration::from_secs(24 * 3600))
        .coded(Code::Harassment, Actor::on_behalf_of("jane")),
)
.await?;
```

Also: `unban`, `force_mute`, `unmute`, `set_grants`, `spotlight`, `log`, and tenant-wide
`client.ban_from_tenant` / `client.unban_from_tenant`. Ban subjects: `banned_account`,
`banned_device`, `banned_address`. `BanRequest::permanent(subject)` for no expiry.

## Follow a room

```rust
use moqom_sdk::{Body, EventQuery};

let room = client.room("live/42");
let mut events = room.events(EventQuery { after: cursor, ..Default::default() }).await?;

while let Some(event) = events.next().await? {
    cursor = event.sequence;            // persist it
    if let Body::Moderation(entry) = event.body {
        // including actions by another console or a safety classifier
        let _ = entry;
    }
}
```

## Grants

`Capability` is a bitflag *set*, never a level. An actor may act on a target only when the
actor's set strictly contains the target's. The bit positions are protocol — the Go and Swift
SDKs use the same ones.

## Retries

Every mutating call carries an idempotency key, generated when you do not supply one. Use
`Actor::keyed(..)` when a retry might come from another process.
