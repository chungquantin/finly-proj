# Architecture

This repository now contains an initial iOS product slice and remains governed by the harness architecture for future expansion.

## Principles

- Repository-local knowledge is authoritative
- Constraints should be documented before they are enforced
- Architecture should stay boring, inspectable, and easy for agents to navigate
- Mechanical validation should replace tribal knowledge wherever possible

## Current Layers

1. `docs/`
   Stores the product, design, planning, quality, reliability, and security knowledge base.
2. `scripts/`
   Stores mechanical checks and repository automation.
3. `apps/ios/`
   Stores the iOS SwiftUI application scaffold for the AI fund launch flow.
4. `templates/`
   Stores deterministic bootstrap templates (`web-nextjs`, `ios-swiftui`) used by `scripts/bootstrap_codebase.py`.
5. `.github/workflows/`
   Stores CI enforcement for repository invariants.
6. `.agents/skills/`
   Stores repository-local agent skills for recurring workflows such as setup and git operations.

## Planned Evolution

When application code is introduced, extend this file with:

- Domain boundaries
- Package or app layout
- Allowed dependency directions
- Cross-cutting concerns and where they enter the system
- Test strategy by layer

Current default assumption: the repository stays compatible with a mixed-language monorepo and grows with explicit boundaries:

- iOS app in `apps/ios/`
- Python agent server in `python/` (planned)
- Shared documentation and plans in `docs/`

See `docs/design-docs/harness-engineering-guide.md` for the default stack policy and setup expectations.

Add framework-specific architecture constraints only when corresponding application code exists in-repo.
