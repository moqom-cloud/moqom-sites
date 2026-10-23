---
title: AI agents in rooms
description: Put AI to work in an end-to-end encrypted room. Run a classifier on the device or as a disclosed agent for trust and safety, transcription or recording, or bring in an LLM host or cohost with an animated RealityKit avatar.
---

AI can take part in a room in three ways. Every room is
[end-to-end encrypted](/guides/e2ee/) with no way to turn it off, so in each case the model runs
somewhere that holds the room's keys: on a participant's device, or on a machine you run. MOQOM's
relays carry ciphertext and never run a model on your media.

| | Sees | Can act by | Disclosed as | Hosted rooms |
| --- | --- | --- | --- | --- |
| [On-device classifier](#on-device-classification) | What that device already decrypts | Reporting to your backend, which moderates | Your app's own disclosure | Yes |
| [Agent you run](#agents-you-run) | Everyone it follows, decrypted on your machine | Your backend's moderation calls | A watchdog every participant's device is shown | Self-hosted relays first; see [Limits](#limits) |
| [AI host or cohost](#an-ai-host-or-cohost) | What any participant sees and hears | Speaking, presenting, and moderating with the grants you mint | A participant you name and announce | Yes |

## On-device classification

The lightest option. A participant's app taps the media it's already decoding, runs a Core ML
model on it, and sends your backend the verdict, never the media. Nothing extra leaves the device.

```swift
let frames = await room.tapVideo(from: bea, policy: .classification) // keyframes only
for await tapped in frames.elements {
    guard !tapped.followsGap else { continue } // built from frames that never arrived
    if let verdict = try classifier.check(tapped.frame), verdict.confidence > 0.95 {
        try await myBackend.report(bea, verdict) // the verdict, not the picture
    }
}
```

Your backend decides what to do, and acts with the [moderation API](/guides/moderation/):

```go
_, err := client.Room(room).ForceMute(ctx, moqom.MuteRequest{
	Target:   moqom.ParticipantRef{Username: report.Username},
	Media:    []moqom.MediaKind{moqom.MediaVideo},
	Scope:    moqom.MuteForEveryone,
	Duration: 10 * time.Minute,
	Actor:    moqom.Actor{Reason: "nudity classifier v3, 0.97 on a reported frame"},
})
```

The reason goes into the moderation log and the room's event stream, so put the model and its
version there: it's what a moderator reviewing an appeal needs to see.

## Agents you run

For trust and safety across a whole room, transcription, captions or recording, run an **agent**:
a process that joins the room's encrypted group as a member, receives everyone's media at full
size, and decrypts it on your side, inside your trust boundary. It's built from MoqomKit's
`RoomAgent` and runs on a Mac.

An agent is never secret. It joins as `watchdog.<id>`, a username the control plane only mints
for a watchdog attached to the room, and every participant's device sees it in the group. Attach
the watchdog first, with the sentence people will be shown:

```go
watchdog, err := client.Room(room).AttachWatchdog(ctx, moqom.NewWatchdog{
	Kind:        moqom.WatchdogSafety,
	OperatedBy:  moqom.OperatedByTenant,
	Descriptor:  "Example's safety system checks this room for abuse.",
	PinnedLayer: "video/360p", // a classifier rarely needs more, and more costs more
})
if err != nil {
	return err
}
token, err := client.MintToken(ctx, moqom.TokenRequest{
	Username:         "watchdog." + watchdog.ID,
	DeviceThumbprint: agentThumbprint, // the agent machine's device key
	Room:             room,
})
```

Then start the agent with that token, and tap whoever you need:

```swift
let room = try await session.join(room: RoomID("demo"))
let agent = RoomAgent(room: room)
await agent.start() // follows everyone, as people come and go

for await event in room.events {
    if case .participantJoined(let person) = event {
        let audio = await room.tapAudio(from: person.id, policy: .transcription)
        Task { for await tapped in audio.elements { transcriber.append(tapped.frame, from: person.id) } }
    }
}
```

Use the same pattern for a recorder, a captioner or a safety classifier, and act on what it finds
through your backend, as above. See [Recording](/guides/recording/) for recorders in particular.

## An AI host or cohost

A host doesn't have to be a person. An LLM can run a room as an ordinary participant: it appears
in the roster, speaks, shows an animated avatar rendered with RealityKit, listens to everyone,
and moderates with the capabilities you grant it. Because it's a participant rather than an
observer, it works in hosted rooms today.

It's made of pieces MoqomKit already has:

- **Its face:** a RealityKit scene published with `SceneCapture`, which takes the rendered frame
  straight from the GPU to the encoder with no copy.
- **Its voice:** your text-to-speech output, published with `AudioRelay`.
- **Its ears:** `tapAudio` for each participant, into speech recognition.
- **Its authority:** a token minted with moderation capabilities, and `room.moderate`.

### Mint its token

Your backend mints the host a token like anyone else's. Give it the capabilities its job needs and
no more; a cohost that mutes and spotlights doesn't need to ban.

```go
token, err := client.MintToken(ctx, moqom.TokenRequest{
	Username:         "host-ai",
	DeviceThumbprint: hostThumbprint, // the Mac it runs on
	Room:             room,
	Publish:          moqom.PublishCamera,
	Moderation:       moqom.CapForceMute | moqom.CapSpotlight | moqom.CapManageQueue,
})
```

### Give it a face and a voice

Run the host on a Mac, in a window: RealityKit only renders while its view is on screen. Publish
the scene from RealityKit's post-process callback, and its speech through an `AudioRelay`:

```swift
import MoqomKit
import MoqomCore
import RealityKit

let room = try await session.join(room: RoomID("demo"))

// The size RealityKit draws at: on a Retina display, twice the view's size in points.
let face = try SceneCapture(format: CaptureFormat(size: PixelSize(width: 1920, height: 1080), frameRate: 30))
let voice = AudioRelay() // 48 kHz mono, 20 ms frames
try await room.startBroadcast(from: face)
try await room.startAudio(from: voice)

arView.renderCallbacks.postProcess = { context in
    // Show the frame in the window as usual...
    let blit = context.commandBuffer.makeBlitCommandEncoder()!
    blit.copy(from: context.sourceColorTexture, to: context.targetColorTexture)
    blit.endEncoding()
    // ...and publish the same texture without it leaving the GPU.
    face.submit(texture: context.sourceColorTexture,
                at: FrameTimestamp(seconds: context.time),
                on: context.commandBuffer)
}

// Each 20 ms of speech your TTS produces: publish it, and move the avatar's mouth with it.
func speak(_ samples: [Float], at time: FrameTimestamp) {
    let frame = AudioFrame(timestamp: time, format: .voice, samples: samples)
    voice.submit(frame)
    avatar.setMouthOpen(frame.peak) // your rig's jaw or blend shape
}
```

### Let it listen, think and act

Tap each participant's audio into speech recognition, send the transcript to your model, and speak
or moderate with what comes back:

```swift
for await event in room.events {
    switch event {
    case .participantJoined(let person):
        let audio = await room.tapAudio(from: person.id, policy: .transcription)
        Task {
            for await tapped in audio.elements {
                guard let line = recognizer.append(tapped.frame, from: person.id) else { continue }
                switch try await model.respond(to: line) {
                case .say(let text):
                    try await tts.synthesize(text, into: speak)
                case .mute(let who, let minutes):
                    try await room.moderate(
                        .forceMute(who, .audio, until: Date.now.addingTimeInterval(minutes * 60)),
                        as: hostGrants)
                case .nothing:
                    break
                }
            }
        }
    default:
        break
    }
}
```

The relays enforce the host's grants exactly as they would a person's: a mute it has no
capability for is refused, and an owner can still mute or remove the host.

### Tell people it's an AI

MOQOM doesn't mark a participant as an AI; that's yours to do, and in many places it's the law.
Article 50 of the EU AI Act, for one, requires telling people when they're interacting with an AI
system. Give the host a name that says so, have it introduce itself, and label it in your UI.

If the model runs at a provider rather than on your Mac, what you send it, the transcript, leaves
your trust boundary. Send text rather than audio, and say in your app which provider hears the
room.

## Limits

- **Agents in hosted rooms.** Participants' devices hold back their media while the group contains
  an agent the room's signed control log hasn't disclosed, so nobody is observed without being
  told. Hosted rooms don't publish that log yet, so agents you run work with
  [self-hosted relays](/guides/self-hosting/) first. On-device classification and AI
  participants are unaffected.
- **No AI marker on participants.** An AI host is an ordinary participant to MOQOM. Name and label
  it yourself, as above.
- **Models are yours.** MOQOM supplies the media and the moderation, not the classifier, the speech
  recognition or the LLM.
- **The model's name goes in the reason.** `decided_by_model` on a moderation entry is reserved for
  decisions MOQOM's own systems make. When your model decides, put its name and version in the
  actor's reason.

## Related

- [Moderation](/guides/moderation/): capabilities, mutes, bans and the moderation log.
- [End-to-end encryption](/guides/e2ee/#recording-and-classifiers): how agents join the group.
- [Recording](/guides/recording/): recorders as agents.
- [Shared AR spaces](/guides/ar-space/): RealityKit scenes shared between participants.
