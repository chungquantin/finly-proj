# Execution Plan: Wire Mobile Agent Flow To Backend And Agent Server

## Objective

Replace the mobile app's mock board/thread flow with the real backend-backed conversational intake, report generation, team chat, and report regeneration flow, while preserving agent reasoning visibility and memory-aware interactions.

## Why

The backend and agent server already expose most of the intended product flow, but the mobile UI still runs on static mock thread data. That breaks the actual end-to-end experience and prevents stored memories, intake follow-ups, and report regeneration from influencing the frontend.

## Scope

- In scope:
  - Wire the mobile board and thread screens to the backend intake, report, report chat, and report regeneration APIs
  - Show per-agent report breakdown and final decision in the thread UI
  - Persist user-facing thread/report state locally on mobile so conversations survive app restarts
  - Add any small backend read APIs needed for report/thread replay and regeneration by report id
  - Keep memory extraction and profile updates active for every agent interaction
- Out of scope:
  - Reworking the visual design system across unrelated screens
  - Full voice recording UX implementation
  - Multi-user auth or server-side session management beyond the existing `user_id` model

## Constraints

- Architectural: Keep `apps/backend` as the app-facing API and `apps/agents` as the stateless execution runtime.
- Reliability: The mobile UI should degrade gracefully when the backend is unavailable and avoid losing the local thread draft/history model.
- Security: Do not introduce secrets into the mobile bundle; continue using the backend as the only LLM-facing app layer.

## Work Plan

1. Discovery
2. Implementation
3. Verification
4. Documentation updates

## Decision Log

- 2026-03-21: Reuse the existing backend intake/report/panel chat/memory pipeline rather than adding a new frontend-specific orchestration layer.
- 2026-03-21: Prefer small backend additions for report/history retrieval over pushing report reconstruction logic into the mobile client.

## Progress Log

- 2026-03-21: Started plan.
- 2026-03-21: Added backend support for persisted specialist insights, report detail reads, report-specific panel history, and regeneration by report id.
- 2026-03-21: Added a persisted mobile agent-board store that runs intake, report generation, panel chat, memory updates, regeneration, and backend report sync.
- 2026-03-21: Replaced the mock board and thread screens with the real backend-backed conversational flow and per-agent report breakdown.
- 2026-03-21: Updated thread UX to keep reports out of the main conversation feed, add a navbar report-status icon with green ready tick, surface report-version history from store state, and show a bottom report preview card that opens full report details.
- 2026-03-21: Scoped mobile agent-board state by selected account (storage namespace + backend user id suffix) and auto-switched board/thread data when onboarding account selection changes.

## Verification

- Commands run:
  - `pnpm -C apps/mobile exec eslint 'src/stores/agentBoardStore.ts' 'src/services/agentUser.ts'`
  - `python3 -m py_compile apps/backend/main.py $(find apps/backend/src -name '*.py' -not -path '*/__pycache__/*')`
  - `apps/agents/.venv/bin/ruff check apps/backend`
  - `pnpm -C apps/mobile exec prettier --write 'app/(tabs)/board.tsx' 'app/thread/[id].tsx' 'src/stores/agentBoardStore.ts' 'src/services/api/index.ts' 'src/services/api/types.ts' 'src/screens/OnboardingCompleteScreen.tsx' 'src/services/agentUser.ts'`
  - `pnpm -C apps/mobile exec eslint 'app/(tabs)/board.tsx' 'app/thread/[id].tsx' 'src/stores/agentBoardStore.ts' 'src/services/api/index.ts' 'src/services/api/types.ts' 'src/screens/OnboardingCompleteScreen.tsx' 'src/services/agentUser.ts'`
  - `pnpm -C apps/mobile exec prettier --write 'app/thread/[id].tsx'`
  - `pnpm -C apps/mobile exec eslint 'src/stores/agentBoardStore.ts' 'app/thread/[id].tsx'`
  - `git diff --check`
- Manual checks:
  - Confirmed the mobile board flow now maps to intake first, then report generation, then team panel chat and regeneration.
- Remaining risk:
  - Full mobile `tsc --noEmit` for the app still reports pre-existing TypeScript issues outside this feature area (`apps/mobile/index.tsx`, `src/i18n`, `src/navigators/navigationUtilities.ts`, `src/services/marketData.ts`), so repo-wide compile is not yet green even though the newly added/edited flow files lint clean.
