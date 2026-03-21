"""Finly Backend API Server — user data, DB, and proxying to the Agent Server.

This server handles user profiles, portfolio, reports storage, chat history,
memories, and heartbeat alerts. It proxies agent pipeline and panel chat
requests to the stateless Agent Server via agent_client.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import time
import uuid
from datetime import date
from typing import Any

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

from finly_agents import agent_client
from finly_agents.agent_client import AgentServerUnavailable
from finly_agents.models import (
    AgentPanelMessage,
    ChatRequest,
    ChatResponse,
    HeartbeatAlert,
    IntakeRequest,
    IntakeResponse,
    MarketTicker,
    OnboardingRequest,
    OnboardingResponse,
    PanelChatRequest,
    PanelChatResponse,
    PortfolioImportRequest,
    PortfolioResponse,
    ReportGenerateRequest,
    ReportRegenerateRequest,
    ReportResponse,
    SpecialistInsight,
    TickerSuggestion,
    UserProfile,
)
from finly_agents.database import (
    init_db,
    get_user,
    get_reports,
    get_latest_report,
    save_report,
)
from finly_agents.profiles import (
    append_chat,
    create_or_update_profile,
    get_chat_history,
    get_profile,
)
from finly_agents.heartbeat import (
    get_pending_alerts,
    seed_demo_alerts,
    trigger_alert,
)

load_dotenv()

logger = logging.getLogger("finly_agents")

TICKER_PATTERN = re.compile(r"\b\$?([A-Z]{2,6})\b")
DATE_PATTERN = re.compile(r"\b(\d{4}-\d{2}-\d{2})\b")


# ---------------------------------------------------------------------------
# OpenAI-compatible models (kept for backward compat)
# ---------------------------------------------------------------------------

class Message(BaseModel):
    role: str
    content: Any


class ChatCompletionsRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    model: str = Field(default="finly-agents-v1")
    messages: list[Message]
    stream: bool = False
    ticker: str | None = None
    trade_date: str | None = None
    selected_analysts: list[str] | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _flatten_content(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict):
                text = item.get("text")
                if isinstance(text, str):
                    parts.append(text)
            elif isinstance(item, str):
                parts.append(item)
        return "\n".join(parts)
    return str(content)


def _extract_last_user_text(messages: list[Message]) -> str:
    for message in reversed(messages):
        if message.role == "user":
            return _flatten_content(message.content)
    return _flatten_content(messages[-1].content) if messages else ""


def _extract_ticker(text: str) -> str | None:
    for match in TICKER_PATTERN.finditer(text):
        value = match.group(1)
        if value not in {
            "BUY", "SELL", "HOLD", "USD", "VND", "JSON", "POST", "GET",
            "THE", "AND", "FOR", "NOT", "WITH", "FROM", "THAT", "THIS",
            "TRADER", "ANALYST", "ADVISOR", "RESEARCHER", "MARKET",
            "RISK", "HIGH", "LOW", "MEDIUM", "TERM", "ESG", "ETF",
        }:
            return value
    return None


def _extract_trade_date(text: str) -> str | None:
    match = DATE_PATTERN.search(text)
    return match.group(1) if match else None


async def _discover_tickers(goals: str, user_context: str = "") -> list[dict]:
    """Use LLM to discover multiple tickers to analyze based on user goals.

    Returns a list of dicts: [{"ticker": "ICLN", "reason": "..."}, ...]
    The first one is the primary pick for deep analysis.
    """
    if not goals:
        return [{"ticker": "SPY", "reason": "Broad market index — good default starting point"}]

    api_key = os.getenv("OPENROUTER_API_KEY", "")
    model = os.getenv("FINLY_INTAKE_MODEL", os.getenv("FINLY_AGENT_MODEL", "openai/gpt-4.1-mini"))
    base_url = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")

    prompt = f"""You are a financial research assistant. Based on the user's investment goals below,
recommend 3-5 stock or ETF tickers that match their interests, ranked by relevance.

USER GOALS: {goals}

{f"USER CONTEXT: {user_context}" if user_context else ""}

