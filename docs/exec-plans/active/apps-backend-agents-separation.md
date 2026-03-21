# Execution Plan: Separate Backend API From Agents Runtime

## Objective

Split the mixed Python service currently living under `apps/agents` into two deployable apps: `apps/agents` for stateless agent orchestration and `apps/backend` for user-data APIs and proxy endpoints.

## Why

The current `apps/agents` app mixes two different responsibilities: TradingAgents-style agent execution and backend application data handling. Separating them makes the architecture legible, aligns the codebase with the intended runtime shape, and reduces future coupling between agent logic and app APIs.

## Scope

- In scope:
  - Create `apps/backend` as the home for the user-data API server
  - Keep `apps/agents` focused on agentic orchestration and agent-facing endpoints
  - Move backend-only Python modules, entrypoints, and docs into `apps/backend`
  - Update repository docs and plans to reflect the new app boundary
- Out of scope:
  - Introducing a new shared library for cross-app models or utilities
  - Rewriting endpoint behavior beyond import/path changes required by the split
  - Reworking deployment infrastructure beyond app-local entrypoint updates

## Constraints

- Architectural: Keep deployable applications under `apps/` per the repo monorepo policy, even though the conceptual boundary is `/agents` vs `/backend`.
- Reliability: Preserve existing backend and agent server behavior while changing paths and package names.
- Security: Do not introduce new secrets or network dependencies as part of the refactor.

## Work Plan

1. Discovery
2. Implementation
3. Verification
4. Documentation updates

## Decision Log

- 2026-03-21: Represent the requested separation as `apps/agents` and `apps/backend` instead of top-level `/agents` and `/backend`, because deployable apps in this repository belong under `apps/`.
- 2026-03-21: Keep the agent runtime package name under `apps/agents` and create a separate `finly_backend` package under `apps/backend` rather than introducing a new shared library during this refactor.

## Progress Log

- 2026-03-21: Started plan.
- 2026-03-21: Moved backend-only Python modules, packaging files, and API docs from `apps/agents` into a new `apps/backend` app.
- 2026-03-21: Recreated `apps/agents` as an agent-runtime-only app with a single `finly-agent-server` entrypoint.
- 2026-03-21: Updated root architecture/docs references and marked the old `apps/agents` API-server plan as superseded.
- 2026-03-21: Updated the repo `justfile` to add unified setup commands and new `backend` run target.
- 2026-03-21: Updated GitHub Actions workflows to use the repo `justfile` targets and to treat `apps/backend` as part of the Python app surface.

## Verification

- Commands run:
  - `python3 -m py_compile apps/agents/main.py $(find apps/agents/src -name '*.py' -not -path '*/__pycache__/*')`
  - `python3 -m py_compile apps/backend/main.py $(find apps/backend/src -name '*.py' -not -path '*/__pycache__/*')`
  - `python3 scripts/check_harness_readiness.py`
  - `just --list`
  - `just --dry-run setup`
  - `just --dry-run lint-ts`
  - `just --dry-run lint-py`
  - `just --dry-run format`
  - `ruby -e 'require "yaml"; YAML.load_file(...)'` for each workflow file under `.github/workflows/`
  - `git diff --check`
- Manual checks:
  - Confirmed `apps/agents/src/tradingagents/dataflows/interface.py` still expects `finly_agents.mock_data`, so that module remains duplicated in `apps/agents` to keep the agent runtime independent from `apps/backend`.
- Remaining risk:
  - `mock_data.py` now exists in both apps to avoid introducing a new shared library during this refactor. If that module changes often, it should be extracted into a shared Python package in a follow-up plan.
  - The GitHub Actions jobs were syntax-checked and aligned with `just`, but they were not executed in GitHub from this session.
