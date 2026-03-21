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

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

from tradingagents.default_config import DEFAULT_CONFIG
from tradingagents.graph.trading_graph import TradingAgentsGraph

from finly_agents.models import (
    AgentPanelMessage,
    ChatRequest,
    ChatResponse,
    HeartbeatAlert,
    IntakeRequest,
    IntakeResponse,
    MarketTicker,
    OnboardingRequest,
    PanelChatRequest,
    PanelChatResponse,
    PortfolioImportRequest,
    PortfolioResponse,
    ReportGenerateRequest,
    ReportRegenerateRequest,
    ReportResponse,
    SpecialistInsight,
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

DEFAULT_ANALYSTS = ["market", "social", "news", "fundamentals"]
TICKER_PATTERN = re.compile(r"\b\$?([A-Z]{2,6})\b")
DATE_PATTERN = re.compile(r"\b(\d{4}-\d{2}-\d{2})\b")


# ---------------------------------------------------------------------------
# Existing OpenAI-compatible models
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
        if value not in {"BUY", "SELL", "HOLD", "USD", "VND", "JSON", "POST", "GET"}:
            return value
    return None


def _extract_trade_date(text: str) -> str | None:
    match = DATE_PATTERN.search(text)
    return match.group(1) if match else None


def _build_graph(model_name: str, selected_analysts: list[str]) -> TradingAgentsGraph:
    config = DEFAULT_CONFIG.copy()
    config["deep_think_llm"] = model_name
    config["quick_think_llm"] = model_name
    config["max_debate_rounds"] = int(os.getenv("FINLY_MAX_DEBATE_ROUNDS", "1"))
    config["max_risk_discuss_rounds"] = int(os.getenv("FINLY_MAX_RISK_ROUNDS", "1"))
    config["data_vendors"] = {
        "core_stock_apis": os.getenv("FINLY_VENDOR_CORE_STOCK", "yfinance"),
        "technical_indicators": os.getenv("FINLY_VENDOR_TECHNICAL", "yfinance"),
        "fundamental_data": os.getenv("FINLY_VENDOR_FUNDAMENTAL", "yfinance"),
        "news_data": os.getenv("FINLY_VENDOR_NEWS", "yfinance"),
    }
    return TradingAgentsGraph(debug=False, config=config, selected_analysts=selected_analysts)


def _run_finly_agents(
    request: ChatCompletionsRequest,
    user_context: str = "",
) -> dict[str, Any]:
    if not request.messages:
        raise HTTPException(status_code=400, detail="messages is required")

    prompt_text = _extract_last_user_text(request.messages)
    ticker = (request.ticker or _extract_ticker(prompt_text) or os.getenv("FINLY_DEFAULT_TICKER") or "FPT").upper()
    trade_date = request.trade_date or _extract_trade_date(prompt_text) or date.today().isoformat()

    selected_analysts = request.selected_analysts or DEFAULT_ANALYSTS
    model_name = os.getenv("FINLY_AGENT_MODEL", "openai/gpt-4.1-mini")

    graph = _build_graph(model_name=model_name, selected_analysts=selected_analysts)
    final_state, decision = graph.propagate(ticker, trade_date, user_context=user_context)

    final_report = final_state.get("final_trade_decision", "")
    content = (
        f"Ticker: {ticker}\n"
        f"Trade date: {trade_date}\n"
        f"Decision: {str(decision).strip()}\n\n"
        f"Final report:\n{final_report}"
    ).strip()

    return {
        "ticker": ticker,
        "trade_date": trade_date,
        "decision": str(decision).strip(),
        "content": content,
        "final_state": final_state,
    }


def _truncate_sentences(text: str, max_sentences: int = 3) -> str:
    if not text:
        return ""
    sentences = re.split(r'(?<=[.!?])\s+', str(text))
    return " ".join(sentences[:max_sentences])


def _extract_specialist_insights(final_state: dict) -> list[SpecialistInsight]:
    insights = []

    # Analyst — combines fundamentals + sentiment
    analyst_parts = []
    for key in ("fundamentals_report", "sentiment_report"):
        text = final_state.get(key, "")
        if text:
            analyst_parts.append(text)
    if analyst_parts:
        combined = "\n\n".join(analyst_parts)
        insights.append(SpecialistInsight(
            role="analyst",
            summary=_truncate_sentences(combined, 3),
            full_analysis=combined,
        ))

    # Researcher — news
    news = final_state.get("news_report", "")
    if news:
        insights.append(SpecialistInsight(
            role="researcher",
            summary=_truncate_sentences(news, 3),
            full_analysis=news,
        ))

    # Trader — market/technical
    market = final_state.get("market_report", "")
    if market:
        insights.append(SpecialistInsight(
            role="trader",
            summary=_truncate_sentences(market, 3),
            full_analysis=market,
        ))

    # Advisor — final trade decision (synthesises everything)
    ftd = final_state.get("final_trade_decision", "")
    if ftd:
        insights.append(SpecialistInsight(
            role="advisor",
            summary=_truncate_sentences(ftd, 3),
            full_analysis=ftd,
        ))

    return insights


def _extract_agent_reasoning(final_state: dict) -> dict:
    """Extract per-agent reasoning into a structured dict for storage."""
    return {
        "market_report": final_state.get("market_report", ""),
        "fundamentals_report": final_state.get("fundamentals_report", ""),
        "news_report": final_state.get("news_report", ""),
        "sentiment_report": final_state.get("sentiment_report", ""),
        "investment_debate": {
            "bull_case": final_state.get("investment_debate_state", {}).get("bull_history", ""),
            "bear_case": final_state.get("investment_debate_state", {}).get("bear_history", ""),
            "judge_decision": final_state.get("investment_debate_state", {}).get("judge_decision", ""),
        },
        "risk_debate": {
            "aggressive": final_state.get("risk_debate_state", {}).get("aggressive_history", ""),
            "conservative": final_state.get("risk_debate_state", {}).get("conservative_history", ""),
            "neutral": final_state.get("risk_debate_state", {}).get("neutral_history", ""),
            "judge_decision": final_state.get("risk_debate_state", {}).get("judge_decision", ""),
        },
        "trader_plan": final_state.get("trader_investment_plan", ""),
        "investment_plan": final_state.get("investment_plan", ""),
    }


def _split_chunks(text: str, chunk_size: int = 120) -> list[str]:
    return [text[i : i + chunk_size] for i in range(0, len(text), chunk_size)] or [""]


def _sse_data(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="Finly Agents API", version="0.2.0")

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
def healthz() -> dict:
    """Health check — verifies DB connectivity and returns server info."""
    db_ok = True
    try:
        from finly_agents.database import get_db
        with get_db() as conn:
            conn.execute("SELECT 1")
    except Exception:
        db_ok = False

    status = "ok" if db_ok else "degraded"
    return {
        "status": status,
        "version": app.version,
        "database": "connected" if db_ok else "error",
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
# OpenAI-compatible chat completions (existing)
# ---------------------------------------------------------------------------

@app.post("/v1/chat/completions")
async def chat_completions(request: ChatCompletionsRequest):
    created = int(time.time())
    completion_id = f"chatcmpl-{uuid.uuid4().hex}"

    try:
        result = await asyncio.to_thread(_run_finly_agents, request)
    except Exception as e:
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

    assistant_text = result["content"]

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
async def onboarding(req: OnboardingRequest) -> UserProfile:
    return create_or_update_profile(req)


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
    """Conversational intake — max 2 follow-ups, then produces goals brief."""
    from finly_agents.intake import run_intake

    result = await run_intake(req.user_id, req.message)
    return IntakeResponse(**result)


@app.post("/api/intake/reset")
async def intake_reset(user_id: str = Query(...)):
    """Reset intake conversation to start fresh."""
    from finly_agents.intake import reset_intake
    reset_intake(user_id)
    return {"status": "ok", "message": "Intake conversation reset"}


# ---------------------------------------------------------------------------
# Report generation
# ---------------------------------------------------------------------------

@app.post("/api/report/generate")
async def report_generate(req: ReportGenerateRequest) -> ReportResponse:
    """Generate investment report using the 4-agent pipeline.

    Incorporates user profile, portfolio, goals brief, and memories as context.
    """
    from finly_agents.context import build_user_context

    user = get_user(req.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found. Complete onboarding first.")

    user_context = build_user_context(req.user_id)
    goals_brief = user.get("goals_brief", "")

    # Determine ticker
    ticker = req.ticker
    if not ticker and goals_brief:
        ticker = _extract_ticker(goals_brief)
    if not ticker:
        ticker = os.getenv("FINLY_DEFAULT_TICKER", "FPT")
    ticker = ticker.upper()

    # Build internal request
    internal_req = ChatCompletionsRequest(
        messages=[Message(role="user", content=f"Analyze {ticker} for investment")],
        ticker=ticker,
    )

    try:
        result = await asyncio.to_thread(_run_finly_agents, internal_req, user_context)
    except Exception as e:
        logger.exception("Report generation failed")
        raise HTTPException(status_code=500, detail=str(e))

    final_state = result.get("final_state", {})
    agent_reasoning = _extract_agent_reasoning(final_state)
    summary = _truncate_sentences(result.get("content", ""), 5)
    full_report = final_state.get("final_trade_decision", result.get("content", ""))

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

    # Record in chat history
    append_chat(req.user_id, "assistant", f"Report generated for {ticker}: {summary}")

    return ReportResponse(
        report_id=report["id"],
        user_id=req.user_id,
        ticker=result["ticker"],
        decision=result["decision"],
        summary=summary,
        full_report=full_report,
        agent_reasoning=agent_reasoning,
        intake_brief=goals_brief,
    )


# ---------------------------------------------------------------------------
# Panel discussion (chat with the team)
# ---------------------------------------------------------------------------

@app.post("/api/report/chat")
async def report_chat(req: PanelChatRequest) -> PanelChatResponse:
    """Chat with the team — Analyst, Researcher, Trader, and Advisor respond individually."""
    from finly_agents.panel import run_panel_discussion

    result = await run_panel_discussion(
        user_id=req.user_id,
        message=req.message,
        report_id=req.report_id,
    )

    return PanelChatResponse(
        user_id=result["user_id"],
        question=result["question"],
        agent_responses=[AgentPanelMessage(**r) for r in result["agent_responses"]],
        memory_updates=result.get("memory_updates", []),
    )


# ---------------------------------------------------------------------------
# Report regeneration
# ---------------------------------------------------------------------------

@app.post("/api/report/regenerate")
async def report_regenerate(req: ReportRegenerateRequest) -> ReportResponse:
    """Regenerate report with updated user context (profile, memories, etc.)."""
    # Get the previous report to know the ticker
    previous = get_latest_report(req.user_id)
    if not previous:
        raise HTTPException(status_code=404, detail="No previous report found. Generate one first.")

    ticker = previous.get("ticker", os.getenv("FINLY_DEFAULT_TICKER", "FPT"))

    # Regenerate with current user context (which may have been updated via panel chat)
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
# Simplified chat endpoint (updated with context)
# ---------------------------------------------------------------------------

@app.post("/api/chat")
async def api_chat(req: ChatRequest):
    """Simplified chat — returns structured ChatResponse with specialist insights."""
    from finly_agents.context import build_user_context
    from finly_agents.memory import extract_and_store_memories

    append_chat(req.user_id, "user", req.message)

    ticker = req.ticker or _extract_ticker(req.message) or os.getenv("FINLY_DEFAULT_TICKER", "FPT")
    ticker = ticker.upper()

    user_context = build_user_context(req.user_id)

    internal_req = ChatCompletionsRequest(
        messages=[Message(role="user", content=req.message)],
        ticker=ticker,
    )

    try:
        result = await asyncio.to_thread(_run_finly_agents, internal_req, user_context)
    except Exception as e:
        logger.exception("Agent pipeline failed in /api/chat")
        return JSONResponse(status_code=500, content={"error": str(e)})

    final_state = result.get("final_state", {})
    insights = _extract_specialist_insights(final_state)
    summary = _truncate_sentences(result.get("content", ""), 5)

    response = ChatResponse(
        ticker=result["ticker"],
        decision=result["decision"],
        summary=summary,
        specialist_insights=insights,
        full_report=final_state.get("final_trade_decision", result.get("content", "")),
    )

    append_chat(req.user_id, "assistant", response.summary)

    # Extract memories in background
    try:
        await extract_and_store_memories(req.user_id, req.message, response.summary)
    except Exception:
        pass

    return response


# ---------------------------------------------------------------------------
# Voice chat endpoint (updated with context)
# ---------------------------------------------------------------------------

@app.post("/api/chat/voice")
async def api_chat_voice(req: ChatRequest):
    """Chat + ElevenLabs TTS audio response. Falls back to JSON if TTS unavailable."""
    from finly_agents.context import build_user_context

    append_chat(req.user_id, "user", req.message)

    ticker = req.ticker or _extract_ticker(req.message) or os.getenv("FINLY_DEFAULT_TICKER", "FPT")
    ticker = ticker.upper()

    user_context = build_user_context(req.user_id)

    internal_req = ChatCompletionsRequest(
        messages=[Message(role="user", content=req.message)],
        ticker=ticker,
    )

    try:
        result = await asyncio.to_thread(_run_finly_agents, internal_req, user_context)
    except Exception as e:
        logger.exception("Agent pipeline failed in /api/chat/voice")
        return JSONResponse(status_code=500, content={"error": str(e)})

    final_state = result.get("final_state", {})
    insights = _extract_specialist_insights(final_state)
    summary = _truncate_sentences(result.get("content", ""), 5)

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
        full_report=final_state.get("final_trade_decision", result.get("content", "")),
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
