# Execution Plan: stack policy and setup detection

## Objective

Document the repository's default monorepo stack policy and update the codebase setup skill so it can infer or ask for the intended stack before scaffolding a project.

## Why

Setup behavior should be repository-local, explicit, and repeatable. The agent needs durable policy for preferred stacks and a deterministic way to map setup requests to scaffold commands.

## Scope

- In scope:
  - Add a harness engineering guide with stack defaults and scaffold attribution
  - Update design doc indexes and related docs to point to the guide
  - Update the `codebase-setup` skill to use prompt-aware stack inference
  - Extend the helper script with recommended scaffold commands and CI/lint/format expectations
- Out of scope:
  - Fully generating a monorepo in this change
  - Installing dependencies or scaffolding an application in this repository

## Constraints

- Architectural: Keep monorepo guidance boring, inspectable, and compatible with mixed-language repositories.
- Reliability: Default to lint, format, and CI enforcement for generated stacks.
- Security: Do not encode fake secrets or automatic external account provisioning.

## Work Plan

1. Discovery
2. Implementation
3. Verification
4. Documentation updates

## Decision Log

- 2026-03-14: Add a dedicated harness engineering guide instead of scattering stack policy across multiple unrelated docs.

## Progress Log

- 2026-03-14: Started plan.
- 2026-03-14: Added a harness engineering guide that records scaffold provenance, mixed-language monorepo policy, default stack profiles, and setup quality gates.
- 2026-03-14: Updated the `codebase-setup` skill and helper script to infer stack profiles from the user prompt and recommend monorepo-friendly scaffold commands.
- 2026-03-14: Validated prompt-aware detection for web, desktop, Rust, and Python setup requests and confirmed the harness readiness check still passes.

## Verification

- Commands run:
  - `bash ./.agents/skills/codebase-setup/scripts/detect-setup-commands.sh --prompt "Can you help to set up the code base with Next.js, Supabase, tRPC, and WorkOS?"`
  - `bash ./.agents/skills/codebase-setup/scripts/detect-setup-commands.sh --prompt "Set up a Tauri desktop app with the same frontend stack"`
  - `bash ./.agents/skills/codebase-setup/scripts/detect-setup-commands.sh --prompt "Bootstrap a Rust CLI with clap and tokio"`
  - `bash ./.agents/skills/codebase-setup/scripts/detect-setup-commands.sh --prompt "Set up a typed Python app with a local .venv"`
  - `python3 scripts/check_harness_readiness.py`
- Manual checks:
  - Reviewed the harness guide and frontend guidance to ensure the default stacks are explicit and monorepo-oriented.
  - Reviewed the skill instructions to ensure the agent only asks stack questions when the prompt does not already imply the target profile.
- Remaining risk:
  - The prompt-to-stack mapping is heuristic and may need new keywords as additional stack variants become common.
