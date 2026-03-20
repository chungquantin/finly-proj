# harness-template Agent Guide

This repository is optimized for agent execution. Keep this file short and use it as a map to the real sources of truth in `docs/`.

## First Reads

Read these in order before making non-trivial changes:

1. `README.md`
2. `ARCHITECTURE.md`
3. `docs/design-docs/harness-template.md`
4. `docs/design-docs/core-beliefs.md`
5. `docs/PLANS.md`
6. The active execution plan in `docs/exec-plans/active/` if one exists for your task

## System Of Record

Repository-local, versioned artifacts are the system of record.

- Product intent lives in `docs/product-specs/`
- Design decisions live in `docs/design-docs/`
- The harness template lives in `docs/design-docs/harness-template.md`
- Execution plans live in `docs/exec-plans/`
- Quality posture lives in `docs/QUALITY_SCORE.md`
- Reliability constraints live in `docs/RELIABILITY.md`
- Security constraints live in `docs/SECURITY.md`
- Generated reference artifacts live in `docs/generated/`

Do not treat chat history, tickets, or undocumented assumptions as authoritative. If a decision matters for future work, encode it in the repository.

## Working Norms

- Prefer small, reviewable changes with clear acceptance criteria.
- For work that spans multiple steps or uncertain decisions, create or update an execution plan before editing code.
- When you discover missing context, add it to the relevant doc instead of expanding this file.
- Keep docs tightly linked to code. Stale docs are bugs.
- Preserve a legible architecture. Add new layers or packages only when documented in `ARCHITECTURE.md`.

## Execution Plans

Use an execution plan for:

- Multi-file changes
- New infrastructure or workflows
- Schema or API changes
- Work expected to take more than one focused session

Plan workflow:

1. Start from `docs/exec-plans/TEMPLATE.md`
2. Save the new plan in `docs/exec-plans/active/`
3. Track progress and decisions in the plan as work evolves
4. Move finished plans to `docs/exec-plans/completed/`

## Documentation Rules

- Update indexes when adding documents.
- Cross-link related docs instead of duplicating content.
- Keep generated content under `docs/generated/` only.
- Prefer templates and checklists over long prose when they improve repeatability.
- Keep the root `AGENTS.md` as a map, not as the full policy surface.

## Mechanical Checks

Run the harness readiness check before merging repository-structure changes:

```bash
python3 scripts/check_harness_readiness.py
```

The checker validates that the harness docs remain present, linked, and structurally consistent.

## When Information Is Missing

- If the repo does not define the needed rule yet, make the smallest safe assumption.
- Record the new rule in the best matching doc in the same change.
- If several options are plausible and the choice affects architecture, create an execution plan and document the tradeoff.

## Current Phase

This repository is in harness-bootstrap phase. Prioritize:

1. Repository legibility
2. Mechanical checks
3. Execution discipline
4. Minimal, boring, inspectable abstractions

Avoid introducing framework-heavy complexity before the product and architecture docs justify it.
