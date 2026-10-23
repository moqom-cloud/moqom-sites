# MOQOM load tests: full data and developer notes

This is the data behind the fan-out and Cloudflare figures on
<https://moqom.cloud/benchmarks/>. Every number comes from a run whose raw
output we keep. These are lab results, not production SLAs.

Updated 22 October 2026.

## Summary

| | Google Cloud Platform (GCP) | Cloudflare MoQ relay (beta) |
|---|---|---|
| Viewers | 6,000 | 6,000 |
| Viewers receiving video | 6,000 | 5,759 |
| Viewers who missed frames | 0 | 0 |
| Median delivery | 60.5–61.3 ms | 16.0–19.7 ms |
| p95 delivery | 134.1–136.1 ms | 24.9–31.0 ms |
| p99 delivery | 175.6–178.7 ms | 30.3–39.1 ms |
| Slowest frame | 0.36–0.38 s | 0.17–0.69 s |
| Delivered | 5.46 Gbit/s | 5.66 Gbit/s |
| Confirmed by the relay's own counters | Yes | No, the relay exposes none |
| Infrastructure | One 4-vCPU VM running MOQOM's relay | Cloudflare's global network |
| Date | 20 August 2026 | 22 October 2026 |

Both runs used the same load generator and traffic. Ranges cover the load
generators: two on GCP, three on Cloudflare.

**Delivery latency** is the time from the publisher sending a frame to a viewer
receiving it, read against each machine's clock (Google Cloud keeps them in
sync). It is not glass to glass, which adds capture, encode, decode and display.
MOQOM's glass-to-glass figure, 56–57 ms median between two iPhone 15 Pros, is
on the benchmarks page with its own rig.

**Why Cloudflare's frames arrive sooner here.** The GCP figure is one 4-vCPU
machine running at 97% CPU (3.88 of 4 cores), against Cloudflare's global network. Below full load the same relay's
median was 12.8–16.9 ms at 3,500 viewers. In production, MOQOM spreads viewers
across as many relays as needed, so no relay runs at that load.

**Read the comparison as indicative.** The rigs differ: region (us-east1 against
us-west2), load generators (2 × n2-standard-8 against 3 × n2-standard-4) and
run length (30 s against 90 s).

## Traffic

Both series use the same synthetic track: one publisher, one track, 30 frames a
second of 4,096-byte objects in one-second groups (about 1 Mbit/s per viewer).
Nothing is encoded or decoded. A viewer **missed frames** if any object is
absent from a group it received, or a whole group never arrived. The first and
last group a viewer sees are not counted, since a run starts and stops mid-group.

## Google Cloud Platform (MOQOM relay)

Harness: `moqom-loadgen`, driven by `moqom-engine/moqom-loadgen/cloud/measure.sh`.
Raw output: `moqom-engine/moqom-loadgen/cloud/results/20260819T*` and `20260820T*`.

### Rig

| Role | Machine |
|---|---|
| Relay | n2-standard-4 (4 vCPU), us-east1-b, started fresh for each size |
| Viewers | 2 × n2-standard-8 load generators, split evenly |
| Publisher | n2-standard-2 |
| Network | One zone, gVNIC, MTU 1460, socket buffers raised to 128 MiB |
| Relay binary | sha256 `9095c6c0…172c1be1` for the final series |

Every viewer is connected and subscribed before the first frame is sent. A size
is **clean** only if every viewer received every object and the relay's own
counters agree. Kernel drops on the relay host are reported beside each size.

### Final series (4 sockets on the relay's port, 30 s per size)

| Viewers | Clean | Relay cores | Gbit/s | Median | p95 | p99 | Slowest |
|---|---|---|---|---|---|---|---|
| 4,000 | yes | 3.50 | 3.57 | 16.0–18.9 ms | 39.7 ms | 64.6–64.9 ms | 0.18 s |
| 4,500 | yes | 3.76 | 4.11 | 23.9–28.1 ms | 56.4–62.9 ms | 81.7–90.8 ms | 0.22 s |
| 5,000 | yes | 3.82 | 4.59 | 29.8–31.5 ms | 73.2–77.7 ms | 106.7–111.5 ms | 0.28 s |
| 5,500 | yes | 3.82 | 5.04 | 38.1–38.2 ms | 88.8–89.0 ms | 120.5–121.5 ms | 0.29 s |
| 6,000 | yes | 3.88 | 5.46 | 60.5–61.3 ms | 134.1–136.1 ms | 175.6–178.7 ms | 0.38 s |

