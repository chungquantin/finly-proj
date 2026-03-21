# Execution Plan: Mobile YFinance Market Data

## Objective

Replace the mocked market quote path with live ticker data from the existing FastAPI backend using `yfinance`, and update the mobile holdings screens to render those live quotes with a safe fallback.

## Why

The current holdings UI shows static prices and percent moves, which breaks the illusion of a live investing product now that the portfolio is centered on recognizable US tickers.

## Scope

- In scope:
  - Replace `/api/market-data` mock output with `yfinance` quotes
  - Add a mobile market-data fetch path for the holdings UI
  - Keep current screen structure and local fallback behavior
- Out of scope:
  - Authentication
  - Historical charts
  - Background polling / streaming

## Constraints

- Architectural: Serve market data from the backend API surface rather than adding a separate quote service.
- Reliability: Mobile screens must still render if the backend is unavailable.
- Security: No API secrets in the mobile client; `yfinance` stays server-side.

## Work Plan

1. Discovery
2. Implementation
3. Verification
4. Documentation updates

## Decision Log

- 2026-03-21: Use the existing `/api/market-data` backend route and keep `yfinance` server-side because the mobile client cannot use the Python library directly.

## Progress Log

- 2026-03-21: Started plan.
- 2026-03-21: Replaced the mocked FastAPI `/api/market-data` route with `yfinance`-backed quote retrieval using `Ticker.get_fast_info()` plus history fallback for previous close.
- 2026-03-21: Added a mobile market-data service and updated the home and portfolio holdings views to derive live values and daily change from backend quotes while preserving mock fallback behavior.
- 2026-03-21: Removed the mobile/web client's hardcoded `127.0.0.1:8000` fallback, reused configured backend URLs for market data, and skipped fetches when no valid market-data backend is configured.

## Verification

- Commands run:
  - `python3 -m py_compile apps/backend/src/finly_backend/server.py`
  - `pnpm -C apps/mobile run compile`
  - `pnpm -C apps/mobile exec eslint src/services/marketData.ts app/(tabs)/home.tsx app/(tabs)/portfolio.tsx src/config/config.dev.ts src/config/config.prod.ts`
  - `pnpm -C apps/mobile exec eslint src/services/marketData.ts src/config/config.dev.ts src/config/config.prod.ts app/(tabs)/home.tsx app/(tabs)/portfolio.tsx`
- Manual checks:
  - Confirmed the mobile views still have static fallback numbers when the market-data request fails.
- Remaining risk:
  - The mobile config points at `http://127.0.0.1:8000`, which is suitable for local simulator development but not for device-on-LAN or production deployment.
