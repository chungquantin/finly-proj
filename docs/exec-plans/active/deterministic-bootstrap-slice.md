# Execution Plan: deterministic bootstrap first slice

## Objective

Add the first deterministic bootstrap path for this repository: a repo-owned bootstrap script, a repo-owned `web-nextjs` template, and readiness checks that validate the new bootstrap policy.

## Why

The current setup guidance is still partly advisory. This change starts converting stack policy into reproducible repository machinery so agents can scaffold a monorepo-friendly codebase with less prompt-time guesswork.

## Scope

- In scope:
  - Add a documented bootstrap workflow for repo-owned templates
  - Add a deterministic bootstrap script with explicit stack selection
  - Add the first repo-owned template for the `web-nextjs` stack
  - Extend readiness checks to validate the new bootstrap policy and template files
  - Update the `codebase-setup` skill to prefer the bootstrap script for supported stacks
- Out of scope:
  - Supporting every stack profile end to end in this slice
  - Installing dependencies or generating a production app in this repository
  - Full runtime validation for scaffolded apps

## Constraints

- Architectural: Keep the repository monorepo-friendly and avoid framework-heavy abstractions outside the template itself.
- Reliability: Prefer deterministic file generation over external scaffold side effects where possible.
- Security: Do not generate secrets or require external accounts to complete the scaffold.

## Work Plan

1. Discovery
2. Implementation
3. Verification
4. Documentation updates

## Decision Log

- 2026-03-14: Start with `web-nextjs` only so the bootstrap script shape can be validated before adding more stack templates.

## Progress Log

- 2026-03-14: Started plan.
- 2026-03-14: Added the deterministic bootstrap script and the first repo-owned `web-nextjs` template with workspace scripts, CI, and baseline app files.
- 2026-03-14: Updated setup docs and the `codebase-setup` skill to prefer the bootstrap script for supported stacks.
- 2026-03-14: Extended harness readiness checks to validate bootstrap docs, script presence, and the first template files.

## Verification

- Commands run:
  - `python3 scripts/check_harness_readiness.py`
  - `python3 scripts/bootstrap_codebase.py --stack web-nextjs --name "Harness Template Demo" --target /tmp/harness-template-demo`
  - `bash ./.agents/skills/codebase-setup/scripts/detect-setup-commands.sh --prompt "Set up a Next.js web app for harness-template"`
  - `find /private/tmp/harness-template-demo -maxdepth 4 -type f | sort`
- Manual checks:
  - Reviewed the generated `/private/tmp/harness-template-demo/package.json` to confirm root lint, format, typecheck, and check scripts are present.
  - Reviewed the generated `/private/tmp/harness-template-demo/apps/web/app/page.tsx` and CI workflow to confirm placeholder substitution and baseline app/CI generation.
- Remaining risk:
  - Only the `web-nextjs` stack is deterministic today; other stacks still rely on prompt-time recommendations until their templates are added.
