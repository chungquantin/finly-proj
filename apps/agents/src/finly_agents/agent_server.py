"""Stateless Agent Server — runs the TradingAgents pipeline and panel chat.

No database imports. Receives all context (user profile, portfolio) in the request.
Designed to run on a separate port from the backend API server.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re

from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import httpx

from tradingagents.default_config import DEFAULT_CONFIG
from tradingagents.graph.trading_graph import TradingAgentsGraph

load_dotenv()

logger = logging.getLogger("finly_agents.agent_server")


def _sse_data(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------


class PipelineRequest(BaseModel):
    ticker: str
    trade_date: str
    user_context: str = ""
    portfolio_summary: str = ""
    selected_analysts: list[str] = ["market", "social", "news", "fundamentals"]
    model_name: str | None = None


class AgentPanelRequest(BaseModel):
    message: str
    report_data: dict  # agent_reasoning + summary from stored report
    user_context: str = ""
    conversation_history: list[dict] = []


# ---------------------------------------------------------------------------
# Agent pipeline helpers (moved from server.py)
# ---------------------------------------------------------------------------


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
    return TradingAgentsGraph(
        debug=False, config=config, selected_analysts=selected_analysts
    )


def _run_pipeline(req: PipelineRequest) -> dict[str, Any]:
    """Execute the full agent pipeline (blocking — run via asyncio.to_thread)."""
    model_name = req.model_name or os.getenv("FINLY_AGENT_MODEL", "openai/gpt-4.1-mini")
    graph = _build_graph(model_name=model_name, selected_analysts=req.selected_analysts)

    user_context = req.user_context
    if req.portfolio_summary:
        user_context += f"\n\nCURRENT PORTFOLIO\n{req.portfolio_summary}"

    final_state, decision = graph.propagate(
        req.ticker, req.trade_date, user_context=user_context
    )

    final_report = final_state.get("final_trade_decision", "")
    content = (
        f"Ticker: {req.ticker}\n"
        f"Trade date: {req.trade_date}\n"
        f"Decision: {str(decision).strip()}\n\n"
        f"Final report:\n{final_report}"
    ).strip()

    agent_reasoning = _extract_agent_reasoning(final_state)
    summary = _truncate_sentences(content, 5)
    specialist_insights = _extract_specialist_insights(final_state)

    return {
        "ticker": req.ticker,
        "trade_date": req.trade_date,
        "decision": str(decision).strip(),
        "content": content,
        "final_state": final_state,
        "agent_reasoning": agent_reasoning,
        "specialist_insights": specialist_insights,
        "summary": summary,
    }


def _truncate_sentences(text: str, max_sentences: int = 3) -> str:
    if not text:
        return ""
    sentences = re.split(r"(?<=[.!?])\s+", str(text))
    return " ".join(sentences[:max_sentences])


def _extract_specialist_insights(final_state: dict) -> list[dict]:
    insights = []

    # Analyst — combines fundamentals + sentiment
    analyst_parts = []
    for key in ("fundamentals_report", "sentiment_report"):
        text = final_state.get(key, "")
        if text:
            analyst_parts.append(text)
    if analyst_parts:
        combined = "\n\n".join(analyst_parts)
        insights.append(
            {
                "role": "analyst",
                "summary": _truncate_sentences(combined, 3),
                "full_analysis": combined,
            }
        )

    # Researcher — news
    news = final_state.get("news_report", "")
    if news:
        insights.append(
            {
                "role": "researcher",
                "summary": _truncate_sentences(news, 3),
                "full_analysis": news,
            }
        )

    # Trader — market/technical
    market = final_state.get("market_report", "")
    if market:
        insights.append(
            {
                "role": "trader",
                "summary": _truncate_sentences(market, 3),
                "full_analysis": market,
            }
        )

    # Advisor — final trade decision
    ftd = final_state.get("final_trade_decision", "")
    if ftd:
        insights.append(
            {
                "role": "advisor",
                "summary": _truncate_sentences(ftd, 3),
                "full_analysis": ftd,
            }
        )

    return insights


def _extract_agent_reasoning(final_state: dict) -> dict:
    """Extract per-agent reasoning into a structured dict."""
    return {
        "market_report": final_state.get("market_report", ""),
        "fundamentals_report": final_state.get("fundamentals_report", ""),
        "news_report": final_state.get("news_report", ""),
        "sentiment_report": final_state.get("sentiment_report", ""),
        "investment_debate": {
            "bull_case": final_state.get("investment_debate_state", {}).get(
                "bull_history", ""
            ),
            "bear_case": final_state.get("investment_debate_state", {}).get(
                "bear_history", ""
            ),
            "judge_decision": final_state.get("investment_debate_state", {}).get(
                "judge_decision", ""
            ),
        },
        "risk_debate": {
            "aggressive": final_state.get("risk_debate_state", {}).get(
                "aggressive_history", ""
            ),
            "conservative": final_state.get("risk_debate_state", {}).get(
                "conservative_history", ""
            ),
            "neutral": final_state.get("risk_debate_state", {}).get(
                "neutral_history", ""
            ),
            "judge_decision": final_state.get("risk_debate_state", {}).get(
                "judge_decision", ""
            ),
        },
        "trader_plan": final_state.get("trader_investment_plan", ""),
        "investment_plan": final_state.get("investment_plan", ""),
    }


# ---------------------------------------------------------------------------
# Panel chat helpers (moved from panel.py)
# ---------------------------------------------------------------------------

AGENT_PERSONAS = {
    "analyst": {
        "name": "Analyst",
        "report_keys": ["fundamentals_report", "sentiment_report"],
        "system_prompt": """\
