---
title: "Backend: Go"
description: Use moqom-go to mint tokens, manage rooms, moderate and follow room events from a Go backend.
---

`moqom-go` is the server-side SDK for Go. It is for your **backend**, not for participants: it
mints the tokens your users join with, creates and closes rooms, moderates them, and follows
what happens in them. It does not carry media and has no [QUIC](https://www.rfc-editor.org/rfc/rfc9000) dependency.

| | |
| --- | --- |
| Module | `github.com/moqom-cloud/moqom-go` |
| Go | 1.23 or later |
| Talks to | The control-plane gRPC API at `api.moqom.cloud:443` |
| Licence | Apache-2.0 |

```sh
go get github.com/moqom-cloud/moqom-go
```

## Connect

Authenticate with a **backend API key** (`mqk_…`) from [moqom.cloud](https://moqom.cloud) or
[`POST /v1/keys`](/reference/billing-api/#post-v1keys). Keep it in your secret manager.

```go
client, err := moqom.Dial("api.moqom.cloud:443",
    moqom.WithCredential(os.Getenv("MOQOM_API_KEY")),
    moqom.WithTenant(os.Getenv("MOQOM_TENANT")))
if err != nil {
    return err
}
defer client.Close()
```

Other options: `WithActor` (a default actor for every call), `WithRetry(attempts, base)`,
`WithTLS`, `WithDialOptions`, and `WithConnection` for tests.

## Mint a token

The call you will make most. Authenticate your user however you already do, then ask for a token
naming that user, that device, that room, and exactly the rights they should have.

```go
token, err := client.MintToken(ctx, moqom.TokenRequest{
    Username:         user.Name,
    DeviceThumbprint: req.Thumbprint, // from the client SDK's DeviceKey
    Room:             "live/42",
    Publish:          moqom.PublishAudio | moqom.PublishVideo,
    Preset:           moqom.PresetNone,
    Lifetime:         10 * time.Minute, // default 10 min, max 15 min
})
// token.Token, token.ExpiresAt, token.Identity, token.KeyID
```

| Field | Meaning |
| --- | --- |
| `Username` | Your identifier for the user. Normalised (NFC); read back the minted one from `token.Identity`. |
| `DeviceThumbprint` | The client device key's thumbprint, reported by the client SDK. Required. |
| `Room` | Which room. Empty mints a token for the tenant's discovery surface but no room. |
| `Publish` | `PublishAudio`, `PublishVideo`, `PublishScreenShare`, `PublishData`; `PublishCamera` = audio+video. |
| `Moderation` / `Preset` | Capabilities, or a preset: `PresetNone`, `PresetModerator`, `PresetSuperModerator`, `PresetOwner`. |
| `Owner` | Make this user the room's owner. |
| `Backstage` | Join backstage; going live later needs no new token. |
| `AgeVerified` | Assert you verified the user's age, for rooms with an age gate. |
| `Lifetime` | Zero for the default (10 minutes). Maximum 15 minutes. |

:::note[Out of credit]
If your tenant has no credit, `MintToken` fails with a gRPC `FailedPrecondition` whose message
says *payment required* or *insufficient credit*. Top up and try again. Moderation calls are
never blocked by credit.
:::

`MintToken` is not retried automatically on an ambiguous failure — minting is cheap and a second
token is harmless. Ask again.

## Rooms

```go
room, err := client.CreateRoom(ctx, moqom.NewRoom{
    Name:   "live/42",
    Owner:  "alice",
    Policy: moqom.Policy{MaxParticipants: 500, StageSlots: 8},
})

r := client.Room("live/42")
state, _ := r.Get(ctx)
page, _ := r.Participants(ctx, moqom.ParticipantQuery{})
_, _ = r.UpdatePolicy(ctx, moqom.PolicyUpdate{ /* fields to change */ })
_, _ = r.Close(ctx, moqom.CodeOperatorAction, moqom.Actor{OnBehalfOf: "jane"})
```

`CreateRoom` is idempotent on the name: creating a room that exists returns `ErrExists` rather
than resetting it. `client.Rooms` pages through rooms; `client.AllRooms` collects every page.

Watchdogs: `r.AttachWatchdog`, `r.DetachWatchdog`, `r.Watchdogs`.

## Moderate

Attribute every action to the human who asked for it. The service account comes from your
credentials and cannot be set per call, so the audit trail cannot be forged.

```go
r := client.Room("live/42")

entry, err := r.Kick(ctx, moqom.KickRequest{
    Target: moqom.User("carol"),
    Code:   moqom.CodeHarassment,
    Actor:  moqom.Actor{OnBehalfOf: "jane", Reason: "repeated slurs in chat"},
})

_, err = r.Ban(ctx, moqom.BanRequest{
    Subject:  moqom.BanAccount("carol"),
    Duration: 24 * time.Hour, // zero = permanent
    Code:     moqom.CodeHarassment,
    Actor:    moqom.Actor{OnBehalfOf: "jane"},
})

_, err = r.ForceMute(ctx, moqom.MuteRequest{
    Target: moqom.User("dan"),
    Media:  []moqom.MediaKind{moqom.MediaAudio},
    Scope:  moqom.MuteForAudience, // cohosts still hear him
    Actor:  moqom.Actor{OnBehalfOf: "jane"},
})

_, err = client.BanFromTenant(ctx, moqom.BanRequest{Subject: moqom.BanDevice(identity)})
```

Every call returns the `ModerationEntry` it produced. Check **`entry.Enforced`**: `true` means
live sessions have been acted on; `false` means the record exists and enforcement is still being
completed (MOQOM keeps retrying). Show that to your moderator.

See the [Moderation guide](/guides/moderation/) for the full set of verbs and their semantics.

### Promote and demote

A role change happens on the connection the participant already has — no handoff, no
reconnect. Record the new grants, then give the app a token for them:

```go
guest := moqom.Grants{Publish: moqom.PublishCamera}

_, err := r.SetGrants(ctx, moqom.GrantsRequest{
    Target: moqom.User("dan"),
    Grants: guest,
    Actor:  moqom.Actor{OnBehalfOf: "jane"},
})

token, err := client.MintToken(ctx, moqom.TokenRequest{
    Username:         "dan",
    DeviceThumbprint: dansThumbprint,
    Room:             "live/42",
    Publish:          guest.Publish,
})
// Send token to Dan's app, which calls room.updateCredential(_:) on the room it is in.
```

To demote, call `SetGrants` with the reduced grants. It applies at once without the app's
cooperation; minting a matching token afterwards keeps the app's next renewal in step. Tokens
minted after `SetGrants` never carry more than it allows, so the renewal endpoint your app
already calls can stay as it is.

## Follow a room

`Events` is your substitute for being in the room. Delivery is **at-least-once and ordered per
room**, and each event's `Sequence` is contiguous within its room — persist it.

```go
stream, err := client.Room("live/42").Events(ctx, moqom.EventQuery{After: cursor})
if err != nil {
    return err
}
for {
    event, err := stream.Recv()
    if err != nil {
        return err // reconnect from your cursor, not from the present
    }
    switch event.Kind {
    case moqom.EventParticipantJoined:
        log.Println("joined", event.Joined.Participant.Identity.Username)
    case moqom.EventModerationApplied:
        audit(event.Moderation)
    }
    cursor = event.Sequence
}
```

`client.Events(ctx, query)` follows every room in the tenant — the right choice for a
moderation queue. `stream.All()` returns an `iter.Seq2` for `range`-over-func.

## Errors

Compare with `errors.Is`; you never need to import gRPC:

| Sentinel | Meaning |
| --- | --- |
| `ErrNotFound` | No such room, participant or watchdog (or it is in another tenant). |
| `ErrDenied` | Permission: the key's ceiling, the actor's capabilities, or standing over the target. |
| `ErrUnauthenticated` | Missing, malformed or unknown API key. |
| `ErrInvalid` | Malformed request. Retrying will not help. |
| `ErrExists` | The room already exists. |
| `ErrClosed` | The room has ended. |
| `ErrUnavailable` | Transient failure that outlasted the SDK's retries. Retry later with the same idempotency key. |
| `ErrInternal` | MOQOM's bug. |

`*moqom.Error` carries `Op` (e.g. `"Room.Kick"`), the gRPC `Code`, the server's `Message`, and
`Retryable()`.

## Retries and idempotency

Every mutating call carries an idempotency key, generated by the SDK when you do not supply one,
and retries reuse it. A queue that redelivers "ban for 24 hours" does not extend the ban. When a
retry might come from a different process, set your own key on the `Actor`.

## Identity

There are no numeric user IDs. A username is a string you already have; a device is derived from
the client's device-key thumbprint — so a device ban and the thumbprint you passed to `MintToken`
are the same fact.
