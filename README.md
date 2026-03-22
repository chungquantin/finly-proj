# Finly

Finly is a voice-first, multi-agent investment advisory product prototype built for Lotus Hacks 2026 (March 20-22, 2026, Vietnam).

<img width="791" height="449" alt="Finly overview" src="https://github.com/user-attachments/assets/d7b9e678-2e44-46f6-876c-b6b8cae515f3" />

## Status

- Stage: Hackathon MVP with active post-hackathon iteration.
- Product shape: educational, simulation-first investment guidance.
- Safety boundary: no real-money trading and no regulated financial-advice claims.

## What Finly Is

Finly provides beginner investors a conversational advisory experience powered by a 4-agent team:

- Portfolio Manager
- Market Analyst
- Risk Assessor
- Researcher

The current direction combines:

- Voice and chat-first interactions
- Transparent agent role outputs
- Guided onboarding and investor education
- Mock portfolio simulation and engagement loops

Source of truth PRD: `docs/product-specs/finly-agentic-investment-team-prd.md`.

## Repository Goals

This repository is both:

- The working codebase for Finly apps/services
- A harness-style, agent-friendly engineering system with versioned docs and mechanical checks

The harness enforces that decisions live in-repo instead of chat history.

## Architecture Overview

Current runtime shape:

1. `apps/mobile` (React Native + Expo): mobile client and UX prototype
2. `apps/backend` (Python + FastAPI): application-facing API for user data, reports, chat history, and agent proxying
3. `apps/agents` (Python + FastAPI): stateless multi-agent runtime for investment analysis pipelines

Request flow:

`Mobile -> Backend API -> Agent Runtime`

Architecture source of truth: `ARCHITECTURE.md`.

## Repository Layout

Top-level directories and their roles:

- `apps/`: deployable app surfaces (`mobile`, `backend`, `agents`)
- `docs/`: product specs, design decisions, quality/reliability/security posture, plans
- `docs/exec-plans/`: active and completed execution plans
- `scripts/`: mechanical checks and bootstrap tooling
- `templates/`: deterministic stack templates
- `.agents/skills/`: repository-local skills for repeatable workflows

## Prerequisites

- Node.js `>=20`
- `pnpm`
- Python `>=3.10`
- `just` (optional but recommended)

## Quick Start (Local Development)

### 1) Install dependencies and create Python environments

```bash
just setup
```

This installs mobile dependencies and prepares virtual environments for:

- `apps/agents`
- `apps/backend`

### 2) Create mobile env file

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

For real devices, set `EXPO_PUBLIC_API_URL` to your machine LAN IP (not `localhost`).

### 3) Run the stack

Run all services together:

```bash
just dev
```

Or run each service independently:

```bash
just mobile    # Expo mobile app
just backend   # Backend API (default :8000)
just agent     # Agent server (default :8001)
```

## Environment Variables

Copy each `.env.example` to `.env` in its app directory before running.

### Mobile (`apps/mobile/.env`)

- `EXPO_PUBLIC_API_URL` (default `http://localhost:8000`)
- `EXPO_PUBLIC_MARKET_DATA_URL` (optional; falls back to API URL)
- `EXPO_PUBLIC_AGENT_SERVER_URL` (reserved for future direct runtime wiring)

### Backend (`apps/backend/.env`)

- `FINLY_BACKEND_HOST`, `FINLY_BACKEND_PORT`
- `FINLY_AGENT_SERVER_URL` (default `http://localhost:8001`)
- `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`
- `FINLY_INTAKE_MODEL`, `FINLY_MEMORY_MODEL`
- `OPENAI_API_KEY` (voice fallback)
- `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`
- `FINLY_DEFAULT_TICKER`
- `FINLY_DB_PATH`

### Agent Runtime (`apps/agents/.env`)

- `FINLY_AGENTS_HOST`, `FINLY_AGENT_SERVER_PORT`
- `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, `OPENAI_API_KEY`
- `FINLY_AGENT_MODEL`, `FINLY_PANEL_MODEL`
- Data vendor selectors (`FINLY_VENDOR_*`)
- Optional provider keys (`FINANCIAL_DATASETS_API_KEY`, `EXA_API_KEY`)
- Debate controls (`FINLY_MAX_DEBATE_ROUNDS`, `FINLY_MAX_RISK_ROUNDS`)

## Useful Commands

```bash
just setup         # install dependencies for mobile + python apps
just dev           # run mobile + backend + agents together
just lint          # lint/typecheck checks across mobile + python apps
just format        # auto-format TS + Python code
```

## API and Service Health

Backend key endpoints:

- `GET /healthz`
- `GET /v1/models`
- `POST /v1/chat/completions`
- `POST /api/onboarding`
- `POST /api/report/generate`
- `POST /api/report/chat`
- `GET /api/market-data`

Agent runtime key endpoints:

- `GET /healthz`
- `POST /agent/run-pipeline`
- `POST /agent/panel-chat`

## Documentation Map

Start here for repository context:

1. `AGENTS.md`
2. `README.md` (this file)
3. `ARCHITECTURE.md`
4. `docs/design-docs/harness-template.md`
5. `docs/design-docs/core-beliefs.md`
6. `docs/PLANS.md`

System-of-record docs:

- Product intent: `docs/product-specs/`
- Design decisions: `docs/design-docs/`
- Reliability constraints: `docs/RELIABILITY.md`
- Security constraints: `docs/SECURITY.md`
- Quality posture: `docs/QUALITY_SCORE.md`
- Active implementation plans: `docs/exec-plans/active/`

## Engineering Workflow

For non-trivial work:

1. Start from `docs/exec-plans/TEMPLATE.md`
2. Create a plan in `docs/exec-plans/active/`
3. Track progress and decisions in the plan
4. Move completed plans to `docs/exec-plans/completed/`

## Harness Checks and Bootstrap Tooling

- Run harness readiness validation:

```bash
python3 scripts/check_harness_readiness.py
```

- Scaffold supported stacks from repo-owned templates:

```bash
python3 scripts/bootstrap_codebase.py --help
```

Currently supported bootstrap stacks:

- `mobile-react-native`
- `web-nextjs`

## Deployment

Railway deployment guide (backend + agent service topology):

- `DEPLOY.md`

## Open Source Contribution

Contributions are welcome, especially around:

- mobile UX polish and reliability
- agent orchestration quality and explainability
- backend API consistency and observability
- docs quality and harness enforcement

Before opening a PR:

1. Follow the execution-plan workflow for non-trivial changes
2. Run `just lint`
3. Run `python3 scripts/check_harness_readiness.py` if docs/repo structure changed
4. Update docs when behavior or constraints change

## Current Gaps (Transparent Status)

- This project is still in MVP/hackathon maturity
- No formal OSS governance files yet (for example: `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`)
- Security and reliability posture is documented but still evolving

## Disclaimer

Finly is an educational prototype. It does not execute trades and should not be treated as regulated financial advice.
