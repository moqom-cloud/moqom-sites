---
title: Private relay networks
description: Run your tenant on relays that carry nobody else's traffic. Dedicated relays MOQOM hosts for you, your own relays locked to your tenant, and private connectivity with no public address at all.
---

By default your rooms run on MOQOM Cloud's shared relay fleet. Media is end-to-end encrypted, so a
shared relay forwards ciphertext it can't read, but the machine is shared with other tenants. A
**private relay network** is a pool of relays that carries only your tenant's traffic, and your
tenant's traffic never touches any other relay.

There are three ways to have one, and they combine:

| | Dedicated | Your own relays (BYOC) | Private connectivity |
| --- | --- | --- | --- |
| Who runs the machines | MOQOM | You | MOQOM or you |
| Where | MOQOM Cloud regions you choose | Your cloud account or data center | Either of the first two |
| Public address | Static IPs, only yours | Yours | None |
| Reached from | The internet | The internet or your network | Your VPC, or managed devices over the overlay |
| You pay | Relay-hours at cost plus 15%, and usage as usual | The [self-hosted fee](/billing/self-hosted/) | Connectivity at cost plus 15% |

## How the isolation is enforced

A private network is a promise about where packets go, so it's enforced in three places rather
than by configuration alone:

1. **In the token.** When your tenant is private, every token MOQOM mints for it names your relay
   pool. Tokens are [sealed](/security/libraries/token/#sealed-tokens), so the pool can't be read
   or removed by anyone outside MOQOM's servers.
2. **At every relay.** A shared relay refuses a token that names a pool. A pool relay refuses
   every token that doesn't name its pool, and every other tenant's token. Both refusals are
   `wrong_pool` (see [errors](/reference/errors/#relays-private-relay-pools)). The check runs on
   the relay, offline, on every session, so an app pointed at the wrong relay fails closed rather
   than falling back. The token response lists the pool's addresses in `relays`, so the app
   knows where to dial.
3. **On the control plane.** A pool relay is sent only your tenant's verification and seal keys,
   sessions, moderation and live-map data, whatever it asks for. Pool relays forward to each
   other and never to a shared relay, so a room that spans regions stays inside the pool.

There is no burst onto the shared fleet. When your pool is full, new sessions are refused with
`pool_full` and existing ones carry on. Size the pool for your peak, or turn on
[autoscaling](#size-and-scaling).

[Point-to-point calls](/guides/peer-to-peer/) still work. Media between two devices goes
device to device and touches no relay. The standby session and the STUN responder are your pool's.

## Dedicated relays

MOQOM runs relays for your tenant alone, on machines no other tenant uses, in the MOQOM Cloud
regions you pick.

Create a pool with the admin API, then make your tenant private. Pool calls need your owner
(`backend`) key:

```go
pool, err := client.CreateRelayPool(ctx, moqom.NewRelayPool{
	Name:    "production",
	Regions: []moqom.PoolRegion{
		{Region: "us-west1", Relays: 2},
		{Region: "us-east4", Relays: 2},
	},
})
if err != nil {
	return err
}

err = client.SetTenantNetwork(ctx, moqom.TenantNetwork{
	Pool: pool.ID,
	Mode: moqom.NetworkPrivate,
})
```

The pool is ready when every relay reports `ready` in `GetRelayPool`, usually within five minutes.
Set the network mode only after that. From then on, every token minted for your tenant names the
pool, and the shared fleet refuses them.

Each relay has a static IPv4 and IPv6 address that stays the same for the life of the pool, so
you can allow-list them on corporate firewalls. `GetRelayPool` lists them. To use your own host
name, such as `media.example.com`, add the DNS record `GetRelayPool` shows you. MOQOM issues and
renews the certificate.

### Size and scaling

Each region needs at least two relays, so one can restart without dropping the region. A relay
is 2 vCPUs and 8 GB. At the 1.3–1.4 Gbit/s of egress per vCPU measured in the
[benchmarks](/specs/benchmarks/), that's about 1,000 viewers of a 2.5 Mbit/s HD stream. Change the count with
`ResizeRelayPool`. New relays take sessions within five minutes. Removed relays drain: they
take no new sessions and close when their last one ends, or after an hour.

Autoscaling keeps each region between a minimum and maximum relay count, adding a relay when the
region passes 70% of capacity for five minutes:

```go
_, err := client.ResizeRelayPool(ctx, pool.ID, moqom.PoolRegion{
	Region: "us-west1", Relays: 2, MaxRelays: 8,
})
```

## Your own relays (BYOC)

[Self-hosted relays](/guides/self-hosting/) already serve only the tenant they were enrolled for.
Put them in a pool and they also become the **only** relays your tenant can use:

```go
pool, err := client.CreateRelayPool(ctx, moqom.NewRelayPool{Name: "on-prem", SelfHosted: true})
```

Enroll each relay into the pool with `CreateRelayEnrollment` and its `Pool` field set, then call
`SetTenantNetwork` as above. You can mix dedicated and self-hosted relays in one pool, for
example your own relays in your data center and dedicated relays in regions where you have none.

## Private connectivity

For traffic that must never cross the public internet, a pool can have **no public address**.
Two ways to reach it:

- **From your VPC on Google Cloud.** MOQOM publishes a
  [Private Service Connect](https://cloud.google.com/vpc/docs/private-service-connect) service
  attachment for the pool. Create an endpoint for it in your VPC and your devices, backends and
  recorders reach the relays on a private address in your own network. Turn it on with
  `SetRelayPoolAccess(ctx, pool.ID, moqom.PoolAccessPrivateServiceConnect)`, and accept your
  project ID in the attachment's allow-list. VPC peering is available for networks that can't use
  Private Service Connect.
- **Over the overlay, for managed devices.** The relays are reachable only through MOQOM's
  zero-trust overlay, the same one BYOC relays use to reach the control plane. Each device runs the
  overlay's tunneler, distributed by your device management, with an identity you enroll and
  revoke per device. Suits fleets of company-managed phones and Macs, such as clinics, trading
  floors and field teams. Turn it on with `moqom.PoolAccessOverlay`.

Either way the relays have no public IP, no public DNS name and no listener on the internet.
Devices outside your network or overlay can't reach them at all, even with a valid token.

## Pricing

Dedicated relays are billed per relay-hour from your prepaid credit at cost plus 15%:

| Item | Price |
| --- | --- |
| Dedicated relay (2 vCPU, 8 GB) | $0.10 per relay-hour, about $73 a month |
| Usage on a dedicated pool | The [usual rates](/billing/pricing/), at your volume band |
| Self-hosted relays in a pool | The [self-hosted fee](/billing/self-hosted/), unchanged. A pool costs nothing extra |
| Private Service Connect, VPC peering, overlay access | Google's or the overlay's cost plus 15%, itemized per hour and per GiB |

A two-region pool with two relays in each region costs about $292 a month before usage. Relay
hours stop when a relay is removed. When credit runs out, a dedicated pool keeps running
existing sessions and refuses new ones, the same as the shared fleet.

## Related

- [Self-hosting](/guides/self-hosting/): running relays yourself
- [Security overview](/security/overview/): end-to-end encryption, sealed tokens and device keys
- [Control-plane gRPC API](/reference/control-plane-grpc/#relaypools): `CreateRelayPool`,
  `GetRelayPool`, `ListRelayPools`, `ResizeRelayPool`, `DeleteRelayPool`, `SetRelayPoolAccess`,
  `SetTenantNetwork`, `CreateRelayEnrollment`
- [Error codes](/reference/errors/#relays-private-relay-pools): `wrong_pool` and `pool_full`
