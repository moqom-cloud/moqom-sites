---
title: Shared AR spaces (Swift)
description: Put a shared, replicated space beside a MOQOM call so remote participants can play or build together in AR, each anchored in their own room.
---

A **shared space** is replicated state that is not media: things with positions, and the facts
your app attaches to them. Everyone in a room can see the same board, pieces or objects, and
act on them, alongside the call or without one.

:::caution[Preview]
The shared-space API is part of `MoqomKit` on iOS and macOS. It has not been in a tagged
release yet, and names may change before one.
:::

What you get:

- **Remote shared AR.** Participants don't need to be in the same place. Each device places the
  space wherever it likes (a coffee table, a desk, the floor) and at whatever scale fits.
- **Nothing about anyone's room is sent.** Where a device puts the space stays on that device.
- **Viewers need no AR hardware.** The space can be drawn in a virtual room, a 3D view or a 2D
  board.
- **One device runs the rules.** Your simulation runs on one participant's device at a time and
  everyone else renders what it publishes. If that device leaves, another takes over.
- **No extra servers.** A space travels through the same relays as the call.

## Join a space

A space belongs to a room. Join it from a `RoomSession`, with a simulation of your own:

```swift
import MoqomKit
import MoqomCore

struct Board: SpaceSimulation {
    func step(_ state: inout SpaceSnapshot, at now: Timecode, since elapsed: Duration) {
        // Advance anything that moves on its own. A board game can leave this empty.
    }

    func apply(_ intent: SpaceIntent, from who: ParticipantIdentity,
               to state: inout SpaceSnapshot, at now: Timecode) {
        guard intent.verb == "place", let id = intent.subject, let point = intent.at else { return }
        state.entities[id] = SpaceEntity(id: id, kind: "piece",
                                         pose: SpacePose(position: point), owner: who)
    }
}

let space = try await room.joinSpace(Board())
```

`joinSpace` is separate from going live: a participant can join a space without a camera.
Calling it twice returns the space already joined. `room.sharedSpace` returns it later, and
`room.leaveSpace()` leaves it.

`SpaceSimulation` has three hooks, all called only on the device currently running the space:

| Hook | When |
| --- | --- |
| `opening(_:at:)` | This device starts running the space. The state is what it had already received; continue from it or replace it. Optional. |
| `step(_:at:since:)` | Every tick (20 a second by default). |
| `apply(_:from:to:at:)` | A participant asked for something. Change the state, or don't: declining needs no reply. Optional. |

## Act

Any participant asks the space for something with `act`. Your simulation decides what happens.

```swift
await space.act(verb: "place",
                subject: "piece-7",
                at: SpaceVector(x: 0.2, y: 0, z: -0.1),
                facts: ["colour": .text("red")])
```

`facts` values are `.flag(Bool)`, `.number(Int64)`, `.decimal(Double)` or `.text(String)`. The
call is the same whichever device is running the space.

## Render

```swift
for await event in space.events {
    switch event {
    case let .changed(snapshot, delta, at: time):
        // Draw snapshot.entities. `delta` says what moved, spawned or was removed.
        render(snapshot, changes: delta, at: time)
    case .roleChanged(let role):
        // .leading while this device runs the simulation, .following otherwise.
        showHostBadge(role == .leading)
    case .authorityChanged(let who):
        // Who is running the space now, if anyone.
        showAuthority(who)
    }
}
```

`at` on `.changed` is the instant the simulation produced the state, so devices that sample
against a shared clock draw the same moment.

## Place it in the real world

Everything in a space is in shared **space coordinates**: origin on the floor at the centre of
the play area, +Y up, −Z forward. Each device decides where that frame sits in its own world
with a `SpaceAnchor`, which is never sent anywhere.

```swift
// After the user taps a surface in your ARKit / RealityKit scene:
let anchor = SpaceAnchor(origin: SpaceVector(x: hit.x, y: hit.y, z: hit.z),
                         rotation: .yaw(facingAngle),
                         scale: 0.4)   // a 1 m board at 40 cm on a desk

let worldPose = anchor.world(from: entity.pose)     // space → this device's world, for drawing
let spacePoint = anchor.space(from: tappedWorldPoint) // this device's world → space, for `act`
```

Use `SpaceAnchor.identity` for a viewer drawing into a virtual room. Detecting surfaces and
running the AR session are your app's job; the anchor supplies the transform.

## Viewers

A participant without publish rights can watch a space but not run it. Tell the space so it
doesn't try:

```swift
let space = try await room.joinSpace(Board(),
                                     configuration: .init(mayLead: false))
```

## Configuration

| Option | Default | Meaning |
| --- | --- | --- |
| `tickRate` | 20 | Simulation ticks a second |
| `mayLead` | `true` | Whether this device may run the space |
| `intentLifetime` | 2 s | Requests older than this are ignored, when clocks allow it to be measured |

## Billing

A space is a data track like any other, metered by bytes like the call beside it. There is no
separate fee for shared spaces.
