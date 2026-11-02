# Automatic data updates

In real-data mode FINN checks upstream sources automatically while the page is visible and online. Users do not need to press Sync. Returning to the page or reconnecting triggers another check. Sample mode does not initiate these automatic requests.

| Data | Minimum interval | Meaning |
| --- | --- | --- |
| Yahoo Finance quotes | 60 seconds | Latest provider quote, with actual trading timestamp. Latency is not guaranteed. |
| NSE announcements | 120 seconds | New exchange disclosures for the portfolio, deduplicated into storage. |
| Daily market history | 15 minutes | Completed daily sessions for charts, price and volume alerts. |

These are check intervals, not a promise that upstream data arrives that quickly. A provider can return an older trading session, particularly on holidays or outside market hours. The displayed quote timestamp is authoritative. No random prices are generated in real-data mode.

Cooldowns are persisted in the shared workspace. Single-flight execution and a distributed lease avoid duplicate concurrent jobs. Failures retain stored data and back off until the next interval. Changing the portfolio makes all jobs eligible immediately. Quote and daily-history caches are separate, so intraday quotes never distort completed-session volume comparisons.

## Background execution

`GET /api/cron/sync` uses the saved portfolio and refreshes all three sources. It requires `Authorization: Bearer <CRON_SECRET>`. Never put this secret in client code.

The checked-in `vercel.json` keeps the existing once-per-weekday schedule. Vercel Hobby permits one daily cron invocation; it is not a minute-by-minute scheduler. A production site and an active scheduler still need to be created. The application cannot run a background job on a deployment that does not exist.

For more frequent background checks on a compatible Vercel plan, change the cron schedule to `*/5 * * * *`. An external scheduler can instead call the same authenticated endpoint every 2–5 minutes. Confirm the scheduler's execution history after deployment. The worker endpoint respects the same source cooldowns as open browsers.

Primary documentation: [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing), [managing cron jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs). Guaranteed exchange-grade real-time streaming requires a suitable licensed feed; see [NSE real-time subscriptions](https://www.nseindia.com/static/market-data/real-time-data-subscription).

## API

Authenticated `GET /api/updates?tickers=INFY,TCS` restores stored filings, daily prices, quotes and job status without calling a market provider. Authenticated same-origin `POST /api/updates` with `{ "tickers": ["INFY", "TCS"] }` updates due sources and returns a snapshot. An empty array clears the shared scheduled watchlist and returns no portfolio data. Concurrent leases return 202 with the current snapshot. `GET /api/market/quote?ticker=INFY` returns one provider quote.

FINN is a single shared workspace: the most recently updated portfolio is the scheduled portfolio. Background browser notifications, automatic document import, and tick-by-tick streaming are not connected.
