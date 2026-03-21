# Finly Backend API Reference

**Architecture:** Two-server design — Backend API (port 8000) handles user data and proxies to the stateless Agent Server (port 8001).

```
Mobile App ──→ Backend API (port 8000) ──→ Agent Server (port 8001)
                 ├── user profiles (SQLite)     ├── POST /agent/run-pipeline
                 ├── report storage             ├── POST /agent/panel-chat
                 ├── chat/conversation history   └── tradingagents + LLM (stateless)
                 ├── memories
                 ├── heartbeat alerts
                 └── builds user_context, proxies to agent server
```

**Backend API Base URL:** `http://localhost:8000`
**Agent Server Base URL:** `http://localhost:8001`
**Version:** 0.3.0

---

## Starting the Servers

```bash
# Start agent server (port 8001) — runs the LLM pipeline
finly-agent-server

# Start backend API (port 8000) — handles user data, proxies to agent server
finly-backend-api
```

---

## Health & System

### `GET /healthz` (Backend)

Health check — verifies DB connectivity and agent server reachability.

**Response:**
```json
{
  "status": "ok",           // "ok" | "degraded"
  "version": "0.3.0",
  "database": "connected",  // "connected" | "error"
  "agent_server": "connected"  // "connected" | "unreachable"
}
```

### `GET /healthz` (Agent Server)

Simple health check — no DB.

**Response:**
```json
{
  "status": "ok",
  "version": "0.2.0"
}
```

### `GET /v1/models`

Lists available models (OpenAI-compatible).

**Response:**
```json
{
  "object": "list",
  "data": [
    { "id": "finly-agents-v1", "object": "model", "created": 1711000000, "owned_by": "finly" }
  ]
}
```

---

## Agent Server Endpoints

### `POST /agent/run-pipeline`

Execute the full TradingAgents pipeline. Stateless — all context passed in request.

**Request Body:**
```json
{
  "ticker": "FPT",                    // required
  "trade_date": "2026-03-21",         // required
  "user_context": "...",              // optional — investor profile text
  "portfolio_summary": "...",         // optional — portfolio holdings text
  "selected_analysts": ["market", "social", "news", "fundamentals"],  // optional
  "model_name": "openai/gpt-4.1-mini"  // optional — overrides FINLY_AGENT_MODEL
}
```

**Response:**
```json
{
  "ticker": "FPT",
  "trade_date": "2026-03-21",
  "decision": "BUY",
  "content": "Ticker: FPT\nDecision: BUY\n...",
  "agent_reasoning": { ... },
  "specialist_insights": [ ... ],
  "summary": "FPT shows strong momentum..."
}
```

### `POST /agent/panel-chat`

Run panel discussion — all 4 agents respond in parallel. Stateless.

**Request Body:**
```json
{
  "message": "Why are you bullish on FPT?",
  "report_data": {
    "agent_reasoning": { ... },
    "summary": "..."
  },
  "user_context": "...",
  "conversation_history": [ ... ]
}
```

**Response:**
```json
{
  "agent_responses": [
    { "agent_role": "analyst", "agent_name": "Analyst", "response": "..." },
    { "agent_role": "researcher", "agent_name": "Researcher", "response": "..." },
    { "agent_role": "trader", "agent_name": "Trader", "response": "..." },
    { "agent_role": "advisor", "agent_name": "Advisor", "response": "..." }
  ]
}
```

---

## Onboarding & User Profiles

### `POST /api/onboarding`

Create or update a user profile.

**Request Body:**
```json
{
  "user_id": "user123",
  "risk_score": 50,
  "horizon": "medium",
  "knowledge": 1
}
```

**Response:** `UserProfile`
```json
{
  "user_id": "user123",
  "risk_score": 50,
  "horizon": "medium",
  "knowledge": 1,
  "goals_brief": "",
  "created_at": "2026-03-21T10:00:00",
  "updated_at": "2026-03-21T10:00:00"
}
```

### `GET /api/user/{user_id}/profile`

Get a user's profile.

**Errors:** `404` if user not found.

### `GET /api/user/{user_id}/chat-history`

**Query Params:** `limit` (int, default 20, max 100)

### `POST /api/onboarding/voice`

Conversational onboarding turn (non-stream fallback).

**Request Body:**
```json
{
  "user_id": "user123",
  "message": "I'm Tin and I can take moderate risk"
}
```

**Response:** `VoiceOnboardingResponse`

### `POST /api/onboarding/voice/stream`

Streaming conversational onboarding turn (SSE).

**Request Body:**
```json
{
  "user_id": "user123",
  "message": "I prefer long-term investing"
}
```

**SSE events:**
- `{"type":"started"}`
- `{"type":"delta","delta":"partial assistant text"}`
- `{"type":"done","result":{...VoiceOnboardingResponse}}`
- `{"type":"error","message":"..."}` (on failure)

### `POST /api/onboarding/voice/reset?user_id={user_id}`

Reset onboarding voice conversation state for a user.

---

## Portfolio Import

### `POST /api/portfolio/import`

Import portfolio items. Three modes: `manual`, `mock`, `csv`.

**Request Body:**
```json
{
  "user_id": "user123",
  "mode": "manual",
  "items": [
    { "asset_type": "stock", "ticker": "FPT", "quantity": 100, "avg_cost": 85000 }
  ]
}
```

### `GET /api/user/{user_id}/portfolio`

Get a user's current portfolio.

---

## Intake (Conversational Goal Extraction)

### `POST /api/intake`

Conversational intake — max 2 follow-ups, then produces a `goals_brief`.

**Request Body:**
```json
{
  "user_id": "user123",
  "message": "I want to invest in Vietnamese tech stocks"
}
```

