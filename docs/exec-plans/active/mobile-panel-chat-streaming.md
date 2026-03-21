# Execution Plan: Stream Panel Chat Responses To Mobile UI

## Objective

Add end-to-end streaming for panel chat so the mobile thread screen receives incremental agent/specialist messages instead of waiting for one final payload.

## Why

The current `/api/report/chat` flow blocks until all specialist responses complete, which makes the UI feel frozen and hides intermediate reasoning progress.

## Scope

- In scope:
  - Add streaming panel-chat endpoint in `apps/agents` that emits specialist responses as they finish.
  - Add streaming proxy endpoint in `apps/backend` that persists streamed messages and emits UI-ready SSE events.
  - Add mobile streaming client/store wiring to render incremental specialist chat bubbles.
- Out of scope:
  - Streaming report generation (`/api/report/generate`).
  - Redesigning thread UI visuals.

## Constraints

- Architectural: Keep mobile talking only to `apps/backend`; `apps/backend` remains proxy to `apps/agents`.
- Reliability: Preserve existing non-stream `/api/report/chat` behavior as fallback.
- Security: No client-side direct calls to model providers.

## Work Plan

1. Discovery
2. Implementation
3. Verification
4. Documentation updates

## Decision Log

- 2026-03-21: Use SSE payloads with typed events (`agent_message_start`, `agent_message_delta`, `agent_message_done`, `memory_updates`, `done`) to keep the transport simple and debuggable.
- 2026-03-21: Keep `/api/report/chat` unchanged for compatibility and add `/api/report/chat/stream` for progressive UI updates.

## Progress Log

- 2026-03-21: Started plan.
- 2026-03-21: Added streaming endpoint `/agent/panel-chat/stream` in `apps/agents` with SSE events per specialist response.
- 2026-03-21: Added backend proxy endpoint `/api/report/chat/stream` with SSE chunk events, panel-conversation persistence, and post-stream memory extraction.
- 2026-03-21: Added mobile API streaming client (`panelChatStream`) and store wiring to render specialist chat bubbles incrementally.

## Verification

- Commands run:
  - `python3 -m py_compile apps/backend/src/finly_backend/server.py apps/backend/src/finly_backend/agent_client.py apps/agents/src/finly_agents/agent_server.py`
  - `pnpm -C apps/mobile exec prettier --write 'src/services/api/index.ts' 'src/stores/agentBoardStore.ts'`
  - `pnpm -C apps/mobile exec eslint 'src/services/api/index.ts' 'src/services/api/types.ts' 'src/stores/agentBoardStore.ts'`
  - `python3 scripts/check_harness_readiness.py`
- Manual checks:
  - Verified streaming event model emits incremental specialist text chunks and final memory updates.
- Remaining risk:
  - React Native `fetch` stream support can vary by runtime; the client includes a non-stream fallback to existing `/api/report/chat` behavior when no stream body is available.
