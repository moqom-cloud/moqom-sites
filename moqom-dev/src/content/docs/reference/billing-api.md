---
title: Billing & keys REST API
description: Every billing and API-key route — signup, balance, checkout, portal, auto top-up, keys — with curl and JSON.
---

The billing API is plain JSON over HTTPS.

| | |
| --- | --- |
| Base URL | `https://api.moqom.cloud` |
| Auth | `Authorization: Bearer mqk_<16 hex>_<secret>` |
| Content type | `application/json` (requests and responses) |
| Caching | Every response is `Cache-Control: no-store` |
| Request bodies | At most 1 MiB. **Unknown fields are rejected** with 400. |
| Money | Integers in **micro-dollars** plus a display string (see below) |

## Conventions

### Money

Every amount is an object:

```json
{ "micros": 50000000, "display": "$50.000000" }
```

`micros` is millionths of a US dollar (`1 USD = 1,000,000 micros`), so sub-cent usage charges
are exact. Request bodies take **cents** (`amount_cents`, `below_cents`).

### Errors

Errors are a JSON object with a single message:

```json
{ "error": "insufficient credit: top up to admit new sessions" }
```

| Status | When |
| --- | --- |
| `400` | Invalid request: malformed JSON, unknown field, out-of-range value |
| `401` | Missing, malformed, unknown, revoked or expired key — or a relay key off `/v1/usage` |
| `402` | Payment required (tenant never paid) or insufficient credit |
| `403` | Tenant suspended, archived or deleted; a `mint` or `readonly` key outside its scope; a key used from an address it is not allowed from |
| `404` | Not found |
| `409` | Conflict: already exists, or a status change that is not allowed |
| `429` | Rate limited: signups, or a key over its own rate limit (`Retry-After` is set) |
| `502` | Upstream payment provider (Stripe) error |
| `503` | Payments are not configured on this deployment |
| `500` | Internal error (message is always `"internal error"`) |

See the full [error codes table](/reference/errors/).

### Key kinds

Routes marked **backend key** require a key of kind `backend`; a `relay` key gets `401` on
them. `POST /v1/usage` takes a relay key — see the [Usage reporting API](/reference/usage-api/).

Two narrower kinds exist for agents, MCP servers and dashboards, so they never need your owner
key:

| Kind | Can | Cannot |
| --- | --- | --- |
| `backend` | Everything: rooms, moderation, tokens of any grant, keys, billing | Report usage |
| `mint` | Mint viewer and publisher client tokens (`MintClientToken`); read rooms and participants; list verification keys | Mint moderator or owner tokens; create, change or close rooms; moderate; keys; billing |
| `readonly` | Read rooms, participants, watchdogs, the moderation log and room events; `GET /v1/billing` and `GET /v1/billing/ledger` | Change anything; mint tokens; keys; account export |
| `relay` | `POST /v1/usage` | Everything else |

A `mint` or `readonly` key outside its scope gets `403` over REST and `PERMISSION_DENIED` over
gRPC. Anything added to the API later is closed to them until listed here.

### Expiry, allowed networks and rate limits

Any key can be issued with:

- **`expires_at`** — after it, the key answers `401` with `invalid api key: expired`. Rotating an
  expiring key issues a replacement with the same lifetime, counted from the rotation.
- **`allowed_networks`** — CIDR prefixes (or single addresses) the key may be used from. From
  anywhere else it gets `403` / `PERMISSION_DENIED`. Behind MOQOM's load balancer the address is
  the one the balancer saw, not a client-supplied `X-Forwarded-For`.
- **`rate_limit_per_minute`** — over it, `429` / `RESOURCE_EXHAUSTED`. Bursts of up to ten
  seconds' allowance are absorbed. `mint` and `readonly` keys default to 600 a minute;
  `backend` and `relay` keys have no per-key limit unless you set one. The limit is applied per
  control-plane instance, so treat it as a ceiling on one runaway client, not an exact quota.

### Leaked keys

MOQOM is applying to GitHub's secret scanning partner program for `mqk_` keys. Once that is
live, a key GitHub reports from a public repository, gist, issue, pull request or Actions log is
**revoked automatically** as soon as the report arrives, and the account email is told which key,
where it was found, and what to do. A revoked last backend key
stops token minting, as revoking it yourself would, so issue a replacement straight away. The
revocation appears in that key's [audit](#get-v1keysidaudit).

