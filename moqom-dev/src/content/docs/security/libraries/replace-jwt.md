---
title: Replace your app's JWTs
description: A step-by-step walkthrough for moving an app from bearer JWTs minted by a login endpoint to post-quantum, device-bound tokens with moqom-token and moqom-proof, including staying signed in when the app reopens. Your sign-in stays; eight small changes swap what it hands out.
---

Many apps authenticate like this: the app posts a password (or a passkey, or a Sign in with
Apple credential) to `POST /login`, the server answers with a [JWT](https://www.rfc-editor.org/rfc/rfc7519)
signed with a shared secret, and every later request sends `Authorization: Bearer <jwt>`. This
page moves that setup to [`moqom-token`](/security/libraries/token/) and
[`moqom-proof`](/security/libraries/proof/), one step at a time. Your sign-in check, your user
table and your routes stay as they are.

The difference in one sentence: today, whoever holds the JWT is the user. Afterwards, the token
only works together with a fresh signature from a key locked inside the user's iPhone or Mac, so
a token copied out of a log, a backup or your database is worthless. The reasons are in
[What each attack gets](/security/libraries/device-sign-in/#what-each-attack-gets).

## What changes

| | Today | After |
| --- | --- | --- |
| Signing key | A shared HS256 secret, on every server that checks tokens | An [ML-DSA-87](https://csrc.nist.gov/pubs/fips/204/final) key pair: the private seed only on the server that issues tokens, the public key anywhere that checks them |
| `POST /login` returns | A JWT for the user | A token for the user **and** the device key the app sent with the login |
| Each request sends | `Authorization: Bearer <jwt>` | `Authorization: MOQT <token>` and `MOQT-Proof: <proof>`, a one-time signature from the device key |
| Your middleware | Checks the JWT's signature and expiry | Checks the token, then the proof |
| Lifetime | Hours or days, often with a refresh token | Fifteen minutes at most, renewed by the app with no refresh token |
| Reopening the app | A long-lived JWT or refresh token kept in the keychain | A fresh token from a proof by the device key; nothing else is stored |
| Signing out a device | Wait for expiry, or keep a deny list | Remove the device's key on the server; it can't renew, and its open streams close at once |
| Open streams | Authenticated once at connect, then open for as long as the socket lasts | End when the token does, unless the device renews |

## Before

The starting point, in Go with [`golang-jwt`](https://github.com/golang-jwt/jwt), and in Swift:

```go
var secret = []byte(os.Getenv("JWT_SECRET"))

mux.HandleFunc("POST /login", func(w http.ResponseWriter, r *http.Request) {
	user, err := checkPassword(r) // your sign-in, unchanged throughout
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	jwt, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": user.ID,
		"exp": time.Now().Add(24 * time.Hour).Unix(),
	}).SignedString(secret)
	_, _ = io.WriteString(w, jwt)
})

func requireUser(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		parsed, err := jwt.Parse(raw, func(*jwt.Token) (any, error) { return secret, nil },
			jwt.WithValidMethods([]string{"HS256"}))
		if err != nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		user, _ := parsed.Claims.GetSubject()
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), userKey{}, user)))
	})
}
```

```swift
let jwt = try await login(email: email, password: password) // kept in the keychain
request.setValue("Bearer \(jwt)", forHTTPHeaderField: "Authorization")
```

## 1. Swap the shared secret for a key pair

Generate an ML-DSA-87 issuer key once, and store its 32-byte seed where `JWT_SECRET` lives
today: your secret manager.

```go
issuer, _ := token.GenerateSigner()
fmt.Println(base64.StdEncoding.EncodeToString(issuer.Seed())) // into your secret manager, once
```

At startup, the server that issues tokens loads the seed. Every server that checks tokens needs
only the public key, so a leak from one of them can't be used to mint anything.

```go
seed, _ := base64.StdEncoding.DecodeString(os.Getenv("TOKEN_SEED"))
issuer, err := token.NewSigner(seed)
if err != nil {
	log.Fatal(err)
}
issuer = issuer.WithID("2026-10") // a key ID, so you can rotate later

verifier := token.NewVerifier("https://api.example.com", issuer.PublicKey()).ForTenant("example")
checker, err := proof.NewChecker(proof.NewDefaultMemoryNonceStore(),
	proof.WithAlgorithms(proof.MLDSA87), proof.WithCertificateRequired(true))
if err != nil {
	log.Fatal(err)
}

// The SHA-256 of the TLS certificate this server presents, which every proof must name.
certificate, err := tls.LoadX509KeyPair("server.crt", "server.key")
if err != nil {
	log.Fatal(err)
}
certificateHash := sha256.Sum256(certificate.Certificate[0])
```

The tenant (`"example"` here) is required in every token. If your app has no tenants, use one
fixed string, such as your app's name.

## 2. Give each device a key

In the app, create a key in the Secure Enclave the first time it runs, and keep it in the
keychain. The private key never leaves the chip: what you store is an encrypted handle that only
this device's Secure Enclave can use. This replaces keeping the JWT in the keychain.

```swift
import CryptoKit
import MoqomProof
import Security

/// The device's key: made once in the Secure Enclave, then loaded from the keychain.
func deviceKey() throws -> Prover {
    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: "com.example.device-key",
        kSecReturnData as String: true,
    ]
    var found: CFTypeRef?
    if SecItemCopyMatching(query as CFDictionary, &found) == errSecSuccess, let blob = found as? Data {
        return Prover(.secureEnclaveMLDSA87(try SecureEnclave.MLDSA87.PrivateKey(dataRepresentation: blob)))
    }
    let key = try SecureEnclave.MLDSA87.PrivateKey()
    let add: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: "com.example.device-key",
        kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        kSecValueData as String: key.dataRepresentation,
    ]
    guard SecItemAdd(add as CFDictionary, nil) == errSecSuccess else { throw CocoaError(.fileWriteUnknown) }
    return Prover(.secureEnclaveMLDSA87(key))
}
```

`ThisDeviceOnly` keeps the handle out of backups and iCloud Keychain. The simulator has no Secure
Enclave; there, use `Prover(.mlDSA87(try MLDSA87.PrivateKey()))` for testing.

## 3. Send the key with the login, and bind the token to it

The app adds its public key to the login request. Nothing secret is in it.

```swift
let device = try deviceKey()
var login = URLRequest(url: URL(string: "https://api.example.com/login")!)
login.httpMethod = "POST"
login.httpBody = try JSONEncoder().encode(LoginBody(email: email, password: password, key: device.jwk))
```

On the server, `POST /login` runs your sign-in check exactly as before, then mints a token whose
`cnf.jkt` is the thumbprint of that key. Compute the thumbprint on the server; never take it
from the request.

```go
mux.HandleFunc("POST /login", func(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email, Password string
		Key             proof.JWK
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	user, err := checkPassword(body.Email, body.Password) // unchanged
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	thumbprint, err := body.Key.Thumbprint()
	if err != nil {
		http.Error(w, "bad key", http.StatusBadRequest)
		return
	}
	devices.Add(user.ID, thumbprint) // your table: which device keys each user has signed in with
	mint(w, user.ID, thumbprint)
})

func mint(w http.ResponseWriter, user, thumbprint string) {
	now := time.Now()
	jws, err := issuer.Sign(token.Claims{
		Issuer:       "https://api.example.com",
		Subject:      user,
		Tenant:       "example",
		ID:           proof.NewNonce(),
		IssuedAt:     now.Unix(),
		Expires:      now.Add(15 * time.Minute).Unix(),
		Confirmation: token.Confirmation{Thumbprint: thumbprint},
	})
	if err != nil {
		http.Error(w, "cannot mint", http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"token": jws, "expiresAt": now.Add(15 * time.Minute).Unix()})
}
```

## 4. Send a proof with every request

Where the app set `Bearer`, it now sets the token and a proof: a signature from the device key,
made for this one request, naming the server's TLS certificate. The app knows that certificate's
hash from its configuration.

```swift
let proof = try device.prove(token: Data(token.utf8), certificateHash: serverCertificateHash,
                             nonce: Prover.nonce())
request.setValue("MOQT \(token)", forHTTPHeaderField: "Authorization")
request.setValue(String(decoding: proof, as: UTF8.self), forHTTPHeaderField: "MOQT-Proof")
```

To make sure a proof is never sent to any other server, send requests through a `URLSession`
that only connects to a server presenting that certificate. `SignedClient` in
[Swift: the app](/security/libraries/device-sign-in/#swift-the-app) does both in about 40 lines;
copy it as it is.

## 5. Check the token and the proof in your middleware

`requireUser` keeps its shape. The two checks replace `jwt.Parse`:

```go
func requireUser(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), claimsKey{}, claims)))
	})
}
```

Handlers read `claims.Subject` where they read the JWT's `sub` before. The error text is a short
class such as `expired`, `replayed`, `wrong_key` or `wrong_certificate`, safe to return and
useful to log.

## 6. Renew instead of refreshing

Drop the refresh token. A token lasts fifteen minutes, and the app asks for a new one a couple of
minutes before it expires, on an endpoint behind the same middleware. The request is
authenticated by the current token and a proof, so nothing long-lived ever needs storing.

```go
mux.Handle("POST /renew", requireUser(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	claims := r.Context().Value(claimsKey{}).(token.Claims)
	if !devices.Has(claims.Subject, claims.Confirmation.Thumbprint) {
		http.Error(w, "signed out", http.StatusUnauthorized) // removed devices end here
		return
	}
	mint(w, claims.Subject, claims.Confirmation.Thumbprint)
})))
```

```swift
// Two minutes before expiresAt: POST /renew through SignedClient, and keep the new token.
```

This is also how sign-out works now:

- **Sign out on this device:** delete the device key from the keychain, and its row on the
  server.
- **Sign out everywhere, or a lost phone:** delete the user's rows in `devices`. Their open
  streams close at once (step 7), and no device can renew, so every token they hold stops
  working within fifteen minutes; no deny list is needed.
- **Password changed:** the same, then each device signs in again with the new password.

## 7. End open streams with the token

The middleware runs once, when a request starts. For an ordinary request that's enough, but a
WebSocket, a server-sent events stream or a long streaming response stays open after that, and
would outlive the token that opened it, and the sign-out. MOQOM's relay doesn't allow that: it
closes a live connection the moment its token expires, unless the device renewed inside it, and
closes it as soon as a ban reaches the relay. Do the same for your own streams:

- **End each stream when its token expires.** A renewal moves the deadline on, so a device that
  keeps renewing keeps its stream.
- **End a device's streams the moment it's signed out or removed,** rather than waiting for the
  expiry.

A small registry of open streams by device key does both:

```go
// Open streams by device key, so each ends with its device's token.
type streams struct {
	mu   sync.Mutex
	open map[string]map[*openStream]struct{}
}

type openStream struct {
	timer  *time.Timer
	cancel context.CancelFunc
}

var open = &streams{open: map[string]map[*openStream]struct{}{}}

// Track returns a context that ends when the token expires, unless the device renews first.
func (s *streams) Track(ctx context.Context, thumbprint string, expires time.Time) (context.Context, func()) {
	ctx, cancel := context.WithCancel(ctx)
	o := &openStream{timer: time.AfterFunc(time.Until(expires), cancel), cancel: cancel}
	s.mu.Lock()
	if s.open[thumbprint] == nil {
		s.open[thumbprint] = map[*openStream]struct{}{}
	}
	s.open[thumbprint][o] = struct{}{}
	s.mu.Unlock()
	return ctx, func() {
		o.timer.Stop()
		cancel()
		s.mu.Lock()
		delete(s.open[thumbprint], o)
		if len(s.open[thumbprint]) == 0 {
			delete(s.open, thumbprint)
		}
		s.mu.Unlock()
	}
}

// Extend moves a device's open streams to its renewed token's expiry.
func (s *streams) Extend(thumbprint string, expires time.Time) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for o := range s.open[thumbprint] {
		o.timer.Reset(time.Until(expires))
	}
}

// End closes a device's open streams now.
func (s *streams) End(thumbprint string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for o := range s.open[thumbprint] {
		o.timer.Stop()
		o.cancel()
	}
}
```

A stream opens behind `requireUser` as any request does, and runs until its context ends:

```go
mux.Handle("GET /events", requireUser(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	claims := r.Context().Value(claimsKey{}).(token.Claims)
	ctx, done := open.Track(r.Context(), claims.Confirmation.Thumbprint, claims.ExpiresTime())
	defer done()

	events := subscribe(ctx, claims.Subject) // your updates for this user
	w.Header().Set("Content-Type", "text/event-stream")
	for {
		select {
		case <-ctx.Done():
			return // expired, signed out, or the app went away
		case event := <-events:
			fmt.Fprintf(w, "data: %s\n\n", event)
			w.(http.Flusher).Flush()
		}
	}
})))
```

Then renewal extends the device's streams, and sign-out ends them:

```go
mux.Handle("POST /renew", requireUser(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	claims := r.Context().Value(claimsKey{}).(token.Claims)
	if !devices.Has(claims.Subject, claims.Confirmation.Thumbprint) {
		http.Error(w, "signed out", http.StatusUnauthorized)
		return
	}
	open.Extend(claims.Confirmation.Thumbprint, time.Now().Add(15*time.Minute))
	mint(w, claims.Subject, claims.Confirmation.Thumbprint)
})))

mux.Handle("POST /logout", requireUser(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	claims := r.Context().Value(claimsKey{}).(token.Claims)
	devices.Remove(claims.Subject, claims.Confirmation.Thumbprint)
	open.End(claims.Confirmation.Thumbprint)
})))
```

Signing a user out everywhere calls `open.End` for each of their device keys. For a WebSocket, close
it with status `1008` (policy violation) when the context ends, so the app can tell a sign-out
from a dropped network.

When the app sees a stream end, it reconnects with its current token. A device that renewed
connects again straight away; a signed-out one gets `401` and goes to the sign-in screen.

If you run more than one server, a stream is open on whichever server took it. Publish each
sign-out to every server, through Redis, Postgres `LISTEN`/`NOTIFY` or whatever you already use
for that, and have each call `open.End`. If a message is lost, the expiry still ends the stream
within fifteen minutes.

## 8. Stay signed in when the app reopens

The user signs in once per device. After that, the device key is what the app remembers: it's
still in the Secure Enclave when the app reopens, hours or weeks later, so the app proves it holds
the key and gets a fresh token. There's no refresh token or long-lived JWT to store, and the
token itself only needs to live in memory.

On the server, `POST /resume` looks the key up in the same `devices` table that `POST /login`
fills, and checks a proof from it. The proof is made over the fixed bytes `resume` rather than a
token, since the app may not have one; it's still single-use, fresh within five minutes and bound
to your server's certificate, so a captured request can't be sent again.

```go
mux.HandleFunc("POST /resume", func(w http.ResponseWriter, r *http.Request) {
	var key proof.JWK
	if err := json.NewDecoder(r.Body).Decode(&key); err != nil {
		http.Error(w, "bad key", http.StatusBadRequest)
		return
	}
	thumbprint, err := key.Thumbprint()
	if err != nil {
		http.Error(w, "bad key", http.StatusBadRequest)
		return
	}
	user, ok := devices.User(thumbprint) // signed in on this device, and not signed out since
	if !ok {
		http.Error(w, "sign in", http.StatusUnauthorized)
		return
	}
	now := time.Now()
	err = checker.Check([]byte(r.Header.Get("MOQT-Proof")), []byte("resume"), certificateHash[:],
		thumbprint, now, now)
	if err != nil {
		http.Error(w, proof.Class(err), http.StatusUnauthorized)
		return
	}
	mint(w, user, thumbprint)
})
```

In the app, call it at launch. A `401` means this device has to sign in again, so show your
sign-in screen; anything else is a token to carry on with.

```swift
struct Token: Decodable {
    let token: String
    let expiresAt: Date
}

/// A token from the device key alone, or nil if this device has to sign in.
func resume(_ client: SignedClient) async throws -> Token? {
    var request = URLRequest(url: URL(string: "https://api.example.com/resume")!)
    request.httpMethod = "POST"
    request.httpBody = try JSONEncoder().encode(client.device.jwk)
    let proof = try client.device.prove(token: Data("resume".utf8),
                                        certificateHash: client.certificateHash, nonce: Prover.nonce())
    request.setValue(String(decoding: proof, as: UTF8.self), forHTTPHeaderField: "MOQT-Proof")
    let (data, response) = try await client.session.data(for: request) // pinned, as every request is
    guard (response as? HTTPURLResponse)?.statusCode == 200 else { return nil }
    let decoder = JSONDecoder()
    decoder.dateDecodingStrategy = .secondsSince1970
    return try decoder.decode(Token.self, from: data)
}

// At launch:
let client = SignedClient(device: try deviceKey(), certificateHash: serverCertificateHash)
if let token = try await resume(client) {
    showHome(token)   // signed in, no screen shown
} else {
    showSignIn()      // first launch on this device, or signed out
}
```

What decides whether a device stays signed in is your `devices` table, so the rules are yours:

- **Signed out, or a lost phone:** delete the row and `resume` answers `401`.
- **Inactive too long:** have `devices.User` refuse a device not seen for, say, 30 days, and
  record the time on each `resume` and `renew`. The user then signs in again, with your full
  password, passkey or MFA check.
- **Face ID before opening:** gate the `resume` call with `LAContext.evaluatePolicy` in the
  app. The key itself stays usable without a prompt, so ordinary requests don't ask for Face ID
  every time.
- **A new phone, or the app reinstalled:** a new device key, which isn't in `devices`, so it
  signs in. The old key can't move with a backup, because it never leaves the Secure Enclave.

## Optional: seal your tokens

Like a JWT, a signed token's claims are readable by anyone holding it: the user ID and anything
else you put in it show up in logs, crash reports and proxies. MOQOM seals its own tokens so they
reveal nothing outside its servers, and your app can do the same. Seal each token with a
`SealKey` after signing it, give the same seal keys to every service that verifies, and those
verifiers open the token before checking it. The app passes the token on as opaque bytes and
learns nothing from it, so return anything it needs, such as the expiry, beside the token.

Sealing adds confidentiality only; the signature and the proof are what make the token
trustworthy. Move a running service over by verifying with `AcceptingUnsealed()` (Go),
`accepting_unsealed()` (Rust) or `acceptsUnsealed: true` (Swift) until the last unsealed token
has expired. The format and API are in [Sealed tokens](/security/libraries/token/#sealed-tokens).

## Roll it out

1. **Ship the server first, accepting both.** During the move, let `requireUser` fall back to
   the old `Bearer` check when there's no `MOQT-Proof` header, and have `POST /login` return the
   new token only when the request carries a key.
2. **Ship the app update.** It sends its key with the login and proofs from then on. Existing
   users sign in once more, or let the app exchange its old JWT for a new token by calling
   `POST /login` with the old JWT as the credential. After that, `POST /resume` keeps them
   signed in.
3. **Turn off `Bearer` on a set date,** and delete `JWT_SECRET`. From then on, every stolen
   bearer JWT is dead, and no new ones exist.

Before going live, check the [deployment notes](/security/libraries/device-sign-in/#deploying-it):

- Proxies need room for about 18 KB of headers.
- Proofs name the certificate of whatever terminates TLS.
- Several servers need a shared nonce store.

Then read [What else to handle, and how](/security/libraries/device-sign-in/#what-else-to-handle-and-how)
for your private key, TLS and devices that are compromised while unlocked.

The full runnable versions, a real HTTPS server with four attacks refused, are in
[Device-bound sign-in](/security/libraries/device-sign-in/).
