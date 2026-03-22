# Finly — Railway Deployment Guide

## Architecture

Finly runs as **two services** that form a chain. The mobile app never talks to the agent server directly.

```
Mobile App  ──►  Backend (port 8000)  ──►  Agent Server (port 8001)
                 apps/backend               apps/agents
                 Stateful: DB, users,       Stateless: runs
                 portfolios, chat history,  TradingAgents LLM
                 heartbeat, proxies AI      pipeline & panel chat
                 requests to agent server
```

| Service | Code | Port | Purpose | Entry point |
|---------|------|------|---------|-------------|
| **Backend** | `apps/backend` | 8000 | All mobile-facing API — users, portfolio, reports, chat, heartbeat. Proxies AI calls to Agent Server | `python main.py` |
| **Agent Server** | `apps/agents` | 8001 | Stateless AI engine — runs TradingAgents LangGraph pipeline, 4-agent panel debates | `python main.py` (or `finly-agent-server` script entry point) |

**How they connect**: Backend calls Agent Server via HTTP (`agent_client.py`), default `http://localhost:8001`. Endpoints proxied: `/api/chat`, `/api/chat/voice`, `/api/report/generate`, `/api/report/chat`, `/api/report/regenerate`.

**Mobile app config**: `apps/mobile/src/config/config.dev.ts` points to backend only. Update `config.prod.ts` with Railway URL after deploy.

---

## Option A: Two Railway Services (Recommended)

More resilient — each service restarts independently, scales independently.

### Service 1: finly-backend

**Root directory**: `apps/backend`

**Build**: Dockerfile (already exists at `apps/backend/Dockerfile`)

**Start command**: `python main.py`

**Environment variables**:
```
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
FINLY_AGENT_MODEL=openai/gpt-4.1-mini
FINLY_AGENT_SERVER_URL=http://<agent-server-internal-url>:8001
FINLY_DB_PATH=/app/finly.db
ELEVENLABS_API_KEY=...          # optional, TTS gracefully degrades
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
```

**Health check**: `GET /healthz`

**Public domain**: Yes — this is what the mobile app connects to.

### Service 2: finly-agent-server

**Root directory**: `apps/agents`

**Build**: Dockerfile (already exists at `apps/agents/Dockerfile`)

**Start command**: `python main.py`

**Environment variables**:
```
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
FINLY_AGENT_MODEL=openai/gpt-4.1-mini
FINLY_AGENT_SERVER_PORT=8001
```

**Health check**: `GET /healthz`

**Public domain**: No — only needs Railway private networking (internal access from backend).

### Connecting the two services

Railway gives each service an internal hostname. After deploying both:

1. Go to finly-agent-server → Settings → get the **Private Networking** URL (e.g., `finly-agent-server.railway.internal`)
2. On finly-backend, set: `FINLY_AGENT_SERVER_URL=http://finly-agent-server.railway.internal:8001`

---

## Option B: Single Service with Both Processes (Fastest for Hackathon)

Run both processes in one Railway service. Simpler setup, but if the agent server crashes, Railway won't restart just that process.

This requires a combined Dockerfile and start script since `apps/backend` and `apps/agents` are separate packages.

### Create `deploy/Dockerfile`

```dockerfile
FROM python:3.11-slim
WORKDIR /app

# Install backend
COPY apps/backend/pyproject.toml apps/backend/pyproject.toml
COPY apps/backend/src/ apps/backend/src/
COPY apps/backend/main.py apps/backend/main.py
RUN pip install --no-cache-dir -e apps/backend

# Install agent server
COPY apps/agents/pyproject.toml apps/agents/pyproject.toml
COPY apps/agents/src/ apps/agents/src/
COPY apps/agents/main.py apps/agents/main.py
RUN pip install --no-cache-dir -e apps/agents

COPY deploy/start.sh start.sh
RUN chmod +x start.sh

EXPOSE 8000
CMD ["bash", "start.sh"]
```

### Create `deploy/start.sh`