Rules:
- Return a JSON array of objects: [{{"ticker": "ICLN", "reason": "Top green energy ETF with broad clean energy exposure"}}]
- Pick real, actively traded US stocks or ETFs
- Diversify across different approaches (e.g., an ETF + individual stocks, different sub-sectors)
- First pick should be the strongest match for deep analysis
- Keep reasons to 1 short sentence
- Return ONLY the JSON array, nothing else"""

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.4,
                    "max_tokens": 300,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"].strip()
            # Parse JSON array from response
            json_match = re.search(r'\[.*\]', content, re.DOTALL)
            if json_match:
                tickers = json.loads(json_match.group())
                # Clean up tickers
                cleaned = []
                for t in tickers[:5]:
                    symbol = re.sub(r"[^A-Z]", "", t.get("ticker", "").upper())[:5]
                    if symbol:
                        cleaned.append({"ticker": symbol, "reason": t.get("reason", "")})
                if cleaned:
                    logger.info(f"Discovered {len(cleaned)} tickers from goals: {[t['ticker'] for t in cleaned]}")
                    return cleaned
    except Exception as e:
        logger.warning(f"Ticker discovery failed: {e}")

    return [{"ticker": "SPY", "reason": "Broad market index — good default starting point"}]


def _truncate_sentences(text: str, max_sentences: int = 3) -> str:
    if not text:
        return ""
    sentences = re.split(r'(?<=[.!?])\s+', str(text))
    return " ".join(sentences[:max_sentences])


def _format_portfolio_summary(portfolio: list[dict] | None) -> str:
    """Format portfolio items from mobile into a summary string for the agent."""
    if not portfolio:
        return ""
    lines = []
    for item in portfolio:
        ticker = item.get("ticker", "?")
        qty = item.get("quantity", 0)
        avg_cost = item.get("avg_cost", 0)
        asset_type = item.get("asset_type", "stock")
        line = f"- {ticker} ({asset_type}): {qty} shares @ {avg_cost}"
        lines.append(line)
    return "\n".join(lines) if lines else "No holdings"


def _split_chunks(text: str, chunk_size: int = 120) -> list[str]:
    return [text[i : i + chunk_size] for i in range(0, len(text), chunk_size)] or [""]


def _sse_data(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="Finly Agents API", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    init_db()
    seed_demo_alerts()
    logger.info("Finly Agents API started — DB initialised, demo alerts seeded")


# ---------------------------------------------------------------------------
# Health & models
# ---------------------------------------------------------------------------

@app.get("/healthz")
async def healthz() -> dict:
    """Health check — verifies DB connectivity and agent server reachability."""
    db_ok = True
    try:
        from finly_agents.database import get_db
        with get_db() as conn:
            conn.execute("SELECT 1")
    except Exception:
        db_ok = False

    agent_ok = await agent_client.check_agent_health()

    status = "ok" if (db_ok and agent_ok) else "degraded"
    return {
        "status": status,
        "version": app.version,
        "database": "connected" if db_ok else "error",
        "agent_server": "connected" if agent_ok else "unreachable",
    }


@app.get("/v1/models")
def list_models() -> dict[str, Any]:
    now = int(time.time())
    return {
        "object": "list",
        "data": [
            {
                "id": "finly-agents-v1",
                "object": "model",
                "created": now,
                "owned_by": "finly",
            }
        ],
    }


# ---------------------------------------------------------------------------
# OpenAI-compatible chat completions (backward compat)
# ---------------------------------------------------------------------------

@app.post("/v1/chat/completions")
async def chat_completions(request: ChatCompletionsRequest):
    created = int(time.time())
    completion_id = f"chatcmpl-{uuid.uuid4().hex}"

    if not request.messages:
        raise HTTPException(status_code=400, detail="messages is required")

    prompt_text = _extract_last_user_text(request.messages)
    ticker = (request.ticker or _extract_ticker(prompt_text) or os.getenv("FINLY_DEFAULT_TICKER") or "FPT").upper()
    trade_date = request.trade_date or _extract_trade_date(prompt_text) or date.today().isoformat()
    selected_analysts = request.selected_analysts or ["market", "social", "news", "fundamentals"]

    try:
        result = await agent_client.call_pipeline(
            ticker=ticker,
            trade_date=trade_date,
            selected_analysts=selected_analysts,
        )
    except (AgentServerUnavailable, Exception) as e:
        logger.exception("Agent pipeline failed")
        return JSONResponse(
            status_code=200,
            content={
                "id": completion_id,
                "object": "chat.completion",
                "created": created,
                "model": request.model,
                "choices": [
                    {
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": f"I encountered an error analyzing this request. Please try again. Error: {e}",
                        },
                        "finish_reason": "stop",
                    }
                ],
            },
        )

    assistant_text = result.get("content", "")

    if not request.stream:
        return JSONResponse(
            {
                "id": completion_id,
                "object": "chat.completion",
                "created": created,
                "model": request.model,
                "choices": [
                    {
                        "index": 0,
                        "message": {"role": "assistant", "content": assistant_text},
                        "finish_reason": "stop",
                    }
                ],
            }
        )

    async def event_stream():
        yield _sse_data(
            {
                "id": completion_id,
                "object": "chat.completion.chunk",
                "created": created,
                "model": request.model,
                "choices": [{"index": 0, "delta": {"role": "assistant"}, "finish_reason": None}],
            }
        )

        for part in _split_chunks(assistant_text):
            yield _sse_data(
                {
                    "id": completion_id,
                    "object": "chat.completion.chunk",
                    "created": created,
                    "model": request.model,
                    "choices": [{"index": 0, "delta": {"content": part}, "finish_reason": None}],
                }
            )

        yield _sse_data(
            {
                "id": completion_id,
                "object": "chat.completion.chunk",
                "created": created,
                "model": request.model,
                "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
            }
        )
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ---------------------------------------------------------------------------
# Onboarding & user profiles
# ---------------------------------------------------------------------------

@app.post("/api/onboarding")
async def onboarding(req: OnboardingRequest) -> OnboardingResponse:
    import base64

    from finly_agents.voice import text_to_speech

    profile = create_or_update_profile(req)
    welcome = (
        f"Welcome to Finly! I've set up your profile. "
        f"You're a {req.horizon}-term investor with a risk score of {req.risk_score}. "
        f"Let's figure out what you'd like to invest in. "
        f"Tell me about your investment goals or a stock you're interested in."
    )
    resp = OnboardingResponse(profile=profile, welcome_message=welcome)

    audio_bytes = await text_to_speech(welcome)
    if audio_bytes:
        resp.audio_b64 = base64.b64encode(audio_bytes).decode("ascii")

    return resp


@app.get("/api/user/{user_id}/profile")
async def user_profile(user_id: str):
    profile = get_profile(user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")
    return profile


@app.get("/api/user/{user_id}/chat-history")
async def user_chat_history(user_id: str, limit: int = Query(default=20, le=100)):
    return get_chat_history(user_id, limit=limit)


# ---------------------------------------------------------------------------
# Portfolio import
# ---------------------------------------------------------------------------

@app.post("/api/portfolio/import")
async def portfolio_import(req: PortfolioImportRequest) -> PortfolioResponse:
    """Import portfolio — modes: mock, csv, manual."""
    from finly_agents.portfolio import import_portfolio

    items_dicts = [item.model_dump() for item in req.items] if req.items else None
    result = import_portfolio(
        user_id=req.user_id,
        mode=req.mode,
        items=items_dicts,
        csv_data=req.csv_data,
    )
    return PortfolioResponse(user_id=req.user_id, items=result)


@app.get("/api/user/{user_id}/portfolio")
async def user_portfolio(user_id: str):
    from finly_agents.database import get_portfolio
    items = get_portfolio(user_id)
    return PortfolioResponse(user_id=user_id, items=items)


# ---------------------------------------------------------------------------
# Intake conversation (goal extraction)
# ---------------------------------------------------------------------------

@app.post("/api/intake")
async def intake_endpoint(req: IntakeRequest) -> IntakeResponse:
    """Conversational intake — max 2 follow-ups, then produces goals brief.

    Returns audio_b64 (base64 mp3) alongside text when ElevenLabs is configured.
    """
    import base64

    from finly_agents.intake import run_intake
    from finly_agents.voice import text_to_speech

    result = await run_intake(req.user_id, req.message)
    resp = IntakeResponse(**result)

    # Generate TTS for the assistant reply
    audio_bytes = await text_to_speech(resp.message)
    if audio_bytes:
        resp.audio_b64 = base64.b64encode(audio_bytes).decode("ascii")

    return resp


@app.post("/api/intake/reset")
async def intake_reset(user_id: str = Query(...)):
    """Reset intake conversation to start fresh."""
    from finly_agents.intake import reset_intake
    reset_intake(user_id)
    return {"status": "ok", "message": "Intake conversation reset"}


# ---------------------------------------------------------------------------
# Report generation (proxied to agent server)
# ---------------------------------------------------------------------------

@app.post("/api/report/generate")
async def report_generate(req: ReportGenerateRequest) -> ReportResponse:
    """Generate investment report using the agent pipeline.

    Builds user_context from DB, optionally accepts portfolio from mobile,
    then proxies to the Agent Server.
    """
    from finly_agents.context import build_user_context

    user = get_user(req.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found. Complete onboarding first.")

    user_context = build_user_context(req.user_id)
    goals_brief = user.get("goals_brief", "")

    # Portfolio: prefer mobile-provided portfolio, fall back to DB
    portfolio_summary = ""
    if req.portfolio:
        portfolio_summary = _format_portfolio_summary(req.portfolio)

    # Determine tickers — agents discover investments based on goals
    additional_tickers: list[dict] = []
    ticker = req.ticker
    if not ticker and goals_brief:
        ticker = _extract_ticker(goals_brief)  # check if user mentioned one explicitly
    if not ticker:
        ticker = os.getenv("FINLY_DEFAULT_TICKER", "")
    if not ticker:
        # Let the LLM research and recommend tickers for the user's goals
        discovered = await _discover_tickers(goals_brief, user_context)
        ticker = discovered[0]["ticker"]
        additional_tickers = discovered[1:]  # remaining as suggestions
    ticker = ticker.upper()

    try:
        result = await agent_client.call_pipeline(
            ticker=ticker,
            trade_date=date.today().isoformat(),
            user_context=user_context,
            portfolio_summary=portfolio_summary,
        )
    except AgentServerUnavailable as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.exception("Report generation failed")
        raise HTTPException(status_code=500, detail=str(e))

    agent_reasoning = result.get("agent_reasoning", {})
    summary = result.get("summary", "")
    full_report = result.get("content", "")
    specialist_insights = result.get("specialist_insights", [])

    # Save to database
    report = save_report(
        user_id=req.user_id,
        ticker=result["ticker"],
        decision=result["decision"],
        summary=summary,
        full_report=full_report,
        agent_reasoning=agent_reasoning,
        intake_brief=goals_brief,
    )

    append_chat(req.user_id, "assistant", f"Report generated for {ticker}: {summary}")

    return ReportResponse(
        report_id=report["id"],
        user_id=req.user_id,
        ticker=result["ticker"],
        decision=result["decision"],
        summary=summary,
        full_report=full_report,
        agent_reasoning=agent_reasoning,
        specialist_insights=specialist_insights,
        additional_tickers=additional_tickers,
        intake_brief=goals_brief,
    )


# ---------------------------------------------------------------------------
# Panel discussion (proxied to agent server)
# ---------------------------------------------------------------------------

@app.post("/api/report/chat")
async def report_chat(req: PanelChatRequest) -> PanelChatResponse:
    """Chat with the team — proxied to Agent Server's panel-chat endpoint."""
    from finly_agents.context import build_user_context
    from finly_agents.database import (
        append_conversation,
        get_conversation_history,
    )

    report = get_latest_report(req.user_id)
    if not report:
        return PanelChatResponse(
            user_id=req.user_id,
            question=req.message,
            agent_responses=[
                AgentPanelMessage(
                    agent_role="system",
                    agent_name="Finly",
                    response="No report has been generated yet. Please generate a report first.",
                )
            ],
            memory_updates=[],
        )

    user_context = build_user_context(req.user_id)
    conversation_history = get_conversation_history(req.user_id, conv_type="panel", limit=20)

    # Record user message
    append_conversation(req.user_id, "panel", "user", req.message)

    # Build report_data for the agent server
    report_data = {
        "agent_reasoning": report.get("agent_reasoning", {}),
        "summary": report.get("summary", ""),
    }

    try:
        agent_responses = await agent_client.call_panel_chat(
            message=req.message,
            report_data=report_data,
            user_context=user_context,
            conversation_history=conversation_history,
        )
    except AgentServerUnavailable as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.exception("Panel chat failed")
        raise HTTPException(status_code=500, detail=str(e))

    # Record each agent's response in DB
    for resp in agent_responses:
        append_conversation(
            req.user_id, "panel", "assistant", resp["response"], agent_role=resp["agent_role"]
        )

    # Extract memories (fire and forget)
    memory_updates = []
    try:
        from finly_agents.memory import extract_and_store_memories

        combined_response = "\n".join(
            f"[{r['agent_name']}]: {r['response']}" for r in agent_responses
        )
        memory_updates = await extract_and_store_memories(req.user_id, req.message, combined_response)
    except Exception as e:
        logger.warning(f"Memory extraction in panel failed: {e}")

    return PanelChatResponse(
        user_id=req.user_id,
        question=req.message,
        agent_responses=[AgentPanelMessage(**r) for r in agent_responses],
        memory_updates=memory_updates or [],
    )


