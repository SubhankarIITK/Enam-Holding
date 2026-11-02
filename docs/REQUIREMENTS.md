# FINN and the ENAM brief

Reviewed against `1. ENAM_AI_Engineer_Build_Challenge_Main.pdf` (4 pages) and `2. ENAM_AI_Engineer_Build_Challenge_Reference.pdf` (3 pages), November 2026; updated for v4.

The brief asks for a focused working prototype. Its examples are explicitly a menu rather than a checklist. FINN follows the core product direction; it should not be described as an exact implementation of every illustrated capability.

| Requirement / example | Current implementation | Assessment |
| --- | --- | --- |
| Mobile-first investor workspace | Responsive dark interface, mobile navigation, digest, research, portfolio, alerts and documents | Implemented; final device acceptance review still needed |
| Diversified mock portfolio of 15–20 listed companies | Default diversified portfolio; users can add/remove NSE tickers | Implemented |
| Material updates above routine filings | Live NSE announcements, category rules, priority cards, collapsed routine group, original attachment links | Implemented; rule-based prioritisation can misclassify |
| Digest time window, default 24 hours | 24-hour, 48-hour and seven-day windows, company/category/search/unread filters | Implemented |
| Price and unusual-volume alerts | Completed-session changes and volume against the preceding 20 sessions; configurable thresholds | Implemented for EOD; tick-based alerts are not provided |
| Actual changing market data | Yahoo Finance quote snapshots checked every minute; completed daily history every 15 minutes while visible | Implemented with provider timestamps; no guaranteed real-time latency |
| Actual exchange filings | Automatic upstream NSE checks every two minutes while the app is visible; persistence, deduplication and partial-failure reporting | Implemented, subject to exchange availability |
| Updates when nobody has the page open | Authenticated cron endpoint refreshes filings, quotes and daily history; default Vercel schedule runs once per weekday | Requires deployment and a scheduler; a secret alone does not prove scheduling is active |
| Annual reports and earnings-call transcripts | Primary NSE PDF discovery/import, user uploads and source-linked document library | Implemented; documents must be imported before research |
| Primary-source-only research | Lexical RAG retrieves relevant document passages, generates a Groq response, validates citations and exposes original pages | Implemented; no third-party news or broker views in research context |
| Business, finances, trajectory, balance sheet, cash quality, narrative, guidance, bull/bear examples | Eight question starters; arbitrary questions over available company documents | Implemented as eight dedicated tabs with financial tables, annual charts, source-backed notes, derived ratios, guidance tracking and a one-click cited explanation. |
| Four quarters of management guidance versus delivery | User can ask this question when the necessary documents are available; missing evidence should be identified | Implemented: four reporting-quarter rows, explicitly labelled target periods, matched outcomes, publication-date checks, annual-target separation and source links. Missing or incompatible evidence remains visible. |
| Results: Revenue, EBITDA, PBT, PAT and QoQ/YoY | Synthetic walkthrough demonstrates comparison; real source-linked figures can be extracted automatically into dedicated views or reviewed and added manually, including PBT | Implemented: opening a real results filing reads its attachment, extracts explicit supported tables or uses bounded model extraction, and calculates comparable QoQ/YoY changes. Total income is kept separate from revenue; missing metrics are not invented. |
| Incoming executive background | Original management-change filing is surfaced | Implemented: appointment/change extraction plus company-provided profile excerpts, matched to the named person and original page. External LinkedIn scraping is not used; missing biographies are stated explicitly. |
| Additional companies outside portfolio | Discovery/research accepts arbitrary valid NSE tickers | Implemented: prepared APLAPOLLO, RELIANCE and TCS source libraries, each with an annual report and four earnings-call transcripts. Availability and extraction coverage are shown, rather than asserting every metric is available. |
| Clean separation between sample and real data | Explicit sample mode; real mode leaves unavailable data empty | Implemented |
| Repository, covering note and actual AI build history | Source archive and documentation exist | Submission incomplete: public repository, hosted URL, covering note and actual build-history export still need preparation |

The reference PDF supplies illustrative categories and a glossary. FINN uses an adaptable category/rule set rather than claiming perfect interpretation of every filing. Citations and original attachments remain the basis for checking conclusions.

For a real-life workflow: add companies, review unread material filings, open original disclosures, import relevant reports/transcripts, ask a specific question, inspect citations, and save the useful analysis. New documents require import; market/filing refreshes do not silently invent or replace research evidence.


## V4 operational limits

The five previously identified product gaps now have working implementations. First-cut extraction is not an accounting audit: unreadable PDFs, unusual table layouts, missing explicit targets and absent biographies produce gaps. Printed-value/excerpt checks cannot prove every model interpretation is semantically correct. Calculations expose their inputs; conflicts are displayed rather than silently reconciled. Annual reports and transcripts remain the only sources used in company research. Results/leadership attachment enrichment is kept on the filing side.

The demo sources contain real public disclosures, not fabricated financial fixtures. Model extraction is cached and resumable; document-derived tables and source excerpts can be displayed without a fresh model request. The submission deliverables remain deferred as requested.