You are Finly's Analyst. You evaluate whether a stock looks strong or weak by \
combining company financials with investor sentiment.

Your analysis from the latest report:
{agent_report}

Full team report summary:
{report_summary}

{user_context}

Answer in 1-2 sentences. Follow the INSTRUCTIONS FOR AGENTS in the user context above \
for language complexity and tone.""",
    },
    "researcher": {
        "name": "Researcher",
        "report_keys": ["news_report"],
        "system_prompt": """\
You are Finly's Researcher. You track the latest news, economic trends, and events \
that could move a stock's price.

Your research from the latest report:
{agent_report}

Full team report summary:
{report_summary}

{user_context}

Answer in 1-2 sentences. Follow the INSTRUCTIONS FOR AGENTS in the user context above \
for language complexity and tone.""",
    },
    "trader": {
        "name": "Trader",
        "report_keys": ["market_report"],
        "system_prompt": """\
You are Finly's Trader. You focus on chart patterns and trading signals to suggest \
good times to buy or sell.

Your trading analysis from the latest report:
{agent_report}

Full team report summary:
{report_summary}

{user_context}

Answer in 1-2 sentences. Follow the INSTRUCTIONS FOR AGENTS in the user context above \
for language complexity and tone.""",
    },
    "advisor": {
        "name": "Advisor",
        "report_keys": [
            "fundamentals_report",
            "sentiment_report",
            "news_report",
            "market_report",
        ],
        "system_prompt": """\
You are Finly's Advisor. You pull together everything the Analyst, Researcher, and \
Trader found and give a final recommendation that fits the user's personal situation — \
their risk comfort, goals, and current portfolio.

Team analysis:
{agent_report}

Debate outcomes:
{debate_summary}

Full team report summary:
{report_summary}

{user_context}

Answer in 1-2 sentences. Follow the INSTRUCTIONS FOR AGENTS in the user context above \
for language complexity and tone. Always tie your answer back to the user's risk profile and goals.""",
    },
}