6,000 is the largest size run on one machine, not its ceiling. Egress was about
1.3–1.4 Gbit/s per vCPU, below the machine's 10 Gbit/s cap.

### Earlier runs

These found the settings above. They are kept for completeness and are not
quoted on the site.

| Run | Setup | Result |
|---|---|---|
| 20260819T2207–2227 | 1 socket, 120 s | Clean to 2,000 (p50 2.3–11.3 ms). At 4,000 and 8,000 the relay host's kernel dropped 2.3–10.3 million packets and latency ran to tens of seconds |
| 20260819T2243 | 1 socket, 120 s | Clean at 2,500; 3,000 not clean; 3,500 clean but 3,335 kernel drops |
| 20260820T2145–2205 | Real H.264 clip at 24 fps, 30 s | Clean to 2,000. Keyframe bursts put p95 at 0.45–0.62 s at 2,000 |
| 20260820T2212 | 1 socket, 30 s | Clean at 3,500 and 4,000 |
| 20260820T2217 | 1 socket, 30 s | 4,500 and 5,000 not clean: about 300,000 kernel drops each. Fixed by spreading the relay over 4 sockets |

## Cloudflare MoQ relay (beta)

Relay: `draft-16.cloudflare.mediaoverquic.com:443`, MoQ Transport draft-16
(ALPN `moqt-16`), one relay created for the test, free during the beta.
Harness: `moqom-loadgen --cloudflare`, driven by
`moqom-engine-pq/moqom-loadgen/cloud/cloudflare.sh`.
Raw output: `moqom-engine-pq/moqom-loadgen/cloud/results/cloudflare-*`.

### Rig

| Role | Machine |
|---|---|
| Viewers | 3 × n2-standard-4 load generators, us-west2-a, public IPs |
| Publisher | n2-standard-2, same zone |
| Sessions | Opened at 100 a second per generator |
| Counting | Starts once all of a generator's viewers are in, as in the MOQOM runs |

Cloudflare refuses a publisher until a viewer has asked for its track, so the
publisher starts after the viewers. Each generator counts only the 90 s after
its own viewers are all subscribed.

### Result at 6,000 viewers (run `cloudflare-20261022T0744Z`)

| Generator | Viewers | Receiving video | Missed frames | Median | p95 | p99 | Slowest | Gbit/s |
|---|---|---|---|---|---|---|---|---|
| 1 | 2,000 | 1,977 | 0 | 19.7 ms | 31.0 ms | 39.1 ms | 0.66 s | 1.94 |
| 2 | 2,000 | 1,782 | 0 | 16.0 ms | 24.9 ms | 30.3 ms | 0.17 s | 1.75 |
| 3 | 2,000 | 2,000 | 0 | 17.9 ms | 27.8 ms | 34.7 ms | 0.69 s | 1.97 |
| All | 6,000 | 5,759 | 0 | | | | | 5.66 |

Generators used 1.6–2.0 of their 4 cores.

Of the 241 viewers who received no video, 23 (generator 1) were refused when
connecting: Cloudflare closed the stream without answering. The other 218
(generator 2) had their subscription accepted and then received nothing, with
no error. We have not yet ruled out our client for those 218.

### Runs not used, and why

| Run | What happened | Why it isn't quoted |
|---|---|---|
| 21 Oct, 1,000 / 6,000 / 10,000 | Up to 109 viewers missed frames; slowest frames 3–5 s | Viewers connected all at once while frames were already flowing, and frames were counted from the first arrival. Our generators' CPU was busy with thousands of handshakes, so frames queued on our side. Fixed by the ramp and the counting rule above |
| 21 Oct, 15,000 / 20,000 | p95 of 8–15 s, hundreds of viewers losing data | Generators at 98–100% CPU; their kernels dropped 400,000–600,000 packets each (`UdpMemErrors`). Measured our machines |
| 22 Oct, 10,000 | Median 59–109 ms, slowest 10 s, viewers receiving about 25 of 30 frames a second | 3,333 viewers per 4-vCPU generator is the edge of what the rig can drive. Not reliable |

