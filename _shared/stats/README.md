# Live stats

Shared by the four sites. Two figures, fetched two ways:

| Figure | Source | When |
| --- | --- | --- |
| GitHub stars, forks, contributors, open issues + PRs, latest release | GitHub REST API (`github.ts`) | At build time |
| Developer signups (optionally active tenants) | `GET /v1/public/stats` on the MOQOM billing API | In the browser, on page load |

Both fail closed. A repository that is private, missing or rate-limited is left
out. If the stats endpoint errors, times out, or JavaScript is off, the signup
figure stays hidden. Nothing is ever shown as a guessed or padded number. The
`threshold` prop only adds a note beside a small count; it never changes it.

## Use

```astro
---
import LiveStats from '../../../_shared/stats/LiveStats.astro';
---
<LiveStats
  repos={['moqom-cloud/moqom-go', 'moqom-cloud/moqom-rust', 'moqom-cloud/moqom-mcp', 'elliott-wave-labs/six10nine']}
  statsUrl="https://api.moqom.cloud/v1/public/stats"
  heading="In the open"
/>
```

Props: `repos`, `statsUrl` (default: `PUBLIC_MOQOM_STATS_URL`, then
`https://moqom.cloud/v1/public/stats`; `null` hides signups), `showSignups`,
`showActiveTenants`, `threshold` (default 0), `belowThresholdNote`,
`signupsLabel`, `heading`, `class`. Theme with `--stats-bg`, `--stats-line`,
`--stats-text`, `--stats-dim`, `--stats-accent`, `--stats-radius` and
`--stats-mono` on any ancestor; they default to each site's own tokens.

`astro build` reads files outside the site directory without configuration.
For `astro dev`, add `vite: { server: { fs: { allow: ['..'] } } }` to the
site's `astro.config.mjs`.

Note: elliottwave.studio's README says that site ships no client-side
JavaScript. Using the component there adds one small module script; pass
`showSignups={false}` to keep it script-free.

## The stats endpoint

```
GET /v1/public/stats
200 {"signups": 42, "active_tenants": 7, "updated_at": "2026-10-06T12:00:00Z"}
```

- `signups`: every tenant ever created, whatever its status now (deleted included).
- `active_tenants`: tenants whose status is `active` (paid and in good standing).
- `updated_at`: when the counts were read, RFC 3339, UTC.
- No key. No tenant names, emails or IDs. Counts only.
- Cached in process for 60 s (stale counts are served if the database fails), `Cache-Control: public, max-age=60`.
- 120 requests per minute per client address, then `429` with `Retry-After: 60`.
- CORS: only origins in `MOQOM_BILLING_CORS_ORIGINS` (Terraform `billing_cors_origins`, default `https://moqom.cloud`, `https://www.moqom.cloud`). Preflight offers `GET` only, no request headers, no credentials. Add `https://elliottwave.studio`, `https://moqom.dev` etc. there if those sites show the figure.

### Which host serves it: not moqom.cloud today

Checked against `moqom/deploy`:

- `moqom.cloud` is the static sites load balancer (`deploy/modules/sites`). Every path is rewritten into `gs://moqom-sites/moqom-cloud/`, so `https://moqom.cloud/v1/public/stats` is the site's 404 page.
- The billing routes are mounted on the control plane's **join endpoint** listener (`cmd/moqom-control/main.go`), Terraform output `join_endpoint`, TCP 8444.
- That listener serves a leaf from MOQOM's private link CA (`deploy/tools/sync-secrets.sh`), which browsers do not trust, and production has no `dns_domain` set. A browser fetch to it fails TLS.

So the signup figure stays hidden on every site until `/v1` has a publicly trusted
HTTPS origin. Two ways to get one (infrastructure changes, not made here):

1. Route `/v1/*` on the moqom.cloud load balancer to the control plane (a backend service in front of the join port, Google-managed certificate). Then the default URL works unchanged.
2. Give the billing API its own hostname, e.g. `api.moqom.cloud`, with a publicly trusted certificate, and set `PUBLIC_MOQOM_STATS_URL=https://api.moqom.cloud/v1/public/stats` in the site build (or pass `statsUrl`).

