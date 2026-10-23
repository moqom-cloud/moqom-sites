---
title: Responsible disclosure
description: How to report a security vulnerability in MOQOM, and what to expect from us.
---

We welcome reports from security researchers and customers.

## How to report

Email **[security@moqom.cloud](mailto:security@moqom.cloud)** with:

- a description of the issue and its impact,
- steps to reproduce, or a proof of concept,
- affected component (SDK and version, API route, relay, website),
- your name or handle if you would like credit.

Please do not include real users' personal data in a report.

## Bug bounty

Our HackerOne program launches as a vulnerability disclosure program. Cash bounties are funded by donations to the open-source projects until paying customers adopt MOQOM. Until then, every valid report gets public credit and our thanks — in the hall of fame and release notes — and we'll send you something: swag in the mail or a tip to your crypto wallet.

<!-- TODO(Elliott): https://hackerone.com/elliottwave is a placeholder until the program is live. Confirm the URL and remove this comment at launch. -->
Program page: [hackerone.com/elliottwave](https://hackerone.com/elliottwave). Until the program
is live, email **[security@moqom.cloud](mailto:security@moqom.cloud)**.

Donations that fund bounties: [elliottwave.dev/donate](https://elliottwave.dev/donate/). See also
[Contributing](/community/contributing/#donate).

## What to expect

**Target: acknowledge within 3 business days.**

<!-- TODO(Elliott): the timelines below are unconfirmed targets drafted for this page. Confirm or replace them, then drop "to be confirmed". -->
Further targets, to be confirmed:

| Step | Target (to be confirmed) |
| --- | --- |
| Initial assessment | Within 10 business days |
| Status updates | At least every 14 days until resolved |
| Fix and disclosure | Coordinated with you; aim to resolve critical issues within 30 days |

## Scope

In scope:

- MOQOM Cloud APIs (`api.moqom.cloud`), relays, and Apple sign-in hosted by MOQOM
- `MoqomKit`, `moqom-go`, `moqom-rust`
- moqom.cloud and moqom.dev

Out of scope: denial-of-service volume testing, social engineering, physical attacks, and
third-party services (for example Stripe) except where MOQOM's integration is at fault.

## Safe harbour

We will not pursue legal action for research that:

- stays within scope and makes a good-faith effort to avoid privacy violations, data destruction
  and service disruption,
- uses only accounts and tenants you own or have permission to test,
- gives us reasonable time to fix the issue before public disclosure.

We have contacted legal counsel to review this.

Elliott Wave LLC operates MOQOM.