## Route summary

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/v1/rates` | none | Public rate card |
| `POST` | `/v1/signup` | none | New tenant, first API key, first checkout |
| `GET` | `/v1/billing` | backend or readonly key | Balance, status, recent ledger |
| `POST` | `/v1/billing/checkout` | backend key | Open a top-up checkout |
| `POST` | `/v1/billing/portal` | backend key | Open the Stripe customer portal |
| `PUT` | `/v1/billing/auto-top-up` | backend key | Configure automatic top-ups |
| `PUT` | `/v1/billing/spend-alerts` | backend key | Monthly spend alerts ([guide](/guides/spend-limits-and-alerts/)) |
| `PUT` | `/v1/billing/spend-limit` | backend key | Monthly spend limit ([guide](/guides/spend-limits-and-alerts/)) |
| `GET` | `/v1/keys` | backend key | List keys |
| `POST` | `/v1/keys` | backend key | Issue a key (secret shown once) |
| `DELETE` | `/v1/keys/{id}` | backend key | Revoke a key |
| `POST` | `/v1/keys/{id}/rotate` | backend key | Replace a key with an overlap |
| `GET` | `/v1/keys/{id}/audit` | backend key | One key's use, counted per minute |
| `GET` | `/v1/audit` | backend key | Every key's use, counted per minute |
| `POST` | `/v1/usage` | relay key | Report usage ([reference](/reference/usage-api/)) |
| `GET` | `/v1/usage/summary` | backend key | Usage by tier and role for a range, beside Agora's list |
| `POST` | `/v1/usage/estimate` | backend key | Price a what-if scenario |
| `POST` | `/v1/migrate/agora/preview` | backend key | Read Agora projects and usage, credentials used once |
| `POST` | `/v1/stripe/webhook` | Stripe signature | Reserved for Stripe — not for customer use |
| `POST` | `/v1/github/secret-scanning` | GitHub signature | Reserved for GitHub — see [Leaked keys](#leaked-keys) |

Ledger, account export, usage summary and estimate, and the Agora migration preview are listed
in the [Admin API overview](/reference/admin-api/).

---

## `GET /v1/rates`

The rate card in force. No authentication.

```sh
curl -sS https://api.moqom.cloud/v1/rates
```

```json
{
  "currency": "usd",
  "direct_fee_per_1000_minutes": { "micros": 500000, "display": "$0.500000" },
  "direct_free_minutes_per_month": 1000,
  "model": "prepaid, 85% of Agora's list price at Agora's volume bands, at least one cent under",
  "share_basis_points": 8500,
  "self_hosted_fee_per_gib": { "micros": 50000, "display": "$0.050000" },
  "agora_list_per_1000_participant_minutes": {
    "host":               { "hd": { "micros": 3990000, "display": "$3.990000" }, "...": "every tier" },
    "audience":           { "hd": { "micros": 3990000, "display": "$3.990000" }, "...": "every tier" },
    "broadcast_audience": { "hd": { "micros": 1990000, "display": "$1.990000" }, "...": "every tier" }
  },
  "volume_bands": [
    {
      "from_minutes": 0,
      "agora_discount_basis_points": 0,
      "per_1000_participant_minutes": {
        "host": {
          "audio":   { "micros": 840000,   "display": "$0.840000" },
          "hd":      { "micros": 3390000,  "display": "$3.390000" },
          "full_hd": { "micros": 7640000,  "display": "$7.640000" },
          "2k":      { "micros": 13590000, "display": "$13.590000" },
          "2k_plus": { "micros": 30590000, "display": "$30.590000" }
        },
        "audience": { "...": "the same as host" },
        "broadcast_audience": {
          "audio":   { "micros": 500000,   "display": "$0.500000" },
          "hd":      { "micros": 1690000,  "display": "$1.690000" },
          "full_hd": { "micros": 3900000,  "display": "$3.900000" },
          "2k":      { "micros": 6790000,  "display": "$6.790000" },
          "2k_plus": { "micros": 15290000, "display": "$15.290000" }
        }
      }
    },
    { "from_minutes": 100000,  "agora_discount_basis_points": 500,  "per_1000_participant_minutes": { "...": "" } },
    { "from_minutes": 500000,  "agora_discount_basis_points": 700,  "per_1000_participant_minutes": { "...": "" } },
    { "from_minutes": 1000000, "agora_discount_basis_points": 1000, "per_1000_participant_minutes": { "...": "" } }
  ],
  "recording_storage_cost_per_gib_month": { "...": "by storage class" }
}
```

| Field | Meaning |
| --- | --- |
| `share_basis_points` | MOQOM's share of Agora's price at the same band; `8500` = 85%, or 15% under |
| `agora_list_per_1000_participant_minutes` | Agora's list price, by [role and tier](/billing/tiers/) |
| `volume_bands` | Each band's start in participant-minutes this month (UTC), Agora's discount there, and MOQOM's rate per 1,000 participant-minutes by role and tier. Every rate is at least 1¢ under Agora's at the same band |
| `self_hosted_fee_per_gib` | The whole price per GiB of egress from your own relays, never above the hosted rate |
| `direct_free_minutes_per_month` | Direct participant-minutes each account gets free per calendar month (UTC) ([point-to-point calls](/guides/peer-to-peer/)) |
| `direct_fee_per_1000_minutes` | Price per 1,000 direct participant-minutes past the free allowance, the same on MOQOM Cloud and self-hosted. Charged on top of the relay session |

The values above are illustrative; the live response is authoritative. See
[Pricing model](/billing/pricing/).

---

## `POST /v1/signup`

Creates a tenant, its first **backend** API key (named `default`), and a checkout for the first
top-up. The tenant is `pending` until that payment succeeds. No authentication; limited to **5
signups per hour per client address** (`429` beyond that).

| Field | Type | Rules |
| --- | --- | --- |
| `email` | string | A valid address, at most 254 characters |
| `name` | string | 1–200 characters |

```sh
curl -sS https://api.moqom.cloud/v1/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"dev@example.com","name":"Example Inc"}'
```

**`201 Created`**

```json
{
  "tenant": "t_3f9a0c1d2e4b5a69",
  "status": "pending",
  "api_key": "mqk_9c1e2f3a4b5d6e7f_x2VtQ…",
  "key_id": "9c1e2f3a4b5d6e7f",
  "checkout_url": "https://checkout.stripe.com/c/pay/cs_…",
  "note": "The API key is shown once. Store it now; it cannot be recovered, only revoked and replaced."
}
```

`checkout_url` is for the default first top-up. If it could not be opened, it is empty and you
can open one later with [`POST /v1/billing/checkout`](#post-v1billingcheckout) using the new key.

---

## `GET /v1/billing`

Balance, status and recent ledger for the key's tenant. **Backend key.**

```sh
curl -sS https://api.moqom.cloud/v1/billing \
  -H "Authorization: Bearer $MOQOM_API_KEY"
