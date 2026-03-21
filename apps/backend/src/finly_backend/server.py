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
from datetime import date
from typing import Any

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
    VoiceOnboardingProfile,
    VoiceOnboardingRequest,
    VoiceOnboardingResponse,
    TickerReportListItem,
)
from finly_backend.database import (
    init_db,
    get_user,
    get_report,
    get_reports,
    get_reports_for_ticker,
    get_latest_report,
    save_report,
)
from finly_backend.profiles import (
    append_chat,
    create_or_update_profile,
    get_chat_history,
    get_profile,
)
from finly_backend.heartbeat import (
    get_pending_alerts,
    seed_demo_alerts,
    trigger_alert,
    trigger_custom_alert,
)

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


def _sse_data(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="Finly Backend API", version="0.3.0")

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
    logger.info("Finly Backend API started — DB initialised, demo alerts seeded")


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

    user_context = build_user_context(req.user_id)
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

    user_context = build_user_context(req.user_id)
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

        try:
            async for event in agent_client.call_panel_chat_stream(
                message=req.message,
                report_data=report_data,
                user_context=user_context,
                conversation_history=conversation_history,
            ):
                if event.get("type") != "agent_response":
                    continue
                response = event.get("response") or {}
                agent_role = str(response.get("agent_role", "")).strip() or "advisor"
                agent_name = str(response.get("agent_name", "")).strip() or "Advisor"
                response_text = str(response.get("response", "")).strip()
                message = {
                    "agent_role": agent_role,
                    "agent_name": agent_name,
                    "response": response_text,
                }

                yield _sse_data({"type": "agent_message_start", "message": message})
                for part in _split_chunks(response_text, chunk_size=60):
                    yield _sse_data(
                        {
                            "type": "agent_message_delta",
                            "message": message,
                            "delta": part,
                        }
                    )
                yield _sse_data({"type": "agent_message_done", "message": message})

                append_conversation(
                    req.user_id,
                    "panel",
                    "assistant",
                    response_text,
                    agent_role=agent_role,
                    metadata={"report_id": report["id"]},
                )
                collected_responses.append(message)
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


# ---------------------------------------------------------------------------
# Heartbeat alerts
# ---------------------------------------------------------------------------


@app.get("/api/heartbeat/alerts")
async def heartbeat_alerts(user_id: str = Query(default="broadcast")):
    alerts = get_pending_alerts(user_id)
    return [a.model_dump() for a in alerts]


@app.post("/api/heartbeat/trigger")
async def heartbeat_trigger(
    scenario: str = Query(...), user_id: str = Query(default="broadcast")
):
    try:
        alert = trigger_alert(scenario, user_id)
        return alert.model_dump()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


class CustomAlertRequest(BaseModel):
    ticker: str
    headline: str
    body: str
    severity: str = "info"
    attributed_to: str = "Finly"
    user_id: str = "broadcast"


@app.post("/api/heartbeat/custom")
async def heartbeat_custom(req: CustomAlertRequest):
    alert = trigger_custom_alert(
        ticker=req.ticker,
        headline=req.headline,
        body=req.body,
        severity=req.severity,
        attributed_to=req.attributed_to,
        user_id=req.user_id,
    )
    return alert.model_dump()


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
