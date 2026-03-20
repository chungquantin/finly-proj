# Execution Plan: codebase-setup skill

## Objective

Add a local skill that triggers on codebase setup requests and guides an agent through discovery, clarification, setup command execution, and verification.

## Why

Repository-local skills should cover repetitive workflows. Codebase setup is a common task that benefits from a deterministic checklist and lightweight command detection.

## Scope

- In scope:
  - Add a new `codebase-setup` skill under `.agents/skills/`
  - Include concise instructions for clarification, setup execution, escalation, and verification
  - Add a helper script to inspect a repo and suggest likely setup commands
  - Validate the helper script with representative output
- Out of scope:
  - Implement project-specific setup logic outside the skill
  - Add external dependencies or a global skill management system

## Constraints

- Architectural: Keep the skill self-contained and consistent with existing `.agents/skills/` layout.
- Reliability: Prefer deterministic repo inspection over free-form guessing.
- Security: Do not auto-run destructive commands; require explicit user confirmation when secrets or privileged actions are involved.

## Work Plan

1. Discovery
2. Implementation
3. Verification
4. Documentation updates

## Decision Log

- 2026-03-14: Implement a small repo-inspection helper script so setup guidance can stay concise and repeatable.

## Progress Log

- 2026-03-14: Started plan.
- 2026-03-14: Added the `codebase-setup` skill, OpenAI metadata, and a helper script that suggests likely setup commands from repository files.
- 2026-03-14: Validated the helper script on the current repository and confirmed harness readiness still passes.

## Verification

- Commands run:
  - `bash ./.agents/skills/codebase-setup/scripts/detect-setup-commands.sh`
  - `python3 scripts/check_harness_readiness.py`
- Manual checks:
  - Reviewed the skill description to ensure trigger phrases include "Can you help to set up the code base?" and similar setup requests.
  - Confirmed the skill invokes the helper with `bash`, avoiding executable-bit dependence in sandboxed environments.
- Remaining risk:
  - The helper script suggests setup commands heuristically from common manifests and may miss repo-specific bootstrap logic that exists only in prose docs.
