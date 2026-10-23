---
title: Recording
description: Room recording policy (allowed, required, prohibited), recorders as disclosed room agents, how recording is billed, and how it interacts with end-to-end encryption.
---

In MOQOM a recorder is not a hidden participant. It is a **watchdog**: an observer attached to a
room through the admin API, disclosed to everyone in it, and governed by the room's recording
policy.

:::note[What exists today]
Recording is done by a room agent **you run**: a process that joins with a token that has no
publish rights and writes what it receives to storage you choose. A hosted recorder that
MOQOM runs for you is in development.
:::

## Recording policy

Every room has a `recording` policy, set on `CreateRoom` or changed with `UpdateRoomPolicy`.

| Policy | Meaning |
| --- | --- |
| `allowed` | The default. A recording watchdog may be attached, and a hosted recording may be started. |
| `required` | A hosted recording starts with the room and can't be stopped while the room is open. With your own recorder instead, attach it before the room goes live. |
| `prohibited` | Attaching a recording watchdog or starting a hosted recording is refused with `FAILED_PRECONDITION`, including from your own backend. |

```go
r := client.Room("board-meeting")
_, err := r.UpdatePolicy(ctx, moqom.PolicyUpdate{
    Policy: moqom.Policy{Recording: moqom.RecordingProhibited},
    Fields: []string{"recording"},
})
```

