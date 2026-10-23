---
title: Contributing
description: Who owns MOQOM, how outside contributions work, how to build and test the open-source SDKs, and how to donate.
---

Bug reports, fixes and examples are welcome on MOQOM's open-source projects.

## Ownership

Elliott Wave LLC, founded and solely owned by Elliott, owns all MOQOM intellectual property,
the open-source parts included. An open-source licence grants you the right to use the code
under its terms; it does not transfer ownership.

## Copyright Assignment Agreement

Outside contributions require signing a **Copyright Assignment Agreement**. Your first pull
request asks you to sign it by leaving a comment.

- It assigns the copyright in your contribution to Elliott Wave LLC.
- You get a permanent licence back to use your contribution for any purpose.

We have contacted legal counsel to review the agreement.

## Building and testing

| Project | Licence | Test command |
| --- | --- | --- |
| `moqom-go` | Apache-2.0 | `go test ./...` |
| `moqom-rust` | Apache-2.0 | `cargo test --workspace` |
| `moqom-security` | Apache-2.0 | `swift test`; `go test ./...` in `go/`; `cargo test --workspace` in `rust/` |

```sh
# moqom-go
go build ./...
go vet ./...
go test ./...

# moqom-rust
cargo build --workspace
cargo clippy --workspace --all-targets
cargo test --workspace
```

## Before you start

- **Good first issues.** Look for the `good first issue` label. Documentation fixes, examples
  and clearer error messages are always useful.
- **Open an issue before big changes.** Anything bigger than a bug fix should start as an issue,
  so nobody spends time on a change that conflicts with work in progress.
- **Security reports go to [security@moqom.cloud](mailto:security@moqom.cloud), not to
  issues.** See [Responsible disclosure](/security/disclosure/).

## Donate

Donations fund open-source maintenance and the [bug bounty](/security/disclosure/#bug-bounty).
Donate at [elliottwave.dev/donate](https://elliottwave.dev/donate/).
