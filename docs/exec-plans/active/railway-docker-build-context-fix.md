# Execution Plan: Fix Railway Docker Build Context For Backend And Agent Services

## Objective

Make Railway deployments for `apps/backend` and `apps/agents` rebuild consistently from the latest source by aligning Dockerfile `COPY` paths with each service root directory.

## Why

Production appears to run an old container image. A root-directory/build-context mismatch in Dockerfiles can prevent expected source changes from being included in rebuilt images.

## Scope

- In scope:
  - Update `apps/backend/Dockerfile` to use app-local paths.
  - Update `apps/agents/Dockerfile` to use app-local paths.
  - Clarify Railway root-directory and Docker build-context guidance in `DEPLOY.md`.
- Out of scope:
  - Changing runtime architecture, API behavior, or env-var contracts.
  - Reworking to a single combined deployment container.

## Constraints

- Architectural: Preserve two-service deployment boundary (`apps/backend` and `apps/agents`).
- Reliability: Keep existing entrypoints and ports unchanged.
- Security: No new secrets, credentials, or network dependencies.

## Work Plan

1. Discovery
2. Implementation
3. Verification
4. Documentation updates

## Decision Log

- 2026-03-22: Use service-local Docker build context (`COPY pyproject.toml ...`, `COPY src/ ...`) because Railway service root is expected to be each app directory.

## Progress Log

- 2026-03-22: Started plan.
- 2026-03-22: Updated `apps/backend/Dockerfile` and `apps/agents/Dockerfile` to use service-local build context paths.
- 2026-03-22: Updated `DEPLOY.md` with explicit root-directory/build-context guidance and stale-image troubleshooting steps.
- 2026-03-22: Ran harness readiness check successfully.

## Verification

- Commands run:
  - `python3 scripts/check_harness_readiness.py`
- Manual checks:
  - Ensure Dockerfiles only reference files that exist inside each service root.
  - Ensure deploy docs explicitly call out root directory and Dockerfile path pairing.
- Remaining risk:
  - If Railway service root is intentionally set to repo root (`.`), the service settings must be updated to app roots or Dockerfiles adjusted accordingly.