Name `recording` in the update mask. A policy update without a mask applies every field. See
[`RoomPolicy`](/reference/control-plane-grpc/#roompolicy).

## Attach a recorder

1. Mint your recorder a token for the room with no publish rights, and start it.
2. Attach a watchdog of kind `recording`, so the room knows it is being recorded and by whom.
3. Detach it when the recorder stops.

```go
w, err := client.Room("live/42").AttachWatchdog(ctx, moqom.NewWatchdog{
    Kind:       moqom.WatchdogRecording,
    OperatedBy: moqom.OperatedByTenant,
    Descriptor: "This session is recorded by Example Inc.",
})
// later
_, err = client.Room("live/42").DetachWatchdog(ctx, w.ID, moqom.Actor{})
```

| Field | Notes |
| --- | --- |
| `Descriptor` | Shown to participants. Write it for a person. |
| `OperatedBy` | `tenant` for your own recorder. `third_party` needs `OperatorName`, so the room can say who is recording. |
| `Scope` | A namespace prefix to record, for example one participant. Empty records the whole room. |
| `PinnedLayer` | Subscribe to one rung of the layer ladder only. |

What the room sees:

- The watchdog is listed in room state with its kind, operator and descriptor, so your app can
  show a recording indicator. It is never in the roster or the participant count.
- `Room.is_recording` is true while a recording watchdog is attached and has not failed.
- Every attach and detach is written to the room's moderation log.
- A room's `watchdog_limit` (default 8) caps how many observers can attach.

## Billing

A recorder is billed as a subscriber for the bytes it receives, at the same
[per-minute rate](/billing/pricing/), as any viewer at the same tier. There is no
recording fee. Storage is wherever your recorder writes, so you pay your own storage costs. If
the recorder subscribes through a relay you host, only the
[platform fee](/billing/self-hosted/) applies.

Pin a lower layer (`PinnedLayer`) if you don't need full resolution; a recorder that takes the
top rung pays for the top rung.

## Recording and end-to-end encryption

Every room is [end-to-end encrypted](/guides/e2ee/), with no way to turn it off. Relays and any
server-side process see ciphertext only, so **MOQOM's servers cannot record the plaintext of a
room**, and a hosted recording stays ciphertext for good. To record what people saw:

| Option | Result |
| --- | --- |
| Run your recorder as an agent | Attach a watchdog to the room, mint a token for `watchdog.<id>`, and run MoqomKit's `RoomAgent` with it. It joins the room's encrypted group as a member every participant can see, and decrypts on your side. The recording is plaintext in your storage; MOQOM still sees only ciphertext. The recorder is inside your trust boundary, so treat its host and storage accordingly. |
| Record on the device | A participant's app records what it already decrypts. Nothing extra leaves the device. |

Participants' devices hold back their media while the group contains an agent the room's signed
control log hasn't disclosed, so nobody is recorded without being told. Hosted rooms don't
publish that log yet, so agents work in self-hosted deployments first; see
[Recording and classifiers](/guides/e2ee/#recording-and-classifiers).

## Hosted recording API

The `moqom.admin.v1.Recordings` service starts, stops and lists recordings made by the hosted
recorder. Every call is scoped to a tenant, and a key scoped to one tenant cannot see another
tenant's recordings.

| Method | What it does |
| --- | --- |
| `StartRecording` | Starts recording a room. The room must be open and its policy not `prohibited`. Needs the same standing as attaching a watchdog. |
| `StopRecording` | Asks a recording to stop. The recorder finishes its files, then the recording becomes `COMPLETED`. |
| `ListRecordings` | Lists recordings, newest first, optionally for one room. Paged with `page_size` and `page_token`. |
| `GetRecording` | One recording with its files and a signed download link for each. |

```go
import adminpb "github.com/moqom-cloud/moqom-go/admin/adminpb"

recordings := adminpb.NewRecordingsClient(conn)

started, err := recordings.StartRecording(ctx, &adminpb.StartRecordingRequest{
    Tenant: "acme",
    Room:   "live/42",
    Options: &adminpb.RecordingOptions{
        Format:      adminpb.RecordingFormat_RECORDING_FORMAT_ARCHIVE_AND_CMAF,
        MaxDuration: durationpb.New(2 * time.Hour),
    },
    Actor: &adminpb.ActorContext{OnBehalfOf: "alice", Reason: "weekly town hall"},
})

// later
done, err := recordings.GetRecording(ctx, &adminpb.GetRecordingRequest{
    Tenant:      "acme",
    RecordingId: started.Id,
    UrlLifetime: durationpb.New(time.Hour),
})
for _, file := range done.Artifacts {
    fmt.Println(file.Kind, file.Track, file.Bytes, file.DownloadUrl)
}
```

How recordings behave:

- **Policy.** `prohibited` refuses `StartRecording` with `FAILED_PRECONDITION`, and changing a
  room to `prohibited` stops any recording in progress. `required` starts a recording when the
  room is created or the policy is set, and `StopRecording` is refused while the room is open.
  Closing the room stops it.
- **One at a time.** A second `StartRecording` for a room that is already being recorded returns
  `ALREADY_EXISTS`.
- **Disclosure.** A hosted recording attaches a `recording` watchdog operated by MOQOM, so the
  room shows it is being recorded. The recorder never appears in the roster or the participant
  count.
- **States.** `PENDING` until a recorder picks it up, then `RECORDING`, `STOPPING` and
  `COMPLETED`, or `FAILED` with `error` set. A recording continues through a recorder restart,
  and files from each recorder session are kept.
- **Formats.** Every recording includes a lossless archive of each track, with timing.
  `ARCHIVE_AND_CMAF` (the default) also writes fragmented MP4 for tracks that can be packaged
  without re-encoding: H.264, HEVC and Opus in rooms where end-to-end encryption is off. Each
  recording also has a JSON manifest listing its files, linked from `manifest_url`.
- **End-to-end encryption.** In an E2EE room the hosted recorder stores ciphertext only, exactly
  as it was received, and `encrypted` is true. Decrypt it later with your own keys. MOQOM cannot
  play it back.
- **Downloads.** Links in `GetRecording` are valid for `url_lifetime`: 15 minutes by default,
  7 days at most, with the expiry in `urls_expire_at`. `ListRecordings` returns the file list
  without links. A recording with more than 1,000 files sets `artifacts_truncated`, and the
  manifest lists the rest.
- **Storage.** Files are stored under a path that begins with your tenant.

**Billing.** The hosted recorder is billed like any other viewer, for the bytes it receives.
There is no recording fee. Storage is passed through at cost.

## Related

- [Moderation](/guides/moderation/): the audit trail that attach and detach are written to.
- [Control-plane gRPC API](/reference/control-plane-grpc/#rooms): `AttachWatchdog`,
  `DetachWatchdog`, `ListWatchdogs`.
- [Threat model & controls](/security/overview/): hidden observers.
