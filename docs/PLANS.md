# Plans

Execution plans are first-class artifacts in this repository.

## Rules

- Use `docs/exec-plans/TEMPLATE.md` for any non-trivial task.
- Keep active plans in `docs/exec-plans/active/`.
- Move finished plans to `docs/exec-plans/completed/`.
- Record progress, decisions, risks, and verification in the plan itself.
- Link plans to the docs and code they change.

## When To Require A Plan

- Multi-step work
- Changes with architectural consequences
- Unknown implementation paths
- Changes that should survive context resets

Small, obvious edits can stay planless, but they should still update docs when they encode new repository policy.
