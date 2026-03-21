# Execution Plan: Backend Ticker-Report Relationship Wiring

## Objective

Ensure backend data and APIs explicitly model ticker-to-report relationships so clients can fetch all reports related to a ticker on drill-in, while keeping watchlist/list surfaces lightweight (no embedded full report body).

## Why

The portfolio watchlist should not inline long report content. Users should open a ticker and see the related reports list, similar to holdings detail flows.

## Scope

- In scope:
  - Add backend persistence for ticker-report relationships
  - Add backend read API for reports by ticker
  - Return list-friendly report payloads that exclude full report body by default
- Out of scope:
  - Mobile UI changes
  - Agent pipeline behavior changes

## Constraints

- Architectural: Keep all client-facing API behavior in `apps/backend` and preserve existing report generation flow.
- Reliability: Keep backward-compatible behavior for existing report detail endpoints.
- Security: No new secrets or external dependencies.

## Work Plan

1. Discovery
2. Implementation
3. Verification
4. Documentation updates

## Decision Log

- 2026-03-21: Use a normalized `report_tickers` table to support 1:N report-to-ticker relationships (primary ticker plus related/suggested tickers).
- 2026-03-21: Keep full report text available only in detail endpoints, and return summary-only metadata for list endpoints.

## Progress Log

- 2026-03-21: Started plan.
- 2026-03-21: Added `report_tickers` persistence and indexes in backend SQLite schema.
- 2026-03-21: Wired report generation to save primary + related ticker links.
- 2026-03-21: Added `GET /api/user/{user_id}/tickers/{ticker}/reports` for ticker drill-in report listing.
- 2026-03-21: Updated report detail response to include persisted related tickers.
- 2026-03-21: Updated backend API reference docs.

## Verification

- Commands run:
  - `python3 -m py_compile apps/backend/main.py $(find apps/backend/src -name '*.py' -not -path '*/__pycache__/*')`
- Manual checks:
  - Reviewed backend diff to confirm ticker-report links are persisted at save time and returned via ticker-scoped endpoint.
- Remaining risk:
  - Existing `GET /api/user/{user_id}/reports` still returns full report payloads; frontend should switch watchlist/ticker drill-in reads to the new ticker-scoped endpoint to avoid showing long report text in list cards.
