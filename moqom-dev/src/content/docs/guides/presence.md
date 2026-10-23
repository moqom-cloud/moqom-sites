---
title: Presence
description: Show who is in a room, who just joined or left, and who is reconnecting or backgrounded, in your app with MoqomKit and on your backend with the room event stream.
---

Every room knows who is in it and what state each device is in. Your app sees it live, at media
latency, through `RoomSession`. Your backend sees the same changes through the
[durable event stream](/guides/events-and-billing/#durable-event-streams), even for rooms it
isn't in.

## Presence states

Each device in a room is in one of five states:

| State | Meaning | What to show |
| --- | --- | --- |
| `connected` | In the room and sending | Normal tile |
| `reconnecting` | Lost its connection and expected back, for example walking between Wi-Fi and cellular. Its seat and subscriptions are held | "Reconnecting…" over the last frame, not a frozen picture |
| `away` | Gone long enough to say so, not long enough to count as having left | Dimmed tile |
| `backgrounded` | The app went to the background and iOS suspended it. Usually back in moments | "Back soon" rather than "connection lost" |
| `left` | Gone | Remove the tile |

A device that drops off doesn't leave straight away. It shows as `reconnecting` while its seat is
held, and only leaves, with the reason `timedOut`, if it doesn't return in time. So a phone that
changes networks never flickers out of the room and back. See
[Unreliable networks](/guides/unreliable-networks/).

Presence is per device. If Ada joins from her iPhone and her Mac, the room has two entries for
her, one per device, both with the username `ada`.

## In your app: who's here

`room.currentState.roster` is who is in the room now. `room.events` streams every change after
that. This model keeps a list your SwiftUI view can draw:

```swift
import MoqomKit
import Observation

@MainActor @Observable
final class WhoIsHere {
    private(set) var people: [Participant] = []
    private(set) var notice: String?

    func follow(_ room: RoomSession) async {
        people = await room.currentState.roster.participants
        for await event in room.events {
            switch event {
            case .participantJoined(let person):
                let firstDevice = !people.contains { $0.username == person.username }
                people.removeAll { $0.id == person.id }
                people.append(person)
                if firstDevice { notice = "\(person.username) joined" }
            case .participantLeft(let who, let reason):
                people.removeAll { $0.id == who }
                if !people.contains(where: { $0.username == who.username }) {
                    notice = reason == .evicted ? "\(who.username) was removed" : "\(who.username) left"
                }
            case .presenceChanged(let who, let presence):
                if let index = people.firstIndex(where: { $0.id == who }) {
                    people[index].presence = presence
                }
            default:
                break
            }
        }
    }
}
```

`room.events` has one consumer. If your app also handles mutes, grants or moderation, handle them
in the same `switch` rather than starting a second loop. The full list of events is in
[Room state](/guides/ios-macos/#room-state).

The "joined" and "left" notices only fire for a person's first device in and last device out, so
someone with a phone and a laptop isn't announced twice.

```swift
struct WhoIsHereList: View {
    let model: WhoIsHere

    var body: some View {
        List(model.people) { person in
            HStack {
                Text(person.username.description)
                Spacer()
                switch person.presence {
                case .connected: EmptyView()
                case .reconnecting: Label("Reconnecting", systemImage: "wifi.exclamationmark")
                case .away: Text("Away")
                case .backgrounded: Text("Back soon")
                case .left: EmptyView()
                }
            }
            .foregroundStyle(person.presence == .connected ? .primary : .secondary)
        }
        .overlay(alignment: .top) {
            if let notice = model.notice { Text(notice).padding(8).background(.thinMaterial, in: .capsule) }
        }
    }
}
```

Start it when you join:

```swift
let room = try await session.join(room: RoomID("demo"))
let whoIsHere = WhoIsHere()
Task { await whoIsHere.follow(room) }
```

Your own presence is sent for you. The SDK reports `backgrounded` when the app leaves the
foreground and `reconnecting` while it recovers a connection, and you leave the room for
everyone else when you call `session.leave(room:)`.

## On your backend: who's online

Your backend doesn't have to be in a room to know who is. The room event stream carries every
join, leave and presence change. It's stored before it's sent, so if your server restarts, it
resumes from the last sequence number it saved and misses nothing.

This keeps a live map of who is in each room, for a lobby that shows "3 people here", or to skip
a push notification for someone who is already in the call:

```go
online := map[string]map[moqom.Identity]moqom.Presence{} // room -> device -> presence

stream, err := client.Events(ctx, moqom.EventQuery{After: cursor}) // every room in your tenant
if err != nil {
	return err
}
for {
	event, err := stream.Recv()
	if err != nil {
		return err // reconnect from cursor
	}
	room := online[event.Room]
	if room == nil {
		room = map[moqom.Identity]moqom.Presence{}
		online[event.Room] = room
	}
	switch event.Kind {
	case moqom.EventParticipantJoined:
		joined := event.Joined
		room[joined.Participant.Identity] = joined.Participant.Presence
		if joined.FirstDevice {
			log.Printf("%s joined %s", joined.Participant.Identity.Username, event.Room)
		}
	case moqom.EventParticipantLeft:
		delete(room, event.Left.Identity)
		if event.Left.LastDevice {
			log.Printf("%s left %s", event.Left.Identity.Username, event.Room)
		}
	case moqom.EventPresenceChanged:
		room[event.PresenceChanged.Identity] = event.PresenceChanged.To
	}
	cursor = event.Sequence // persist it
}
```

`FirstDevice` and `LastDevice` do the per-person counting for you, so "Ada joined" is logged once
however many devices she uses.

To ask who is in a room right now, for example when rendering a page, list it:

```go
page, err := client.Room("live/42").Participants(ctx, moqom.ParticipantQuery{})
if err != nil {
	return err
}
for _, p := range page.Items {
	fmt.Println(p.Identity.Username, p.Identity.Device, p.Presence)
}
```

Backstage participants aren't listed unless you set `IncludeBackstage`; `IncludeDeparted` adds
people who have left recently, for "who was here when this happened".

## Privacy

Presence says who is in a room and in what state. It never includes an IP address, and media
stays end-to-end encrypted whatever presence shows. Rooms preloaded by a
[`RoomFeed`](/guides/ios-macos/#a-feed-of-live-rooms) as the user scrolls are joined relay-only, so scrolling past a
room doesn't reveal the user's IP address to anyone in it.
