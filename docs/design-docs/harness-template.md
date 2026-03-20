# Harness Template

## Objective

This repository uses a harness template so agents can operate with low ambiguity and low entropy as the codebase grows.

The template is intentionally simple:

- a short root `AGENTS.md`
- a repository-local docs system
- execution plans for non-trivial work
- mechanical checks for structural drift
- repository-local skills for repetitive workflows

## Why This Shape

Agent performance drops when the repository hides intent in chat history, long prompt dumps, or unwritten team habits.

This template keeps the high-signal information in versioned files that agents can re-read and update:

- the root file stays small enough to read every session
- durable policy moves into targeted docs
- plans preserve working memory across context resets
- CI catches obvious harness regressions early

## Approach

Our approach is to introduce process in layers, only when the repository can enforce it.

1. Start with the minimum navigational surface:
   `AGENTS.md`, `README.md`, `ARCHITECTURE.md`, and a small `docs/` tree.
2. Add persistent working memory:
   execution plans in `docs/exec-plans/`.
3. Add enforcement:
   repository checks in `scripts/` and CI workflows in `.github/workflows/`.
4. Add reusable operator knowledge:
   repository-local skills in `.agents/skills/`.
5. Add stack-specific policy only when the product direction justifies it.

## Repository Roles

- `AGENTS.md`
  Entry point and reading order only.
- `docs/design-docs/`
  Durable design and process decisions.
- `docs/product-specs/`
  Product intent and acceptance criteria.
- `docs/exec-plans/`
  Active and completed implementation plans.
- `scripts/`
  Mechanical checks and automation.
- `.agents/skills/`
  Repeatable workflows encoded for agents.

## What We Optimize For

- Fast onboarding for fresh agent sessions
- Low-cost context recovery after interruptions
- Reviewable changes instead of broad prompt-only behavior
- Monorepo compatibility so the repository can absorb multiple stacks later
- Boring enforcement before clever automation

## Non-Goals

- Encoding every future engineering rule before code exists
- Choosing a final product stack too early
- Replacing design docs with giant root instructions
- Pretending structural checks are enough without later runtime checks

## Template Status In harness-template

`harness-template` currently has the harness layer, stack policy guidance, and a readiness check.

It does not yet have:

- product specs for user-facing behavior
- runtime validation for an application stack
- architecture rules for concrete apps or packages
- observability for agent-operated systems

Those should be added incrementally, backed by execution plans.