# ---------------------------------------------------------------------------
# Report regeneration
# ---------------------------------------------------------------------------

@app.post("/api/report/regenerate")
async def report_regenerate(req: ReportRegenerateRequest) -> ReportResponse:
    """Regenerate report with updated user context."""
    previous = get_latest_report(req.user_id)
    if not previous:
        raise HTTPException(status_code=404, detail="No previous report found. Generate one first.")

    ticker = previous.get("ticker", os.getenv("FINLY_DEFAULT_TICKER", "FPT"))

    gen_req = ReportGenerateRequest(user_id=req.user_id, ticker=ticker)
    return await report_generate(gen_req)


# ---------------------------------------------------------------------------
# User memories
# ---------------------------------------------------------------------------

@app.get("/api/user/{user_id}/memories")
async def user_memories(user_id: str):
    from finly_agents.database import get_memories
    return get_memories(user_id)


@app.get("/api/user/{user_id}/reports")
async def user_reports(user_id: str, limit: int = Query(default=10, le=50)):
    return get_reports(user_id, limit=limit)


# ---------------------------------------------------------------------------
# Simplified chat endpoint (proxied to agent server)
# ---------------------------------------------------------------------------

@app.post("/api/chat")
async def api_chat(req: ChatRequest):
    """Simplified chat — proxies to agent pipeline and returns structured response."""
    from finly_agents.context import build_user_context
    from finly_agents.memory import extract_and_store_memories

    append_chat(req.user_id, "user", req.message)

    ticker = req.ticker or _extract_ticker(req.message) or os.getenv("FINLY_DEFAULT_TICKER", "FPT")
    ticker = ticker.upper()

    user_context = build_user_context(req.user_id)

    try:
        result = await agent_client.call_pipeline(
            ticker=ticker,
            trade_date=date.today().isoformat(),
            user_context=user_context,
        )
    except AgentServerUnavailable as e:
        return JSONResponse(status_code=503, content={"error": str(e)})
    except Exception as e:
        logger.exception("Agent pipeline failed in /api/chat")
        return JSONResponse(status_code=500, content={"error": str(e)})

    insights = [SpecialistInsight(**i) for i in result.get("specialist_insights", [])]
    summary = result.get("summary", "")

    response = ChatResponse(
        ticker=result["ticker"],
        decision=result["decision"],
        summary=summary,
        specialist_insights=insights,
        full_report=result.get("content", ""),
    )

    append_chat(req.user_id, "assistant", response.summary)

    try:
        await extract_and_store_memories(req.user_id, req.message, response.summary)
    except Exception:
        pass

    return response


