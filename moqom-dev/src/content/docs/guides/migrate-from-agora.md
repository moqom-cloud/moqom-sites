---
title: Migrating from Agora
description: Map Agora projects, tokens and SDK calls to MOQOM, and compare what your Agora usage would cost on MOQOM Cloud.
---

This guide maps the parts of an Agora integration to their MOQOM equivalents, and shows how to
compare costs before you move any traffic. It describes Agora only from Agora's public
documentation and list prices.

## Compare costs first

The console at [moqom.cloud/account](https://moqom.cloud/account/) has a **Migrate from Agora**
tab. Paste an Agora Customer ID and Customer Secret (Agora Console, **RESTful API**). MOQOM's
servers use them for one request to Agora's Console RESTful API, which browsers cannot call
directly:

- `GET https://api.agora.io/dev/v1/projects` for the project list. The App ID and App
  Certificate in that response are not read.
- `GET https://api.agora.io/dev/v3/usage?business=default` for each project, at most 20, over the
  last 90 full UTC days. This gives seconds of audio, HD, Full HD, 2K and 2K+ video per day.

You get your projects, your minutes by tier, what those minutes cost at Agora's list price, an
estimate of what they would cost on MOQOM Cloud, and a checklist.

- **The credentials are used once.** They are sent only to `api.agora.io` over HTTPS and are not
  stored, logged, cached or returned. Create a new Customer Secret for the preview, read-only if
  your Agora account offers that, and delete it in Agora Console afterwards.
- **Agora figures are list prices.** If you have negotiated rates, your Agora bill is lower than
  shown.
- **Agora's usage API does not split hosts from broadcast audience.** The preview prices every
  minute as a host or interactive audience member, and also shows the total as if every minute
  were broadcast audience. Your actual mix is somewhere between the two.
- **MOQOM figures are estimates.** MOQOM bills measured bytes, and Agora reports minutes, so the
  preview assumes a bitrate per tier (64 kbps audio, 1.5 Mbit/s HD, 3.5 Mbit/s Full HD, 6 Mbit/s
  2K, 12 Mbit/s 2K+) and prices that with the [published rate card](/billing/pricing/). Agora's
  legacy HDP (HD+) minutes are counted as Full HD.

The same call is available as
[`POST /v1/migrate/agora/preview`](/reference/billing-api/#post-v1migrateagorapreview).

## What maps to what

| Agora | MOQOM |
| --- | --- |
| Project | A tenant, or a room-name prefix within one tenant |
| App ID | Your tenant ID and a backend API key (`mqk_…`), which stays on your servers |
| App Certificate and your token server | Your token server calling [`MintToken`](/guides/backend-go/#mint-a-token) with the backend key |
| Channel | Room, created with `CreateRoom` |
| Host / broadcaster | A token with publish rights (`PublishCamera`, `PublishScreenShare`) |
| Audience | A token without publish rights |
| Usage by resolution tier | [`GET /v1/usage/summary`](/reference/billing-api/#get-v1usagesummary), same tier boundaries |
| RESTful API Customer ID and Secret | Backend API keys, issued and rotated in the console or with `POST /v1/keys` |

MOQOM classifies a participant's usage by the aggregate pixels of every video stream they receive
at once: HD up to 1280×720, Full HD up to 1920×1080, 2K up to 2560×1440, 2K+ above. These are the
boundaries Agora publishes. Each tier is charged 85% of Agora's price for that role, tier and
volume band, always at least 1¢ per 1,000 minutes under ([tiers and rates](/billing/tiers/)).

## Steps

1. **Create a tenant and keys.** Sign up at [moqom.cloud](https://moqom.cloud/signup/), add
   credit, and issue a backend key per environment.
2. **Replace token generation.** Keep authenticating users as you do now. Where your token server
   builds an Agora token from the App ID and App Certificate, call `MintToken` instead, naming the
   user, the device thumbprint the client SDK reports, the room, and what they may publish. See
   [Backend: Go](/guides/backend-go/) or [Backend: Rust](/guides/backend-rust/).
3. **Create rooms.** Where you used channel names, create rooms with the same names from your
   backend. `CreateRoom` is idempotent on the name.
4. **Swap the client SDK.** Replace the Agora RTC SDK's join, publish and subscribe calls with the
   MOQOM client SDK for each platform. Check [platform status](/platforms/status/) first, since
   not every platform is at the same stage.
5. **Move moderation.** Agora's kick and ban calls map to MOQOM's moderation verbs, attributed to
   the person who asked for them. See [Moderation](/guides/moderation/).
6. **Run side by side.** Move one room type or region at a time. Compare the console's
   **Savings** tab, which prices your metered usage at Agora's list, with your Agora invoice.
7. **Clean up.** Delete the Agora Customer Secret you used for the preview.
