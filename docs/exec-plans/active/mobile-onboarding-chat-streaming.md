# Execution Plan: Stream Onboarding Chat Responses To Mobile UI

## Objective

Add end-to-end streaming for onboarding chat so mobile receives incremental assistant text and shows an in-progress loading state while Finly is still generating.

## Why

The current onboarding chat waits for a full response before rendering, which makes the UI feel stalled and gives no feedback that the agent is working.

## Scope

- In scope:
  - Add backend SSE endpoint for onboarding voice/text chat.
  - Add mobile API streaming client for onboarding chat.
  - Update onboarding chat screen to render token deltas and explicit loading status.
- Out of scope:
  - Voice-recording UX redesign.
  - Changes to non-onboarding chat surfaces.

## Constraints

- Architectural: Mobile must call `apps/backend` only; provider streaming remains server-side.
- Reliability: Keep existing `/api/onboarding/voice` non-stream flow as fallback.
- Security: No direct mobile calls to model providers.

## Work Plan

1. Discovery
2. Implementation
3. Verification
4. Documentation updates

## Decision Log

- 2026-03-22: Reuse existing SSE parsing pattern from intake/panel chat to keep behavior consistent across mobile streams.
- 2026-03-22: Keep event model minimal (`started`, `delta`, `done`, `error`) because onboarding is single-assistant-turn only.

## Progress Log

- 2026-03-22: Started plan.
- 2026-03-22: Added backend streaming function for onboarding chat (`run_onboarding_chat_stream`) with token deltas and final structured result.
- 2026-03-22: Added backend SSE endpoint `/api/onboarding/voice/stream` while preserving `/api/onboarding/voice` as fallback.
- 2026-03-22: Added mobile onboarding stream API method and stream event type.
- 2026-03-22: Updated onboarding chat screen to render assistant streaming text and explicit in-progress status.
- 2026-03-22: Updated backend API docs with onboarding stream endpoint contract.

## Verification

- Commands run:
  - `python3 -m py_compile apps/backend/src/finly_backend/onboarding_chat.py apps/backend/src/finly_backend/server.py`
  - `pnpm -C apps/mobile exec prettier --write src/services/api/index.ts src/services/api/types.ts src/screens/OnboardingChatScreen.tsx`
  - `pnpm -C apps/mobile exec eslint src/services/api/index.ts src/services/api/types.ts src/screens/OnboardingChatScreen.tsx`
  - `python3 scripts/check_harness_readiness.py`
- Manual checks:
  - Verified onboarding UI now creates an in-progress assistant bubble and fills text incrementally via stream deltas.
- Remaining risk:
  - Streaming relies on React Native `fetch` stream support; client keeps non-stream fallback for environments without stream body support.
