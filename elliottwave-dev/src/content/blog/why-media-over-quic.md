---
title: Why we built MOQOM on Media over QUIC
description: Live video has been split between fast-but-small and big-but-slow. Media over QUIC is the IETF standard that ends the split, and the reason MOQOM exists.
date: 2026-10-06
author: Elliott
draft: true
---

<!--
  DRAFT. Review checklist before setting draft: false:
  - Outcome-level only. No description of how any MOQOM mechanism works (check against the patent assessment with counsel).
  - Re-run benchmarks before publishing; BENCHMARKS-AND-SPECS.md says to rerun before quoting externally.
  - TODO(Elliott): personal voice, opening anecdote, and sign-off.
-->

For as long as there has been live video on the internet, it has been sold in two halves.

One half is **fast and small**. Video calls feel live because they are, but they strain once a room becomes an audience. The other half is **big and slow**. Broadcast reaches everyone, a few seconds after it happened. Products pick a half and get better at it, year after year, and the line between them stays where it is.

MOQOM exists because we think that line is about to disappear, and the reason is a standard.

## What Media over QUIC is

Media over QUIC (MoQ) is being developed at the **IETF** in the MoQ working group. Its transport specification, [`draft-ietf-moq-transport`](https://datatracker.ietf.org/doc/draft-ietf-moq-transport/), defines a publish/subscribe protocol for live media that runs over QUIC, the transport underneath HTTP/3, and over WebTransport in the browser.

The ambition is in the name of the problem it solves: a single protocol for media that needs to be both real time and at scale, instead of one protocol for each half. MOQOM targets **draft-19**.

## Why a standard, and not our own protocol

Defining a category is not the same as inventing a private wire format. We wanted three things only a standard gives:

- **Longevity.** A protocol the industry converges on outlives any one vendor, including us.
- **Reach.** QUIC and WebTransport are already in the network stacks and browsers developers ship on.
- **An exit.** Customers should be able to adopt MOQOM without betting their product on a format only we speak.

## Why our own implementation

A standard tells you what goes over the wire. It does not decide how fast a frame gets from one camera to another screen, how many viewers a relay can carry, or how the media is protected. Those are the outcomes customers actually buy, so we wrote our implementation from the draft rather than forking someone else’s.

## What it delivers today

Measured end to end, from light hitting one phone’s camera to the frame appearing on another phone’s screen:

| Measurement | Result |
|---|---|
| Glass-to-glass latency, median | **56–57 ms** |
| Glass-to-glass latency, p95 | **70 ms** |
| Subscribers on one 4-vCPU relay, zero loss | **6,000** at 5.46 Gbit/s |


\* Built to scale: a Rust media plane and a Go control plane, each scaling out horizontally. Measured in lab: 6,000 viewers on one 4-vCPU relay, every frame delivered. Full data at moqom.cloud/benchmarks/load-tests.md.

The latency runs used two iPhone 15 Pros on home Wi-Fi through a relay in Los Angeles, both directions at once, at 720p30. The fan-out run used a single 4-vCPU cloud relay; 6,000 was the largest size tested, not the ceiling.

## What’s next

MOQOM is available on iOS and macOS today. Web, Android, desktop and an OBS plugin are scoped, with work ongoing and release planned for October 2026.

Documentation lives at [moqom.dev](https://moqom.dev), and you can start building at [moqom.cloud](https://moqom.cloud).

*Elliott, founder, elliottwave.studio lab*
