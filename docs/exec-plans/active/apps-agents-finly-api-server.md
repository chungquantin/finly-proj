# Execution Plan: Migrate apps/agents to Finly API Server (No CLI)

## Status

Superseded by `docs/exec-plans/active/apps-backend-agents-separation.md` as of 2026-03-21. The backend API server introduced here now lives in `apps/backend`, while `apps/agents` is reserved for stateless agent orchestration.

## Objective

Replace the current CLI-oriented `apps/agents` entry surface with a Finly-focused API server that supports OpenAI-compatible chat completions and streaming responses for agent-team communication.

## Why

Finly’s product direction needs a programmatic backend interface for mobile/web clients and orchestration layers. The current CLI UX is not suitable for app-to-agent communication.

## Scope

- In scope:
  - Remove `src/cli` from `apps/agents`
  - Add an API server surface in `apps/agents` using Python/FastAPI
  - Implement `POST /v1/chat/completions` with OpenAI-compatible request/response shape
  - Implement SSE streaming mode for chat completions when `stream=true`
  - Update app docs and packaging entrypoints for the new server
- Out of scope:
  - Full parity with every OpenAI API field
  - Persistent conversation memory storage across requests
  - Production auth/rate-limit/deployment hardening

## Constraints

- Architectural: Keep `apps/agents` as a standalone inspectable runtime in the current monorepo shape.
- Reliability: Keep deterministic compile checks and ensure non-stream + stream paths both return valid payload shapes.
- Security: Do not introduce secrets; continue using env-based configuration.

## Work Plan

1. Discovery
2. Implementation
3. Verification
4. Documentation updates

## Decision Log

- 2026-03-19: Use FastAPI + `StreamingResponse` to provide an OpenAI-compatible `/v1/chat/completions` endpoint with SSE chunks and `[DONE]` terminator.
- 2026-03-19: Keep `TradingAgentsGraph` as the domain engine and wrap it in request-scoped service logic instead of rewriting internal agent flow.

## Progress Log

- 2026-03-19: Started plan.
- 2026-03-19: Removed `apps/agents/src/cli` and replaced entrypoint usage with `finly_agents.server`.
- 2026-03-19: Added OpenAI-compatible endpoints: `/v1/models` and `/v1/chat/completions` (stream + non-stream), plus `/healthz`.
- 2026-03-19: Updated packaging (`pyproject.toml`, `requirements.txt`) and app docs/env examples for API-first runtime.
- 2026-03-19: Switched default LLM runtime from OpenAI to OpenRouter for Finly agents.

## Verification

- Commands run:
  - `python3 -m py_compile apps/agents/main.py $(find apps/agents/src -name '*.py')`
  - `python3 scripts/check_harness_readiness.py`
- Manual checks:
  - Reviewed route and payload shapes for `/healthz`, `/v1/models`, and `/v1/chat/completions` (streaming and non-streaming).
- Remaining risk:
  - Runtime behavior depends on installed API dependencies (`fastapi`, `uvicorn`) and external LLM/data-provider availability.