```bash
#!/bin/bash
# Start agent server in background on port 8001
cd /app/apps/agents && python main.py &

# Wait briefly for agent server to start
sleep 2

# Start backend in foreground on port 8000 (Railway-exposed port)
cd /app/apps/backend && python main.py
```

### Railway config

**Root directory**: `.` (repo root, so it can access both apps)

**Environment variables**: Same as Option A combined, plus:
```
FINLY_AGENT_SERVER_URL=http://localhost:8001
```

**Downside**: If agent server crashes, only a full redeploy restarts it. Fine for a hackathon demo.

---

## Step-by-Step Deploy

### Prerequisites
- Railway account (free tier works for hackathon)
- GitHub repo connected to Railway (easiest) or Railway CLI installed (`npm i -g @railway/cli`)

### Dashboard Deploy (Easiest — no CLI needed)

1. Go to https://railway.com/dashboard
2. New Project → Deploy from GitHub repo
3. **For Option A**: Add two services, set root directories to `apps/backend` and `apps/agents`
4. **For Option B**: Set root directory to `.` (repo root), set Dockerfile path to `deploy/Dockerfile`
5. Add env vars in each service's Settings tab
6. Deploy
7. On the backend service: Settings → Generate Domain (this is the public URL)
8. Copy the domain URL for your mobile app's `config.prod.ts`

### Railway CLI Deploy

```bash
# 1. Login
railway login

# 2. Link to your project
railway link

# 3. Set env vars (do this in Railway dashboard or CLI)
railway variables set OPENROUTER_API_KEY=sk-or-...
railway variables set FINLY_AGENT_MODEL=openai/gpt-4.1-mini
railway variables set FINLY_AGENT_SERVER_URL=http://localhost:8001
railway variables set FINLY_DB_PATH=/app/finly.db
# Add ELEVENLABS_API_KEY if you have one

# 4. Deploy
railway up

# 5. Check logs
railway logs

# 6. Get public URL
railway domain
```

---

## Pre-Deploy Checklist

- [ ] `PORT` env var fix is applied (already done in both `server.py` and `agent_server.py`)
- [ ] `OPENROUTER_API_KEY` set in Railway env vars
- [ ] `ELEVENLABS_API_KEY` set if you want voice (optional)
- [ ] For Option B: create `deploy/Dockerfile` and `deploy/start.sh`
- [ ] After deploy: update `apps/mobile/src/config/config.prod.ts` with Railway URL

---

## Environment Variables Reference

| Variable | Required | Default | Used by | Notes |
|----------|----------|---------|---------|-------|
| `OPENROUTER_API_KEY` | **Yes** | — | Both | LLM provider key |
| `OPENROUTER_BASE_URL` | No | `https://openrouter.ai/api/v1` | Both | |
| `FINLY_AGENT_MODEL` | No | `openai/gpt-4.1-mini` | Both | Model for all agent calls |
| `FINLY_INTAKE_MODEL` | No | Same as FINLY_AGENT_MODEL | Backend | Model for intake coordinator |
| `FINLY_BACKEND_PORT` | No | `8000` | Backend | Railway auto-sets `PORT`, which takes priority |
| `FINLY_AGENT_SERVER_PORT` | No | `8001` | Agent Server | |
| `FINLY_AGENT_SERVER_URL` | No | `http://localhost:8001` | Backend | How backend reaches agent server |
| `FINLY_DB_PATH` | No | `finly.db` | Backend | SQLite path — use `/app/finly.db` in Docker |
| `ELEVENLABS_API_KEY` | No | — | Backend | TTS, gracefully falls back if missing |
| `ELEVENLABS_VOICE_ID` | No | `21m00Tcm4TlvDq8ikWAM` | Backend | ElevenLabs voice (Rachel) |
| `FINLY_MAX_DEBATE_ROUNDS` | No | `1` | Agent Server | Investment debate iterations |
| `FINLY_MAX_RISK_ROUNDS` | No | `1` | Agent Server | Risk debate iterations |
| `FINLY_VENDOR_CORE_STOCK` | No | `yfinance` | Agent Server | Stock data vendor |

---

## Railway-Specific Notes