### `POST /api/intake/reset`

**Query Params:** `user_id` (string, required)

---

## Report Generation

### `POST /api/report/generate`

Run the agent pipeline to generate an investment report. Proxied to the Agent Server.

**Warning:** This endpoint can take 30-60 seconds to respond.

**Request Body:**
```json
{
  "user_id": "user123",
  "ticker": "FPT",
  "portfolio": [
    { "asset_type": "stock", "ticker": "FPT", "quantity": 100, "avg_cost": 85000 },
    { "asset_type": "stock", "ticker": "VCB", "quantity": 50, "avg_cost": 92000 }
  ]
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `user_id` | yes | Must have completed onboarding |
| `ticker` | no | Auto-inferred from intake goals or env default |
| `portfolio` | no | Portfolio holdings from mobile native storage. Passed to agent as context. |

**Response:** `ReportResponse`
```json
{
  "report_id": "rpt_abc123",
  "user_id": "user123",
  "ticker": "FPT",
  "decision": "BUY",
  "summary": "FPT shows strong momentum...",
  "full_report": "...",
  "agent_reasoning": { ... },
  "intake_brief": "User wants to invest in VN tech stocks"
}
```

**Errors:** `404` user not found, `503` agent server unavailable, `500` pipeline failure.

---

## Panel Discussion (Chat with the Team)

### `POST /api/report/chat`

Chat with the analyst team. Proxied to Agent Server.

**Request Body:**
```json
{
  "user_id": "user123",
  "message": "Why are you bullish on FPT?",
  "report_id": null
}
```

**Response:** `PanelChatResponse`
```json
{
  "user_id": "user123",
  "question": "Why are you bullish on FPT?",
  "agent_responses": [
    { "agent_role": "analyst", "agent_name": "Analyst", "response": "..." },
    { "agent_role": "researcher", "agent_name": "Researcher", "response": "..." },
    { "agent_role": "trader", "agent_name": "Trader", "response": "..." },
    { "agent_role": "advisor", "agent_name": "Advisor", "response": "..." }
  ],
  "memory_updates": ["risk_preference: user is interested in growth"]
}
```

---

## Report Regeneration

### `POST /api/report/regenerate`

Re-run report generation with the user's current context.

**Request Body:**
```json
{ "user_id": "user123", "report_id": null }
```

---

## General Chat

### `POST /api/chat`

Simplified chat — runs the full agent pipeline via Agent Server.

**Request Body:**
```json
{
  "user_id": "user123",
  "message": "Should I buy FPT?",
  "ticker": null
}
```

**Response:** `ChatResponse` with `specialist_insights[]`.

### `POST /api/chat/voice`

Same as `/api/chat` but returns audio (ElevenLabs TTS) if available.

---

## User Data

### `GET /api/user/{user_id}/memories`
### `GET /api/user/{user_id}/reports`

**Query Params:** `limit` (int, default 10, max 50)

### `GET /api/user/{user_id}/tickers/{ticker}/reports`

List all reports related to a ticker for a user (primary or related ticker match).

**Query Params:** `limit` (int, default 20, max 100)

**Response:**
```json
[
  {
    "report_id": "abc123",
    "user_id": "user123",
    "ticker": "TSLA",
    "decision": "SELL",
    "summary": "Short summary...",
    "intake_brief": "User asked about EV exposure",
    "created_at": "2026-03-21 11:22:33",
    "relation_type": "primary",
    "relation_reason": ""
  }
]
```

---

## Market Data

### `GET /api/market-data`

**Query Params:** `tickers` (comma-separated, default `"VCB,FPT,VNM,TPB"`)

---

## Heartbeat Alerts

### `GET /api/heartbeat/alerts`
### `POST /api/heartbeat/trigger`

**Query Params:** `scenario` (required), `user_id` (default `"broadcast"`)

---

## OpenAI-Compatible Completions

### `POST /v1/chat/completions`

OpenAI-compatible endpoint. Proxied to Agent Server with empty context (backward compat).

Supports SSE streaming.

---

## Data Sources

The agent pipeline supports multiple data vendors, configured via environment variables:

| Vendor | Env Var | Provides |
|--------|---------|----------|
| **yfinance** (default) | — | Stock prices, fundamentals, news |
| **alpha_vantage** | `ALPHA_VANTAGE_API_KEY` | Stock prices, fundamentals, news |
| **financial_datasets** | `FINANCIAL_DATASETS_API_KEY` | Stock prices, fundamentals (no technical indicators) |
| **exa.ai** | `EXA_API_KEY` | Web search for news and social sentiment (additive to existing tools) |

Exa.ai tools are automatically added to news and social media analysts when `EXA_API_KEY` is set.

---

## Recommended Flow

```
1. Start servers:     finly-agent-server and finly-backend-api
2. POST /api/onboarding          → Create user profile
3. POST /api/portfolio/import    → Import portfolio (mock for demo)
4. POST /api/intake              → Conversational goal extraction (1-3 calls)
5. POST /api/report/generate     → Generate investment report (30-60s)
                                    optionally pass portfolio from mobile
6. POST /api/report/chat         → Chat with analyst team (repeatable)
7. POST /api/report/regenerate   → Re-generate with updated context
```

---

## Notes

- **No auth** — `user_id` is passed by the client (hackathon mode)
- **CORS** — all origins allowed
- **Auto-docs** — Swagger UI at `GET /docs`, ReDoc at `GET /redoc` (both servers)
- **Portfolio** — lives in mobile native storage, passed in requests, not stored server-side
- **Agent Server** — stateless, zero DB dependency, can be scaled independently
