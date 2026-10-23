---
title: Usage reporting API
description: POST /v1/usage — the record schema, idempotent ids, batch limits and the admitted flag for self-hosted relays.
---

Self-hosted relays report what they served with `POST /v1/usage`. MOQOM rates each record,
charges your prepaid balance, and tells the relay whether to keep admitting new sessions.

| | |
| --- | --- |
| Endpoint | `POST https://api.moqom.cloud/v1/usage` |
| Auth | `Authorization: Bearer mqk_…` with a **relay** key |
| Batch size | **At most 5,000 records** per request |
| Body | At most 1 MiB; unknown fields rejected |
| Idempotency | Per record, by `id` |

Backend keys are refused here (`401`); relay keys are refused everywhere else.

The MOQOM relay does all of this for you once it is given a relay key — see
[Configure the relay to report usage](/guides/self-hosting/#2-configure-the-relay-to-report-usage).
The rest of this page is the contract, for reporting from your own software or checking what the
relay sends. Relays MOQOM runs for you report the same records with MOQOM's own credentials; you
do not configure anything for them.

## Request

```json
{
  "records": [
    {
      "id": "relay-eu-1:2026-10-06T09:15:00Z:bea/41d07a9e",
      "tenant": "t_3f9a0c1d2e4b5a69",
      "room": "live/42",
      "participant": "bea/41d07a9e",
      "role": "broadcast_audience",
      "tier": "full_hd",
      "seconds": 60,
      "egress_bytes": 104857600,
      "ingress_bytes": 0
    }
  ]
}
```

### Record fields

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `id` | string | yes | 1–200 characters. Unique per participant-interval **from your relay**. Makes the record idempotent. |
| `tenant` | string | no | Optional with a relay key. If present it must equal the key's tenant, or the request is rejected. |
| `room` | string | no | Room name. Shown as the ledger entry's `reference`. |
| `participant` | string | no | Participant identifier, for your own reconciliation. |
| `role` | string | yes | `host`, `audience`, or `broadcast_audience` |
| `tier` | string | yes | `audio`, `hd`, `full_hd`, `2k`, `2k_plus` — see [Tiers](/billing/tiers/) |
| `seconds` | integer | yes | Connected time in this interval, `0`–`86400` |
| `egress_bytes` | integer | yes | Bytes sent to this participant, `≥ 0` |
| `ingress_bytes` | integer | yes | Bytes received from this participant, `≥ 0` |
| `direct_seconds` | integer | no | Time in this interval the participant held a [point-to-point call](/guides/peer-to-peer/) ticket, `0`–`86400`. Absent means `0`; relays that predate point-to-point calls never send it |

**Tier** is chosen by the *sum of pixels of every video stream the participant received at
once* — audio-only is `audio`; up to 1280×720 is `hd`; up to 1920×1080 `full_hd`; up to
2560×1440 `2k`; above that `2k_plus`.

### Choosing ids

The `id` is what makes retries safe: a record whose `id` has already been charged for your tenant
is counted as a duplicate and charged nothing. A good id combines relay, interval start and
participant, e.g. `relay-eu-1:2026-10-06T09:15:00Z:bea/41d07a9e`. Never reuse an id for a
different interval.

### Validation

The whole request is rejected with **400** (and nothing is charged) if any record:

- has an empty or over-long `id`,
- has an unknown `role` or `tier`,
- has negative quantities, or `seconds` or `direct_seconds` above 86,400,
- names a different tenant from the relay key's.

There are more than 5,000 records → **400** `at most 5000 records per report`.

An empty batch, `{"records":[]}`, is valid: it charges nothing and returns `admitted`. A relay
with nobody connected can use it to learn when it may admit sessions again.

## Response

**`200 OK`**

```json
{
  "charged": 1,
  "duplicates": 0,
  "unbilled": 0,
  "total": { "micros": 4580, "display": "$0.004580" },
  "admitted": true
}
```

| Field | Meaning |
| --- | --- |
| `charged` | Records charged in this request |
| `duplicates` | Records whose `id` was already charged — safe to ignore |
| `unbilled` | Records accepted but not charged (e.g. exempt test tenants) |
| `total` | Sum charged by this request |
| `admitted` | Whether the tenant may admit **new** sessions. When `false`, stop admitting new sessions until it returns to `true`. |

## Retry policy

- On a network error, timeout or `5xx`: retry the **same batch with the same ids**. Duplicates are
  free.
- On `400`: fix the batch; retrying unchanged will fail again. One invalid record rejects the
  whole batch, so the MOQOM relay splits a rejected batch to find the invalid records, sends the
  rest, and drops and logs only those.
- On `401`: the relay key is wrong or revoked. The MOQOM relay logs this as an error and keeps
  the records, retrying until the key is fixed.

## How a record is priced

Self-hosted records are charged the per-GiB self-hosted fee on `egress_bytes` only, never more
than the hosted rate for the record's role and tier:

```text
charge = min( self_hosted_fee_per_gib × egress_GiB ,  rate(role, tier) × seconds / 60,000 )
```

where `rate` is the first-band price per 1,000 participant-minutes from
[`GET /v1/rates`](/reference/billing-api/#get-v1rates). The example above —
100 MiB in one minute at a $0.05/GiB fee — would be about $0.004883, just over the Full HD
broadcast-audience rate for one minute ($0.0039), so it is charged that rate. 100 MiB a
minute is about 14 Mbit/s, far above a Full HD stream; at a typical 4 Mbit/s the same minute
costs about $0.0014. See [Self-hosted fee](/billing/self-hosted/).

`direct_seconds` is charged on top, at the same rate as on MOQOM Cloud: the
first `direct_free_minutes_per_month` of each calendar month (UTC) are free for your account,
then `direct_fee_per_1000_minutes` applies, both from
[`GET /v1/rates`](/reference/billing-api/#get-v1rates). The allowance is counted across all your
relays, and a duplicate record moves neither the fee nor the allowance.

After a batch is charged, [auto top-up](/billing/top-ups/) runs if the balance fell below your
threshold.
