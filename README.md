# Finly

Finly is an AI agentic investment team product being built for Lotus Hacks 2026 (March 20-22, Vietnam).

<img width="791" height="449" alt="image" src="https://github.com/user-attachments/assets/d7b9e678-2e44-46f6-876c-b6b8cae515f3" />

The product direction is a multi-agent advisory experience for beginner investors, combining:

- A 4-agent investment team
- Real-time conversational UX using Agora Voice
- Arena-style gamification and education pathways
- Mock portfolio simulation for safe learning

## Product Snapshot

- Target users:
  - 18-25 students new to investing
  - 30-40 working professionals new to investing
- Core agent roles:
  - Portfolio Manager
  - Market Analyst
  - Trader
  - Researcher
- Market focus: English stocks 

See the PRD source of truth at `docs/product-specs/finly-agentic-investment-team-prd.md`.

## Repository Purpose

This repository is still organized as an agent-first harness:

- `docs/` stores versioned product, design, reliability, and planning artifacts
- `docs/exec-plans/` stores active and completed execution plans
- `scripts/check_harness_readiness.py` enforces core documentation structure
- `scripts/bootstrap_codebase.py` provides deterministic bootstrap templates

## Current Code Areas

- `apps/mobile/`: mobile client prototype surface
- `apps/agents/`: local Python agent runtime for TradingAgents-style orchestration
- `apps/backend/`: local Python backend API for user data, storage, and agent proxy endpoints
- `templates/`: repo-owned bootstrap templates (`web-nextjs`, `mobile-react-native`)

## Current Mobile Prototype Notes

- The board tab now supports creating ad hoc investment discussions, searching conversation history, and opening new thread detail views from the drafted prompt.
- The settings tab now follows a more native grouped iOS layout with profile summary, segmented preference controls, and a dedicated onboarding reset card.

## Workflow

1. Read `AGENTS.md` and `ARCHITECTURE.md`
2. Read relevant docs under `docs/`
3. Create/update an execution plan for non-trivial changes
4. Run `python3 scripts/check_harness_readiness.py` for doc/structure updates
5. Use `python3 scripts/bootstrap_codebase.py --help` when adding template-driven scaffolds