```

**`200 OK`**

```json
{
  "tenant": {
    "id": "t_3f9a0c1d2e4b5a69",
    "name": "Example Inc",
    "email": "dev@example.com",
    "status": "active",
    "has_card": true,
    "auto_top_up": {
      "enabled": false,
      "below": { "micros": 0, "display": "$0.000000" },
      "amount": { "micros": 0, "display": "$0.000000" }
    },
    "created_at": "2026-10-01T17:03:11Z"
  },
  "balance": { "micros": 41237500, "display": "$41.237500" },
  "admitted": true,
  "recent": [
    {
      "kind": "usage",
      "amount": { "micros": -3980, "display": "-$0.003980" },
      "capped": true,
      "reference": "live/42",
      "at": "2026-10-06T09:16:02Z"
    }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `tenant.status` | `pending`, `active`, `suspended`, `archived`, `deleted` |
| `tenant.has_card` | A saved payment method exists (needed for auto top-up) |
| `tenant.last_top_up_error` | Present when the last automatic top-up failed |
| `balance` | Prepaid credit remaining |
| `admitted` | Whether new sessions and tokens are admitted now |
| `recent[]` | Up to 50 recent [ledger entries](/guides/events-and-billing/#ledger-entry-kinds): `kind`, `amount`, `capped`, `reference`, `detail`, `at` |

---

## `POST /v1/billing/checkout`

Opens a hosted checkout page for buying credit. **Backend key.**

| Field | Type | Rules |
| --- | --- | --- |
| `amount_cents` | integer | Whole cents, from **$10.00** (`1000`) to **$10,000.00** (`1000000`) |

```sh
curl -sS https://api.moqom.cloud/v1/billing/checkout \
  -H "Authorization: Bearer $MOQOM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"amount_cents": 5000}'
```

**`200 OK`**

```json
{ "checkout_url": "https://checkout.stripe.com/c/pay/cs_…" }
```

After payment the customer returns to `moqom.cloud`; credit is added when the payment succeeds.
Errors: `400` out of range, `403` tenant archived/deleted, `502` Stripe error, `503` payments not
configured.

---

## `POST /v1/billing/portal`

Opens the Stripe customer portal (receipts, saved cards). **Backend key.** No body.

```sh
curl -sS -X POST https://api.moqom.cloud/v1/billing/portal \
  -H "Authorization: Bearer $MOQOM_API_KEY"
```

**`200 OK`**

```json
{ "portal_url": "https://billing.stripe.com/p/session/…" }
```

`400` if the tenant has never paid (there is nothing to manage yet).

---

## `PUT /v1/billing/auto-top-up`

Configures automatic top-ups: when a usage charge takes the balance below `below_cents`, MOQOM
charges the saved card `amount_cents`. **Backend key.**

| Field | Type | Rules |
| --- | --- | --- |
| `enabled` | boolean | |
| `below_cents` | integer | Threshold, not negative |
| `amount_cents` | integer | When enabled: $10.00–$10,000.00 |

```sh
curl -sS -X PUT https://api.moqom.cloud/v1/billing/auto-top-up \
  -H "Authorization: Bearer $MOQOM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"enabled": true, "below_cents": 1000, "amount_cents": 5000}'
```

**`200 OK`** — the updated tenant:

```json
{
  "id": "t_3f9a0c1d2e4b5a69",
  "name": "Example Inc",
  "email": "dev@example.com",
  "status": "active",
  "has_card": true,
  "auto_top_up": {
    "enabled": true,
    "below": { "micros": 10000000, "display": "$10.000000" },
    "amount": { "micros": 50000000, "display": "$50.000000" }
  },
  "created_at": "2026-10-01T17:03:11Z"
}
```

Auto top-up needs a saved card, which is stored when you pay a checkout. See
[Top-ups & auto top-up](/billing/top-ups/).

---

## `GET /v1/keys`

Lists the tenant's keys, including revoked ones. Secrets are never returned. **Backend key.**

```sh
curl -sS https://api.moqom.cloud/v1/keys -H "Authorization: Bearer $MOQOM_API_KEY"
```

**`200 OK`**

```json
{
  "keys": [
    { "id": "9c1e2f3a4b5d6e7f", "name": "default", "kind": "backend", "created_at": "2026-10-01T17:03:11Z" },
    { "id": "5b7e0d2a9c3f1e48", "name": "relay-us-east-1", "kind": "relay", "created_at": "2026-10-06T09:12:44Z" },
    { "id": "0a1b2c3d4e5f6a7b", "name": "old-ci", "kind": "backend", "created_at": "2026-09-02T10:00:00Z", "revoked_at": "2026-10-02T08:30:00Z" },
    {
      "id": "3c4d5e6f7a8b9c0d", "name": "support-agent", "kind": "mint", "created_at": "2026-10-06T10:00:00Z",
      "expires_at": "2027-01-04T10:00:00Z",
      "allowed_networks": ["203.0.113.0/24"],
      "rate_limit_per_minute": 600
    }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `kind` | `backend`, `mint`, `readonly` or `relay` |
| `revoked_at` | Present once the key has stopped working |
| `retires_at` | Present while a rotated key is still working; when it stops |
| `expires_at` | Present for a key issued with an expiry |
| `expired` | `true` once `expires_at` has passed |
| `allowed_networks` | Present when the key is restricted to these prefixes |
| `rate_limit_per_minute` | The key's effective limit; absent for none |

---

## `POST /v1/keys`

Issues a new key. The plaintext `api_key` appears **only in this response**. **Backend key.**

| Field | Type | Rules |
| --- | --- | --- |
| `name` | string | 1–100 characters |
| `kind` | string | `backend` (default), `mint`, `readonly` or `relay` — see [key kinds](#key-kinds) |
| `expires_at` | [RFC 3339](https://www.rfc-editor.org/rfc/rfc3339) time | Optional. At least 1 hour and at most 3 years ahead |
| `allowed_networks` | array of strings | Optional. Up to 20 CIDR prefixes or addresses, IPv4 or IPv6; stored as prefixes |
| `rate_limit_per_minute` | integer | Optional. 0 (the kind's default) to 100000 |

```sh
curl -sS https://api.moqom.cloud/v1/keys \
  -H "Authorization: Bearer $MOQOM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"name":"support-agent","kind":"mint","expires_at":"2027-01-04T10:00:00Z","allowed_networks":["203.0.113.0/24"]}'
```

**`201 Created`**

```json
{
  "key": {
    "id": "7f6e5d4c3b2a1908", "name": "support-agent", "kind": "mint", "created_at": "2026-10-06T09:20:00Z",
    "expires_at": "2027-01-04T10:00:00Z", "allowed_networks": ["203.0.113.0/24"], "rate_limit_per_minute": 600
  },
  "api_key": "mqk_7f6e5d4c3b2a1908_Q1wE…"
}
```

Revoking a `mint` or `readonly` key never needs `?confirm=stop-service`: it stops that agent and
nothing else.

---

## `DELETE /v1/keys/{id}`

Revokes a key immediately. **Backend key.**

```sh
curl -sS -X DELETE https://api.moqom.cloud/v1/keys/0a1b2c3d4e5f6a7b \
  -H "Authorization: Bearer $MOQOM_API_KEY"
```

**`204 No Content`**

You cannot revoke the key the request is authenticated with (`400`): issue a replacement first,
then revoke the old key using the new one. `404` if no such key exists in your tenant.

:::caution[Revoking your last working key stops service]
If the key is your last working **backend** key, revoking it stops all video: your backend can no
longer mint tokens, so new sessions are refused at once and live ones end within 15 minutes, when
their tokens can't renew. For the last **relay** key, your self-hosted relays stop reporting usage.
Either request is refused with `409` and `"code": "would_stop_service"` unless you add
`?confirm=stop-service`. Rotate instead.
:::

---

## `POST /v1/keys/{id}/rotate`

Rotates a key with no gap in service. **Backend key.** Issues a replacement with the same name,
kind, allowed networks and rate limit (and, for an expiring key, the same lifetime from now), and keeps the old key working for `overlap_seconds` (default 86400, at most 604800) while
you roll the new one out. Live sessions are never affected: client tokens don't depend on the API
key that minted them.

```sh
curl -sS -X POST https://api.moqom.cloud/v1/keys/0a1b2c3d4e5f6a7b/rotate \
  -H "Authorization: Bearer $MOQOM_API_KEY" \
  -d '{"overlap_seconds": 3600}'
```

**`201 Created`**

```json
{
  "key": { "id": "9f8e7d6c5b4a3921", "name": "production", "kind": "backend", "created_at": "2026-10-06T13:00:00Z" },
  "api_key": "mqk_9f8e7d6c5b4a3921_…",
  "old_key_retires": "2026-10-06T14:00:00Z"
}
```

The new key is shown once. Until `old_key_retires`, `GET /v1/keys` lists the old key with
`retires_at`; afterwards with `revoked_at`. Revoking a retiring key early is allowed. Rotating
the key the request is authenticated with is allowed too.

An expired key cannot be rotated (`400`); issue a new one.

---

## `GET /v1/keys/{id}/audit`

How a key has been used, newest first. **Backend key.** `GET /v1/audit` is the same for every key
in your tenant, optionally filtered with `?key=<id>`. `limit` is 1–1,000 (default 200). Secrets
never appear.

```sh
curl -sS "https://api.moqom.cloud/v1/keys/3c4d5e6f7a8b9c0d/audit?limit=50" \
  -H "Authorization: Bearer $MOQOM_API_KEY"
```

**`200 OK`**

```json
{
  "entries": [
    {
      "key_id": "3c4d5e6f7a8b9c0d",
      "minute": "2026-10-06T09:41:00Z",
      "operation": "/moqom.admin.v1.Tokens/MintClientToken",
      "address": "203.0.113.20",
      "outcome": "ok",
      "count": 214,
      "first_at": "2026-10-06T09:41:00.112Z",
      "last_at": "2026-10-06T09:41:59.870Z"
    }
  ]
}
```

Uses are counted per minute, per operation, source address and outcome. `operation` is the gRPC
method, or the HTTP method and route (`GET /v1/keys/{id}`). `outcome` is one of:

| Outcome | Meaning |
| --- | --- |
| `ok` | Allowed |
| `bad_secret` | Someone presented this key's ID with the wrong secret |
| `revoked` / `expired` | The key was used after it stopped working |
| `out_of_scope` | A `mint`, `readonly` or `relay` key called something outside its kind |
| `address_refused` | Used from outside the key's allowlist |
| `rate_limited` | Over the key's rate limit |
| `leaked_revoked` | Revoked because GitHub found it in public; `detail` says where |

Entries can lag a call by up to 10 seconds, and are kept for 400 days.

---

## `GET /v1/usage/summary`

Your metered usage over `[from, to)`, grouped by role, tier and relay hosting. **Backend key.**
`from` and `to` are dates (midnight UTC) or [RFC 3339](https://www.rfc-editor.org/rfc/rfc3339) times, at most 400 days apart; `to` is
exclusive. `charged` is the sum of the ledger's usage entries, so it is what you paid.
`agora_list` prices the same seconds at Agora's list price for the same role and tier: hosts and
interactive audience at the interactive rate, broadcast audience at the broadcast rate.

```sh
curl -sS "https://api.moqom.cloud/v1/usage/summary?from=2026-10-01&to=2026-11-01" \
  -H "Authorization: Bearer $MOQOM_API_KEY"
```

```json
{
  "from": "2026-10-01T00:00:00Z",
  "to": "2026-11-01T00:00:00Z",
  "elapsed_seconds": 457200,
  "lines": [
    {
      "role": "broadcast_audience", "tier": "hd", "hosting": "cloud",
      "records": 1200, "seconds": 432000, "participant_minutes": 7200,
      "egress_bytes": 84180000000, "ingress_bytes": 0, "capped_records": 0,
      "charged": { "micros": 12100000, "display": "$12.100000" },
      "agora_list": { "micros": 14328000, "display": "$14.328000" },
      "savings": { "micros": 2228000, "display": "$2.228000" },
      "savings_basis_points": 1555
    }
  ],
  "by_role": [ … ], "by_tier": [ … ], "total": { … },
  "projection_period": { "charged": { … }, "agora_list": { … }, "savings": { … } },
  "projection_30_days": { "charged": { … }, "agora_list": { … }, "savings": { … } }
}
```

`by_role`, `by_tier` and `total` have the fields of a line. The projections extrapolate the
period's average to its full length and to 30 days. They are estimates, and are absent until an
hour of the period has elapsed. `projection_period` is also absent once the period has ended.

## `POST /v1/usage/estimate`

Prices a what-if month with the rate card in force. **Backend key.** Each group is
`count` identical participants, each receiving `tiles` video streams of `tile_width` × `tile_height`
at an assumed `kbps_per_tile` (`tiles: 0` is audio only). The tier is the aggregate pixels
received, as on the bill. Every figure is an estimate from the assumed bitrate.

```sh
curl -sS -X POST https://api.moqom.cloud/v1/usage/estimate \
  -H "Authorization: Bearer $MOQOM_API_KEY" \
  -d '{"hosting":"cloud","minutes":1200,"groups":[
        {"role":"host","count":2,"tiles":1,"tile_width":1280,"tile_height":720,"kbps_per_tile":1800},
        {"role":"broadcast_audience","count":500,"tiles":1,"tile_width":1280,"tile_height":720,"kbps_per_tile":1800}]}'
```

The response has a line per group (`tier`, `kbps`, `participant_minutes`, `egress_gib`,
`charge`, `capped`, `agora_list`) and a `total` with `charge`, `agora_list`, `savings` and
`savings_basis_points`. `hosting` is `cloud` or `self_hosted`; `minutes` is 1 to 44,640 per
participant; at most 8 groups of up to 1,000,000.

## `POST /v1/migrate/agora/preview`

Reads your Agora projects and the last 90 full UTC days of their usage, and prices that usage at
Agora's list price beside a MOQOM Cloud estimate. **Backend key.** See
[Migrating from Agora](/guides/migrate-from-agora/).

```sh
curl -sS -X POST https://api.moqom.cloud/v1/migrate/agora/preview \
  -H "Authorization: Bearer $MOQOM_API_KEY" \
  -d '{"customer_id":"…","customer_secret":"…"}'
```

The credentials are used for this one request, sent only to `https://api.agora.io`, and never
stored, logged or returned. Limits: 6 previews an hour per tenant, the first 20 Agora projects,
25 seconds in all. Agora rejecting the credentials answers `400`, not `401`. Agora rate limiting
the account answers `429`, and other Agora failures answer `502` or `504`.

The response has `projects` (`id`, `name`, `enabled`, `seconds_by_tier`, and `error` for a
project whose usage could not be read; App IDs and App Certificates are never read), `tiers` and
`total` (minutes, `agora_list`, `moqom_estimate`, `savings`, and both again as if every minute
were broadcast audience), `per_30_days`, `notes`, and a migration `checklist`.

---

## `POST /v1/stripe/webhook`

MOQOM's receiver for Stripe events, verified by Stripe's signature. It is listed here only so
you recognise it; it is not part of the customer API.
