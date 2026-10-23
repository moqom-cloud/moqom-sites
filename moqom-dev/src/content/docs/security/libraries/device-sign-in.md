---
title: Device-bound sign-in
description: Replace bearer session tokens in your own app with post-quantum tokens bound to a Secure Enclave key, using moqom-token and moqom-proof. Stolen tokens, replayed requests and interceptors with their own certificate all get nothing.
---

Most apps sign a user in once and then send a bearer credential with every request: a session
cookie, an OAuth access token, a [JWT](https://www.rfc-editor.org/rfc/rfc7519). Whoever holds that string is the user. It leaks through
logs, backups, crash reports, a compromised proxy or malware reading app storage, and it works
from anywhere until it expires.

[`moqom-token`](/security/libraries/token/) and [`moqom-proof`](/security/libraries/proof/)
replace it with the scheme MOQOM's own apps and relays use. The token names a key that lives in
the device's Secure Enclave, and every request carries a fresh, single-use proof signed by that
key, bound to the token and to the TLS certificate of the server it is sent to. Both are signed
with **ML-DSA-87**, the post-quantum signature standard ([FIPS 204](https://csrc.nist.gov/pubs/fips/204/final)).

Your existing sign-in (password, passkey, Sign in with Apple) stays. It runs once per device, to
enrol the device's key; everything after that uses the token and proofs. Moving an existing JWT
setup over? [Replace your app's JWTs](/security/libraries/replace-jwt/) does it one step at a time.

## Zero trust, per request

A bearer session trusts whoever holds the string. This scheme trusts nothing it can't check on
the request in front of it:

- **No trusted session.** Every request proves, again, that it comes from the enrolled device's
  key. There is no cookie or session ID that stands in for the user once they're signed in.
- **No trusted network.** The proof names the TLS certificate of the server it was made for, so
  being on the path, inside the network, or holding a valid certificate for your domain is not
  enough to use what passes by.
- **No trusted storage.** The device key is generated in the Secure Enclave and can't be
  exported, so nothing your app writes to disk, logs or backs up can be used to sign as the
  device.
- **No trusted parser.** Token and proof are read by the same strict rules in Swift, Go and
  Rust, so a crafted header can't make two components disagree about who is asking.

MOQOM runs its own servers the same way, one layer further down: the control plane, the relays'
management ports and the admin API are dark services on an [OpenZiti](https://openziti.io)
overlay, with no public port at all, reachable only with an enrolled identity. If your API
serves only your own apps and servers, putting it behind an overlay like that removes it from the
internet entirely; device-bound tokens and proofs still decide who each request is from. See
[Zero-trust management plane](/guides/peer-to-peer/#zero-trust-management-plane).

## What each attack gets

### Flaws in the bearer model itself

These aren't bugs in any one library. They follow from "whoever holds the string is the user",
so every bearer scheme has them: session cookies, OAuth access tokens and
[JWTs](https://www.rfc-editor.org/rfc/rfc7519) alike. They're behind some of the largest
breaches of recent years.

| Attack | Seen in | With a bearer token | With a device-bound token |
| --- | --- | --- | --- |
| **Session theft that skips MFA.** Malware ("infostealers") copies tokens off a device that already passed MFA, and the attacker replays them elsewhere | [CircleCI, 2023](https://circleci.com/blog/jan-4-2023-incident-report/): an engineer's 2FA-backed SSO session stolen by malware | Full access from the attacker's machine; MFA never runs again | Nothing: the token needs a proof from the device's Secure Enclave key, which malware can't copy off the device (`wrong_key`) |
| **Tokens leaked through tooling.** Logs, crash reports, backups, debugging captures shared with support | [Okta, 2023](https://sec.okta.com/articles/harfiles/): session tokens in HAR files uploaded to support were used against customers | Full access until it expires | Nothing (`wrong_key`) |
| **Tokens stolen from a third party's servers** | [GitHub, 2022](https://github.blog/news-insights/company-news/security-alert-stolen-oauth-user-tokens/): OAuth tokens stolen from Heroku and Travis CI used to clone private repositories | Usable from anywhere | A stolen token is useless without the holder's key, which a database dump doesn't contain |
| **Replay.** A captured request sent again | Any bearer API | Accepted | Refused: each proof is single-use (`replayed`) |
| **Interception with a certificate of its own.** A mis-issued certificate, a hijacked domain or DNS, TLS inspection, a malicious proxy | Corporate TLS inspection, compromised proxies | It reads the token and uses it anywhere | The device's proof names the interceptor's certificate, so the real server refuses it (`wrong_certificate`) |
| **No way to end a session.** A stateless token stays valid after logout, password change or device loss | Most JWT deployments | Valid until it expires, often hours or days | **Enforced inside the open session, not only at connect.** The relay closes a live connection the moment its token expires (within 30 seconds of clock tolerance), so a session lives no longer than its token: fifteen minutes at most. A signed-out or removed device can't renew, and a ban closes the live connection as soon as it reaches the relay, without waiting for expiry |
| **Harvest now, forge later.** A quantum computer recovering the issuer's private key | Any RSA, ECDSA or Ed25519 issuer | Every token becomes forgeable | Tokens and proofs are signed with [ML-DSA-87](https://csrc.nist.gov/pubs/fips/204/final), which is designed to resist it |

### Flaws common across JWT libraries

These come from the JWT format's flexibility: the token tells the verifier how to check it. They
have been found again and again in popular libraries across languages.

| Attack | Example | With `moqom-token` and `moqom-proof` |
| --- | --- | --- |
| **`alg: none`.** An unsigned token accepted as valid | [CVE-2015-9235](https://nvd.nist.gov/vuln/detail/CVE-2015-9235), Node `jsonwebtoken` | Refused: the key decides the algorithm, and no key has the algorithm `none` |
| **Algorithm confusion.** An HMAC token keyed with the server's public RSA key | [CVE-2016-10555](https://nvd.nist.gov/vuln/detail/CVE-2016-10555), `jwt-simple` | Refused: no HMAC exists, and `alg` must equal the algorithm of the key `kid` names |
| **Key injection.** The token carries its own key (`jwk`) or says where to fetch one (`jku`, `x5u`) | [CVE-2018-0114](https://nvd.nist.gov/vuln/detail/CVE-2018-0114), Cisco `node-jose` | Refused: the header has exactly `alg`, `typ` and `kid`, and any other parameter makes the token malformed |
| **`kid` injection.** A key ID used as a file path or database query | Path traversal and SQL injection through `kid` | Not possible: `kid` is only compared byte for byte against the keys you loaded |
| **"Psychic signatures."** An all-zero ECDSA signature accepted for any token | [CVE-2022-21449](https://nvd.nist.gov/vuln/detail/CVE-2022-21449), Java 15–18 | Tokens use ML-DSA-87 only, and Ed25519 tokens are refused, through each platform's own verified implementation |
| **Weak shared secrets.** HMAC secrets short enough to brute-force offline from one token | Common in HS256 deployments | Not possible: there is no shared secret, only an ML-DSA-87 key pair |
| **Missing claim checks.** No expiry, or a token for another audience accepted | Libraries that make `exp` and `aud` optional | `exp` is always required and capped at fifteen minutes; issuer and tenant are compared byte for byte when pinned |
| **Two parsers, two readings.** Duplicate claims, odd numbers or bad Unicode read differently by two components | Parser differentials between gateways and services | Refused: one strict JSON reading in Swift, Go and Rust, checked by shared test vectors |

### What else to handle, and how

The token and proof decide who a request is from. Four things sit next to that, and each has a
clear answer.

- **Protect your private key.** Anyone holding the private key you sign tokens with can mint
  tokens bound to a device key of their own, as attackers did with a stolen Microsoft signing key in
  [Storm-0558](https://www.microsoft.com/en-us/security/blog/2023/07/14/analysis-of-storm-0558-techniques-for-unauthorized-email-access/).
  - Keep the seed in a secret manager or HSM, readable only by the one service that issues
    tokens, never by the services that verify them. Verifiers need only the public key.
  - Pin the issuer, and the tenant if you have one, so a token from any other key is refused.
  - Rotate on a schedule: publish the new key ID beside the old one, issue with the new one, and
    drop the old one after fifteen minutes, the longest a token can live. Nobody has to sign in
    again. See [Set it up](#set-it-up).
  - MOQOM does the same: its signing key is in Google Secret Manager, readable only by the
    control plane, which itself has no public port
    ([zero-trust management plane](/guides/peer-to-peer/#zero-trust-management-plane)).
- **Encrypt the traffic with post-quantum TLS, and pin in your app.** Tokens and proofs are
  signatures, not encryption, so TLS keeps requests secret. Use ML-KEM-1024 key exchange
  where both ends are yours ([Post-quantum, part by part](#post-quantum-part-by-part)) and pin your server's certificate,
  as the [Swift client](#swift-the-app) does. Pinning is worth having but is no substitute for the
  proof:
  - **Pinning protects only the connection your app makes.** A token that leaks from a log, a
    backup or your own servers works from any client, including an attacker's script that pins
    nothing. The proof is what makes the token useless there.
  - **The server can't tell whether a client pinned.** The proof's certificate binding is
    checked by the server, on every request. It holds even for a client that got pinning wrong,
    or on a device where pinning was switched off with instrumentation tools such as Frida,
    which is routine for anyone reverse-engineering an app.
  - **Pins get relaxed in practice.** Apps ship backup pins and fallbacks so a certificate
    rotation doesn't break old versions, and every fallback is a certificate an interceptor
    might hold.
  - **Pinning says nothing about who is asking.** It authenticates the server to your app. The
    token and proof authenticate the device to the server, on every request.

  Together: TLS keeps the traffic secret, pinning keeps your app talking to the right server,
  and the proof makes sure nothing captured on any path, by any client, can be used. If TLS ends
  at a load balancer, see [Where TLS ends](#deploying-it).
- **Validate your inputs.** SQL injection, command injection and cross-site scripting are still
  your server's input handling: parameterised queries, no shell, output encoding (the
  [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/) covers each). What these
  libraries remove is injection through the credential itself: token headers, key IDs and claims
  are read strictly, and never used as paths, queries or URLs (the
  [JWT table above](#flaws-common-across-jwt-libraries)). MOQOM's own decoders are fuzzed
  continuously ([threats and controls](/security/overview/#threats-and-controls)).
- **Limit what a compromised device can do.** Malware running as your app on an unlocked device
  can ask the Secure Enclave to sign, though it can never copy the key off the device. So the
  damage stays on that one device, and it ends when you act:
  - **Contained to the device.** Every proof comes from that device's key, so the attacker
    can't move the session to a machine of their own, and every request they make is
    attributable to the one device.
  - **Short by default.** Tokens last fifteen minutes at most, and a removed device can't renew.
    Remove the device on your server, and its access ends within that window. MOQOM goes
    further: a relay closes the live connection when its token expires, and a ban by device
    closes it at once ([moderation](/guides/moderation/)).
  - **Re-enrol on suspicion.** A new device key means a new sign-in, which runs your full MFA or
    passkey check again.

## Post-quantum, part by part

| Part | Algorithm | Where |
| --- | --- | --- |
| Token signature | ML-DSA-87 ([FIPS 204](https://csrc.nist.gov/pubs/fips/204/final)) | `moqom-token` |
| Device proof signature | ML-DSA-87, in the Secure Enclave on Apple devices | `moqom-proof` |
| Connection secrecy (key exchange) | Post-quantum key exchange in [TLS 1.3](https://www.rfc-editor.org/rfc/rfc8446): [ML-KEM-1024](https://csrc.nist.gov/pubs/fips/203/final) (`SecP384r1MLKEM1024` or `MLKEM1024`) where both ends are yours; hybrid [X25519](https://www.rfc-editor.org/rfc/rfc7748) elliptic curve + ML-KEM-768 ([`X25519MLKEM768`](https://datatracker.ietf.org/doc/draft-ietf-tls-ecdhe-mlkem/)) for browsers, which offer nothing stronger | Your TLS stack |
| Room media keys, in MOQOM | ML-KEM-1024 and ML-DSA-87 in [MLS](https://www.rfc-editor.org/rfc/rfc9420) | [`moqom-mls`](/security/libraries/mls/) |

Tokens and proofs are signatures; there is no key exchange in them. The key exchange that keeps
a connection secret is TLS's, and it should be post-quantum too, because recorded traffic can be
decrypted later by whoever eventually has a large enough quantum computer.

- **Where both ends are yours,** use ML-KEM-1024: hybrid `SecP384r1MLKEM1024` or pure
  `MLKEM1024`. Set the curve preferences explicitly in Go's `crypto/tls` or in rustls with
  `aws-lc-rs`, because their defaults prefer ML-KEM-768 and still offer classical curves.
- **Where browsers connect,** accept hybrid `X25519MLKEM768`. It is the strongest key exchange
  any browser offers.
- **Refuse classical-only key exchange** everywhere.

MOQOM does this itself: every device connection and every link between MOQOM's servers is
ML-KEM-1024 only, and `api.moqom.cloud` gives browsers `X25519MLKEM768`
([details](/guides/e2ee/#post-quantum)).

## Set it up

1. **Make an issuer key, once.** Generate an [ML-DSA-87](https://csrc.nist.gov/pubs/fips/204/final) key and keep its 32-byte seed in your
   secret manager. Give it a key ID (`2026-10`). If anything other than this server verifies
   tokens, publish the public key as a [JWK](https://www.rfc-editor.org/rfc/rfc7517) set.
2. **Make a device key, once per device.** On Apple devices running iOS, macOS, visionOS or
   tvOS 26 or later, create a `SecureEnclave.MLDSA87.PrivateKey`. The Secure Enclave holds
   ML-DSA-87 keys from the 26 releases, so the device key is post-quantum and hardware-bound at
   once. Keep its `dataRepresentation` in the keychain with
   `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`: the blob is useless to any other device,
   and `ThisDeviceOnly` keeps it out of backups and iCloud Keychain. The simulator has no Secure
   Enclave, so there you need a software ML-DSA-87 key; record which kind you made, because only
   the enclave key carries the guarantee. MOQOM's own SDK does exactly this in `DeviceKey` and
   reports the result as `storage`.
3. **Enrol.** After your normal sign-in, the device sends its public JWK. The server computes the
   thumbprint itself and mints a token with that thumbprint as `cnf.jkt`, for at most fifteen
   minutes. The short life isn't what protects the token, since the binding does; it means
   revoking a user or a device takes effect within minutes without a revocation list. To renew,
   add an endpoint that checks the current token and a proof exactly as in step 5 and mints a
   new token for the same `cnf.jkt`; the device calls it a couple of minutes before expiry.
4. **Send every request with both.** `Authorization: MOQT <token>` and `MOQT-Proof: <proof>`,
   where the proof is made for this request with a new nonce and the SHA-256 of the server's
   leaf certificate.
5. **Check both on the server.** Verify the token with the issuer and tenant pinned, then check
   the proof against your own certificate's hash, with the certificate required and only
   ML-DSA-87 accepted. Instances behind one name should share the nonce store.

## Go: server and client

This runs as `Example_deviceBoundSignIn` in `go/token/example_signin_test.go`: a real HTTPS
server, a device enrolling, one good request, and four attacks. The test's helpers, which send a
request on its own TLS connection and make a throwaway certificate, are in the same file.

```go
// ---- Your backend ----

// The issuer key. Generate it once and keep issuer.Seed() in your secret
// manager; publish issuer.PublicKey().JWK() for anything else that verifies.
issuer, err := token.GenerateSigner()
if err != nil {
	log.Fatal(err)
}
issuer = issuer.WithID("2026-10")
verifier := token.NewVerifier("https://api.example.com", issuer.PublicKey()).ForTenant("acme")
checker, err := proof.NewChecker(proof.NewDefaultMemoryNonceStore(),
	proof.WithAlgorithms(proof.MLDSA87), proof.WithCertificateRequired(true))
if err != nil {
	log.Fatal(err)
}

// The server's TLS certificate, and its SHA-256, known before it serves.
certificateHash := sha256.Sum256(certificate.Certificate[0])

mux := http.NewServeMux()
// Enrolment: after your existing sign-in, the device sends its public key.
mux.HandleFunc("POST /enrol", func(w http.ResponseWriter, r *http.Request) {
	user := "ada" // whoever your existing sign-in authenticated
	var key proof.JWK
	if err := json.NewDecoder(r.Body).Decode(&key); err != nil {
		http.Error(w, "bad key", http.StatusBadRequest)
		return
	}
	thumbprint, err := key.Thumbprint() // derived here, never taken from the device
	if err != nil {
		http.Error(w, "bad key", http.StatusBadRequest)
		return
	}
	now := time.Now()
	jws, err := issuer.Sign(token.Claims{
		Issuer:       "https://api.example.com",
		Subject:      user,
		Tenant:       "acme",
		ID:           proof.NewNonce(),
		IssuedAt:     now.Unix(),
		Expires:      now.Add(15 * time.Minute).Unix(),
		Confirmation: token.Confirmation{Thumbprint: thumbprint},
	})
	if err != nil {
		http.Error(w, "cannot mint", http.StatusInternalServerError)
		return
	}
	_, _ = io.WriteString(w, jws)
})
// Every other request: verify the token, then the proof.
mux.HandleFunc("GET /me", func(w http.ResponseWriter, r *http.Request) {
	jws := strings.TrimPrefix(r.Header.Get("Authorization"), "MOQT ")
	now := time.Now()
	claims, err := verifier.Verify(jws, now)
	if err != nil {
		http.Error(w, token.Class(err), http.StatusUnauthorized)
		return
	}
	err = checker.Check([]byte(r.Header.Get("MOQT-Proof")), []byte(jws), certificateHash[:],
		claims.Confirmation.Thumbprint, now, claims.ExpiresTime())
	if err != nil {
		http.Error(w, proof.Class(err), http.StatusUnauthorized)
		return
	}
	fmt.Fprintf(w, "hello %s", claims.Subject)
})

// ---- The device ----

// On iOS this key is made in the Secure Enclave and never leaves it.
device, err := proof.GenerateProver(proof.MLDSA87)
if err != nil {
	log.Fatal(err)
}
key, err := json.Marshal(device.JWK()) // the body of POST /enrol, which returns the token

// For each request, after the TLS handshake: a proof for the certificate
// this connection's server presented.
leaf := sha256.Sum256(conn.ConnectionState().PeerCertificates[0].Raw)
p, err := device.Prove([]byte(jws), leaf[:], proof.NewNonce(), time.Now())
request.Header.Set("Authorization", "MOQT "+jws)
request.Header.Set("MOQT-Proof", string(p))
```

What the server answers, in order: the device's request, the same request sent again, the
token with a thief's proof, a proof the device made for an interceptor's certificate, and the
token with no proof:

```text
200 hello ada
401 replayed
401 wrong_key
401 wrong_certificate
401 malformed
```

## Swift: the app

The device side in an app, compiled by the test suite in `SignInExampleTests.swift`.
`SignedClient` makes a proof for each request and only lets requests
reach a server whose leaf certificate is the one the proofs name, so a proof never travels over
a connection to anyone else. `certificateHash` comes from your app's configuration; when you
rotate the server's certificate, ship the new hash first.

```swift
import CryptoKit
import Foundation
import MoqomProof

/// Sends requests with the device-bound token, each with a fresh proof.
struct SignedClient {
    let device: Prover
    let certificateHash: Data
    let session: URLSession

    init(device: Prover, certificateHash: Data) {
        self.device = device
        self.certificateHash = certificateHash
        session = URLSession(configuration: .ephemeral,
                             delegate: PinnedServer(certificateHash: certificateHash),
                             delegateQueue: nil)
    }

    func data(for request: URLRequest, token: String) async throws -> (Data, URLResponse) {
        var request = request
        let proof = try device.prove(token: Data(token.utf8), certificateHash: certificateHash, nonce: Prover.nonce())
        request.setValue("MOQT \(token)", forHTTPHeaderField: "Authorization")
        request.setValue(String(decoding: proof, as: UTF8.self), forHTTPHeaderField: "MOQT-Proof")
        return try await session.data(for: request)
    }
}

/// Refuses any server whose leaf certificate is not the one the proofs name.
final class PinnedServer: NSObject, URLSessionDelegate {
    let certificateHash: Data

    init(certificateHash: Data) { self.certificateHash = certificateHash }

    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge
    ) async -> (URLSession.AuthChallengeDisposition, URLCredential?) {
        guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
              let trust = challenge.protectionSpace.serverTrust,
              SecTrustEvaluateWithError(trust, nil),
              let leaf = (SecTrustCopyCertificateChain(trust) as? [SecCertificate])?.first,
              Data(SHA256.hash(data: SecCertificateCopyData(leaf) as Data)) == certificateHash
        else { return (.cancelAuthenticationChallenge, nil) }
        return (.useCredential, URLCredential(trust: trust))
    }
}

// Once per device: a key in the Secure Enclave. Keep key.dataRepresentation in the keychain
// and load it again with SecureEnclave.MLDSA87.PrivateKey(dataRepresentation:).
let key = try SecureEnclave.MLDSA87.PrivateKey()
let device = Prover(.secureEnclaveMLDSA87(key))
let enrolment = try JSONEncoder().encode(device.jwk) // POST this after your sign-in
```

The same flow with the server written in Swift runs in the test suite as
`Tests/MoqomTokenTests/SignInExampleTests.swift`, with the same five outcomes:

```swift
let serverCertificate = Data(SHA256.hash(data: Data("your server's leaf certificate, DER".utf8)))
let backend = try Backend(certificateHash: serverCertificate)

// On the device. In an app: Prover(.secureEnclaveMLDSA87(try SecureEnclave.MLDSA87.PrivateKey())).
let device = Prover(.mlDSA87(try MLDSA87.PrivateKey()))
let token = try backend.enrol(user: "ada", key: try JSONEncoder().encode(device.jwk))

// Each request: the token, and a fresh proof for the server's certificate.
let proof = try device.prove(token: Data(token.utf8), certificateHash: serverCertificate, nonce: Prover.nonce())
#expect(backend.me(token: token, proof: proof) == "200 hello ada")
#expect(backend.me(token: token, proof: proof) == "401 replayed")
```

where the backend's two endpoints are:

```swift
/// `POST /enrol`, after your existing sign-in: the device sends its public key.
func enrol(user: String, key body: Data) throws -> String {
    let key = try JSONDecoder().decode(ProofJWK.self, from: body)
    let now = Int64(Date().timeIntervalSince1970)
    return try issuer.sign(Claims(
        issuer: "https://api.example.com",
        subject: user,
        tenant: "acme",
        id: Prover.nonce(),
        issuedAt: now,
        expires: now + 15 * 60,
        thumbprint: try key.thumbprint() // derived here, never taken from the device
    ))
}

/// Any other request: verify the token, then the proof.
func me(token: String, proof: Data) -> String {
    let now = Date()
    do {
        let claims = try verifier.verify(token, now: now)
        try checker.check(proof, token: Data(token.utf8), certificateHash: certificateHash,
                          thumbprint: claims.thumbprint, now: now, until: claims.expiresDate)
        return "200 hello \(claims.subject)"
    } catch let error as TokenError {
        return "401 \(error.errorClass)"
    } catch let error as ProofError {
        return "401 \(error.errorClass)"
    } catch {
        return "500"
    }
}
```

## Deploying it

- **Header sizes.** An [ML-DSA-87](https://csrc.nist.gov/pubs/fips/204/final) token is about 6.8 KB and a proof about 11.1 KB, so each request
  carries about 18 KB of credentials. Go's server allows 1 MB of headers by default. nginx's
  default of 8 KB per header line is too small for the proof: set
  `large_client_header_buffers 4 16k;`. Check the limits of every proxy in front of your server.
- **Where TLS ends.** A proof names the certificate of whatever terminates TLS. If a load
  balancer or CDN terminates it, the device sees that certificate, so the server must check
  proofs against that certificate's hash, and the binding protects the path to the load balancer,
  not beyond it. Terminating TLS at your own servers, or passing it through, keeps the binding
  end to end.
- **Several instances.** Each nonce must be spent once across every instance that shares a
  certificate. Implement the one-method `NonceStore` over a shared database such as Redis or
  Postgres, recording the nonce atomically.
- **Long-lived connections.** On a WebSocket, a gRPC stream or a MoQ session, send the token
  and proof once when the connection opens, and again when the token is renewed. That is how
  MOQOM's clients talk to relays.
- **Clocks.** A proof is accepted within five minutes of the server's clock by default. Devices
  with a clock further off are refused as `expired` or `not_yet_valid`.
- **Older devices.** A device with a P-256 key must generate an ML-DSA-87 key and sign in again.
  Checkers refuse ES256 proofs as `unsupported`, because ES256 is not post-quantum.

## Compared with DPoP

The proof has the shape of an [RFC 9449](https://www.rfc-editor.org/rfc/rfc9449) DPoP proof, with three differences that matter here: it
is bound to the server's certificate rather than to a URL, so an interceptor answering for your
name cannot reuse it; every proof is single-use, not only within a freshness window; and it is
post-quantum by default. See [How it differs from DPoP](/security/libraries/proof/#how-it-differs-from-dpop).
