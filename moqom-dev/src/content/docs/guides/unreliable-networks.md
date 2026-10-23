---
title: Unreliable networks
description: How MOQOM keeps mobile video and data flowing through network switches, drops and congestion, with no code on your side.
---

Mobile networks drop, switch and congest. MOQOM treats that as the normal case. Everything on
this page is on by default in the Swift SDK; you write no retry logic.

## Network switches

[QUIC](https://www.rfc-editor.org/rfc/rfc9000) connections survive an address change. When a phone walks off Wi-Fi onto cellular, the
session moves to the new path without a new handshake, and calls keep going. The Swift SDK runs
QUIC on MOQOM's own Rust stack, which migrates the connection when the path changes.

## Drops and reconnection

If the network goes away entirely, the session reconnects with backoff. While it does:

- other participants see your presence as **reconnecting**, not **left**;
- on return, subscriptions, mutes, grants and stage position are restored exactly;
- a publisher re-announces and republishes its catalog, and viewers rebind without your app
  laying out again;
- the token is renewed if it would expire in the meantime.

Watch `session.state` for `.reconnecting` to show a banner. A session ends with
`.networkFailure` only when the network does not come back within the reconnect window.

## Durable playback

Every relay keeps the most recent groups of every track: eight groups by default, about 16
seconds at a two-second keyframe interval. Playback leans on that history in three places:

- **Joining.** A new subscription also fetches the group already in progress, so the first
  frame arrives at once instead of after the next keyframe. `RoomSession.setCatchUpGroups(_:)`
  changes how many groups are fetched; `0` turns it off.
- **Reconnecting.** When subscriptions rebind after a drop, the picture is filled from the
  relay's history rather than waiting on the publisher.
- **Replay.** `RoomSession.replay(of:lastGroups:)` returns the last groups of a participant's
  video as a separate stream, so you can show an instant replay without touching the live
  picture. It returns what the relay holds, which may be less than you asked for.

History is answered by the nearest relay, so many viewers reconnecting at once do not reach
the publisher. It is kept alongside forwarding rather than in its path, so it never slows the
live stream, and it works with end-to-end encryption because relays keep the ciphertext as is.

Self-hosted relays set retention with `MOQOM_RELAY_CACHE_GROUPS` (groups per track) and
`MOQOM_RELAY_CACHE_MB` (megabytes across all tracks).

## Congestion

- **Adaptive video.** Bandwidth is estimated continuously from arrival timing, and the
  subscriber steps down a layer before the picture stalls, then back up when there is room.
- **Drop, don't stall.** Media buffers are bounded and drop late frames rather than freezing.
  Decoding starts on a keyframe, and holes are counted instead of waited on.
- **No head-of-line blocking.** Each track rides its own [QUIC](https://www.rfc-editor.org/rfc/rfc9000) stream, so a lost packet on one
  track never holds up another.
- **Repair.** Missed objects can be fetched back from the relay (MOQT FETCH). Where the
  publisher no longer holds them, the gap is marked and playback continues.

## Data tracks

Data tracks get the same transport and the same recovery. A viewer who drops and rejoins lands
in the exact current room and shared-space state, without replaying history.

## Testing on a bad network

Use the Network Link Conditioner (Xcode → Additional Tools) on macOS or the Developer settings
on iOS to simulate loss, latency and bandwidth caps, then switch between Wi-Fi and cellular
mid-call.
