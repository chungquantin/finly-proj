# Execution Plan: Holding Detail Ticker News (Exa)

## Objective

Show a ticker-specific news list on the mobile holding detail page, sourced from a backend endpoint that uses Exa search when configured.

## Why

The holding detail screen currently lacks fresh market context. Surfacing recent ticker news directly on this page improves decision support and aligns with the board recommendation workflow.

## Scope

- In scope:
  - Add backend ticker news API endpoint
  - Use Exa search in backend when `EXA_API_KEY` is available
  - Add mobile API typing/client method for ticker news
  - Render a news section on `app/holding/[ticker].tsx`
- Out of scope:
  - Full article summarization pipeline
  - News sentiment scoring
  - Pagination/infinite scrolling

## Constraints

- Architectural: Keep backend change localized to `apps/backend/src/finly_backend/` and mobile integration within existing API client and holding route.
- Reliability: If Exa is unavailable or errors, return a safe empty/fallback response without breaking holding detail rendering.
- Security: Do not expose API keys to mobile; Exa key remains backend-only.

## Work Plan

1. Discovery
2. Implementation
3. Verification
4. Documentation updates

## Decision Log

- 2026-03-21: Implement Exa integration directly in backend API route (instead of mobile direct calls) to keep secrets server-side and centralize error handling.

## Progress Log

- 2026-03-21: Started plan.
- 2026-03-21: Added backend `GET /api/ticker-news` endpoint with Exa-first lookup and yfinance fallback behavior.
- 2026-03-21: Added mobile API types/client method for ticker news retrieval.
- 2026-03-21: Added a `Ticker news` section on holding detail route, including loading/empty states and article deep links.

## Verification

- Commands run:
  - `python3 -m py_compile apps/backend/src/finly_backend/server.py apps/backend/src/finly_backend/models.py`
  - `pnpm -C apps/mobile exec eslint 'app/holding/[ticker].tsx' 'src/services/api/index.ts' 'src/services/api/types.ts'`
- Manual checks:
  - Holding detail screen now renders a ticker-specific news card list and shows source badge when available.
- Remaining risk:
  - Live Exa behavior depends on runtime `EXA_API_KEY` availability and external network response quality.
