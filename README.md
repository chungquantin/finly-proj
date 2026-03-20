# harness-template

`harness-template` is currently in harness-bootstrap mode with an initial iOS product slice.

The immediate goal is to make the codebase legible, enforceable, and easy for coding agents to operate in:

- A short root `AGENTS.md` points to repository-local sources of truth
- `docs/design-docs/harness-template.md` explains the repository's harness template and operating model
- `scripts/bootstrap_codebase.py` can generate repo-owned starter code for supported stacks
- `docs/` holds versioned product, design, reliability, and planning knowledge
- `docs/exec-plans/` is the home for active and completed execution plans
- `scripts/check_harness_readiness.py` mechanically validates the scaffold
- `.github/workflows/harness-readiness.yml` runs the check in CI
- `apps/ios/` contains an initialized SwiftUI flow for AI fund launch UX

## Bootstrap Workflow

1. Read `AGENTS.md`
2. Read `ARCHITECTURE.md`
3. Read `docs/design-docs/harness-template.md`
4. Read the relevant docs in `docs/`
5. Create an execution plan for any non-trivial task
6. Run `python3 scripts/check_harness_readiness.py` when changing scaffold docs
7. Use `python3 scripts/bootstrap_codebase.py --help` when adding a supported starter template

## Repository Layout

```text
.
├── AGENTS.md
├── ARCHITECTURE.md
├── README.md
├── apps/
├── templates/
├── docs/
├── scripts/
└── .github/workflows/
```

## Supported Bootstrap Stacks

- `web-nextjs`
- `ios-swiftui`

## Next Steps

The next repository milestone should add:

- Python agent server scaffold under `python/`
- API contracts between mobile app and agent server
- Architectural invariants that can be enforced mechanically
- Agent-operable local dev tooling for validation and observability

## Approach

The harness template follows an agent-first approach:

- Keep root instructions short and move durable policy into repository-local docs
- Treat execution plans as persistent working memory for non-trivial changes
- Prefer monorepo-ready structure so future stacks can be added without churn
- Add mechanical checks early so repository discipline does not depend on memory
- Grow policy in small, reviewable increments instead of writing speculative process docs