The Stripe Checkout signup form on moqom.cloud needs the same thing, so one fix serves both.

## Rebuild hourly (Cloud Build + Cloud Scheduler)

`moqom/deploy/tools/cloudbuild-sites.yaml` builds every site in `node:22` with
pnpm, then uploads with `publish-sites.sh` (same cache headers and page
aliases) from a gcloud image. Only the GitHub figures need the rebuild; the
signup figure is live.

One-off run from a laptop, from the directory holding `moqom/` and `sites/`:

```sh
gcloud builds submit . --project=moqom-503700 \
  --config=moqom/deploy/tools/cloudbuild-sites.yaml \
  --ignore-file=moqom/deploy/tools/sites.gcloudignore
```

A trigger needs the source in a repository connected to Cloud Build, and
`sites/` is not in one yet. Once it is (with `moqom/deploy/tools/` beside it
at the same relative paths, or the paths in the YAML adjusted), the commands
below create the trigger and the hourly job. **Not run.** Replace `REPO` with
the connected repository's resource name.

```sh
PROJECT=moqom-503700
REGION=us-west1
BUILDER=sites-publisher@$PROJECT.iam.gserviceaccount.com
SCHEDULER=sites-scheduler@$PROJECT.iam.gserviceaccount.com

# Identity the build runs as: write to the bucket, write logs.
gcloud iam service-accounts create sites-publisher --project=$PROJECT
gcloud storage buckets add-iam-policy-binding gs://moqom-sites \
  --member=serviceAccount:$BUILDER --role=roles/storage.objectAdmin
gcloud projects add-iam-policy-binding $PROJECT \
  --member=serviceAccount:$BUILDER --role=roles/logging.logWriter

# Optional: a GitHub token (no scopes needed) so builds are not rate-limited.
# Then uncomment availableSecrets in the YAML and add secretEnv to the build step.
printf '%s' "$GITHUB_TOKEN" | gcloud secrets create sites-github-token \
  --project=$PROJECT --data-file=-
gcloud secrets add-iam-policy-binding sites-github-token --project=$PROJECT \
  --member=serviceAccount:$BUILDER --role=roles/secretmanager.secretAccessor

# Manual trigger: runs only when called, which is what the scheduler does.
gcloud builds triggers create manual --project=$PROJECT --region=$REGION \
  --name=publish-sites \
  --repository=REPO \
  --branch=main \
  --build-config=moqom/deploy/tools/cloudbuild-sites.yaml \
  --service-account=projects/$PROJECT/serviceAccounts/$BUILDER

# Identity the scheduler calls Cloud Build as.
gcloud iam service-accounts create sites-scheduler --project=$PROJECT
gcloud projects add-iam-policy-binding $PROJECT \
  --member=serviceAccount:$SCHEDULER --role=roles/cloudbuild.builds.editor
gcloud iam service-accounts add-iam-policy-binding $BUILDER --project=$PROJECT \
  --member=serviceAccount:$SCHEDULER --role=roles/iam.serviceAccountUser

# Hourly, on the hour.
gcloud scheduler jobs create http publish-sites-hourly --project=$PROJECT \
  --location=$REGION --schedule='0 * * * *' --time-zone=Etc/UTC \
  --uri="https://cloudbuild.googleapis.com/v1/projects/$PROJECT/locations/$REGION/triggers/publish-sites:run" \
  --http-method=POST --headers=Content-Type=application/json --message-body='{}' \
  --oauth-service-account-email=$SCHEDULER \
  --oauth-token-scope=https://www.googleapis.com/auth/cloud-platform
```

Every run rsyncs with `--delete-unmatched-destination-objects`, so whatever
the repository's `main` holds is what the sites serve within the hour. Pause
the job (`gcloud scheduler jobs pause publish-sites-hourly --location=$REGION`)
while publishing by hand from a laptop.
