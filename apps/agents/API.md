# Finly Agents API Reference

**Base URL:** `http://localhost:8000`
**Version:** 0.2.0

---

## Health & System

### `GET /healthz`

Health check — verifies DB connectivity.

**Response:**
```json
{
  "status": "ok",           // "ok" | "degraded"
  "version": "0.2.0",
  "database": "connected"   // "connected" | "error"
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

## Onboarding & User Profiles

### `POST /api/onboarding`

Create or update a user profile.

**Request Body:**
```json
{
  "user_id": "user123",           // required — string
  "risk_score": 50,               // optional — int 0-100, default 50
  "horizon": "medium",            // optional — "short" | "medium" | "long", default "medium"
  "knowledge": 1                  // optional — int 1-3, default 1
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

**Path Params:** `user_id` (string)

**Response:** `UserProfile` (same shape as above)

**Errors:** `404` if user not found.

### `GET /api/user/{user_id}/chat-history`

Get a user's chat history.

**Path Params:** `user_id` (string)
**Query Params:** `limit` (int, default 20, max 100)

**Response:**
```json
[
  { "role": "user", "content": "Analyze FPT", "timestamp": "2026-03-21T10:00:00" },
  { "role": "assistant", "content": "Report generated...", "timestamp": "2026-03-21T10:00:05" }
]
```

---

## Portfolio Import

### `POST /api/portfolio/import`

Import portfolio items. Three modes available.

**Request Body:**
```json
{
  "user_id": "user123",           // required
  "mode": "manual",               // required — "manual" | "mock" | "csv"
  "items": [                      // required for "manual" mode
    {
      "asset_type": "stock",      // optional — "stock" | "crypto", default "stock"
      "ticker": "FPT",            // required
      "quantity": 100,             // optional — float, default 0
      "avg_cost": 85000,          // optional — float, default 0
      "wallet_address": null      // optional — for crypto only
    }
  ],
  "csv_data": null                // required for "csv" mode — raw CSV string
}
```

**Mode details:**
- `"mock"` — auto-fills a demo portfolio based on user's risk score (conservative/moderate/aggressive). No `items` or `csv_data` needed.
- `"csv"` — parses `csv_data` string. Expected CSV columns: `ticker`, `quantity`, `avg_cost`.
- `"manual"` — uses the `items` array directly.

**Response:** `PortfolioResponse`
```json
{
  "user_id": "user123",
  "items": [
    { "asset_type": "stock", "ticker": "FPT", "quantity": 100.0, "avg_cost": 85000.0, "wallet_address": null }
  ]
}
```

### `GET /api/user/{user_id}/portfolio`

Get a user's current portfolio.

**Path Params:** `user_id` (string)

**Response:** `PortfolioResponse` (same shape as above)

---

## Intake (Conversational Goal Extraction)

### `POST /api/intake`

Conversational intake — the AI asks up to 2 follow-up questions to understand the user's investment goals, then produces a `goals_brief`.

Call this endpoint multiple times in a back-and-forth conversation.

**Request Body:**
```json
{
  "user_id": "user123",           // required
  "message": "I want to invest in Vietnamese tech stocks"  // required
}
```

**Response:** `IntakeResponse`
```json
{
  "user_id": "user123",
  "message": "What's your target return timeframe?",  // assistant's reply or final brief
  "is_complete": false,           // true when intake is done
  "follow_up_count": 1,          // how many follow-ups so far (max 2)
  "goals_brief": null             // populated when is_complete=true
}
```

**Flow:**
1. User sends first message → AI asks follow-up #1
2. User responds → AI asks follow-up #2 (or completes)
3. User responds → AI completes with `is_complete: true` and `goals_brief`
4. `goals_brief` is auto-saved to user profile and used in report generation

### `POST /api/intake/reset`

Reset the intake conversation to start over.

**Query Params:** `user_id` (string, required)

**Response:**
```json
{ "status": "ok", "message": "Intake conversation reset" }
```

---

## Report Generation

### `POST /api/report/generate`

Run the 4-agent pipeline to generate an investment report. This is the core endpoint — it runs market, fundamentals, news, and sentiment analysts, followed by bull/bear debate and risk debate.

**Warning:** This endpoint can take 30-60 seconds to respond.

**Request Body:**
```json
{
  "user_id": "user123",           // required — must have completed onboarding
  "ticker": "FPT"                 // optional — if null, inferred from intake goals or defaults to env var
}
```

**Response:** `ReportResponse`
```json
{
  "report_id": "rpt_abc123",
  "user_id": "user123",
  "ticker": "FPT",
  "decision": "BUY",             // "BUY" | "HOLD" | "SELL"
  "summary": "FPT shows strong momentum...",
  "full_report": "...",           // complete trade decision text
  "agent_reasoning": {
    "market_report": "Technical analysis shows RSI at...",
    "fundamentals_report": "P/E ratio of 12.5 suggests...",
    "news_report": "Recent government tech policy...",
    "sentiment_report": "Social sentiment is bullish...",
    "investment_debate": {
      "bull_case": "...",
      "bear_case": "...",
      "judge_decision": "..."
    },
    "risk_debate": {
      "aggressive": "...",
      "conservative": "...",
      "neutral": "...",
      "judge_decision": "..."
    },
    "trader_plan": "...",
    "investment_plan": "..."
  },
  "intake_brief": "User wants to invest in VN tech stocks for long-term growth"
}
```

**Errors:** `404` if user not found, `500` if pipeline fails.

---

## Panel Discussion (Chat with the Team)

### `POST /api/report/chat`

Chat with the analyst team after a report is generated. All 4 agents (Analyst, Researcher, Trader, Advisor) respond individually to the user's question.

**Request Body:**
```json
{
  "user_id": "user123",           // required
  "message": "Why are you bullish on FPT?",  // required
  "report_id": null               // optional — references a specific report
}
```

**Response:** `PanelChatResponse`
```json
{
  "user_id": "user123",
  "question": "Why are you bullish on FPT?",
  "agent_responses": [
    {
      "agent_role": "analyst",
      "agent_name": "Analyst",
      "response": "FPT's financials look solid and investor mood is positive."
    },
    {
      "agent_role": "researcher",
      "agent_name": "Researcher",
      "response": "Recent government tech policy is a tailwind for FPT."
    },
    {
      "agent_role": "trader",
      "agent_name": "Trader",
      "response": "Charts show an uptrend — could be a good entry point."
    },
    {
      "agent_role": "advisor",
      "agent_name": "Advisor",
      "response": "Given your moderate risk profile, a small position in FPT looks reasonable."
    }
  ],
  "memory_updates": ["risk_preference: user is interested in growth"]
}
```

**Notes:**
- Panel chat also extracts memories from the conversation (e.g., if the user says "I'm more aggressive", risk score auto-adjusts by +15).
- Requires a report to exist — returns a system message if no report found.

---

## Report Regeneration

### `POST /api/report/regenerate`

Re-run report generation with the user's current context. Use this after the user has refined their preferences via panel chat.

**Request Body:**
```json
{
  "user_id": "user123",           // required
  "report_id": null               // optional — regenerates from latest if null
}
```

**Response:** `ReportResponse` (same shape as `/api/report/generate`)

**Errors:** `404` if no previous report exists.

---

## General Chat

### `POST /api/chat`

Simplified chat endpoint — runs the full agent pipeline and returns a structured response.

**Request Body:**
```json
{
  "user_id": "user123",           // optional — default "anonymous"
  "message": "Should I buy FPT?", // required
  "ticker": null,                  // optional — auto-extracted from message if null
  "stream": false                  // optional — not used in this endpoint
}
```

**Response:** `ChatResponse`
```json
{
  "ticker": "FPT",
  "decision": "BUY",
  "summary": "FPT shows strong momentum with...",
  "specialist_insights": [
    { "role": "analyst", "summary": "Financials solid, sentiment positive.", "full_analysis": "..." },
    { "role": "researcher", "summary": "Government tech policy is a tailwind.", "full_analysis": "..." },
    { "role": "trader", "summary": "Charts show an uptrend.", "full_analysis": "..." },
    { "role": "advisor", "summary": "Small position looks reasonable for your profile.", "full_analysis": "..." }
  ],
  "full_report": "..."
}
```

### `POST /api/chat/voice`

Same as `/api/chat` but returns audio (ElevenLabs TTS) if available.

**Request Body:** Same as `/api/chat`.

**Response:**
- If TTS succeeds: `audio/mpeg` binary stream with headers `X-Finly-Ticker` and `X-Finly-Decision`
- If TTS unavailable: Falls back to `ChatResponse` JSON (same as `/api/chat`)

**Requires:** `ELEVENLABS_API_KEY` and `OPENAI_API_KEY` in `.env`.

---

## User Data

### `GET /api/user/{user_id}/memories`

Get stored memories/preferences for a user.

**Path Params:** `user_id` (string)

**Response:**
```json
[
  { "memory_key": "risk_preference", "memory_value": "aggressive growth investor", "updated_at": "..." },
  { "memory_key": "sector_interest", "memory_value": "Vietnamese tech stocks", "updated_at": "..." }
]
```

### `GET /api/user/{user_id}/reports`

Get report history for a user.

**Path Params:** `user_id` (string)
**Query Params:** `limit` (int, default 10, max 50)

**Response:**
```json
[
  {
    "id": "rpt_abc123",
    "ticker": "FPT",
    "decision": "BUY",
    "summary": "...",
    "created_at": "2026-03-21T10:00:00"
  }
]
```

---

## Market Data

### `GET /api/market-data`

Get mock market data for tickers.

**Query Params:** `tickers` (comma-separated string, default `"VCB,FPT,VNM,TPB"`)

**Response:**
```json
[
  { "ticker": "FPT", "price": 86500, "change_pct": 1.76, "currency": "VND" },
  { "ticker": "VCB", "price": 92300, "change_pct": -0.54, "currency": "VND" }
]
```

---

## Heartbeat Alerts

### `GET /api/heartbeat/alerts`

Get pending alerts for a user.

**Query Params:** `user_id` (string, default `"broadcast"`)

**Response:**
```json
[
  {
    "alert_id": "alert_001",
    "timestamp": "2026-03-21T08:00:00",
    "ticker": "FPT",
    "alert_type": "price_spike",
    "headline": "FPT surges 5%",
    "body": "...",
    "attributed_to": "market_analyst",
    "severity": "high"
  }
]
```

### `POST /api/heartbeat/trigger`

Manually trigger a heartbeat alert.

**Query Params:**
- `scenario` (string, required) — alert scenario to trigger
- `user_id` (string, default `"broadcast"`)

**Response:** Single `HeartbeatAlert` object (same shape as above).

**Errors:** `400` if scenario is invalid.

---

## OpenAI-Compatible Completions

### `POST /v1/chat/completions`

OpenAI-compatible chat completions endpoint. Runs the full agent pipeline.

**Request Body:**
```json
{
  "model": "finly-agents-v1",     // optional
  "messages": [
    { "role": "user", "content": "Analyze FPT" }
  ],
  "stream": false,                // optional — supports SSE streaming
  "ticker": "FPT",               // optional — auto-extracted if null
  "trade_date": "2026-03-21",    // optional — defaults to today
  "selected_analysts": ["market", "social", "news", "fundamentals"]  // optional
}
```

**Response (non-streaming):**
```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1711000000,
  "model": "finly-agents-v1",
  "choices": [
    {
      "index": 0,
      "message": { "role": "assistant", "content": "Ticker: FPT\nDecision: BUY\n..." },
      "finish_reason": "stop"
    }
  ]
}
```

**Response (streaming):** Server-Sent Events (SSE) with `chat.completion.chunk` objects, terminated by `data: [DONE]`.

---

## Recommended Flow

```
1. POST /api/onboarding          → Create user profile
2. POST /api/portfolio/import    → Import portfolio (mock for demo)
3. POST /api/intake              → Conversational goal extraction (1-3 calls)
4. POST /api/report/generate     → Generate investment report (30-60s)
5. POST /api/report/chat         → Chat with analyst team (repeatable)
6. POST /api/report/regenerate   → Re-generate with updated context
```

---

## Notes

- **No auth** — `user_id` is passed by the client (hackathon mode)
- **CORS** — all origins allowed
- **Auto-docs** — FastAPI auto-generates Swagger UI at `GET /docs` and ReDoc at `GET /redoc`