async def _call_agent(
    agent_key: str,
    persona: dict,
    user_question: str,
    report_data: dict,
    user_context: str,
    conversation_history: list[dict],
) -> dict:
    """Call a single panel agent via LLM."""
    reasoning = report_data.get("agent_reasoning", {})

    report_keys = persona.get("report_keys", [])
    parts = []
    for key in report_keys:
        text = reasoning.get(key, "")
        if text:
            parts.append(text)
    agent_report = "\n\n".join(parts) if parts else "No data available."

    report_summary = report_data.get("summary", "No report generated yet.")

    # Build debate summary for the Advisor
    debate_summary = ""
    if agent_key == "advisor":
        inv_debate = reasoning.get("investment_debate", {})
        risk_debate = reasoning.get("risk_debate", {})
        debate_parts = []
        if inv_debate.get("judge_decision"):
            debate_parts.append(
                f"Investment debate conclusion: {inv_debate['judge_decision']}"
            )
        if risk_debate.get("judge_decision"):
            debate_parts.append(
                f"Risk debate conclusion: {risk_debate['judge_decision']}"
            )
        debate_summary = "\n".join(debate_parts) if debate_parts else "No debate data."

    fmt_kwargs = dict(
        agent_report=agent_report,
        report_summary=report_summary,
        user_context=user_context,
    )
    if "{debate_summary}" in persona["system_prompt"]:
        fmt_kwargs["debate_summary"] = debate_summary
    system_prompt = persona["system_prompt"].format(**fmt_kwargs)

    messages = [{"role": "system", "content": system_prompt}]

    for msg in conversation_history[-6:]:
        if msg.get("agent_role") == agent_key or msg.get("role") == "user":
            messages.append({"role": msg["role"], "content": msg["content"]})

    messages.append({"role": "user", "content": user_question})

    api_key = os.getenv("OPENROUTER_API_KEY", "")
    model = os.getenv(
        "FINLY_PANEL_MODEL", os.getenv("FINLY_AGENT_MODEL", "openai/gpt-4.1-mini")
    )
    base_url = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")

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
                    "messages": messages,
                    "temperature": 0.7,
                    "max_tokens": 300,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            response_text = data["choices"][0]["message"]["content"]
    except Exception as e:
        logger.warning(f"Panel agent {agent_key} failed: {e}")
        response_text = "I'm having trouble responding right now. Please try again."

    return {
        "agent_role": agent_key,
        "agent_name": persona["name"],
        "response": response_text,
    }


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="Finly Agent Server", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
def healthz() -> dict:
    """Health check — no DB, just confirm the server is alive."""
    return {"status": "ok", "version": app.version}


@app.post("/agent/run-pipeline")
async def run_pipeline(req: PipelineRequest):
    """Execute the full TradingAgents pipeline."""
    try:
        result = await asyncio.to_thread(_run_pipeline, req)
    except Exception as e:
        logger.exception("Agent pipeline failed")
        raise HTTPException(status_code=500, detail=str(e))

    # Don't return final_state (too large) — return the processed fields
    return {
        "ticker": result["ticker"],
        "trade_date": result["trade_date"],
        "decision": result["decision"],
        "content": result["content"],
        "agent_reasoning": result["agent_reasoning"],
        "specialist_insights": result["specialist_insights"],
        "summary": result["summary"],
    }


@app.post("/agent/panel-chat")
async def panel_chat(req: AgentPanelRequest):
    """Run panel discussion — all 4 agents respond in parallel."""
    tasks = []
    for agent_key, persona in AGENT_PERSONAS.items():
        tasks.append(
            _call_agent(
                agent_key,
                persona,
                req.message,
                req.report_data,
                req.user_context,
                req.conversation_history,
            )
        )

    agent_responses = await asyncio.gather(*tasks)
    return {"agent_responses": list(agent_responses)}


@app.post("/agent/panel-chat/stream")
async def panel_chat_stream(req: AgentPanelRequest):
    """Run panel discussion and stream each agent response when available."""

    async def event_stream():
        yield _sse_data({"type": "started"})

        tasks_by_role: dict[asyncio.Task, str] = {}
        for agent_key, persona in AGENT_PERSONAS.items():
            task = asyncio.create_task(
                _call_agent(
                    agent_key,
                    persona,
                    req.message,
                    req.report_data,
                    req.user_context,
                    req.conversation_history,
                )
            )
            tasks_by_role[task] = agent_key

        for task in asyncio.as_completed(tasks_by_role):
            try:
                response = await task
            except Exception as e:  # defensive fallback; _call_agent already handles most errors
                agent_key = tasks_by_role.get(task, "unknown")
                logger.warning(f"Panel stream task failed for {agent_key}: {e}")
                response = {
                    "agent_role": agent_key,
                    "agent_name": AGENT_PERSONAS.get(agent_key, {}).get("name", "Agent"),
                    "response": "I'm having trouble responding right now. Please try again.",
                }
            yield _sse_data({"type": "agent_response", "response": response})

        yield _sse_data({"type": "done"})
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def run() -> None:
    import uvicorn

    host = os.getenv("FINLY_AGENTS_HOST", "0.0.0.0")
    port = int(os.getenv("PORT", os.getenv("FINLY_AGENT_SERVER_PORT", "8001")))
    uvicorn.run("finly_agents.agent_server:app", host=host, port=port, reload=False)


if __name__ == "__main__":
    run()