The rig is capped by Google Cloud quota (24 vCPUs, 4 IP addresses per region),
so 6,000 is the largest Cloudflare size we can measure reliably today. Larger
sizes need more generators, and Cloudflare's agreement first.

## Cloudflare draft-16: what we found building the test

Things a client has to handle on Cloudflare's relay, observed in October 2026:

- **Subgroup priority is required.** Subgroups using the default-priority
  header types (0x30–0x3D) are dropped silently. Send an explicit publisher
  priority; we use 128.
- **PUBLISH needs an audience.** A PUBLISH is refused with REQUEST_ERROR 0,
  reason "uninterested", until a viewer has subscribed to the track. A
  publisher with no viewers is dropped after about 45 s.
- **SUBSCRIBE before the publisher.** Error 0x10 "Track not found" if the
  namespace doesn't exist; error 0 "internal error" if the namespace exists but
  the track doesn't. Retry, but slowly: each session has few request IDs, and
  REQUESTS_BLOCKED doesn't raise the limit. When they run out, reconnect.
- **Connection bursts.** Hundreds of setups at once from one address on one
  token are partly refused (the stream closes unanswered). Ramp connections.
- **Tokens.** A relay holds at most 10 tokens, so viewers share one. The token
  travels in the URL path (`/<token>`) and so appears in access logs.
- **No counters.** The relay exposes no metrics, so delivery can only be read
  from the viewers' side.
- **Not supported:** PUBLISH_NAMESPACE, FETCH, REQUEST_UPDATE (pause, resume,
  priority changes), GOAWAY.

| Feature | Cloudflare MoQ (beta) | moqom.cloud and self-hosted MOQOM |
|---|---|---|
| Post-quantum end-to-end encryption (SFrame, MLS room keys) | Yes, keys from MOQOM | Yes |
| Protocol version | draft-16 | draft-22, and draft-19 |
| Catch-up and late join from cache (FETCH) | No | Yes |
| Pause, resume and priority changes (REQUEST_UPDATE) | No | Yes |
| Graceful relay migration (GOAWAY) | No | Yes |
| Per-viewer tokens | No, 10 per relay, shared | Yes, device-bound |
| Token kept out of logs | No, in the URL path | Yes, in-band |
| Admission tickets, kick and ban, spend limits | No | Yes |
| Relay counters, metering, events, recording | No | Yes |
| Relay-side layer and bitrate adaptation | No | Yes |
| Direct (peer-to-peer) calls | No | Yes |

## Reproducing

MOQOM relay (Google Cloud, needs 22 vCPUs):

```sh
cd moqom-engine/moqom-loadgen/cloud
export ZONE=us-east1-b RELAY_MACHINE=n2-standard-4 GENERATORS=2 \
  GEN_MACHINE=n2-standard-8 PUB_MACHINE=n2-standard-2
./up.sh
./measure.sh --shards 4 --seconds 30 4000 4500 5000 5500 6000
./down.sh
```

Cloudflare (needs a Cloudflare MoQ relay with a publish token and a subscribe
token in `~/.config/moqom/cloudflare.env` as `MOQOM_CF_PUBLISH_TOKEN` and
`MOQOM_CF_SUBSCRIBE_TOKEN`, and 14 vCPUs on Google Cloud):

```sh
cd moqom-engine-pq/moqom-loadgen/cloud
./cloudflare.sh up
./cloudflare.sh run 6000      # RAMP, STAGGER and SECONDS_PER_RUN are environment overrides
./cloudflare.sh down
```

The load generator on its own:

```sh
moqom-load watch --cloudflare --relay draft-16.cloudflare.mediaoverquic.com:443 \
  --subscribers 2000 --ramp 100 --seconds 90 --frame-bytes 4096 --fps 30
moqom-load publish --cloudflare --relay draft-16.cloudflare.mediaoverquic.com:443 \
  --seconds 150 --frame-bytes 4096 --fps 30
```

Code: the draft-16 client is `moqom-client/src/cloudflare.rs`, the load
generator `moqom-loadgen/src/main.rs`. Guide: <https://moqom.dev/guides/cloudflare/>.
