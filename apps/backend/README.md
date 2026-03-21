# apps/backend

Finly backend API for application data and agent-facing proxy endpoints.

This app owns:

- user profiles
- portfolio imports and reads
- report storage and regeneration
- chat history and memories
- voice/TTS helpers
- market-data and heartbeat endpoints

This app does not run TradingAgents directly. It calls the stateless agent runtime in `apps/agents`.

## Local Setup

```bash
cd apps/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
cp .env.example .env
```

## Run Backend API

```bash
cd apps/backend
python3 main.py
# or
finly-backend-api
```

Server defaults:

- Host: `0.0.0.0`
- Port: `8000`

Override with:

- `FINLY_BACKEND_HOST`
- `FINLY_BACKEND_PORT`

## Dependency

The backend expects the agent server at `FINLY_AGENT_SERVER_URL` and will report a degraded `/healthz` status if it cannot reach it.

## Key Endpoints

- `GET /healthz`
- `GET /v1/models`
- `POST /v1/chat/completions`
- `POST /api/onboarding`
- `POST /api/report/generate`
- `POST /api/report/chat`
- `GET /api/market-data`

## Smoke Checks

```bash
cd apps/backend
python3 -m py_compile main.py $(find src -name '*.py')
```