### PORT variable
Railway sets a `PORT` env var automatically. Both services already handle this:
```python
# backend server.py — reads PORT first, falls back to FINLY_BACKEND_PORT
port = int(os.getenv("PORT", os.getenv("FINLY_BACKEND_PORT", "8000")))

# agent_server.py — reads PORT first, falls back to FINLY_AGENT_SERVER_PORT
port = int(os.getenv("PORT", os.getenv("FINLY_AGENT_SERVER_PORT", "8001")))
```
**For Option B (single service)**: Only backend needs the Railway `PORT`. Set `FINLY_AGENT_SERVER_PORT=8001` explicitly so the agent server doesn't also grab Railway's PORT.

### Persistent storage
SQLite on Railway is **ephemeral** — data resets on each deploy. For a hackathon demo this is fine (DB seeds on startup). For persistence:
1. Service Settings → Add Volume
2. Mount path: `/app/data`
3. Set `FINLY_DB_PATH=/app/data/finly.db`

### Networking
- Railway assigns a random public domain (e.g., `finly-backend-production-xxxx.up.railway.app`)
- Only the **backend** service needs a public domain
- Agent server should use **private networking only** (Option A) or localhost (Option B)

### Timeouts
- Agent pipeline timeout is 180s, panel chat is 60s
- Railway default request timeout may be lower — check Settings → Networking and increase if needed

---

## Smoke Test After Deploy

```bash
URL=https://<your-domain>.up.railway.app

# 1. Health check (works without any API keys)
curl $URL/healthz

# 2. Market data (no API key needed)
curl $URL/api/market-data

# 3. Onboarding (no API key needed)
curl -X POST $URL/api/onboarding \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test1","risk_score":50,"horizon":"medium","knowledge":2}'

# 4. Chat (needs OPENROUTER_API_KEY + agent server running)
curl -X POST $URL/api/chat \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test1","message":"Should I buy VCB?"}'

# 5. Heartbeat trigger (no API key needed)
curl -X POST "$URL/api/heartbeat/trigger?scenario=fpt_earnings_beat"

# 6. Heartbeat poll
curl "$URL/api/heartbeat/alerts"
```

---

## Endpoints Available After Deploy

All endpoints the mobile app calls (all on the **backend** service):

| Endpoint | Needs Agent Server | Needs LLM Key | Needs ElevenLabs |
|----------|-------------------|---------------|-----------------|
| `GET /healthz` | No (but reports agent server status) | No | No |
| `GET /api/market-data` | No | No | No |
| `GET /api/market-data/history` | No | No | No |
| `POST /api/onboarding` | No | No | Optional (TTS) |
| `POST /api/portfolio/import` | No | No | No |
| `GET /api/user/{id}/portfolio` | No | No | No |
| `GET /api/user/{id}/profile` | No | No | No |
| `POST /api/intake` | No | **Yes** | Optional (TTS) |
| `POST /api/intake/reset` | No | No | No |
| `POST /api/chat` | **Yes** | **Yes** | No |
| `POST /api/chat/voice` | **Yes** | **Yes** | **Yes** |
| `POST /api/report/generate` | **Yes** | **Yes** | No |
| `POST /api/report/chat` | **Yes** | **Yes** | No |
| `POST /api/report/regenerate` | **Yes** | **Yes** | No |
| `GET /api/heartbeat/alerts` | No | No | No |
| `POST /api/heartbeat/trigger` | No | No | No |
| `POST /api/heartbeat/custom` | No | No | No |
| `GET /api/user/{id}/chat-history` | No | No | No |
| `GET /api/user/{id}/reports` | No | No | No |
| `GET /api/user/{id}/memories` | No | No | No |

---

## Known Issues

- [ ] SQLite is ephemeral on Railway — add volume if persistence matters beyond a single deploy
- [ ] `config.prod.ts` in mobile needs the Railway URL after first deploy
- [ ] Agent server timeout is 180s — Railway default request timeout may be lower
- [ ] No auth — endpoints are publicly accessible (fine for hackathon)
- [ ] CORS allows all origins (fine for demo)
- [ ] Option B: if agent server crashes mid-request, backend returns 503 until full redeploy
