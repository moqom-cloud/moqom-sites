---
title: Platform status
description: Which MOQOM SDKs are available today and which are on the way.
---

| Platform | Status | Notes |
| --- | --- | --- |
| **iOS, iPadOS, macOS** (Swift, `MoqomKit`) | **Available** | Ships with a prebuilt binary core. visionOS and tvOS 26 share the same package. See the [iOS & macOS guide](/guides/ios-macos/). |
| **Go backend** (`moqom-go`) | **Available** | [Go guide](/guides/backend-go/) |
| **Rust backend** (`moqom-rust`) | **Available** | [Rust guide](/guides/backend-rust/) |
| **Self-hosted relay** | **Available** | [Self-hosting](/guides/self-hosting/) |
| [Android](/platforms/android/) | In progress, coming Q4 2026 | |
| [Desktop](/platforms/desktop/) | In progress, coming Q4 2026 | |
| [OBS plugin](/platforms/obs/) | Scoped, work ongoing | |

Release notes appear in the [changelog](/changelog/). To hear when a platform ships, sign up at
[moqom.cloud](https://moqom.cloud).

## Interop

Every client speaks the same IETF [MoQ Transport](https://datatracker.ietf.org/doc/draft-ietf-moq-transport/) protocol to the same relays, so a room can mix
platforms freely: when the Android SDK ships, an Android viewer will watch an iPhone broadcaster
in the same room with no gateway in between. MOQOM launches on Apple platforms only.
