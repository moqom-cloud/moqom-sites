---
title: Methodology
description: How MOQOM's latency and fan-out numbers are measured, and what would make a run untrustworthy.
---

The rule: **a number without a run behind it is not published.** Every benchmark figure on this
site comes from a run whose raw output is retained.

:::caution[Benchmark note]
\* Built to scale: a Rust media plane and a Go control plane, each scaling out horizontally. Measured in lab: 6,000 viewers on one 4-vCPU relay, every frame delivered. Full data at [moqom.cloud/benchmarks/load-tests.md](https://moqom.cloud/benchmarks/load-tests.md).
:::

## Glass-to-glass latency

- **What is measured.** Time from camera capture on the sender to render on the receiver,
  including capture, encode, network, buffering, decode and display.
- **How.** Frames are software-timestamped at capture and read at render on a shared clock.
  Both devices are disciplined against NTP.
- **Error bars.** The harness reports clock-agreement error beside every reading, and marks a run
  untrustworthy when that error exceeds the median.
- **A correction already applied.** An earlier version understated latency by about 15 ms because
  of how it anchored the clock offset; published numbers come from after that fix.
- **Cross-checking.** Phone-side results are compared against the relay's own counters. A run
  that looks smooth on the phones while the relay reports dropped media was smooth because frames
  were thrown away, and is not published as clean.
- **Next.** A physical photodiode rig is planned; that is the number to quote in a contract.

## Relay fan-out

- **Load generator.** A dedicated MoQ load generator drives one publisher and *N* subscribers
  from separate machines in the same zone.
- **Cold start per size.** The relay is restarted between sizes, so each starts with fresh
  quotas and counters.
- **Definition of clean.** Every subscriber received every object **and** the kernel dropped zero
  packets. Subscriber reports and relay metrics are read together, so a relay that quietly gave up
  on some viewers cannot look clean.
- **Same binary.** Every run in a series uses an identical relay binary, verified by hash.
- **Report the right ratio.** Subscribers-per-core depends entirely on bitrate; Gbit/s-per-core is
  the comparable figure across clips.
- **Largest size tested ≠ ceiling.** We say which limit was reached (CPU, NIC, kernel queue) and
  which was not.

## Quality engineering behind the numbers

| Codebase | Tests |
| --- | --- |
| Swift client SDK | ~864 |
| Relay and media engine | ~944 |

Plus coverage-guided fuzzing of every decoder on every change, deeper scheduled fuzz runs, and
cross-language interop: a Swift publisher and subscriber through the Rust relay, and both backend
SDKs against the real control plane.

## Comparing against other systems

We do not publish comparisons with other MoQ stacks until they have been measured on the same rig
with the same method. The fan-out load generator can drive any draft-19 relay, and we intend to
publish those comparisons when they exist.
