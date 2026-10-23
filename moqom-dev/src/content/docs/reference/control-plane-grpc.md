---
title: Control-plane gRPC API
description: The public admin API — Rooms, Moderation, Tokens, Events and RelayPools services in package moqom.admin.v1.
---

The control plane's admin API is gRPC, package **`moqom.admin.v1`**. The Go and Rust SDKs wrap
it; you can also generate a client from the protos in any language gRPC supports.

| | |
| --- | --- |
| Endpoint | `api.moqom.cloud:443` (TLS) |
| Auth | gRPC metadata `authorization: Bearer mqk_…` with a **backend** key |
| Scope | Every request names a `tenant`; it must be the key's tenant |
| Services | `Rooms`, `Moderation`, `Tokens`, `Events`, `RelayPools` |

Relay keys are refused by every admin service (`PERMISSION_DENIED`).

:::note[Credit and the admin API]
Only calls that admit media are gated on credit. A tenant without credit gets
**`FAILED_PRECONDITION`** from `MintClientToken`. **Moderation, rooms and events always keep
working**, so you can still remove someone from a room when you are out of credit.
:::

## Shared types (`common.proto`)

| Message / enum | Key fields | Notes |
| --- | --- | --- |
| `Identity` | `username`, `device` | Username is your string (NFC, ≤ 4096 UTF-8 bytes). Device is derived from the client's device-key thumbprint. |
| `ParticipantRef` | `username`, `device` | Empty `device` targets **every** device of the user. |
| `Grants` | `publish[]`, `moderation[]`, `is_owner` | Publish scopes and moderation capabilities are independent sets. |
| `PublishScope` | `AUDIO`, `VIDEO`, `SCREEN_SHARE`, `DATA` | Permission, never an action. |
| `Capability` | chat `1–5`, stage `10–16`, room `20–25`, meta `30–32` | A set, never a level. See [Concepts](/getting-started/concepts/#grants-publish-scopes-and-capabilities). |
| `CapabilityPreset` | `NONE`, `MODERATOR`, `SUPER_MODERATOR`, `OWNER` | Expanded server-side; the resulting set is what is stored. |
| `MediaKind` | `AUDIO`, `VIDEO`, `SCREEN_SHARE` | |
| `Presence` | `CONNECTED`, `RECONNECTING`, `AWAY`, `BACKGROUNDED`, `LEFT` | |
| `ModerationCode` | `ADULT_CONTENT`, `VIOLENCE`, `HARASSMENT`, `SELF_HARM`, `COPYRIGHT`, `AGE_VERIFICATION_REQUIRED`, `TENANT_POLICY`, `OPERATOR_ACTION` | Sent to the affected client. |
| `ActorContext` | `on_behalf_of`, `reason`, `idempotency_key` | The human the backend acts for. The service account is taken from credentials, never from the body. |
| `Timecode` | `at`, `uncertainty_ns`, `trust` | An instant with its error bar. |

## `Rooms`

| RPC | Request → Response | Purpose |
| --- | --- | --- |
| `CreateRoom` | `CreateRoomRequest` → `Room` | Create a room. `room` is your own name for it. Optional `owner_username`, `policy`, `starts_at` (creates it `SCHEDULED`). |
| `GetRoom` | `GetRoomRequest` → `Room` | Read one room. |
| `ListRooms` | `ListRoomsRequest` → `ListRoomsResponse` | Page through rooms, optionally filtered by `lifecycle[]`. |
| `UpdateRoomPolicy` | `UpdateRoomPolicyRequest` → `Room` | Change policy on a live room. Use `update_mask`; absent means all fields. Tightening applies immediately to everyone. `residency_zone` is immutable. `e2ee` can only be required; `E2EE_POLICY_OPTIONAL` is refused. |
| `CloseRoom` | `CloseRoomRequest` → `Room` | End the room for everyone with a `ModerationCode`. Idempotent. |
| `ListParticipants` | `ListParticipantsRequest` → `ListParticipantsResponse` | Who is in the room. `include_backstage`, `include_departed`. Paged. |
| `GetParticipant` | `GetParticipantRequest` → `Participant` | One device. |
| `AttachWatchdog` | `AttachWatchdogRequest` → `Watchdog` | Attach a recorder, safety, analytics, compliance or custom observer. |
| `DetachWatchdog` | `DetachWatchdogRequest` → `Watchdog` | |
| `ListWatchdogs` | `ListWatchdogsRequest` → `ListWatchdogsResponse` | |

### `Room`

| Field | Meaning |
| --- | --- |
| `tenant`, `room` | Identity |
| `namespace` | The room's MOQT namespace prefix, rendered slash-separated. Use it rather than constructing one. |
| `policy` | `RoomPolicy` (below) |
| `lifecycle` | `SCHEDULED`, `LIVE`, `ACTING_HOST`, `ENDED` |
| `starts_at`, `created_at`, `ended_at` | Timestamps |
| `acting_host` | Set while `ACTING_HOST` |
| `participant_count` / `distinct_user_count` | Devices / people in the room |
| `is_recording` | A recording watchdog is attached |
| `audiences[]` | `{via, viewers, resolution}` — how the audience divides between the cohosts who brought it |

### `RoomPolicy`

| Field | Meaning |
| --- | --- |
| `age_gate` | `{minimum_age, require_verification}` — with verification required, tokens must be minted with `age_verified` |
| `recording` | `ALLOWED`, `REQUIRED` (a hosted recording starts with the room and can't be stopped while it is open), `PROHIBITED` |
| `residency_zone` | Where the room's data (including derived data) may live. Immutable. |
| `max_participants` | Device limit; `0` = unlimited |
| `stage_slots` | Simultaneous video publishers (default 8) |
| `watchdog_limit` | Watchdogs that may attach (default 8) |
| `e2ee` | Always `E2EE_POLICY_REQUIRED`; `UNSPECIFIED` means the same, and a room read back always states it. `E2EE_POLICY_OPTIONAL` is deprecated and refused on `CreateRoom` and `UpdateRoomPolicy`. Carried to devices as the `e2ee` claim in client tokens. See [End-to-end encryption](/guides/e2ee/#required-in-every-room). |

### `Participant`

`identity`, `grants`, `presence`, `self_muted[]`, `forced_muted_for_everyone[]`,
`forced_muted_for_audience[]`, `is_spotlighted`, `is_backstage`, `joined_at`, `relay_id`,
`arrived_via` (the cohost whose following brought them, from the token), `locale` (BCP 47).

### `Watchdog`

`id`, `kind` (`RECORDING`, `SAFETY`, `ANALYTICS`, `COMPLIANCE`, `CUSTOM`), `custom_kind`,
`operated_by` (`PLATFORM`, `TENANT`, `THIRD_PARTY`), `operator_name`, `descriptor` (shown to
participants), `scope` (namespace prefix it may observe; empty = whole room), `health`
(`ATTACHED`, `DEGRADED`, `FAILED`), `attached_at`, `is_billable`, `pinned_layer`.

## `Moderation`

Every RPC returns the `ModerationEntry` it produced. See the [Moderation guide](/guides/moderation/).

| RPC | Key request fields | Purpose |
| --- | --- | --- |
| `Kick` | `room`, `target`, `code`, `actor` | Remove now; may rejoin. |
| `Ban` | `room` (for `ROOM` scope), `scope` (`ROOM` / `TENANT`), `subject` (`username` / `device` / `ip_prefix`), `duration` (unset = permanent), `code`, `actor` | End current sessions and refuse future ones. |
| `Unban` | `room`, `scope`, `subject`, `actor` | Lift a ban early. |
| `ForceMute` | `room`, `target`, `media[]` (empty = all), `scope` (`EVERYONE` / `AUDIENCE`), `duration`, `actor` | Stop media without the client's cooperation. |
| `Unmute` | `room`, `target`, `media[]`, `scope`, `actor` | Lift a force-mute of the given scope. |
| `SetGrants` | `room`, `target`, `grants` (complete result, not a delta), `preset`, `actor` | Change rights. Demotions apply immediately. |
| `Spotlight` | `room`, `target` (unset = clear), `actor` | |
| `ListModerationLog` | `room` (empty = tenant-wide), `since`, `until`, `target`, `verb[]`, paging | Audit trail. Requires `CAPABILITY_READ_MODERATION_LOG`. |

### `ModerationEntry`

| Field | Meaning |
| --- | --- |
| `id`, `tenant`, `room`, `at` | |
| `verb` | `KICK`, `BAN`, `UNBAN`, `FORCE_MUTE`, `UNMUTE`, `SET_GRANTS`, `SPOTLIGHT`, `CLOSE_ROOM`, `ATTACH_WATCHDOG`, `DETACH_WATCHDOG`, `UPDATE_ROOM_POLICY` |
| `service_account` | Filled by the server from the credentials |
| `on_behalf_of`, `reason`, `code` | From the request |
| `target` / `ban_subject` | Who it was done to |
| `expires_at` | When the effect lapses; unset for permanent or instantaneous actions |
| `media`, `mute_scope`, `ban_scope`, `grants` | The verb's parameters |
| `policy_change` | On `UPDATE_ROOM_POLICY` entries that change a security setting, what changed, as `field: old -> new` |
| `enforced` | `true` once live sessions have been acted on; `false` while enforcement is still completing |
| `decided_by_model` | Set when a classifier, not a person, decided |

A repeated request with the same `actor.idempotency_key` returns the original entry unchanged.

## `Tokens`

| RPC | Purpose |
| --- | --- |
| `MintClientToken` | Issue the short-lived token a client joins with. |
| `ListVerificationKeys` | The public keys MOQOM's relays verify tokens with. Rotated without deploys. |
| `SetAppleSignIn` | Turn on [Apple sign-in hosted by MOQOM](/reference/device-tokens/#3-apple-sign-in-hosted-by-moqom) for the tenant: Apple team ID, bundle IDs, which existing rooms, and the publish grants. It never grants moderation or creates rooms. Needs a `backend` key. |

### `MintClientTokenRequest`

| Field | Meaning |
| --- | --- |
| `tenant` | Your tenant |
| `username` | The user this token speaks for |
| `device_thumbprint` | **Required.** The client's device-key thumbprint, as reported by the client SDK |
| `room` | The room. It must exist and be open. Empty = discovery surface, no room |
| `grants` / `preset` | What they may do. A service account can never mint more than its own ceiling |
| `lifetime` | Default **10 minutes**, maximum **15 minutes** |
| `backstage` | Join backstage; going live later needs no new token |
| `age_verified` | Assert verification for age-gated rooms |
| `arrived_via` | The cohost whose following brought this user (requires `room`, cannot be the user themselves) |

### `MintClientTokenResponse`

`token` ([sealed](/security/libraries/token/#sealed-tokens) and opaque, passed by the client at
session setup), `expires_at`, `identity` (with the device already derived), `key_id` (matches a
`VerificationKey.key_id`), `direct` (the room's point-to-point policy), `relays` (the relay
addresses a token for a [private relay pool](/guides/private-networks/) must dial; absent for
the shared fleet). For a private tenant the token also carries a `pool` claim naming its pool;
the token is sealed, so clients never read it. Hand these to the device
as the [token response](/reference/device-tokens/#the-token-response); it can't read them from
the token.

Failure modes:

| Code | Cause |
| --- | --- |
| `INVALID_ARGUMENT` | Missing `device_thumbprint`, bad username, lifetime above 15 minutes |
| `PERMISSION_DENIED` | Asking for capabilities, ownership or publish rights the key cannot grant |
| `NOT_FOUND` | The room does not exist |
| `FAILED_PRECONDITION` | **No credit** (payment required / insufficient credit), room ended, or room requires age verification |

### `ListVerificationKeysResponse`

`keys[]` — `{key_id, algorithm ("ML-DSA-87", the only one), jwk, not_before, retires_at}` — and `binding`, the
token binding this deployment issues.

## `Events`

| RPC | Purpose |
| --- | --- |
| `StreamRoomEvents` | Server stream of `RoomEvent` for one room (`room` set) or the whole tenant (`room` empty). |

Request: `tenant`, `room`, `after_sequence` (resume point; `0` = now), `kind[]` (filter).

`RoomEvent`: `tenant`, `room`, `sequence` (contiguous per room), `at`, `timecode`, `kind`, and one
body: `participant_joined`, `participant_left`, `presence_changed`, `grants_changed`,
`mute_changed`, `spotlight_changed`, `publish_changed`, `watchdog_changed`, `lifecycle_changed`,
`moderation_applied`. See [Events](/guides/events-and-billing/#room-events).

## `RelayPools`

A relay pool is a set of relays that carries only your tenant's traffic. See
[Private relay networks](/guides/private-networks/). Every RPC here needs your owner key, a
[`backend` key](/reference/billing-api/#key-kinds); `mint` and `readonly` keys are refused with
`PERMISSION_DENIED`.

| RPC | Key request fields | Purpose |
| --- | --- | --- |
| `CreateRelayPool` | `name`, `regions[]` (`{region, relays, max_relays}`), `self_hosted` | Create a pool. MOQOM starts the dedicated relays in each region; a `self_hosted` pool starts empty and takes relays you enroll. Returns the `RelayPool`. |
| `GetRelayPool` | `pool_id` | Read one pool, with each relay's address and state. |
| `ListRelayPools` | | Every pool in the tenant. |
| `ResizeRelayPool` | `pool_id`, `region`, `relays`, `max_relays` | Set a region's relay count. A `max_relays` above `relays` turns on autoscaling up to it. Removed relays drain. |
| `DeleteRelayPool` | `pool_id` | Delete a pool. Its relays drain for up to one hour, then stop. |
| `SetRelayPoolAccess` | `pool_id`, `access` (`PUBLIC`, `PRIVATE_SERVICE_CONNECT`, `OVERLAY`) | How the pool is reached: public addresses, a Private Service Connect attachment, or only over the overlay. |
| `SetTenantNetwork` | `pool`, `mode` (`SHARED`, `PRIVATE`) | Confine the tenant to a pool (`PRIVATE`), or return it to the shared fleet (`SHARED`). From then on every token minted for the tenant names the pool. |
| `CreateRelayEnrollment` | `pool`, among its other fields | Enroll a [self-hosted relay](/guides/self-hosting/). With `pool` set, the relay joins that pool and serves only it. |

### `RelayPool`

| Field | Meaning |
| --- | --- |
| `id`, `name` | Identity |
| `regions[]` | `{region, relays, max_relays}` |
| `state` | The pool's state |
| `relays[]` | `{address, region, state}` — each relay's static address, its region, and its state (`ready` once it takes sessions) |

In the Go SDK:

| RPC | Go |
| --- | --- |
| `CreateRelayPool` | `CreateRelayPool(ctx, moqom.NewRelayPool{...})` |
| `GetRelayPool` | `GetRelayPool(ctx, id)` |
| `ListRelayPools` | `ListRelayPools(ctx)` |
| `ResizeRelayPool` | `ResizeRelayPool(ctx, id, moqom.PoolRegion{...})` |
| `DeleteRelayPool` | `DeleteRelayPool(ctx, id)` |
| `SetRelayPoolAccess` | `SetRelayPoolAccess(ctx, id, moqom.PoolAccessPrivateServiceConnect)` |
| `SetTenantNetwork` | `SetTenantNetwork(ctx, moqom.TenantNetwork{Pool: id, Mode: moqom.NetworkPrivate})` |

A relay refuses a token that names another pool, or no pool, with `wrong_pool`, and a full pool
refuses new sessions with `pool_full`. See [Error codes](/reference/errors/#relays-private-relay-pools).

## Status codes

| gRPC code | Typical cause | Retry? |
| --- | --- | --- |
| `UNAUTHENTICATED` | No, malformed or unknown key | No |
| `PERMISSION_DENIED` | Wrong tenant, relay key, or insufficient capability/ceiling | No |
| `INVALID_ARGUMENT` | Malformed request; immutable policy field | No |
| `NOT_FOUND` | No such room/participant/watchdog (also for other tenants' resources) | No |
| `ALREADY_EXISTS` | Room already exists | No |
| `FAILED_PRECONDITION` | Room closed; age verification required; **no credit** (`MintClientToken`) | After fixing the cause |
| `UNAVAILABLE`, `DEADLINE_EXCEEDED` | Transient | Yes, with the same idempotency key |
| `INTERNAL` | MOQOM bug | Report it |
