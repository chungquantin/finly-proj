# Execution Plan: Team Section Portfolio Insights + Advisor News

## Objective

Update the mobile "Your Team" section so each agent provides general portfolio-level feedback grounded in overall portfolio state and current holdings, rename "Portfolio Manager" to "Advisor", and ensure Advisor responses include latest holdings news for today.

## Why

The current team card copy is mostly static/thread-specific and does not consistently reflect the full portfolio context. The UX should present concise, high-level guidance per specialist and explicit same-day news coverage from the Advisor across held tickers.

## Scope

- In scope:
  - Home tab team-card insight generation using current holdings/portfolio snapshot
  - Role-label updates from Portfolio Manager to Advisor in mobile-visible mappings
  - Agent prompt and backend context updates to enforce portfolio-overall/current-holdings feedback style
  - Advisor context enrichment with today's holdings headlines for panel-chat responses
- Out of scope:
  - Redesigning team card layout
  - Full historical news timeline or sentiment scoring

## Constraints

- Architectural: Keep API boundaries intact (`apps/mobile` consumes `apps/backend`, backend proxies `apps/agents`).
- Reliability: If holdings news fetch fails, Advisor still returns safe fallback guidance.
- Security: News calls remain server-side/backend-mediated where possible; no secret exposure in mobile.

## Work Plan

1. Discovery
2. Implementation
3. Verification
4. Documentation updates

## Decision Log

- 2026-03-22: Use lightweight holdings-news summaries in context instead of expanding schema or adding a new dedicated report endpoint.

## Progress Log

- 2026-03-22: Started plan.
- 2026-03-22: Updated Home team-card insight generation to use portfolio-overall/current-holdings feedback per agent instead of static board-thread snippets.
- 2026-03-22: Renamed Portfolio Manager presentation to Advisor in team-role and thread role-mapping surfaces.
- 2026-03-22: Updated panel-chat agent persona prompts so Analyst/Researcher/Trader/Advisor responses are portfolio-level and holdings-aware, with Advisor instructed to include today holdings news when context is present.
- 2026-03-22: Added backend advisor-context enrichment that fetches same-day/latest headlines per holding and injects a `TODAY HOLDINGS NEWS` block for advisor panel responses.
- 2026-03-22: Updated Home team message bubbles to render Markdown and open a full-response modal when tapped.

## Verification

- Commands run:
  - `pnpm -C apps/mobile exec eslint 'app/(tabs)/home.tsx' 'src/utils/mockAppData.ts'`
  - `pnpm -C apps/mobile exec eslint 'app/(tabs)/home.tsx'`
  - `python3 -m py_compile apps/backend/src/finly_backend/server.py apps/backend/src/finly_backend/heartbeat.py apps/agents/src/finly_agents/agent_server.py`
- Manual checks:
  - Reviewed Home team-card text path to confirm each card now reflects portfolio-overall/current-holdings general feedback.
  - Reviewed backend panel-chat flow to confirm `TODAY HOLDINGS NEWS` context is appended only when advisor is part of target agents.
- Remaining risk:
  - Advisor holdings-news context depends on external news provider availability (Exa/yfinance); fallback lines are used when fetches fail or same-day items are absent.
