# FINN 2.3 API

Workspace endpoints accept an authenticated HttpOnly session cookie or `x-finn-key: <FINN_ACCESS_KEY>` when configured. Vercel requires a workspace key and valid MongoDB storage. Never put keys in query strings. Status, session state and the credential-free prewritten sample are public. This is one shared workspace, not a multi-tenant service.

| Method and path | Behaviour |
| --- | --- |
| `GET /api/status` | Version and configuration flags; no credentials or database connection attempts. |
| `GET /api/health` | Authenticated storage read/write or MongoDB ping; actual readiness. |
| `GET /api/filings?tickers=INFY,TCS&hours=24` | Stored NSE disclosures, last sync report, limit/truncation metadata. `hours`: 1-168, tickers: 1-40. |
| `POST /api/filings` | Fetch the last seven days for `{ "tickers": ["INFY", "TCS"], "persistWatchlist": true }`. Save the scheduler watchlist only when explicitly requested. Return per-company outcomes, fetched/inserted counts, partial status and run timestamps. |
| `GET /api/market?ticker=INFY` | Completed daily NSE sessions, current/previous close change, volume divided by the preceding 20 sessions, dated history, cache/staleness flags. |
| `GET /api/documents?ticker=INFY` | Up to 100 primary-document metadata records, chunk/page counts, extraction quality and original-PDF availability. |
| `POST /api/documents` | Multipart fields: ticker, title, type (`annual_report` or `transcript`), period, optional source URL, and PDF `file` or pasted `text`. PDFs <=4 MB/400 pages; text <=300,000 characters. |
| `POST /api/documents/import` | `{ "filingId": "nse-...", "period": "Q2 FY27" }`. Import a stored NSE annual-report/transcript attachment, verify archive host on every redirect, enforce download limits, extract and retain the original. |
| `GET /api/documents/:id/original` | Authenticated PDF download. Original bytes; private/no-store response. |
| `POST /api/research` | `{ "ticker": "INFY", "question": "...", "demo": false }`. Primary-source retrieval, Groq analysis and citation validation. Returns evidence passages, page references, cache status and generation time. |
| `GET /api/cron/sync` | Vercel scheduler endpoint; requires `Authorization: Bearer <CRON_SECRET>`, independently of the workspace key. Uses the saved watchlist, configured default list or initial portfolio. |

## V2 additions

| Method and path | Behaviour |
| --- | --- |
| `GET /api/market/portfolio?tickers=INFY,TCS` | Read saved snapshots only, no provider requests. Return prices, missing tickers and check time. Expired fresh-cache entries within 24h are marked stale. |
| `POST /api/market/portfolio` | JSON `{ "tickers": ["INFY", "TCS"] }`, 1-40 entries, deduplicated. Four concurrent provider calls; stop starting work after 38 seconds. Per-company outcomes and prices, partial status and finish time. Uses the existing 15-minute market cache. |
| `GET /api/documents/:id/page?page=3` | Extracted passages on a single stored document page. Workspace authentication; private/no-store. |
| `GET /api/financials?ticker=INFY` | Up to 1,000 stored financial figures sorted by period end, with truncation flag. |
| `DELETE /api/financials?id=<id>` | Remove a saved figure without changing its source document. |
| `POST /api/financials` | JSON documentId, page, metric, numeric value, unit, periodType, periodEnd (YYYY-MM-DD), periodLabel and quote. Supported metrics and units are allowlisted. |

A figure's supporting quote (20-2,000 characters after whitespace normalization) must occur within a passage on the selected page, and contain the exact numeric value. Source metadata comes from the stored document. Quotes do not authorize external fetches. Validation does not prove semantic correctness: metric, units and period interpretation are confirmed by the user. Records carry `verification: user-reviewed-excerpt-matched`. Stable identifiers replace the same ticker/metric/unit/period type/end date. Different currencies, units and period types are never combined in a chart. Percent is supported for EBITDA margin.

## Storage and caching

