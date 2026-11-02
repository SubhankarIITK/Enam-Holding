# FINN 4.0 production release

This release is for a private, single shared workspace. It does not implement separate user accounts or tenant isolation. Uploading a document makes it available to anyone with the workspace key. Financial figures are user reviewed and source matched; they are not an automated financial verification service.

## Release gates

Run `npm ci`, then `npm run check:release`. The release checks include unit/regression tests, a production build, isolated HTTP integration tests and the npm production dependency audit. Tests never use real provider keys or the configured database. A test-only local-storage override is explicit.

Run `npm run check:production` with the intended production environment. This is read only and prints PASS/FAIL, never credentials. It verifies a strong workspace key, separate scheduler secret, Groq/model configuration, an HTTPS canonical app URL, TLS-enabled Mongo configuration and an actual database ping. It cannot verify cloud-provider access from your future deployment region.

The source archive is reproducible with `python scripts/package-release.py`. It includes `.env.example` and excludes real env files, original PDFs, runtime records, node_modules and build output. Keep actual secrets in Vercel environment variables.

## Vercel setup

1. Create/import a Git repository from this source. Select Next.js and Node.js 22.x. Use `finn` as the root only if the Git repository contains the parent directory; otherwise use the repository root.
2. Build with `npm run build`; leave the framework output directory at its default. The source archive is not a prebuilt Vercel artifact.
3. Set production environment variables from the private env file: `MONGODB_URI`, `MONGODB_DB`, `GROQ_API_KEY`, `GROQ_MODEL`, `FINN_ACCESS_KEY`, `CRON_SECRET`, and `FINN_APP_URL`. Use at least 32 random characters for the workspace key and cron secret, with different values. Never use the example placeholders.
4. Set `FINN_APP_URL` to the final HTTPS origin, for example `https://your-project.vercel.app`. Include no path. If a custom domain becomes canonical, update the variable and redeploy. The origin must match the URL used to open the app. Preview deployments need their own origin value.
5. Leave `FINN_ALLOW_LOCAL_STORAGE` unset or false. Vercel never permits local-disk fallback. If Atlas cannot be reached, the app returns a storage error instead of losing writes to ephemeral storage.
6. Configure Atlas access for the deployment and a database user with read/write and index creation permissions on the selected database. Enable an appropriate Atlas backup policy and test restoring to a separate database before storing important data. Do not use the live workspace for restore tests.
7. Deploy, then run the smoke checks below from the actual production region.

The [Vercel cron configuration](https://vercel.com/docs/cron-jobs/manage-cron-jobs) invokes `/api/cron/sync` on weekdays at 11:30 UTC (17:00 IST). It authenticates with `Authorization: Bearer CRON_SECRET`. The route is configured for a 60-second maximum duration. Cron timing is platform managed; local development does not run the schedule.

## Smoke checks after deployment

- Open the final HTTPS URL. Verify the sign-in form; a wrong key must not open the workspace. Sign in and verify Research, Documents and Portfolio.
- In Settings, run **Check connections** and confirm the document library is ready. This authenticated check pings Mongo; it does not attest to provider availability.
- In Home, select **My updates** and keep the page visible. Confirm that automatic checks finish, inspect the updates and open an original NSE attachment. If sources are unavailable, saved data and a warning should remain visible. Concurrent automatic runs return the current snapshot with HTTP 202. Check Vercel logs after the scheduled run; failed/interrupted runs require attention.
- In Portfolio, confirm automatic quotes and daily history load for two tickers, inspect their source timestamps, reload and confirm saved snapshots return. NSE and Yahoo may reject cloud IPs; verify provider access from the deployment region.
- Upload a small primary-source PDF for a selected ticker. Check extracted page counts, download the original, ask a question and open its citations. Only relevant excerpts are sent to Groq. Never upload documents you are not authorized to share with that provider.
- For a ticker with no primary documents, verify the guided upload/import state and disabled research submission. A price feed is not an annual report or transcript. The source finder covers recent annual reports and the past year of transcript filings. Sources absent from NSE still need manual upload.
- Save an answer, reload and reopen it from Saved research without a provider request. Export its Markdown and check the source pages. Remove a test source and confirm dependent saved analyses disappear.
- Lock the workspace and confirm authenticated API requests with the old session return 401. Sessions expire after eight hours; changing the workspace key invalidates all existing sessions.
- Check the daily cron results, Vercel error logs and Atlas capacity/backup status as ongoing operations. Error responses include a request ID; logs exclude credentials, document contents and model answers.

## Authentication and limits

The browser uses an HttpOnly, SameSite=Strict session cookie, with Secure enabled in production. The raw workspace key is not retained in browser storage. Existing browser credentials are exchanged once and removed. Session tokens are stored only as hashes, with a database TTL and an explicit expiry check. Sign-out deletes the session. HTTP clients may still authenticate using `x-finn-key` over HTTPS.

Sign-in attempts are throttled per IP and globally using shared Mongo counters. Authenticated read, write and research quotas are separate. In self-hosted setups, the reverse proxy must replace incoming `x-forwarded-for`; do not expose a trusted-proxy configuration directly to the internet.

JSON bodies and uploaded/provider response streams have explicit byte limits. Browser uploads are limited to 4 MB/400 pages. Server imports of discovered NSE PDFs support 24 MB/1,200 pages and 6,000 passages (12 MB serialized text). Imports over 4 MB index the full extracted text and retain a SHA-256 fingerprint plus a direct original-source link, rather than storing the oversized PDF in a function response. The import route allows 120 seconds; check the deployment plan supports this duration. All PDFs need extractable text. OCR, BSE ingestion, personalized accounts and background push/email delivery are outside this release. Alerts are in-app snapshots.

## Rollback and recovery

Keep the previous successful Vercel deployment. If a release fails smoke checks, promote the prior deployment and restore its compatible environment values. Current changes add collections and indexes; they do not delete existing documents or filings. Rotate a compromised workspace key to invalidate sessions, and rotate compromised provider/cron keys at their respective services. Secrets previously exposed in logs must be rotated before production launch.

Development local records do not migrate automatically when MongoDB is enabled. Re-import the original documents or use a separately reviewed migration. Do not copy `.finn-data` into a deployment bundle.
