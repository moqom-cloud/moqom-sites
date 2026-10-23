---
title: Admin API overview
description: Every way your backend administers MOQOM — the HTTPS billing and keys API and the control-plane gRPC API — and which reference page covers each.
---

Your backend talks to MOQOM through two APIs at `api.moqom.cloud`. Both authenticate with a
**backend** [API key](/guides/api-keys/). Neither is for devices: devices join with participant
tokens your backend mints.

| | HTTPS billing API | Control-plane gRPC API |
| --- | --- | --- |
| For | Money, keys, usage, account | Rooms, moderation, tokens, events, relay pools |
| Transport | JSON over HTTPS | gRPC over TLS (`api.moqom.cloud:443`) |
| Auth | `Authorization: Bearer mqk_…` | Same key, as gRPC call credentials |
| SDKs | `curl` or any HTTP client | [`moqom-go`](/guides/backend-go/), [`moqom-rust`](/guides/backend-rust/) |
| Out of credit | Still works | Still works; only `MintClientToken` is refused |
| Reference | [Billing & keys REST API](/reference/billing-api/) | [Control-plane gRPC API](/reference/control-plane-grpc/) |

The console at [moqom.cloud/account](https://moqom.cloud/account/) uses the same billing API
with the same key.

## HTTPS billing API

| Method | Path | Auth | Purpose | Docs |
| --- | --- | --- | --- | --- |
| `GET` | `/v1/rates` | none | Public rate card | [Reference](/reference/billing-api/#get-v1rates) |
| `GET` | `/v1/public/stats` | none | Signup and active-tenant counts, cached 60 s | |
| `POST` | `/v1/signup` | none | New tenant, first key, first checkout | [Reference](/reference/billing-api/#post-v1signup) |
| `GET` | `/v1/billing` | backend | Balance, status, this month's spend, recent ledger | [Reference](/reference/billing-api/#get-v1billing) |
| `GET` | `/v1/billing/ledger` | backend | Up to 5,000 ledger entries, newest first (`?limit=`) | [Ledger entry kinds](/guides/events-and-billing/#ledger-entry-kinds) |
| `POST` | `/v1/billing/checkout` | backend | Open a top-up checkout | [Reference](/reference/billing-api/#post-v1billingcheckout) |
| `POST` | `/v1/billing/portal` | backend | Stripe customer portal | [Reference](/reference/billing-api/#post-v1billingportal) |
| `PUT` | `/v1/billing/auto-top-up` | backend | Configure automatic top-ups | [Reference](/reference/billing-api/#put-v1billingauto-top-up) |
| `PUT` | `/v1/billing/spend-alerts` | backend | Monthly spend alert amounts | [Guide](/guides/spend-limits-and-alerts/#spend-alerts-recommended) |
| `PUT` | `/v1/billing/spend-limit` | backend | Set or clear a monthly spend limit | [Guide](/guides/spend-limits-and-alerts/#spend-limit-optional) |
| `GET` | `/v1/keys` | backend | List keys | [Reference](/reference/billing-api/#get-v1keys) |
| `POST` | `/v1/keys` | backend | Issue a key, shown once | [Reference](/reference/billing-api/#post-v1keys) |
| `DELETE` | `/v1/keys/{id}` | backend | Revoke a key | [Reference](/reference/billing-api/#delete-v1keysid) |
| `POST` | `/v1/keys/{id}/rotate` | backend | Replace a key with an overlap | [Reference](/reference/billing-api/#post-v1keysidrotate) |
| `GET` | `/v1/account/export` | backend | Data export of the account, for access requests | |
| `POST` | `/v1/usage` | relay | Report self-hosted relay usage | [Usage reporting API](/reference/usage-api/) |
| `GET` | `/v1/usage/summary` | backend | Usage by role and tier for `?from&to`, beside Agora's list price | |
| `POST` | `/v1/usage/estimate` | backend | Price a what-if scenario | |
| `POST` | `/v1/migrate/agora/preview` | backend | Read your Agora projects and usage with credentials used once, and estimate the same minutes on MOQOM | |
| `POST` | `/v1/stripe/webhook` | Stripe signature | Reserved for Stripe | |

Conventions shared by every route (money in micro-dollars, unknown fields rejected, errors as
`{"error": "…"}`) are in [Billing & keys REST API](/reference/billing-api/#conventions).

## Control-plane gRPC API

Package `moqom.admin.v1`. Every call takes your `tenant` and, for writes, an `actor` that is
recorded in the audit trail.

| Service | RPCs | Covers | Guide |
| --- | --- | --- | --- |
| [`Rooms`](/reference/control-plane-grpc/#rooms) | `CreateRoom`, `GetRoom`, `ListRooms`, `UpdateRoomPolicy`, `CloseRoom`, `ListParticipants`, `GetParticipant`, `AttachWatchdog`, `DetachWatchdog`, `ListWatchdogs` | Room lifecycle and policy, rosters, observers | [Recording](/guides/recording/), [E2EE](/guides/e2ee/) |
| [`Moderation`](/reference/control-plane-grpc/#moderation) | `Kick`, `Ban`, `Unban`, `ForceMute`, `Unmute`, `SetGrants`, `Spotlight`, `ListModerationLog` | Acting on participants, with an audit entry for each | [Moderation](/guides/moderation/) |
| [`Tokens`](/reference/control-plane-grpc/#tokens) | `MintClientToken`, `ListVerificationKeys`, `SetAppleSignIn` | Participant tokens for devices | [Getting a token onto a device](/reference/device-tokens/) |
| [`Events`](/reference/control-plane-grpc/#events) | `StreamRoomEvents` | A live stream of what happens in a room | [Events, webhooks & billing](/guides/events-and-billing/) |
| [`RelayPools`](/reference/control-plane-grpc/#relaypools) | `CreateRelayPool`, `GetRelayPool`, `ListRelayPools`, `ResizeRelayPool`, `DeleteRelayPool`, `SetRelayPoolAccess`, `SetTenantNetwork`, `CreateRelayEnrollment` (with `pool`) | Relays that carry only your tenant's traffic. Owner (`backend`) key only. | [Private relay networks](/guides/private-networks/) |

Moderation and room administration are never blocked by credit or a spend limit: a tenant out
of credit can still ban someone. Status codes are listed under
[Status codes](/reference/control-plane-grpc/#status-codes) and [Error codes](/reference/errors/).

## Device-facing endpoints

These are not admin APIs, but sit beside them:

- [Apple sign-in hosted by MOQOM](/reference/device-tokens/#3-apple-sign-in-hosted-by-moqom):
  `POST /v1/apple/sign-in` and `POST /v1/apple/token`, for apps without a backend of their own.
  It checks App Attest and Sign in with Apple, mints only for rooms you list, and never mints
  moderation rights or creates rooms.
- Relays: devices connect with the participant token over [QUIC](https://www.rfc-editor.org/rfc/rfc9000) or [WebTransport](https://datatracker.ietf.org/doc/draft-ietf-webtrans-http3/). See
  [Architecture overview](/architecture/overview/).