- MongoDB collections: documents, originals, filings, workspace, sync, cache, rates, metrics, sessions, leases. Unique record indexes prevent duplicate IDs. Filings, documents and metrics have ticker/date indexes. Cache and rate buckets have TTL indexes.
- Development without a valid MongoDB URI uses ignored `.finn-data/` JSON records and PDF files, written atomically. Invalid URI configuration is surfaced in status/Settings. A syntactically valid but unreachable MongoDB instance returns an error; it never silently switches data stores.
- On Vercel, missing or invalid MongoDB configuration disables workspace storage instead of using ephemeral disk.
- Price cache: 15-minute freshness, up to 24-hour retention for explicitly flagged provider-outage fallback. EOD date is always retained.
- Research cache: six hours; key includes normalized question, ticker, model, prompt version, retrieved passage text, source identifiers and pages. No stale research fallback. Equivalent simultaneous work is coalesced within a process.
- Local development rate buckets are in memory. MongoDB buckets are atomic and shared between application instances. Read/write/research limits are separate; 429 responses include Retry-After.

## Ingestion and provenance

NSE records are deduplicated by exchange identity, assigned an explicit IST publication timestamp and classified using deterministic rules. Summaries reproduce exchange disclosure text; they do not claim to extract financial figures from attachments. Newspaper result advertisements and routine compliance are kept below material disclosures. Rules are heuristics and can misclassify unusual wording.

The sync batches four upstream requests at a time, bounds request/run duration, and reports failures without replacing previously stored records. The feed is limited to the newest 1,000 matching records, with a truncation flag. A company returning more than 500 records is reported as requiring a narrower ingestion window rather than silently truncating.

PDF extraction keeps page references and line boundaries where available. Sparse-text pages are flagged for possible OCR. The importer accepts only NSE archive PDF attachments referenced by stored filings; arbitrary URLs and redirects to other hosts are rejected. Pasted excerpts remain attributed to their submitted page boundaries.

Research uses BM25-style relevance, query expansion, duplicate suppression and a document-diversity penalty, with a bounded evidence context. Every displayed citation ID must exist in that context. Common bracket formats are normalized; one bounded model repair is allowed. This checks reference structure, **not whether every model claim is factually entailed**. Review material figures against the original PDF.

## Errors and operations

Errors return `error`, `code`, `requestId` and an X-Request-Id header where the shared handler applies. Database secrets and connection strings are not returned. Cross-origin workspace writes are rejected. Upstream NSE/Yahoo blocking or rate limits remain visible; live mode never substitutes demo filings.

The checked-in Vercel cron schedule runs at 11:30 UTC (17:00 IST) on weekdays when deployed and configured. This is a daily filing sync, not real-time push delivery. Local development has no background scheduler. The open UI refreshes stored feed data once a minute while visible; it does not scrape NSE every minute.


## Release security

- `GET /api/session`: authentication requirement/state, no sensitive workspace data.
- `POST /api/session`: JSON `{ "key": "..." }`, 2,048-byte limit, per-IP/global attempt quotas. Set an eight-hour HttpOnly/SameSite=Strict cookie (Secure in production); store only a token hash, expiry and key fingerprint.
- `DELETE /api/session`: revoke the current session and expire the cookie. Browser mutation requests require the canonical origin when `FINN_APP_URL` is set. Key rotation invalidates sessions.
- All API responses are private/no-store. Malformed JSON does not echo payloads. Body streams are bounded before parsing; provider streams are bounded and unexpected redirects are rejected.
- Production fails closed without workspace authentication and durable storage. `FINN_ALLOW_LOCAL_STORAGE=true` is an explicit self-hosting/test override and is never honored on Vercel.
- Mongo filing-sync leases prevent overlapping manual/cron jobs across instances, expire after 90 seconds and are owner-released. Conflicts return 409/SYNC_RUNNING. Stale running metadata is marked interrupted after the lease interval.
- Session expiry, rate limits and lease ownership are checked by application logic in addition to TTL indexes; Mongo TTL deletion is asynchronous.


## Source finding and RAG usability

