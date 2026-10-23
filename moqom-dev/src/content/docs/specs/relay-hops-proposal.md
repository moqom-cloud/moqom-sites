---
title: "Proposal: hop limit for relays"
description: draft-elliottwave-moq-hop-limit-00, a proposed Media over QUIC Transport extension that bounds how many relays a request can be forwarded through.
---

:::note[Status]
An individual proposal from Elliott Wave LLC. It hasn't been submitted to the IETF, and the MoQ
working group hasn't adopted it. It targets [`draft-ietf-moq-transport-22`](https://datatracker.ietf.org/doc/html/draft-ietf-moq-transport-22). The code values are
provisional until IANA assigns them.
:::

## The problem

A MoQ relay that can't serve a request forwards it to an upstream relay. Many deployments choose
that upstream by configuration, the way a content delivery network pulls from an origin. A
configuration mistake can create a cycle: relay A forwards a namespace to B, and B forwards it
back to A.

A request for a track that neither holds then goes around the cycle until a timeout or a resource
limit ends it. Neither relay can see the cycle, because a request from another relay looks the
same as one from a viewer. [MoQ Transport](https://datatracker.ietf.org/doc/draft-ietf-moq-transport/) defines no hop limit for this case. It notes that
namespace publication "does not protect against loops", and it leaves relay-to-relay design out
of scope.

## The fix

Each request carries a number that only goes down, like an IP packet's Time to Live or HTTP's
`Max-Forwards`.

1. **Negotiation.** Both ends send an empty `HOP_LIMIT_SUPPORTED` Setup Option. Draft-22 closes
   the session on an unknown parameter, so the parameter is sent only where both ends declared
   support.
2. **Receiving.** A request with no `HOP_LIMIT`, such as one from a viewer, starts at the relay's
   maximum. A request that carries one is clamped to that maximum, so a peer can't raise another
   relay's limit.
3. **Forwarding.** At zero, the relay refuses. Otherwise it forwards with the value minus one. A
   request is forwarded at most "maximum" times, however the relays are wired.
4. **Refusing.** The relay answers with a new `HOP_LIMIT_EXCEEDED` error. That isn't a protocol
   violation, so the session stays up and the misconfiguration shows up as a clear error.

It covers SUBSCRIBE, FETCH, TRACK_STATUS, SUBSCRIBE_NAMESPACE and SUBSCRIBE_TRACKS.

## The case a plain counter misses

Relays often attach a new request to an upstream request they've already sent for the same track,
which is called aggregation. In a cycle, that creates a deadlock rather than a loop: A waits on B,
and B waits on A, until a timeout.

The proposal adds one rule to prevent this. A relay must not attach a request to a pending one if
the new request has a smaller remaining limit than the pending one started with. A request that
went around a cycle always comes back smaller. So the relay forwards it again instead of
attaching it, it runs out, and the error clears every pending request in the cycle.

```text
Subscriber        Relay A              Relay B
    |-- SUBSCRIBE -->| remaining 3        |
    |                |-- HOP_LIMIT 2 ---->| remaining 2
    |                |<-- HOP_LIMIT 1 ----|
    |                |  1 < 3: forward, don't attach
    |                |-- HOP_LIMIT 0 ---->| remaining 0
    |                |<- HOP_LIMIT_EXCEEDED
    |                |-- error ---------->|
    |                |<-- error ----------|
    |<-- HOP_LIMIT_EXCEEDED               |
```

## How it relates to other work

Luke Curley's `draft-lcurley-moq-cluster` prevents loops in namespace **advertisements** by
carrying the path each advertisement took. This proposal covers **requests** that relays forward
without an advertisement to follow: to a configured parent, to an origin chosen by policy, or
after a redirect. The two don't overlap, and a relay can use both.

## Recommended settings

The maximum should be configurable. It should be at least the number of upstream relays on the
longest legitimate path. An edge, one interior tier and an origin need 2. The proposal recommends a
default of 3. Fan-out multiplies with each tier while latency only adds, so deep trees are rare,
and a bigger limit only makes a cycle do more work before it fails.

## In MOQOM

MOQOM's relay already applies a hop limit to SUBSCRIBE, with a maximum of 3, clamping on receipt
and refusing at zero. It currently uses a private parameter code and answers with "does not
exist". The standard option, the new error code, the aggregation rule and the other request types
aren't implemented yet.

## IANA requests

| Registry | Name | Provisional value |
| --- | --- | --- |
| MOQT Setup Options | `HOP_LIMIT_SUPPORTED` | `0x40C51` |
| MOQT Message Parameters | `HOP_LIMIT` | `0x40C52` |
| MOQT REQUEST_ERROR Codes | `HOP_LIMIT_EXCEEDED` | `0x37` (suggested) |