# ---------------------------------------------------------------------------
# Voice chat endpoint (proxied to agent server)
# ---------------------------------------------------------------------------

@app.post("/api/chat/voice")
async def api_chat_voice(req: ChatRequest):
    """Chat + ElevenLabs TTS audio response. Falls back to JSON if TTS unavailable."""
    from finly_agents.context import build_user_context

    append_chat(req.user_id, "user", req.message)

    ticker = req.ticker or _extract_ticker(req.message) or os.getenv("FINLY_DEFAULT_TICKER", "FPT")
    ticker = ticker.upper()

    user_context = build_user_context(req.user_id)

    try:
        result = await agent_client.call_pipeline(
            ticker=ticker,
            trade_date=date.today().isoformat(),
            user_context=user_context,
        )
    except AgentServerUnavailable as e:
        return JSONResponse(status_code=503, content={"error": str(e)})
    except Exception as e:
        logger.exception("Agent pipeline failed in /api/chat/voice")
        return JSONResponse(status_code=500, content={"error": str(e)})

    insights = [SpecialistInsight(**i) for i in result.get("specialist_insights", [])]
    summary = result.get("summary", "")

    append_chat(req.user_id, "assistant", summary)

    from finly_agents.voice import text_to_speech

    audio_bytes = await text_to_speech(summary)
    if audio_bytes:
        return StreamingResponse(
            iter([audio_bytes]),
            media_type="audio/mpeg",
            headers={"X-Finly-Ticker": result["ticker"], "X-Finly-Decision": result["decision"]},
        )

    return ChatResponse(
        ticker=result["ticker"],
        decision=result["decision"],
        summary=summary,
        specialist_insights=insights,
        full_report=result.get("content", ""),
    )


