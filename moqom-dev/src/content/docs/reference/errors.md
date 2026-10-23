---
title: Error codes
description: Every HTTP and gRPC error MOQOM returns, what causes it, and whether to retry.
---

## REST: billing, keys and usage

All billing-API errors are JSON: `{"error": "<message>"}`.

| HTTP | Cause | Typical message | Retry? |
| --- | --- | --- | --- |
| `400 Bad Request` | Invalid request: malformed JSON, **unknown field**, value out of range, more than 5,000 usage records, revoking your own key | `invalid request: …` | No — fix the request |
| `401 Unauthorized` | Missing, malformed, unknown or revoked key, **or the wrong kind of key** (relay key on a backend route, backend key on `/v1/usage`) | `invalid api key` | No |
| `401 Unauthorized` | The key's `expires_at` has passed | `invalid api key: expired` | No — rotate before expiry, or issue a new key |
| `402 Payment Required` | Tenant has **never paid** | `payment required: add credit to activate this tenant` | After paying |
| `402 Payment Required` | Prepaid **balance spent** | `insufficient credit: top up to admit new sessions` | After topping up |
| `403 Forbidden` | Tenant **suspended**, archived or deleted | `tenant is not active` | No — contact support |
| `403 Forbidden` | A `mint` or `readonly` key on a route outside its [kind](/reference/billing-api/#key-kinds) | `this api key's kind does not allow this call` | No — use a key of the right kind |
| `403 Forbidden` | The key has `allowed_networks` and the request came from elsewhere | `this api key is not allowed from this address` | No — call from an allowed network, or change the key |
| `404 Not Found` | No such key or tenant | `not found` | No |
| `409 Conflict` | Already exists, or a tenant status change that is not allowed | `already exists` / `tenant status cannot change that way` | No |
| `429 Too Many Requests` | More than 5 signups per hour from one address | `too many signups from this address` | Later |
| `429 Too Many Requests` | The key is over its `rate_limit_per_minute` | `this api key is over its rate limit` | After `Retry-After` |
| `500 Internal Server Error` | MOQOM bug | `internal error` | Yes, with backoff |
| `502 Bad Gateway` | Payment provider (Stripe) returned an error | Stripe's message | Yes, with backoff |
| `503 Service Unavailable` | Payments not configured on this deployment | `payments are not configured on this deployment` | No |

Authentication failures are deliberately uninformative: you are never told *which* part of a key
was wrong.

## Relays: sealed tokens

Every MOQOM token is [sealed](/security/libraries/token/#sealed-tokens). A relay opens it, then
verifies it, and refuses the session with one of these classes if it can't:

| Class | Cause |
| --- | --- |
| `malformed` | Cut short, or not base64url |
| `unsupported` | Another seal version, or a token that isn't sealed |
| `unknown_key` | A seal key ID the relay doesn't hold |
| `bad_signature` | The sealed bytes don't authenticate, or the signature inside doesn't verify |

None of these is fixed by retrying with the same token: ask for a new one. A token that opens is
then checked exactly as before, and expiry, tenant and proof failures are reported in the same
way.

## Relays: private relay pools

When a tenant runs on a [private relay network](/guides/private-networks/), every token names its
pool in a sealed `pool` claim, and every relay checks it on every session:

| Class | Cause |
| --- | --- |
| `wrong_pool` | The token's `pool` isn't this relay's pool: a pooled token at a shared relay, a shared-fleet token at a pool relay, or another pool's token |
| `pool_full` | The private pool is at capacity. New sessions are refused and existing ones carry on. MOQOM never bursts a private tenant onto the shared fleet. |

`wrong_pool` is never fixed by retrying: dial one of the addresses in the token response's
[`relays`](/reference/device-tokens/#the-token-response). For `pool_full`, add relays with
[`ResizeRelayPool`](/reference/control-plane-grpc/#relaypools), or raise `MaxRelays` so
autoscaling can.

## gRPC: control-plane admin API

| Code | Cause | Retry? |
| --- | --- | --- |
| `UNAUTHENTICATED` | No credentials, empty credential, unknown, revoked or expired key, or a `relay` API key | No |
| `PERMISSION_DENIED` | Request names another tenant; a relay service credential used on the admin API; actor lacks capability or standing over the target; minting beyond the key's ceiling (a `mint` key asking for a moderator or owner); a `mint` or `readonly` key calling a method outside its kind; a key used from outside its `allowed_networks` | No |
| `RESOURCE_EXHAUSTED` | The key is over its `rate_limit_per_minute` | Yes, after a second |
| `INVALID_ARGUMENT` | Missing tenant or `device_thumbprint`; malformed name, CIDR or capability; token lifetime above 15 minutes; changing an immutable policy field | No |
| `NOT_FOUND` | No such room, participant or watchdog — also returned for resources in another tenant | No |
| `ALREADY_EXISTS` | Room already exists | No |
| `FAILED_PRECONDITION` | Room has ended; room requires age verification; **tenant has no credit** (`MintClientToken` only) | After fixing the cause |
| `CANCELED` / `DEADLINE_EXCEEDED` | Client cancelled or timed out | Yes |
| `UNAVAILABLE` | Transient | Yes — same idempotency key |
| `INTERNAL` | MOQOM bug; the message is kept to help diagnosis | Report it |

### SDK equivalents

| gRPC code | Go sentinel | Rust |
| --- | --- | --- |
| `NOT_FOUND` | `ErrNotFound` | `Error::NotFound` |
| `PERMISSION_DENIED` | `ErrDenied` | `Error::Denied` |
| `UNAUTHENTICATED` | `ErrUnauthenticated` | `Error::Unauthenticated` |
| `INVALID_ARGUMENT` | `ErrInvalid` | `Error::Invalid` |
| `ALREADY_EXISTS` | `ErrExists` | `Error::Exists` |
| `FAILED_PRECONDITION` (room ended) | `ErrClosed` | `Error::Closed` |
| `UNAVAILABLE` | `ErrUnavailable` | `Error::Unavailable` |
| `INTERNAL` | `ErrInternal` | `Error::Internal` |

## Credit gating at a glance

| Operation | Without credit |
| --- | --- |
| `MintClientToken` | **`FAILED_PRECONDITION`** |
| Self-hosted relay `POST /v1/usage` | `200`, with `"admitted": false` |
| Moderation (`Kick`, `Ban`, `ForceMute`, …) | **Always works** |
| Rooms, events, keys, billing routes | Always work |

## Client SDK (Swift) terminal reasons

| `TerminalEvent` | Meaning |
| --- | --- |
| `.moderated(code:)` | Kicked, banned or room closed by a moderator, with a [moderation code](/guides/moderation/#moderation-codes) |
| `.hostEnded` | The host ended the room or broadcast |
| `.networkFailure` | The network did not come back within the reconnect window |
| `.tokenExpired` | The token lapsed and was not renewed |

`MoqomError.encryptionRequired` is not terminal. `startBroadcast` and `startAudio` throw it when
the room requires end-to-end encryption and `useEncryption` has not been called; set a key and
try again. Incoming media dropped for the same reason is reported as
`RoomEvent.encryptionRequired(participant)`. See [End-to-end encryption](/guides/e2ee/).
