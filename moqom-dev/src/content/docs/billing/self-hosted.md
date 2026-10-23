---
title: Self-hosted fee
description: What self-hosted (BYOC) relays pay — the platform fee only, never more than the hosted rate.
---

When usage is served by a relay **you** run, you have already paid for the bandwidth and the
machine. MOQOM charges only the **platform fee**:

```text
charge = min( egress_GiB × self_hosted_fee_per_gib ,  rate(role, tier) × seconds / 60,000 )
```

| | MOQOM Cloud relay | Self-hosted relay |
| --- | --- | --- |
| Price | 85% of Agora's rate per minute, at your volume band | **$0.05 per GiB of egress — the whole price** |
| Bandwidth & compute | Included | **Not charged** — you pay your provider |
| Never more than | Agora's rate less at least 1¢ per 1,000 minutes | The hosted rate for the same minutes |
| Moderation, rooms, tokens, events | Included | Included |
| [Relay pool](/guides/private-networks/) lock | Dedicated relays: $0.10 per relay-hour | **No charge** |

The current self-hosted fee is **$0.05 per GiB** of relay egress; the live value is
`self_hosted_fee_per_gib` in [`GET /v1/rates`](/reference/billing-api/#get-v1rates).

### Why $0.05

Agora bills per participant-minute by resolution tier, not per GiB. Converted at typical
bitrates, its cheapest rate is about **$0.16 per GiB**: 720p to 1080p watched by a broadcast
audience. Everything else costs more per GiB on Agora, because smaller streams carry fewer bytes
for the same per-minute price.

| Received | Agora, per GiB | $0.05 is under it by |
| --- | --- | --- |
| 720p at 1.8 Mbit/s, broadcast audience | ~$0.16 | 69% |
| 1080p at 4 Mbit/s, broadcast audience | ~$0.16 | 70% |
| 4K at 12 Mbit/s, broadcast audience | ~$0.21 | 77% |
| 720p, interactive | ~$0.32 | 85% |
| 360p at 0.6 Mbit/s, broadcast audience | ~$0.48 | 90% |
| Audio at 64 kbit/s, broadcast audience | ~$1.32 | 97% |

The fee alone is about 69% under Agora. Your own bandwidth cost comes on top, and no record is
ever charged more than the same minutes would cost on MOQOM Cloud.

:::caution[Launch pricing]
Launch pricing, subject to change before general availability. The platform fee is a
configurable default.
:::

## Example

A self-hosted relay serves 2 TiB (2,048 GiB) to viewers in a month:

```text
2,048 GiB × $0.05 = $102.40
```

## How it is metered

Your relays report usage with a **relay key** to [`POST /v1/usage`](/reference/usage-api/).
Every record is charged to that key's tenant. The response's `admitted` flag tells your relay
whether to keep admitting new sessions, so the prepaid gate holds on infrastructure MOQOM does
not run.

See [Self-hosting relays](/guides/self-hosting/).