- `GET /api/research/sources?ticker=APLAPOLLO` requires workspace authentication. It searches official NSE annual-report metadata plus four bounded historical announcement windows covering 368 days. It accepts only annual-report/transcript PDF candidates on exact NSE archive hosts. Discovery does not overwrite the digest watchlist or last-sync report.
- Discovery is coalesced in-process, globally quota limited on cache misses, cached for a day (10 minutes on partial failure), and can return a visibly stale list up to seven days old during an outage. Per-provider failures are surfaced; they never become invented documents.
- `POST /api/documents/import` also accepts `{ "sourceId": "source-...", "period": "optional override" }`. It only imports a stored candidate; arbitrary user URLs are not fetched. A transcript defaults to its filing date, not an inferred reporting quarter. The user may override the period after reading the document.
- Server import supports 24 MB/1,200 pages and up to 6,000 passages / 12 MB serialized text. Browser uploads remain 4 MB/400 pages. Imported originals over 4 MB stay at the official source URL; complete extracted text, source URL and SHA-256 fingerprint are stored. Smaller original PDFs are retained and downloadable. Limits cause visible failure, never silent page truncation.
- `DELETE /api/documents/:id` removes a library document, its original and linked reviewed figures. Existing research-cache entries expire naturally; future retrieval cannot select deleted documents and therefore cannot reuse their evidence-dependent cache key.
- Research returns `retrieval` metadata: method, embeddings=false, documentCount, indexedPassages, retrievedPassages and contextCharacters. Retrieval is lexical BM25 RAG with financial query expansion, page-level provenance, a bounded context and overlap suppression. Zero-score passages are rejected.
- Groq rate limits return 429/GROQ_RATE_LIMIT and a bounded Retry-After, with daily-quota messaging when identifiable. The browser preserves the question and shows a retry countdown. The application cannot bypass an upstream account quota.


## Saved analyses

- Real generated answers include an `analysisId` for a server-side snapshot, saveable for 24 hours. The identifier is tied to the evidence cache key and answer text, so a changed answer gets a distinct identity. Samples and no-evidence messages cannot be saved as primary-source research.
- `POST /api/research/saved` accepts only `{ "analysisId": "analysis-..." }`, not a client-supplied answer. It validates the server snapshot and current source-document availability, then retains the record for 30 days.
- `GET /api/research/saved?ticker=APLAPOLLO` lists metadata for the 20 most recently saved analyses. `GET /api/research/saved?id=analysis-...` returns the saved answer and evidence without calling Groq. Expiry is checked explicitly as well as by Mongo TTL.
- `DELETE /api/research/saved?id=analysis-...` removes a saved analysis, leaving the primary documents in place. Deleting a source removes dependent saved analyses, originals and reviewed figures. Cached answers and unsaved snapshots expire naturally; a snapshot with a removed source cannot be saved.
- Export is browser-side Markdown with source excerpts, page references, URLs and generation time. The exported file is an archive of the answer, not a new verification of its claims.

## Automatic updates

See [automatic updates](AUTOMATIC-UPDATES.md) for the authenticated snapshot, refresh, quote and background scheduling endpoints. These keep quote snapshots separate from EOD alert history.

## Company and filing insights (v4)

- `GET /api/insights?ticker=APLAPOLLO`: authenticated source-derived views, figures, ratios, comparisons, guidance, conflicts and document coverage. Reads stored primary sources; no provider generation.
- `GET /api/insights?demos=true`: three prepared research companies and actual stored-source counts.
- `POST /api/insights` with `{ "ticker": "APLAPOLLO", "documentId": "<stored-id>" }`: extract one stored annual report/transcript. Cached by document content, publication metadata, model and extraction version; 429 includes Retry-After. Same-origin protection, authentication, rate quota and lease apply.
- `GET /api/insights?filingId=<stored-nse-id>`: cached filing insight or null.
- `POST /api/insights` with `{ "filingId": "<stored-nse-id>" }`: read a stored results/management attachment from vetted NSE archives. Supported explicit tables and executive profiles use direct parsing; other layouts use bounded source-checked model extraction. Never fetches a client-supplied arbitrary URL.

A response includes the original source page/excerpt for figures and profile facts. Period-context citations can differ from the numeric-row citation. Source removal purges linked generated extraction caches and excludes deleted documents from all company views. Half-year values are not relabelled as quarterly values. Derived ratios never mix units or accounting bases. Guidance publication dates are not inferred from upload timestamps.

Full results attachments use position-based PDF row ordering before calendar-quarter parsing. Printed units, accounting basis and column dates are checked; six-month columns are kept out of quarterly comparisons. Cited financial research also receives an index of metric-labelled facts already present in its supplied passages, preserving operating revenue versus total income.
