"""Finly Backend API Server — user data, DB, and proxying to the Agent Server.

This server handles user profiles, portfolio, reports storage, chat history,
memories, and heartbeat alerts. It proxies agent pipeline and panel chat
requests to the stateless Agent Server via agent_client.
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
import uuid
import asyncio
from datetime import date, timedelta
from typing import Any
from urllib.parse import urlparse

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

from finly_backend import agent_client
from finly_backend.agent_client import AgentServerUnavailable
from finly_backend.models import (
    AgentPanelMessage,
    ChatRequest,
    ChatResponse,
    IntakeRequest,
    IntakeResponse,
    MarketTicker,
    MarketTickerProfile,
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
    TickerNewsInsightRequest,
    TickerNewsItem,
    TickerNewsResponse,
    VoiceOnboardingProfile,
    VoiceOnboardingRequest,
    VoiceOnboardingResponse,
    TickerReportListItem,
    HeartbeatAnalyzeRequest,
    HeartbeatRuleCreateRequest,
    HeartbeatRuleResponse,
    HeartbeatResultResponse,
)
from finly_backend.database import (
    init_db,
    get_user,
    upsert_user,
    get_report,
    get_reports,
    get_reports_for_ticker,
    get_latest_report,
    save_report,
    get_portfolio,
    create_heartbeat_rule,
    get_heartbeat_rules,
    delete_heartbeat_rule,
    toggle_heartbeat_rule,
    save_heartbeat_result,
    get_heartbeat_results,
    mark_heartbeat_result_read,
    get_heartbeat_unread_count,
)
from finly_backend.profiles import (
    append_chat,
    create_or_update_profile,
    get_chat_history,
    get_profile,
)
from finly_backend.heartbeat import start_heartbeat_scheduler

load_dotenv()

logger = logging.getLogger("finly_backend")

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
            "BUY",
            "SELL",
            "HOLD",
            "USD",
            "VND",
            "JSON",
            "POST",
            "GET",
            "THE",
            "AND",
            "FOR",
            "NOT",
            "WITH",
            "FROM",
            "THAT",
            "THIS",
            "TRADER",
            "ANALYST",
            "ADVISOR",
            "RESEARCHER",
            "MARKET",
            "RISK",
            "HIGH",
            "LOW",
            "MEDIUM",
            "TERM",
            "ESG",
            "ETF",
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
        return [
            {
                "ticker": "SPY",
                "reason": "Broad market index — good default starting point",
            }
        ]

    api_key = os.getenv("OPENROUTER_API_KEY", "")
    model = os.getenv(
        "FINLY_INTAKE_MODEL", os.getenv("FINLY_AGENT_MODEL", "openai/gpt-4.1-mini")
    )
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
            json_match = re.search(r"\[.*\]", content, re.DOTALL)
            if json_match:
                tickers = json.loads(json_match.group())
                # Clean up tickers
                cleaned = []
                for t in tickers[:5]:
                    symbol = re.sub(r"[^A-Z]", "", t.get("ticker", "").upper())[:5]
                    if symbol:
                        cleaned.append(
                            {"ticker": symbol, "reason": t.get("reason", "")}
                        )
                if cleaned:
                    logger.info(
                        f"Discovered {len(cleaned)} tickers from goals: {[t['ticker'] for t in cleaned]}"
                    )
                    return cleaned
    except Exception as e:
        logger.warning(f"Ticker discovery failed: {e}")

    return [
        {"ticker": "SPY", "reason": "Broad market index — good default starting point"}
    ]


def _truncate_sentences(text: str, max_sentences: int = 3) -> str:
    if not text:
        return ""
    sentences = re.split(r"(?<=[.!?])\s+", str(text))
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


_VALID_AGENTS = {"analyst", "researcher", "trader", "advisor"}


def _parse_target_agents(message: str) -> list[str]:
    """Extract @specialist tags from a message. Returns ["advisor"] if none found."""
    tags = re.findall(r"@(\w+)", message.lower())
    agents = [t for t in tags if t in _VALID_AGENTS]
    return agents if agents else ["advisor"]


def _select_news_insight_agent(title: str, summary: str) -> str:
    text = f"{title} {summary}".lower()

    risk_keywords = (
        "downgrade",
        "lawsuit",
        "investigation",
        "antitrust",
        "fine",
        "miss",
        "weak",
        "cut guidance",
        "fraud",
        "risk",
        "warning",
        "layoff",
        "recall",
    )
    trader_keywords = (
        "breakout",
        "technical",
        "momentum",
        "volatility",
        "support",
        "resistance",
        "rally",
        "plunge",
        "surge",
        "target price",
        "upgrade",
    )
    researcher_keywords = (
        "earnings",
        "revenue",
        "guidance",
        "ceo",
        "partnership",
        "launch",
        "product",
        "acquisition",
        "macro",
        "inflation",
        "regulation",
        "analyst day",
    )

    if any(keyword in text for keyword in risk_keywords):
        return "advisor"
    if any(keyword in text for keyword in trader_keywords):
        return "trader"
    if any(keyword in text for keyword in researcher_keywords):
        return "researcher"
    return "analyst"


def _agent_name(agent_role: str) -> str:
    names = {
        "advisor": "Advisor",
        "analyst": "Analyst",
        "researcher": "Researcher",
        "trader": "Trader",
    }
    return names.get(agent_role, "Advisor")


def _ticker_news_report_data(
    ticker: str,
    title: str,
    summary: str,
    source: str,
) -> dict[str, Any]:
    headline_context = (
        f"Ticker: {ticker}\n"
        f"Headline: {title}\n"
        f"Summary: {summary or 'No summary provided.'}\n"
        f"Source: {source or 'Unknown'}\n"
    )
    return {
        "summary": f"Latest ticker-news context for {ticker}",
        "agent_reasoning": {
            "fundamentals_report": headline_context,
            "sentiment_report": headline_context,
            "news_report": headline_context,
            "market_report": headline_context,
        },
    }


def _ticker_news_user_prompt(
    ticker: str,
    title: str,
    summary: str,
    url: str,
    source: str,
) -> str:
    return (
        "Give actionable insight for this ticker headline in plain language for a beginner "
        "investor. Keep it concise (2 short sentences): what it means now and what to watch next.\n\n"
        f"Ticker: {ticker}\n"
        f"Headline: {title}\n"
        f"Summary: {summary or 'No summary provided.'}\n"
        f"Source: {source or 'Unknown'}\n"
        f"URL: {url or 'N/A'}"
    )


async def _build_today_holdings_news_context(user_id: str, max_holdings: int = 8) -> str:
    """Build a compact same-day holdings-news summary for advisor context."""
    portfolio = get_portfolio(user_id)
    if not portfolio:
        return "TODAY HOLDINGS NEWS\n- No current holdings found."

    tickers: list[str] = []
    seen: set[str] = set()
    for item in portfolio:
        ticker = str(item.get("ticker", "")).strip().upper()
        if not ticker or ticker in seen:
            continue
        seen.add(ticker)
        tickers.append(ticker)
        if len(tickers) >= max_holdings:
            break

    if not tickers:
        return "TODAY HOLDINGS NEWS\n- No current holdings found."

    today = date.today().isoformat()

    async def latest_line_for_ticker(ticker: str) -> str:
        try:
            items = await _fetch_exa_ticker_news(ticker, lookback_days=1, limit=3)
        except Exception:
            items = []
        if not items:
            try:
                items = _fetch_yfinance_ticker_news(ticker, limit=3)
            except Exception:
                items = []

        if not items:
            return f"- {ticker}: no major headline today."

        headline = next((item for item in items if item.published_at.startswith(today)), None)
        if headline is None:
            headline = items[0]
        title = headline.title.strip() if headline.title else "No title available"
        source = headline.source.strip() if headline.source else "Unknown"
        return f"- {ticker}: {title} ({source})"

    lines = await asyncio.gather(*(latest_line_for_ticker(ticker) for ticker in tickers))
    return "TODAY HOLDINGS NEWS\n" + "\n".join(lines)



def _sse_data(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="Finly Backend API", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    init_db()
    start_heartbeat_scheduler()
    logger.info("Finly Backend API started — DB initialised, heartbeat scheduler started")


# ---------------------------------------------------------------------------
# Health & models
# ---------------------------------------------------------------------------


@app.get("/healthz")
async def healthz() -> dict:
    """Health check — verifies DB connectivity and agent server reachability."""
    db_ok = True
    try:
        from finly_backend.database import get_db

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
    ticker = (
        request.ticker
        or _extract_ticker(prompt_text)
        or os.getenv("FINLY_DEFAULT_TICKER")
        or "FPT"
    ).upper()
    trade_date = (
        request.trade_date
        or _extract_trade_date(prompt_text)
        or date.today().isoformat()
    )
    selected_analysts = request.selected_analysts or [
        "market",
        "social",
        "news",
        "fundamentals",
    ]

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
                "choices": [
                    {"index": 0, "delta": {"role": "assistant"}, "finish_reason": None}
                ],
            }
        )

        for part in _split_chunks(assistant_text):
            yield _sse_data(
                {
                    "id": completion_id,
                    "object": "chat.completion.chunk",
                    "created": created,
                    "model": request.model,
                    "choices": [
                        {"index": 0, "delta": {"content": part}, "finish_reason": None}
                    ],
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

    from finly_backend.voice import text_to_speech

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


# ---------------------------------------------------------------------------
# Voice onboarding (conversational profile extraction)
# ---------------------------------------------------------------------------


@app.post("/api/onboarding/voice")
async def onboarding_voice(req: VoiceOnboardingRequest) -> VoiceOnboardingResponse:
    """Conversational voice onboarding — extracts profile through natural dialogue.

    Accepts either audio_b64 (transcribed via Whisper) or message (text fallback).
    Set is_initial=true to get the greeting message without any user input.
    """
    import base64

    from finly_backend.onboarding_chat import (
        get_initial_greeting,
        run_onboarding_chat,
    )
    from finly_backend.voice import text_to_speech, transcribe_audio

    # Initial greeting — no user input needed
    if req.is_initial:
        greeting = get_initial_greeting()
        audio_bytes = await text_to_speech(greeting)
        audio_b64 = base64.b64encode(audio_bytes).decode("ascii") if audio_bytes else None
        return VoiceOnboardingResponse(
            user_id=req.user_id,
            message=greeting,
            audio_b64=audio_b64,
            is_complete=False,
            turn_count=0,
        )

    # Resolve user message: transcribe audio or use text
    transcript = None
    user_message = req.message

    try:
        if req.audio_b64 and not req.message:
            audio_bytes = base64.b64decode(req.audio_b64)
            transcript = await transcribe_audio(audio_bytes, req.audio_content_type)
            if not transcript:
                return VoiceOnboardingResponse(
                    user_id=req.user_id,
                    message="Sorry, I couldn't catch that. Could you try again?",
                    is_complete=False,
                    turn_count=0,
                )
            user_message = transcript

        if not user_message:
            raise HTTPException(status_code=400, detail="Either message or audio_b64 is required")

        # Run conversational onboarding
        result = await run_onboarding_chat(req.user_id, user_message)

        # Generate TTS for the response
        audio_bytes = await text_to_speech(result["message"])
        audio_b64 = base64.b64encode(audio_bytes).decode("ascii") if audio_bytes else None

        # Build profile if complete
        profile = None
        if result["is_complete"] and result.get("profile"):
            p = result["profile"]
            profile = VoiceOnboardingProfile(
                name=p.get("name"),
                risk=p.get("risk"),
                horizon=p.get("horizon"),
                knowledge=p.get("knowledge"),
            )

        return VoiceOnboardingResponse(
            user_id=req.user_id,
            message=result["message"],
            audio_b64=audio_b64,
            is_complete=result["is_complete"],
            turn_count=result["turn_count"],
            profile=profile,
            transcript=transcript,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Voice onboarding failed for user %s", req.user_id)
        return JSONResponse(
            status_code=500,
            content={"error": str(e)},
        )


@app.post("/api/onboarding/voice/stream")
async def onboarding_voice_stream(req: VoiceOnboardingRequest):
    """Streaming onboarding chat response for progressive text rendering in mobile UI."""
    import base64

    from finly_backend.onboarding_chat import (
        get_initial_greeting,
        run_onboarding_chat_stream,
    )
    from finly_backend.voice import transcribe_audio

    if not req.is_initial and not req.message and not req.audio_b64:
        raise HTTPException(status_code=400, detail="Either message or audio_b64 is required")

    async def event_stream():
        transcript = None
        try:
            if req.is_initial:
                greeting = get_initial_greeting()
                done_result = VoiceOnboardingResponse(
                    user_id=req.user_id,
                    message=greeting,
                    audio_b64=None,
                    is_complete=False,
                    turn_count=0,
                    profile=None,
                    transcript=None,
                )
                yield _sse_data({"type": "started"})
                yield _sse_data({"type": "delta", "delta": greeting})
                yield _sse_data({"type": "done", "result": done_result.model_dump()})
                yield "data: [DONE]\n\n"
                return

            user_message = req.message
            if req.audio_b64 and not req.message:
                audio_bytes = base64.b64decode(req.audio_b64)
                transcript = await transcribe_audio(audio_bytes, req.audio_content_type)
                if not transcript:
                    fallback = VoiceOnboardingResponse(
                        user_id=req.user_id,
                        message="Sorry, I couldn't catch that. Could you try again?",
                        audio_b64=None,
                        is_complete=False,
                        turn_count=0,
                        profile=None,
                        transcript=None,
                    )
                    yield _sse_data({"type": "started"})
                    yield _sse_data({"type": "delta", "delta": fallback.message})
                    yield _sse_data({"type": "done", "result": fallback.model_dump()})
                    yield "data: [DONE]\n\n"
                    return
                user_message = transcript

            async for event in run_onboarding_chat_stream(req.user_id, str(user_message)):
                event_type = str(event.get("type", "")).strip()
                if event_type == "started":
                    yield _sse_data({"type": "started"})
                    continue
                if event_type == "delta":
                    yield _sse_data({"type": "delta", "delta": str(event.get("delta", ""))})
                    continue
                if event_type == "done":
                    result = event.get("result") or {}
                    profile_data = result.get("profile")
                    profile = None
                    if isinstance(profile_data, dict):
                        profile = VoiceOnboardingProfile(
                            name=profile_data.get("name"),
                            risk=profile_data.get("risk"),
                            horizon=profile_data.get("horizon"),
                            knowledge=profile_data.get("knowledge"),
                        )
                    done_result = VoiceOnboardingResponse(
                        user_id=str(result.get("user_id", req.user_id)),
                        message=str(result.get("message", "")),
                        audio_b64=None,
                        is_complete=bool(result.get("is_complete", False)),
                        turn_count=int(result.get("turn_count", 0)),
                        profile=profile,
                        transcript=transcript,
                    )
                    yield _sse_data({"type": "done", "result": done_result.model_dump()})
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.exception("Voice onboarding stream failed for user %s", req.user_id)
            yield _sse_data({"type": "error", "message": str(e)})
            yield _sse_data({"type": "done"})
            yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.post("/api/onboarding/voice/upload")
async def onboarding_voice_upload(
    user_id: str = Form(...),
    audio: UploadFile = File(...),
) -> VoiceOnboardingResponse:
    """Voice onboarding via multipart audio file upload (used by mobile).

    Transcribes the audio via Whisper, then runs the conversational onboarding.
    """
    import base64

    from finly_backend.onboarding_chat import run_onboarding_chat
    from finly_backend.voice import text_to_speech, transcribe_audio

    audio_bytes = await audio.read()
    content_type = audio.content_type or "audio/m4a"

    transcript = await transcribe_audio(audio_bytes, content_type)
    if not transcript:
        return VoiceOnboardingResponse(
            user_id=user_id,
            message="Sorry, I couldn't catch that. Could you try again?",
            is_complete=False,
            turn_count=0,
        )

    result = await run_onboarding_chat(user_id, transcript)

    audio_resp = await text_to_speech(result["message"])
    audio_b64 = base64.b64encode(audio_resp).decode("ascii") if audio_resp else None

    profile = None
    if result["is_complete"] and result.get("profile"):
        p = result["profile"]
        profile = VoiceOnboardingProfile(
            name=p.get("name"),
            risk=p.get("risk"),
            horizon=p.get("horizon"),
            knowledge=p.get("knowledge"),
        )

    return VoiceOnboardingResponse(
        user_id=user_id,
        message=result["message"],
        audio_b64=audio_b64,
        is_complete=result["is_complete"],
        turn_count=result["turn_count"],
        profile=profile,
        transcript=transcript,
    )


@app.post("/api/onboarding/voice/reset")
async def onboarding_voice_reset(user_id: str = Query(...)):
    """Reset voice onboarding conversation to start fresh."""
    from finly_backend.onboarding_chat import reset_onboarding_chat

    reset_onboarding_chat(user_id)
    return {"status": "ok", "message": "Voice onboarding conversation reset"}


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
    from finly_backend.portfolio import import_portfolio

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
    from finly_backend.database import get_portfolio

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

    from finly_backend.intake import run_intake
    from finly_backend.voice import text_to_speech

    result = await run_intake(req.user_id, req.message)
    resp = IntakeResponse(**result)

    # Generate TTS for the assistant reply
    audio_bytes = await text_to_speech(resp.message)
    if audio_bytes:
        resp.audio_b64 = base64.b64encode(audio_bytes).decode("ascii")

    return resp


@app.post("/api/intake/stream")
async def intake_stream_endpoint(req: IntakeRequest):
    """Streaming intake response for progressive advisor text rendering."""
    from finly_backend.intake import run_intake_stream

    async def event_stream():
        try:
            async for event in run_intake_stream(req.user_id, req.message):
                event_type = str(event.get("type", "")).strip()
                if event_type == "started":
                    yield _sse_data({"type": "started"})
                elif event_type == "delta":
                    yield _sse_data({"type": "delta", "delta": str(event.get("delta", ""))})
                elif event_type == "done":
                    yield _sse_data({"type": "done", "result": event.get("result", {})})
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.exception("Intake stream failed")
            yield _sse_data({"type": "error", "message": str(e)})
            yield _sse_data({"type": "done"})
            yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.post("/api/intake/reset")
async def intake_reset(user_id: str = Query(...)):
    """Reset intake conversation to start fresh."""
    from finly_backend.intake import reset_intake

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
    from finly_backend.context import build_user_context

    user = get_user(req.user_id)
    if not user:
        raise HTTPException(
            status_code=404, detail="User not found. Complete onboarding first."
        )

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
        specialist_insights=specialist_insights,
        intake_brief=goals_brief,
        additional_tickers=additional_tickers,
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
    from finly_backend.context import build_user_context
    from finly_backend.database import (
        append_conversation,
        get_conversation_history,
    )

    report = (
        get_report(req.report_id, user_id=req.user_id)
        if req.report_id
        else get_latest_report(req.user_id)
    )
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

    target_agents = req.target_agents or _parse_target_agents(req.message)

    user_context = build_user_context(req.user_id)
    if "advisor" in target_agents:
        try:
            today_news_context = await _build_today_holdings_news_context(req.user_id)
            user_context = f"{user_context}\n\n{today_news_context}".strip()
        except Exception as exc:
            logger.warning(
                "Failed to build today holdings news context for user %s: %s",
                req.user_id,
                exc,
            )
    conversation_history = get_conversation_history(
        req.user_id,
        conv_type="panel",
        limit=20,
        metadata_filters={"report_id": report["id"]},
    )

    # Record user message
    append_conversation(
        req.user_id,
        "panel",
        "user",
        req.message,
        metadata={"report_id": report["id"]},
    )

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
            target_agents=target_agents,
        )
    except AgentServerUnavailable as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.exception("Panel chat failed")
        raise HTTPException(status_code=500, detail=str(e))

    # Record each agent's response in DB
    for resp in agent_responses:
        append_conversation(
            req.user_id,
            "panel",
            "assistant",
            resp["response"],
            agent_role=resp["agent_role"],
            metadata={"report_id": report["id"]},
        )

    # Extract memories (fire and forget)
    memory_updates = []
    try:
        from finly_backend.memory import extract_and_store_memories

        combined_response = "\n".join(
            f"[{r['agent_name']}]: {r['response']}" for r in agent_responses
        )
        memory_updates = await extract_and_store_memories(
            req.user_id, req.message, combined_response
        )
    except Exception as e:
        logger.warning(f"Memory extraction in panel failed: {e}")

    return PanelChatResponse(
        user_id=req.user_id,
        question=req.message,
        agent_responses=[AgentPanelMessage(**r) for r in agent_responses],
        memory_updates=memory_updates or [],
    )


@app.post("/api/report/chat/stream")
async def report_chat_stream(req: PanelChatRequest):
    """Stream panel-chat specialist responses for progressive UI rendering."""
    from finly_backend.context import build_user_context
    from finly_backend.database import append_conversation, get_conversation_history

    report = (
        get_report(req.report_id, user_id=req.user_id)
        if req.report_id
        else get_latest_report(req.user_id)
    )

    if not report:
        async def no_report_stream():
            message = "No report has been generated yet. Please generate a report first."
            fallback = {
                "agent_role": "system",
                "agent_name": "Finly",
                "response": message,
            }
            yield _sse_data({"type": "started"})
            yield _sse_data({"type": "agent_message_start", "message": fallback})
            for part in _split_chunks(message, chunk_size=60):
                yield _sse_data({"type": "agent_message_delta", "message": fallback, "delta": part})
            yield _sse_data({"type": "agent_message_done", "message": fallback})
            yield _sse_data({"type": "done"})
            yield "data: [DONE]\n\n"

        return StreamingResponse(no_report_stream(), media_type="text/event-stream")

    # Determine which specialists should respond.
    target_agents = req.target_agents or _parse_target_agents(req.message)

    user_context = build_user_context(req.user_id)
    if "advisor" in target_agents:
        try:
            today_news_context = await _build_today_holdings_news_context(req.user_id)
            user_context = f"{user_context}\n\n{today_news_context}".strip()
        except Exception as exc:
            logger.warning(
                "Failed to build today holdings news context for user %s: %s",
                req.user_id,
                exc,
            )
    conversation_history = get_conversation_history(
        req.user_id,
        conv_type="panel",
        limit=20,
        metadata_filters={"report_id": report["id"]},
    )

    append_conversation(
        req.user_id,
        "panel",
        "user",
        req.message,
        metadata={"report_id": report["id"]},
    )

    report_data = {
        "agent_reasoning": report.get("agent_reasoning", {}),
        "summary": report.get("summary", ""),
    }

    async def event_stream():
        yield _sse_data({"type": "started"})
        collected_responses: list[dict[str, str]] = []
        partial_text_by_role: dict[str, str] = {}

        try:
            async for event in agent_client.call_panel_chat_stream(
                message=req.message,
                report_data=report_data,
                user_context=user_context,
                conversation_history=conversation_history,
                target_agents=target_agents,
            ):
                event_type = str(event.get("type", "")).strip()
                if event_type in {"started", "done"}:
                    continue

                if event_type == "agent_response":
                    response = event.get("response") if isinstance(event.get("response"), dict) else {}
                    agent_role = str(response.get("agent_role", "")).strip() or "advisor"
                    agent_name = str(response.get("agent_name", "")).strip() or "Advisor"
                    response_text = str(response.get("response", "")).strip()
                    yield _sse_data(
                        {
                            "type": "agent_message_start",
                            "message": {
                                "agent_role": agent_role,
                                "agent_name": agent_name,
                                "response": "",
                            },
                        }
                    )
                    if response_text:
                        yield _sse_data(
                            {
                                "type": "agent_message_delta",
                                "message": {
                                    "agent_role": agent_role,
                                    "agent_name": agent_name,
                                    "response": "",
                                },
                                "delta": response_text,
                            }
                        )
                    final_message = {
                        "agent_role": agent_role,
                        "agent_name": agent_name,
                        "response": response_text,
                    }
                    yield _sse_data({"type": "agent_message_done", "message": final_message})
                    append_conversation(
                        req.user_id,
                        "panel",
                        "assistant",
                        response_text,
                        agent_role=agent_role,
                        metadata={"report_id": report["id"]},
                    )
                    collected_responses.append(final_message)
                    continue

                message = event.get("message") if isinstance(event.get("message"), dict) else {}
                agent_role = str(message.get("agent_role", "")).strip() or "advisor"
                agent_name = str(message.get("agent_name", "")).strip() or "Advisor"

                if event_type == "agent_message_start":
                    partial_text_by_role[agent_role] = ""
                    yield _sse_data(
                        {
                            "type": "agent_message_start",
                            "message": {
                                "agent_role": agent_role,
                                "agent_name": agent_name,
                                "response": "",
                            },
                        }
                    )
                    continue

                if event_type == "agent_message_delta":
                    delta = str(event.get("delta", ""))
                    if not delta:
                        continue
                    partial_text_by_role[agent_role] = (
                        f"{partial_text_by_role.get(agent_role, '')}{delta}"
                    )
                    yield _sse_data(
                        {
                            "type": "agent_message_delta",
                            "message": {
                                "agent_role": agent_role,
                                "agent_name": agent_name,
                                "response": "",
                            },
                            "delta": delta,
                        }
                    )
                    continue

                if event_type != "agent_message_done":
                    continue

                response_text = str(message.get("response", "")).strip()
                if not response_text:
                    response_text = partial_text_by_role.get(agent_role, "").strip()
                final_message = {
                    "agent_role": agent_role,
                    "agent_name": agent_name,
                    "response": response_text,
                }
                yield _sse_data({"type": "agent_message_done", "message": final_message})

                append_conversation(
                    req.user_id,
                    "panel",
                    "assistant",
                    response_text,
                    agent_role=agent_role,
                    metadata={"report_id": report["id"]},
                )
                collected_responses.append(final_message)
        except AgentServerUnavailable as e:
            yield _sse_data({"type": "error", "message": str(e)})
            yield _sse_data({"type": "done"})
            yield "data: [DONE]\n\n"
            return
        except Exception as e:
            logger.exception("Panel chat stream failed")
            yield _sse_data({"type": "error", "message": str(e)})
            yield _sse_data({"type": "done"})
            yield "data: [DONE]\n\n"
            return

        memory_updates: list[str] = []
        try:
            from finly_backend.memory import extract_and_store_memories

            combined_response = "\n".join(
                f"[{item['agent_name']}]: {item['response']}" for item in collected_responses
            )
            memory_updates = await extract_and_store_memories(
                req.user_id,
                req.message,
                combined_response,
            )
        except Exception as e:
            logger.warning(f"Memory extraction in panel stream failed: {e}")

        yield _sse_data({"type": "memory_updates", "memory_updates": memory_updates or []})
        yield _sse_data({"type": "done"})
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ---------------------------------------------------------------------------
# Report regeneration
# ---------------------------------------------------------------------------


@app.post("/api/report/regenerate")
async def report_regenerate(req: ReportRegenerateRequest) -> ReportResponse:
    """Regenerate report with updated user context."""
    previous = (
        get_report(req.report_id, user_id=req.user_id)
        if req.report_id
        else get_latest_report(req.user_id)
    )
    if not previous:
        raise HTTPException(
            status_code=404, detail="No previous report found. Generate one first."
        )

    ticker = previous.get("ticker", os.getenv("FINLY_DEFAULT_TICKER", "FPT"))

    gen_req = ReportGenerateRequest(user_id=req.user_id, ticker=ticker)
    return await report_generate(gen_req)


@app.get("/api/report/{report_id}")
async def report_detail(report_id: str, user_id: str = Query(...)) -> ReportResponse:
    report = get_report(report_id, user_id=user_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    return ReportResponse(
        report_id=report["id"],
        user_id=report["user_id"],
        ticker=report["ticker"],
        decision=report.get("decision", ""),
        summary=report.get("summary", ""),
        full_report=report.get("full_report", ""),
        agent_reasoning=report.get("agent_reasoning", {}),
        specialist_insights=report.get("specialist_insights", []),
        additional_tickers=report.get("additional_tickers", []),
        intake_brief=report.get("intake_brief", ""),
    )


@app.get("/api/report/{report_id}/panel-history")
async def report_panel_history(
    report_id: str,
    user_id: str = Query(...),
    limit: int = Query(default=50, le=200),
):
    from finly_backend.database import get_conversation_history

    report = get_report(report_id, user_id=user_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    return get_conversation_history(
        user_id,
        conv_type="panel",
        limit=limit,
        metadata_filters={"report_id": report_id},
    )


# ---------------------------------------------------------------------------
# User memories
# ---------------------------------------------------------------------------


@app.get("/api/user/{user_id}/memories")
async def user_memories(user_id: str):
    from finly_backend.database import get_memories

    return get_memories(user_id)


@app.get("/api/user/{user_id}/reports")
async def user_reports(user_id: str, limit: int = Query(default=10, le=50)):
    return get_reports(user_id, limit=limit)


@app.get("/api/user/{user_id}/tickers/{ticker}/reports")
async def user_ticker_reports(
    user_id: str,
    ticker: str,
    limit: int = Query(default=20, le=100),
) -> list[TickerReportListItem]:
    reports = get_reports_for_ticker(user_id, ticker, limit=limit)
    return [
        TickerReportListItem(
            report_id=report["id"],
            user_id=report["user_id"],
            ticker=report["ticker"],
            decision=report.get("decision", ""),
            summary=report.get("summary", ""),
            intake_brief=report.get("intake_brief", ""),
            created_at=report.get("created_at", ""),
            relation_type=report.get("related_ticker_relation_type", "primary"),
            relation_reason=report.get("related_ticker_reason", "") or "",
        )
        for report in reports
    ]


# ---------------------------------------------------------------------------
# Simplified chat endpoint (proxied to agent server)
# ---------------------------------------------------------------------------


@app.post("/api/chat")
async def api_chat(req: ChatRequest):
    """Simplified chat — proxies to agent pipeline and returns structured response."""
    from finly_backend.context import build_user_context
    from finly_backend.memory import extract_and_store_memories

    append_chat(req.user_id, "user", req.message)

    ticker = (
        req.ticker
        or _extract_ticker(req.message)
        or os.getenv("FINLY_DEFAULT_TICKER", "FPT")
    )
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
    from finly_backend.context import build_user_context

    append_chat(req.user_id, "user", req.message)

    ticker = (
        req.ticker
        or _extract_ticker(req.message)
        or os.getenv("FINLY_DEFAULT_TICKER", "FPT")
    )
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

    from finly_backend.voice import text_to_speech

    audio_bytes = await text_to_speech(summary)
    if audio_bytes:
        return StreamingResponse(
            iter([audio_bytes]),
            media_type="audio/mpeg",
            headers={
                "X-Finly-Ticker": result["ticker"],
                "X-Finly-Decision": result["decision"],
            },
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
    from finly_backend.mock_data import _BASE_PRICES, _clean, is_vn_ticker

    import random
    import yfinance as yf

    def _to_float(value: Any) -> float | None:
        try:
            number = float(value)
        except (TypeError, ValueError):
            return None
        if number != number:  # NaN guard
            return None
        return number

    def _fast_info_value(fast_info: Any, key: str) -> Any:
        if hasattr(fast_info, "get"):
            try:
                return fast_info.get(key)
            except Exception:
                pass
        try:
            return fast_info[key]
        except Exception:
            return None

    def _load_us_quote(symbol: str) -> MarketTicker | None:
        ticker = yf.Ticker(symbol)
        fast_info = ticker.fast_info

        price = _to_float(_fast_info_value(fast_info, "lastPrice")) or _to_float(
            _fast_info_value(fast_info, "regularMarketPrice")
        )
        previous_close = _to_float(_fast_info_value(fast_info, "previousClose")) or _to_float(
            _fast_info_value(fast_info, "regularMarketPreviousClose")
        )
        currency = str(_fast_info_value(fast_info, "currency") or "USD").upper()

        # `fast_info` can be incomplete; fall back to the latest daily candles.
        if price is None or previous_close is None:
            history = ticker.history(period="5d", interval="1d")
            close_series = history.get("Close")
            close_values = close_series.tolist() if close_series is not None else []
            closes = [_to_float(value) for value in close_values]
            closes = [value for value in closes if value is not None]
            if closes:
                price = price if price is not None else closes[-1]
                if previous_close is None:
                    previous_close = closes[-2] if len(closes) > 1 else closes[-1]

        if price is None:
            return None

        change_pct = 0.0
        if previous_close and previous_close != 0:
            change_pct = ((price - previous_close) / previous_close) * 100

        return MarketTicker(
            ticker=symbol,
            price=round(price, 2),
            change_pct=round(change_pct, 2),
            currency=currency,
        )

    results: list[dict] = []
    for raw_ticker in tickers.split(","):
        raw_ticker = raw_ticker.strip().upper()
        if not raw_ticker:
            continue
        clean = _clean(raw_ticker)
        if is_vn_ticker(clean) and clean in _BASE_PRICES:
            base = _BASE_PRICES[clean]
            random.seed(hash(clean + date.today().isoformat()) % 2**31)
            change_pct = round(random.uniform(-3.0, 4.0), 2)
            price = round(base * (1 + change_pct / 100))
            results.append(
                MarketTicker(
                    ticker=clean,
                    price=price,
                    change_pct=change_pct,
                    currency="VND",
                ).model_dump()
            )
        else:
            try:
                quote = _load_us_quote(clean)
            except Exception:
                logger.exception("Failed to fetch yfinance quote for %s", clean)
                quote = None

            # Skip symbols that cannot be resolved so the mobile client can use local fallback.
            if quote:
                results.append(quote.model_dump())
    return results


@app.get("/api/market-data/profile")
async def market_data_profile(ticker: str = Query(...)):
    import yfinance as yf

    symbol = ticker.strip().upper()
    if not symbol:
        raise HTTPException(status_code=400, detail="ticker is required")

    def _to_float(value: Any) -> float | None:
        try:
            number = float(value)
        except (TypeError, ValueError):
            return None
        if number != number:  # NaN guard
            return None
        return number

    def _text(value: Any) -> str | None:
        if value is None:
            return None
        normalized = str(value).strip()
        return normalized or None

    try:
        ticker_obj = yf.Ticker(symbol)
        info = ticker_obj.info or {}
        fast_info = ticker_obj.fast_info
    except Exception as exc:
        logger.exception("Failed to fetch yfinance profile for %s", symbol)
        raise HTTPException(status_code=502, detail=f"Failed to fetch profile for {symbol}") from exc

    market_cap = _to_float(info.get("marketCap"))
    currency = _text(info.get("currency"))
    exchange = _text(info.get("exchange"))

    if market_cap is None:
        try:
            market_cap = _to_float(fast_info.get("marketCap"))
        except Exception:
            market_cap = None

    if not currency:
        try:
            currency = _text(fast_info.get("currency"))
        except Exception:
            currency = None

    if not exchange:
        try:
            exchange = _text(fast_info.get("exchange"))
        except Exception:
            exchange = None

    summary = _text(info.get("longBusinessSummary"))
    if summary and len(summary) > 700:
        summary = f"{summary[:700].rstrip()}..."

    profile = MarketTickerProfile(
        ticker=symbol,
        short_name=_text(info.get("shortName")),
        long_name=_text(info.get("longName")),
        sector=_text(info.get("sector")),
        industry=_text(info.get("industry")),
        exchange=exchange,
        market_cap=market_cap,
        currency=currency,
        website=_text(info.get("website")),
        summary=summary,
    )
    return profile.model_dump()


def _extract_news_summary(item: dict[str, Any], max_len: int = 280) -> str:
    highlights = item.get("highlights")
    if isinstance(highlights, list):
        normalized = [str(value).strip() for value in highlights if str(value).strip()]
        if normalized:
            text = " ".join(normalized)
            return text if len(text) <= max_len else f"{text[:max_len].rstrip()}..."

    text = str(item.get("text", "")).strip()
    if not text:
        return ""
    return text if len(text) <= max_len else f"{text[:max_len].rstrip()}..."


async def _fetch_exa_ticker_news(
    ticker: str,
    lookback_days: int,
    limit: int,
) -> list[TickerNewsItem]:
    api_key = os.getenv("EXA_API_KEY", "").strip()
    if not api_key:
        return []

    end_date = date.today()
    start_date = end_date - timedelta(days=max(1, lookback_days))

    payload: dict[str, Any] = {
        "query": f"{ticker} stock market news analysis",
        "numResults": limit,
        "type": "neural",
        "category": "news",
        "startPublishedDate": f"{start_date.isoformat()}T00:00:00.000Z",
        "endPublishedDate": f"{end_date.isoformat()}T23:59:59.000Z",
        "contents": {
            "text": {"maxCharacters": 1000},
            "highlights": {"numSentences": 3},
        },
    }

    headers = {
        "x-api-key": api_key,
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post("https://api.exa.ai/search", headers=headers, json=payload)
            response.raise_for_status()
            results = response.json().get("results", [])
    except httpx.HTTPStatusError as e:
        status = e.response.status_code
        if status == 429:
            logger.warning("Exa rate limited for ticker %s; falling back to yfinance", ticker)
            return []
        logger.warning("Exa HTTP error %s for ticker %s; falling back to yfinance", status, ticker)
        return []
    except httpx.TimeoutException:
        logger.warning("Exa timeout for ticker %s; falling back to yfinance", ticker)
        return []
    except httpx.RequestError as e:
        logger.warning("Exa request error for ticker %s: %s; falling back to yfinance", ticker, e)
        return []

    news_items: list[TickerNewsItem] = []
    for raw in results[:limit]:
        title = str(raw.get("title", "")).strip()
        url = str(raw.get("url", "")).strip()
        if not title or not url:
            continue
        parsed = urlparse(url)
        source = parsed.netloc.replace("www.", "")
        published = str(raw.get("publishedDate", "")).strip()
        news_items.append(
            TickerNewsItem(
                title=title,
                url=url,
                published_at=published,
                summary=_extract_news_summary(raw),
                source=source,
            )
        )
    return news_items


def _yfinance_article_payload(article: dict[str, Any]) -> dict[str, Any]:
    content = article.get("content")
    if isinstance(content, dict):
        return content
    return article


def _fetch_yfinance_ticker_news(ticker: str, limit: int) -> list[TickerNewsItem]:
    import yfinance as yf

    stock = yf.Ticker(ticker)
    articles = stock.get_news(count=limit)
    if not articles:
        return []

    items: list[TickerNewsItem] = []
    for article in articles[:limit]:
        data = _yfinance_article_payload(article)
        title = str(data.get("title", "")).strip()
        url = str(data.get("link", "")).strip()
        if not title or not url:
            continue

        summary = str(data.get("summary", "")).strip()
        if not summary:
            summary = _extract_news_summary({"text": str(data.get("description", ""))})

        provider = data.get("provider")
        source = str(provider.get("displayName", "")).strip() if isinstance(provider, dict) else ""
        pub_date = data.get("pubDate") or data.get("providerPublishTime")
        published_at = str(pub_date or "").strip()

        items.append(
            TickerNewsItem(
                title=title,
                url=url,
                published_at=published_at,
                summary=summary,
                source=source,
            )
        )

    return items


@app.get("/api/ticker-news")
async def ticker_news(
    ticker: str = Query(..., min_length=1, max_length=12),
    limit: int = Query(default=6, ge=1, le=20),
    lookback_days: int = Query(default=7, ge=1, le=30),
) -> TickerNewsResponse:
    symbol = ticker.strip().upper()
    if not symbol:
        raise HTTPException(status_code=400, detail="ticker is required")

    try:
        exa_items = await _fetch_exa_ticker_news(symbol, lookback_days, limit)
        if exa_items:
            return TickerNewsResponse(ticker=symbol, source="exa", items=exa_items)
    except Exception:
        logger.exception("Failed to fetch Exa ticker news for %s", symbol)

    try:
        fallback_items = _fetch_yfinance_ticker_news(symbol, limit)
        return TickerNewsResponse(ticker=symbol, source="yfinance", items=fallback_items)
    except Exception:
        logger.exception("Failed to fetch yfinance ticker news for %s", symbol)
        return TickerNewsResponse(ticker=symbol, source="none", items=[])

@app.post("/api/ticker-news/insight/stream")
async def ticker_news_insight_stream(req: TickerNewsInsightRequest):
    """Stream a ticker-news insight from one selected specialist agent."""
    symbol = req.ticker.strip().upper()
    title = req.title.strip()
    summary = req.summary.strip()
    source = req.source.strip()
    url = req.url.strip()

    if not symbol:
        raise HTTPException(status_code=400, detail="ticker is required")
    if not title:
        raise HTTPException(status_code=400, detail="title is required")

    agent_role = _select_news_insight_agent(title, summary)
    agent_name = _agent_name(agent_role)
    report_data = _ticker_news_report_data(symbol, title, summary, source)
    message = _ticker_news_user_prompt(symbol, title, summary, url, source)

    async def event_stream():
        yield _sse_data(
            {"type": "started", "agent_role": agent_role, "agent_name": agent_name}
        )
        emitted_start = False
        final_text = ""
        try:
            async for event in agent_client.call_panel_chat_stream(
                message=message,
                report_data=report_data,
                user_context="",
                conversation_history=[],
                target_agents=[agent_role],
            ):
                event_type = str(event.get("type", "")).strip()
                if event_type == "agent_message_start" and not emitted_start:
                    emitted_start = True
                    yield _sse_data(
                        {
                            "type": "agent_message_start",
                            "message": {
                                "agent_role": agent_role,
                                "agent_name": agent_name,
                                "response": "",
                            },
                        }
                    )
                    continue
                if event_type == "agent_message_delta":
                    delta = str(event.get("delta", ""))
                    final_text += delta
                    yield _sse_data(
                        {
                            "type": "agent_message_delta",
                            "message": {
                                "agent_role": agent_role,
                                "agent_name": agent_name,
                                "response": "",
                            },
                            "delta": delta,
                        }
                    )
                elif event_type == "agent_message_done":
                    response = str(event.get("message", {}).get("response", "")).strip() or final_text
                    if response:
                        final_text = response
                elif event_type == "error":
                    raise RuntimeError(str(event.get("message", "agent stream failed")))

            if not emitted_start:
                yield _sse_data(
                    {
                        "type": "agent_message_start",
                        "message": {
                            "agent_role": agent_role,
                            "agent_name": agent_name,
                            "response": "",
                        },
                    }
                )
            if not final_text:
                final_text = "I couldn't finish analysis for this headline. Check source details and price action before deciding."
            yield _sse_data(
                {
                    "type": "agent_message_done",
                    "message": {
                        "agent_role": agent_role,
                        "agent_name": agent_name,
                        "response": final_text,
                    },
                }
            )
            yield _sse_data({"type": "done"})
            yield "data: [DONE]\n\n"
        except Exception:
            logger.exception("Ticker news insight stream failed for %s", symbol)
            fallback = (
                "I hit a temporary issue generating the insight. Focus on headline impact, "
                "upcoming earnings, and risk exposure before changing position size."
            )
            if not emitted_start:
                yield _sse_data(
                    {
                        "type": "agent_message_start",
                        "message": {
                            "agent_role": agent_role,
                            "agent_name": agent_name,
                            "response": "",
                        },
                    }
                )
            yield _sse_data(
                {
                    "type": "agent_message_delta",
                    "message": {
                        "agent_role": agent_role,
                        "agent_name": agent_name,
                        "response": "",
                    },
                    "delta": fallback,
                }
            )
            yield _sse_data(
                {
                    "type": "agent_message_done",
                    "message": {
                        "agent_role": agent_role,
                        "agent_name": agent_name,
                        "response": fallback,
                    },
                }
            )
            yield _sse_data({"type": "error", "message": "ticker-news insight failed"})
            yield _sse_data({"type": "done"})
            yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ---------------------------------------------------------------------------
# Heartbeat analysis
# ---------------------------------------------------------------------------


@app.post("/api/heartbeat/analyze")
async def heartbeat_analyze(req: HeartbeatAnalyzeRequest):
    """One-shot portfolio risk analysis — streams results via SSE."""
    from finly_backend.context import build_user_context

    # Heartbeat results table has FK -> users(user_id). Ensure the user row exists.
    upsert_user(req.user_id)

    tickers = req.tickers
    if not tickers:
        # Get tickers from user's portfolio
        portfolio = get_portfolio(req.user_id)
        tickers = list({item["ticker"] for item in portfolio})

    if not tickers:
        raise HTTPException(status_code=400, detail="No tickers to analyze. Import a portfolio first.")

    user_context = build_user_context(req.user_id)

    async def event_stream():
        import asyncio

        yield _sse_data({"type": "started", "tickers": tickers})

        # Run all ticker analyses in parallel
        async def analyze_one(ticker: str) -> dict:
            try:
                result = await agent_client.call_heartbeat_analyze(
                    ticker=ticker, user_context=user_context
                )
                save_heartbeat_result(
                    user_id=req.user_id,
                    ticker=ticker,
                    decision=result.get("decision", "HOLD"),
                    summary=result.get("summary", ""),
                    full_analysis=result.get("full_analysis", ""),
                    severity=result.get("severity", "info"),
                )
                return {"ok": True, "ticker": ticker, "result": result}
            except Exception as e:
                logger.exception("Heartbeat analyze failed for %s", ticker)
                return {"ok": False, "ticker": ticker, "error": str(e)}

        # Emit ticker_start for all tickers up front
        for ticker in tickers:
            yield _sse_data({"type": "ticker_start", "ticker": ticker})

        # Run concurrently and stream results as they complete
        results = []
        pending = {asyncio.ensure_future(analyze_one(t)): t for t in tickers}
        while pending:
            done_set, _ = await asyncio.wait(pending.keys(), return_when=asyncio.FIRST_COMPLETED)
            for fut in done_set:
                del pending[fut]
                out = fut.result()
                if out["ok"]:
                    results.append(out["result"])
                    yield _sse_data({
                        "type": "ticker_done",
                        "ticker": out["ticker"],
                        "decision": out["result"].get("decision", "HOLD"),
                        "summary": out["result"].get("summary", ""),
                        "severity": out["result"].get("severity", "info"),
                    })
                else:
                    yield _sse_data({
                        "type": "ticker_error",
                        "ticker": out["ticker"],
                        "error": out["error"],
                    })

        yield _sse_data({"type": "done", "results": results})
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.post("/api/heartbeat/rules")
async def create_rule(req: HeartbeatRuleCreateRequest):
    """Create a monitoring rule from natural language."""
    # Heartbeat rules table has FK -> users(user_id). Ensure the user row exists.
    upsert_user(req.user_id)

    try:
        parsed = await agent_client.call_parse_rule(req.raw_rule)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse rule: {e}")

    rule = create_heartbeat_rule(
        user_id=req.user_id,
        raw_rule=req.raw_rule,
        parsed_condition=parsed,
    )
    return {
        "id": rule["id"],
        "user_id": rule["user_id"],
        "raw_rule": rule["raw_rule"],
        "parsed_condition": json.loads(rule["parsed_condition"]) if isinstance(rule["parsed_condition"], str) else rule["parsed_condition"],
        "is_active": bool(rule["is_active"]),
        "created_at": rule["created_at"],
    }


@app.get("/api/heartbeat/rules")
async def list_rules(user_id: str = Query(...)):
    """List all heartbeat rules for a user."""
    rules = get_heartbeat_rules(user_id)
    return [
        {
            "id": r["id"],
            "user_id": r["user_id"],
            "raw_rule": r["raw_rule"],
            "parsed_condition": r["parsed_condition"],
            "is_active": bool(r["is_active"]),
            "created_at": r["created_at"],
        }
        for r in rules
    ]


@app.delete("/api/heartbeat/rules/{rule_id}")
async def remove_rule(rule_id: str):
    """Delete a heartbeat rule."""
    if not delete_heartbeat_rule(rule_id):
        raise HTTPException(status_code=404, detail="Rule not found")
    return {"ok": True}


@app.patch("/api/heartbeat/rules/{rule_id}")
async def toggle_rule(rule_id: str):
    """Toggle a heartbeat rule active/inactive."""
    rule = toggle_heartbeat_rule(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return {
        "id": rule["id"],
        "user_id": rule["user_id"],
        "raw_rule": rule["raw_rule"],
        "parsed_condition": rule["parsed_condition"],
        "is_active": bool(rule["is_active"]),
        "created_at": rule["created_at"],
    }


@app.get("/api/heartbeat/results")
async def list_results(
    user_id: str = Query(...),
    unread_only: bool = Query(default=False),
):
    """List heartbeat analysis results."""
    results = get_heartbeat_results(user_id, unread_only=unread_only)
    return [
        {
            "id": r["id"],
            "user_id": r["user_id"],
            "rule_id": r["rule_id"],
            "ticker": r["ticker"],
            "decision": r["decision"],
            "summary": r["summary"],
            "full_analysis": r.get("full_analysis", ""),
            "severity": r["severity"],
            "is_read": bool(r["is_read"]),
            "created_at": r["created_at"],
        }
        for r in results
    ]


@app.post("/api/heartbeat/results/{result_id}/read")
async def mark_result_read(result_id: str):
    """Mark a heartbeat result as read."""
    if not mark_heartbeat_result_read(result_id):
        raise HTTPException(status_code=404, detail="Result not found")
    return {"ok": True}


@app.get("/api/heartbeat/results/unread-count")
async def unread_count(user_id: str = Query(...)):
    """Get count of unread heartbeat results."""
    count = get_heartbeat_unread_count(user_id)
    return {"count": count}


# ---------------------------------------------------------------------------
# Market data
# ---------------------------------------------------------------------------

def _market_data_history_payload(
    ticker: str,
    period: str = "1mo",
    interval: str = "1d",
) -> dict[str, Any]:
    """Return OHLCV history payload for a ticker with VN mock + yfinance routing."""
    from finly_backend.mock_data import _generate_ohlcv, is_vn_ticker

    clean_ticker = ticker.upper().strip()
    currency = "VND" if is_vn_ticker(clean_ticker) else "USD"

    if is_vn_ticker(clean_ticker):
        period_days = {
            "1d": 1,
            "5d": 5,
            "1mo": 30,
            "3mo": 90,
            "6mo": 180,
            "1y": 365,
        }.get(period, 30)
        raw = _generate_ohlcv(clean_ticker, days=period_days)
        data = [
            {
                "date": r["Date"],
                "open": r["Open"],
                "high": r["High"],
                "low": r["Low"],
                "close": r["Close"],
                "volume": r["Volume"],
            }
            for r in raw
        ]
    else:
        import yfinance as yf

        tk = yf.Ticker(clean_ticker)
        hist = tk.history(period=period, interval=interval)
        data = [
            {
                "date": idx.strftime("%Y-%m-%d"),
                "open": round(float(row["Open"]), 2),
                "high": round(float(row["High"]), 2),
                "low": round(float(row["Low"]), 2),
                "close": round(float(row["Close"]), 2),
                "volume": int(row["Volume"]),
            }
            for idx, row in hist.iterrows()
        ]

    return {
        "ticker": clean_ticker,
        "currency": currency,
        "period": period,
        "interval": interval,
        "data": data,
    }


@app.get("/api/market-data/history")
async def market_data_history(
    ticker: str = Query(...),
    period: str = Query(default="1mo"),
    interval: str = Query(default="1d"),
):
    """Return OHLCV history for one ticker."""
    try:
        return _market_data_history_payload(
            ticker=ticker,
            period=period,
            interval=interval,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"history data error: {e}")


@app.get("/api/market-data/history/batch")
async def market_data_history_batch(
    tickers: str = Query(..., description="Comma-separated ticker symbols"),
    period: str = Query(default="1mo"),
    interval: str = Query(default="1d"),
):
    """Return OHLCV history for multiple tickers in one request."""
    symbols = [ticker.strip().upper() for ticker in tickers.split(",") if ticker.strip()]
    if not symbols:
        return {"period": period, "interval": interval, "results": {}}

    results: dict[str, Any] = {}
    for symbol in symbols:
        try:
            results[symbol] = _market_data_history_payload(
                ticker=symbol,
                period=period,
                interval=interval,
            )
        except Exception as e:
            results[symbol] = {"ticker": symbol, "error": str(e), "data": []}

    return {"period": period, "interval": interval, "results": results}


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------


def run() -> None:
    import uvicorn

    host = os.getenv("FINLY_BACKEND_HOST", "0.0.0.0")
    port = int(os.getenv("PORT", os.getenv("FINLY_BACKEND_PORT", "8000")))
    uvicorn.run("finly_backend.server:app", host=host, port=port, reload=False)


if __name__ == "__main__":
    run()
