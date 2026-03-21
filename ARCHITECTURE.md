# Architecture

This repository contains early implementation slices for the Finly product and remains governed by the harness architecture.

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
3. `apps/mobile/`
   Stores the mobile prototype surface.
4. `apps/agents/`
   Stores the local Python TradingAgents-style runtime used for specialized investment agents and stateless agent endpoints.
5. `apps/backend/`
   Stores the local Python backend API for user profiles, portfolios, reports, chat history, and proxy endpoints into `apps/agents`.
6. `templates/`
   Stores deterministic bootstrap templates (`web-nextjs`, `mobile-react-native`) used by `scripts/bootstrap_codebase.py`.
7. `.github/workflows/`
   Stores CI enforcement for repository invariants.
8. `.agents/skills/`
   Stores repository-local agent skills for recurring workflows such as setup and git operations.

## Planned Evolution

When the hackathon build is stabilized, extend this file with:

- Harder dependency rules between mobile client, backend API, and agent runtime
- Allowed dependency directions between UI, backend, and simulation modules
- Runtime observability and error handling contracts
- Test strategy by layer and by demo-critical flow

## Target Runtime Shape (PRD-Aligned)

- Frontend: React + Tailwind UI with Agora Web voice integration (hackathon target)
- Backend API: Python + FastAPI application layer for user data and client-facing endpoints
- Agent runtime: Python + FastAPI stateless multi-agent orchestration for Portfolio Manager, Market Analyst, Risk Assessor, Researcher
- Data: Mock market engine and mock portfolio state for demo safety and speed

See `docs/design-docs/harness-engineering-guide.md` for the default stack policy and setup expectations.

Add framework-specific architecture constraints only when corresponding application code exists in-repo.
