# apps/agents

Finly agent runtime for multi-agent investment analysis.

- Upstream repository: `https://github.com/TauricResearch/TradingAgents`
- Source package path: `tradingagents/`
- Snapshot commit: `f362a160c309a680cac460aa9de217ec63e434e6`

## Responsibility

- Owns agentic orchestration logic
- Runs the stateless agent pipeline and panel chat endpoints
- Does not own user profiles, report storage, or application data APIs

## Local Setup

```bash
cd apps/agents
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
cp .env.example .env
```

## Run Agent Server

```bash
cd apps/agents
python3 main.py
# or
finly-agent-server
```

Server defaults:

- Host: `0.0.0.0`
- Port: `8001`

Override with:

- `FINLY_AGENTS_HOST`
- `FINLY_AGENT_SERVER_PORT`

## Endpoints

- `GET /healthz`
- `POST /agent/run-pipeline`
- `POST /agent/panel-chat`

## Smoke Checks

```bash
cd apps/agents
python3 -m py_compile main.py $(find src -name '*.py')
```
