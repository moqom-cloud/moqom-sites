---
title: Spend limits & alerts
description: Monthly spend alerts and an optional monthly spend limit — what the API supports, and why alerts are the recommended choice.
---

MOQOM is prepaid, so you never owe more than the credit you bought. Within that credit, two
optional controls watch a calendar month (UTC) of usage charges:

| | Spend alerts | Spend limit |
| --- | --- | --- |
| What it does | Records a notice when this month's spend crosses an amount | Refuses new sessions and ends live ones once this month's spend reaches it |
| Affects service | Never | Yes: every stream stops, including those in progress |
| Default | Off, unless a limit is set | Off |
| Recommendation | **Use them** | Optional, and not recommended for most apps |

## Spend alerts (recommended)

Set up to 10 amounts. Each one fires at most once a month, the first time this month's spend
crosses it. Alerts never stop a session.

```sh
curl -sS -X PUT https://api.moqom.cloud/v1/billing/spend-alerts \
  -H "Authorization: Bearer $MOQOM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"enabled": true, "thresholds_cents": [10000, 25000, 50000]}'
```

| Field | Type | Rules |
| --- | --- | --- |
| `enabled` | boolean | `false` silences every alert, defaults included |
| `thresholds_cents` | integer array | At most 10, each $1.00–$1,000,000.00 in whole cents, no duplicates. Must be empty when `enabled` is `false` |

With alerts on and no amounts of your own, the thresholds default to **50%, 80% and 100% of
your spend limit**. With no limit and no amounts, nothing alerts, so set amounts if you
don't use a limit.

Fired alerts are listed under `fired` in [`GET /v1/billing`](/reference/billing-api/#get-v1billing)
and on the Billing tab at [moqom.cloud/account](https://moqom.cloud/account/). Email delivery
to the account's billing address is in development.

## Spend limit (optional)

A limit is a hard stop for streams already in progress, not just new ones. Once this month's
usage charges reach it:

- New sessions are refused: `MintClientToken` fails with
  `FAILED_PRECONDITION` and the message `spend limit reached: …`.
- Live streams and calls end: each one stops when its current token expires (at most 15 minutes)
  and its renewal is refused.
- Auto top-up stops charging your card until the month turns over or the limit is raised.
- Moderation and administration keep working.

Topping up does not lift a limit. Raising or removing it does, or the next UTC month.

```sh
# Set a $500 monthly limit
curl -sS -X PUT https://api.moqom.cloud/v1/billing/spend-limit \
  -H "Authorization: Bearer $MOQOM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"enabled": true, "monthly_cents": 50000}'

# Remove it
curl -sS -X PUT https://api.moqom.cloud/v1/billing/spend-limit \
  -H "Authorization: Bearer $MOQOM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"enabled": false}'
```

| Field | Type | Rules |
| --- | --- | --- |
| `enabled` | boolean | |
| `monthly_cents` | integer | Required when enabled: $1.00–$1,000,000.00 in whole cents. `0` or absent when disabled |

:::caution[A limit stops your product]
When a limit is reached, everyone using your app loses video until someone raises it. For most
apps an outage costs more than the overspend it prevents. Prepaid credit already bounds what you
can spend; turn auto top-up off, or keep its amount small, if you want a tighter bound without a
hard stop. Use a limit only when stopping service is the outcome you want, for example a
fixed-budget pilot.
:::

## Response

Both routes return this month's spend state. The same fields appear in
[`GET /v1/billing`](/reference/billing-api/#get-v1billing).

```json
{
  "month": "2026-10",
  "month_spend": { "micros": 132400000, "display": "$132.400000" },
  "spend_limit": { "micros": 500000000, "display": "$500.000000" },
  "limit_reached": false,
  "alerts": {
    "enabled": true,
    "default": false,
    "thresholds": [
      { "micros": 100000000, "display": "$100.000000" },
      { "micros": 250000000, "display": "$250.000000" }
    ]
  },
  "fired": [
    { "threshold": { "micros": 100000000, "display": "$100.000000" }, "at": "2026-10-04T18:22:10Z" }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `month` | The UTC calendar month being measured |
| `month_spend` | Usage charged this month |
| `spend_limit` | The limit, or `null` when none is set |
| `limit_reached` | New sessions are being refused because of the limit |
| `alerts.default` | The thresholds are the 50/80/100% defaults of the limit |
| `alerts.thresholds` | The amounts in force, ascending |
| `fired` | Thresholds that have fired this month, and when |

Errors: `400` for an out-of-range or malformed value, `401` for a missing or relay key. See
[Error codes](/reference/errors/).
