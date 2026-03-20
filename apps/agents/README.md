# apps/agents

Finly API server for multi-agent investment analysis, initialized from TradingAgents modules.

- Upstream repository: `https://github.com/TauricResearch/TradingAgents`
- Source package path: `tradingagents/`
- Snapshot commit: `f362a160c309a680cac460aa9de217ec63e434e6`

## Included Agent Teams

- `analysts`
- `researchers`
- `trader`
- `risk_mgmt`
- `managers`
- `utils`

## Local Setup

```bash
cd apps/agents
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
cp .env.example .env
```

## Run API Server

```bash
cd apps/agents
python3 main.py
# or
finly-agents-api
```

Server defaults:

- Host: `0.0.0.0`
- Port: `8000`

Override with:

- `FINLY_AGENTS_HOST`
- `FINLY_AGENTS_PORT`

## OpenAI-Compatible Endpoint

`POST /v1/chat/completions`

Example (non-streaming):

```bash
curl -s http://localhost:8000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "finly-agents-v1",
    "messages": [
      {"role": "user", "content": "Analyze FPT for 2025-03-10"}
    ]
  }'
```

Example (streaming SSE):

```bash
curl -N http://localhost:8000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "finly-agents-v1",
    "stream": true,
    "messages": [
      {"role": "user", "content": "Analyze VNM for 2025-03-10"}
    ]
  }'
```

## Optional Request Extensions

The OpenAI-compatible request body also accepts Finly runtime hints:

- `ticker`: explicit ticker symbol (overrides prompt extraction)
- `trade_date`: `YYYY-MM-DD`
- `selected_analysts`: subset of analysts, e.g. `['market', 'news']`

## Smoke Checks

```bash
cd apps/agents
python3 -m py_compile main.py $(find src -name '*.py')
```

Set at least one LLM API key in `.env` before running live workflows.
Finly default runtime expects `OPENROUTER_API_KEY`.
