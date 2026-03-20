# Architecture

This repository does not yet contain product code. The current architecture is the harness architecture that governs how future code should be introduced.

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
3. `.github/workflows/`
   Stores CI enforcement for repository invariants.
4. `.agents/skills/`
   Stores repository-local agent skills for recurring workflows such as setup and git operations.

## Planned Evolution

When application code is introduced, extend this file with:

- Domain boundaries
- Package or app layout
- Allowed dependency directions
- Cross-cutting concerns and where they enter the system
- Test strategy by layer

Default assumption before an application-specific architecture exists: the repository should stay compatible with a mixed-language monorepo. See `docs/design-docs/harness-engineering-guide.md` for the default stack policy and setup expectations.

Do not add a framework-specific architecture section until the repository has committed to a concrete stack.
