---
title: Web SDK
description: MOQOM for browsers — in progress, coming Q4 2026.
draft: true
---

:::note[Status]
**In progress. Coming Q4 2026.**
:::

The web SDK will let browsers join MOQOM rooms over **[WebTransport](https://datatracker.ietf.org/doc/draft-ietf-webtrans-http3/)**, the same carrier MOQOM
relays already accept on their single UDP port alongside raw [QUIC](https://www.rfc-editor.org/rfc/rfc9000).

Expected shape, subject to change:

- Join, publish and watch with the same room, role and token model as the
  [Swift SDK](/guides/ios-macos/).
- Tokens minted by your backend exactly as today — no backend changes required.
- Interop with iOS and macOS participants in the same room.

Until it ships, browsers are not supported clients. See [Platform status](/platforms/status/).
