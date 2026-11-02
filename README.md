# FINN 4.0

A private investment workspace for NSE updates, portfolio monitoring and primary-source research. The React frontend and Node.js API routes deploy together as one Next.js application on Vercel. MongoDB Atlas stores documents and snapshots; Groq generates cited answers.

## Deploy to Vercel

Import this repository with these settings:

| Setting | Value |
| --- | --- |
| Framework | Next.js |
| Root directory | Repository root (`.`) |
| Node.js | 22.x |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | Framework default |

Add the following server-side production variables in Vercel. `.env.example` contains names and safe defaults; real credentials are excluded from Git.

| Variable | Value |
| --- | --- |
| `MONGODB_URI` | Atlas connection string with access from the deployment |
| `MONGODB_DB` | Database name; default `finn` |
| `GROQ_API_KEY` | Groq API key |
| `GROQ_MODEL` | `openai/gpt-oss-120b`, or another supported Groq chat model |
| `FINN_ACCESS_KEY` | Workspace sign-in key, at least 32 random characters |
| `CRON_SECRET` | A different random secret, at least 32 characters |
| `FINN_APP_URL` | Final HTTPS production origin, without a path |
| `FINN_ALLOW_LOCAL_STORAGE` | `false` |

If the final origin is unknown before deployment, set `FINN_APP_URL` when Vercel assigns it and redeploy. Do not prefix secrets with `NEXT_PUBLIC_`. Configure Atlas network access for the backend; allowing only your laptop's IP is insufficient. Vercel requires MongoDB and never falls back to local storage.

After deployment, sign in, run **Settings → Check connections**, verify quotes and NSE filings, and ask a cited research question. Provider access must be verified from the deployment region. Follow the [deployment runbook](docs/DEPLOYMENT.md) for smoke checks, backups and rollback.

GitHub Actions runs release checks on pushes and pull requests. Source, verification checks and setup documentation are included; credentials, uploaded PDFs, runtime data, dependencies and build output are excluded. `.vercelignore` additionally excludes development material from deployment uploads.

## Run locally

Requires Node.js 22.16+; use Node.js 22.x for the documented deployment.

```powershell
git clone https://github.com/SubhankarIITK/Enam-Holding.git
cd Enam-Holding
Copy-Item .env.example .env.local
# Fill .env.local privately with your server credentials.
npm.cmd ci
npm.cmd run dev
```

Open http://127.0.0.1:3000. On macOS/Linux use `cp` and `npm`. `.env.local` takes precedence over `.env`; neither belongs in Git. Sign in with `FINN_ACCESS_KEY`. The browser receives an expiring HttpOnly session cookie; provider keys remain on the server.

## Use FINN

- **Home:** select **My updates**, review actual NSE disclosures, filter material changes and open original attachments. Sample mode is explicitly synthetic.
- **Portfolio:** track NSE companies, inspect quote timestamps and view completed-session price/volume charts. Real mode never fills missing data with random prices.
- **Research:** choose a prepared company or add annual reports and transcripts. Explore eight research views, ask questions, inspect citations, save analyses and export answers with evidence.
- **Documents:** upload text-based PDFs up to 4 MB/400 pages, paste excerpts or discover/import official NSE PDFs up to 24 MB/1,200 pages. Larger imported originals remain linked at their source. Scanned PDFs require OCR before import.
- **Results and leadership:** open filings for supported financial comparisons and company-provided executive profiles. Missing evidence remains visible; check important figures against the original document.
- **Alerts:** configure price, volume and filing rules. Alerts are shown in the app; email, SMS and push delivery are not included.

FINN is one shared workspace. Everyone with the workspace key can access its documents and research. Separate user accounts and tenant isolation are not implemented.

## Automatic updates and RAG

While real mode is visible and online, quotes are checked every minute, filings every two minutes and daily history every 15 minutes. Actual source times and partial failures remain visible. These intervals do not guarantee exchange-grade real-time delivery.

`vercel.json` requests one background run per weekday at 11:30 UTC (17:00 IST). A deployed app and active scheduler are required. Frequent closed-page updates require a compatible scheduler. Research documents are imported explicitly, independently of price and filing checks. See [automatic updates](docs/AUTOMATIC-UPDATES.md).

Research uses lexical RAG: page-preserving extraction, BM25 passage ranking, financial query expansion and duplicate suppression select relevant excerpts for Groq. Responses include validated citation references and source pages. MongoDB stores documents and caches; no embedding provider or vector database is required. Citation validation does not prove every claim. Missing or incompatible evidence is reported explicitly.

## Prepare public-source examples

The prepared-company cards cover APL Apollo, Reliance and TCS. Readiness depends on the configured database; no runtime database records are bundled in this repository. Using the existing Atlas database preserves already imported documents.

```powershell
node scripts/prepare-research-demo.mjs
# Optional: cache structured insights from imported public NSE documents.
node scripts/build-demo-insights.mjs
```

`GROQ_EXTRACTION_MODEL` optionally selects a separate extraction model; otherwise `GROQ_MODEL` is used. GPT-OSS models use low reasoning effort. The preparation script excludes private uploads and caches progress.

## Verify

```powershell
npm.cmd run check:release
npm.cmd run check:production
```

`check:release` runs unit tests, a production build, isolated HTTP integration checks and a production dependency audit. Tests do not call real providers or write to the configured database. `check:production` checks configuration and pings MongoDB without printing secrets; it requires the intended final HTTPS origin.

See the [API contract](docs/API.md) and [requirements review](docs/REQUIREMENTS.md) for endpoints, evidence handling and limitations. Building or pushing source does not deploy or submit the project.