# ---------------------------------------------------------------------------
# Market data
# ---------------------------------------------------------------------------

@app.get("/api/market-data")
async def market_data(tickers: str = Query(default="VCB,FPT,VNM,TPB")):
    from finly_agents.mock_data import _BASE_PRICES, _clean

    import random

    results: list[dict] = []
    for raw_ticker in tickers.split(","):
        raw_ticker = raw_ticker.strip().upper()
        clean = _clean(raw_ticker)
        if clean in _BASE_PRICES:
            base = _BASE_PRICES[clean]
            random.seed(hash(clean + date.today().isoformat()) % 2**31)
            change_pct = round(random.uniform(-3.0, 4.0), 2)
            price = round(base * (1 + change_pct / 100))
            results.append(
                MarketTicker(
                    ticker=clean, price=price, change_pct=change_pct, currency="VND",
                ).model_dump()
            )
        else:
            results.append(
                MarketTicker(
                    ticker=raw_ticker, price=0.0, change_pct=0.0, currency="USD",
                ).model_dump()
            )
    return results


# ---------------------------------------------------------------------------
# Heartbeat alerts
# ---------------------------------------------------------------------------

@app.get("/api/heartbeat/alerts")
async def heartbeat_alerts(user_id: str = Query(default="broadcast")):
    alerts = get_pending_alerts(user_id)
    return [a.model_dump() for a in alerts]


@app.post("/api/heartbeat/trigger")
async def heartbeat_trigger(scenario: str = Query(...), user_id: str = Query(default="broadcast")):
    try:
        alert = trigger_alert(scenario, user_id)
        return alert.model_dump()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

def run() -> None:
    import uvicorn

    host = os.getenv("FINLY_AGENTS_HOST", "0.0.0.0")
    port = int(os.getenv("FINLY_AGENTS_PORT", "8000"))
    uvicorn.run("finly_agents.server:app", host=host, port=port, reload=False)


if __name__ == "__main__":
    run()
