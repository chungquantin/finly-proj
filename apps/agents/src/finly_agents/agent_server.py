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
    target_agents: list[str] | None = None  # e.g. ["advisor"], ["trader", "analyst"]; None = all


class HeartbeatAnalyzeAgentRequest(BaseModel):
    ticker: str
    user_context: str = ""


class ParseRuleRequest(BaseModel):
    raw_rule: str


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
for language complexity and tone. Give only general feedback at portfolio level, \
covering both overall portfolio posture and the current holdings.""",
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
for language complexity and tone. Give only general feedback at portfolio level, \
covering both overall portfolio posture and the current holdings.""",
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
for language complexity and tone. Give only general feedback at portfolio level, \
covering both overall portfolio posture and the current holdings.""",
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

IMPORTANT: Always speak in first person as the Advisor. Never say "the analyst thinks" \
or "the trader says" — instead synthesize their insights into YOUR OWN recommendation. \
Say "I" not "the analyst".

Team analysis:
{agent_report}

Debate outcomes:
{debate_summary}

Full team report summary:
{report_summary}

{user_context}

Answer in 1-2 sentences. Follow the INSTRUCTIONS FOR AGENTS in the user context above \
for language complexity and tone. Give only general feedback at portfolio level, \
covering both overall portfolio posture and the current holdings. Always tie your answer \
back to the user's risk profile and goals. If the context includes a TODAY HOLDINGS NEWS \
section, summarize the latest news for all listed holdings today in your response.""",
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
    final_text = ""
    async for event in _stream_agent_events(
        agent_key=agent_key,
        persona=persona,
        user_question=user_question,
        report_data=report_data,
        user_context=user_context,
        conversation_history=conversation_history,
    ):
        if event.get("type") == "delta":
            final_text += str(event.get("delta", ""))
        elif event.get("type") == "done":
            final_text = str(event.get("response", final_text))

    if not final_text:
        final_text = "I'm having trouble responding right now. Please try again."

    return {
        "agent_role": agent_key,
        "agent_name": persona["name"],
        "response": final_text,
    }


def _build_panel_messages(
    agent_key: str,
    persona: dict,
    user_question: str,
    report_data: dict,
    user_context: str,
    conversation_history: list[dict],
) -> list[dict[str, str]]:
    """Build message payload for a single specialist."""
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
    return messages


async def _stream_agent_events(
    agent_key: str,
    persona: dict,
    user_question: str,
    report_data: dict,
    user_context: str,
    conversation_history: list[dict],
):
    """Yield streaming token events for a single specialist."""
    messages = _build_panel_messages(
        agent_key=agent_key,
        persona=persona,
        user_question=user_question,
        report_data=report_data,
        user_context=user_context,
        conversation_history=conversation_history,
    )

    api_key = os.getenv("OPENROUTER_API_KEY", "")
    model = os.getenv(
        "FINLY_PANEL_MODEL", os.getenv("FINLY_AGENT_MODEL", "openai/gpt-4.1-mini")
    )
    base_url = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")

    agent_identity = {
        "agent_role": agent_key,
        "agent_name": persona["name"],
    }
    full_text = ""

    yield {"type": "start", **agent_identity}

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            async with client.stream(
                "POST",
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
                    "stream": True,
                },
            ) as resp:
                resp.raise_for_status()
                async for raw_line in resp.aiter_lines():
                    line = (raw_line or "").strip()
                    if not line.startswith("data:"):
                        continue
                    payload = line[5:].strip()
                    if not payload:
                        continue
                    if payload == "[DONE]":
                        break
                    try:
                        chunk = json.loads(payload)
                    except Exception:
                        continue
                    delta = (
                        chunk.get("choices", [{}])[0]
                        .get("delta", {})
                        .get("content", "")
                    )
                    if not delta:
                        continue
                    full_text += str(delta)
                    yield {"type": "delta", "delta": str(delta), **agent_identity}
    except Exception as e:
        logger.warning(f"Panel agent {agent_key} failed: {e}")
        fallback = "I'm having trouble responding right now. Please try again."
        yield {"type": "delta", "delta": fallback, **agent_identity}
        full_text = fallback

    yield {"type": "done", "response": full_text, **agent_identity}


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
    """Run panel discussion — selected agents respond in parallel."""
    targets = req.target_agents or list(AGENT_PERSONAS.keys())
    tasks = []
    for agent_key, persona in AGENT_PERSONAS.items():
        if agent_key not in targets:
            continue
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
    """Run panel discussion and stream specialist token deltas."""

    async def event_stream():
        yield _sse_data({"type": "started"})
        queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()

        async def _run_specialist(agent_key: str, persona: dict):
            try:
                async for item in _stream_agent_events(
                    agent_key=agent_key,
                    persona=persona,
                    user_question=req.message,
                    report_data=req.report_data,
                    user_context=req.user_context,
                    conversation_history=req.conversation_history,
                ):
                    await queue.put(item)
            except Exception as e:
                logger.warning(f"Panel stream task failed for {agent_key}: {e}")
                await queue.put(
                    {
                        "type": "done",
                        "agent_role": agent_key,
                        "agent_name": persona.get("name", "Agent"),
                        "response": "I'm having trouble responding right now. Please try again.",
                    }
                )
            finally:
                await queue.put(None)

        targets = req.target_agents or list(AGENT_PERSONAS.keys())
        tasks = [
            asyncio.create_task(_run_specialist(agent_key, persona))
            for agent_key, persona in AGENT_PERSONAS.items()
            if agent_key in targets
        ]

        completed = 0
        target = len(tasks)
        while completed < target:
            item = await queue.get()
            if item is None:
                completed += 1
                continue
            event_type = item.get("type")
            if event_type == "start":
                yield _sse_data(
                    {
                        "type": "agent_message_start",
                        "message": {
                            "agent_role": item.get("agent_role", ""),
                            "agent_name": item.get("agent_name", ""),
                            "response": "",
                        },
                    }
                )
            elif event_type == "delta":
                yield _sse_data(
                    {
                        "type": "agent_message_delta",
                        "message": {
                            "agent_role": item.get("agent_role", ""),
                            "agent_name": item.get("agent_name", ""),
                            "response": "",
                        },
                        "delta": item.get("delta", ""),
                    }
                )
            elif event_type == "done":
                yield _sse_data(
                    {
                        "type": "agent_message_done",
                        "message": {
                            "agent_role": item.get("agent_role", ""),
                            "agent_name": item.get("agent_name", ""),
                            "response": item.get("response", ""),
                        },
                    }
                )

        await asyncio.gather(*tasks, return_exceptions=True)

        yield _sse_data({"type": "done"})
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ---------------------------------------------------------------------------
# Heartbeat analysis
# ---------------------------------------------------------------------------


def _run_heartbeat_pipeline(req: HeartbeatAnalyzeAgentRequest) -> dict[str, Any]:
    """Execute the full agent pipeline for heartbeat analysis (blocking)."""
    model_name = os.getenv("FINLY_AGENT_MODEL", "openai/gpt-4.1-mini")
    graph = _build_graph(
        model_name=model_name,
        selected_analysts=["market", "social", "news", "fundamentals"],
    )

    from datetime import date as _date
    trade_date = _date.today().isoformat()

    final_state, decision = graph.propagate(
        req.ticker, trade_date, user_context=req.user_context
    )

    final_report = final_state.get("final_trade_decision", "")
    summary = _truncate_sentences(final_report, 3)
    specialist_insights = _extract_specialist_insights(final_state)

    decision_str = str(decision).strip().upper()
    severity = "critical" if decision_str == "SELL" else "warning" if decision_str == "BUY" else "info"

    return {
        "ticker": req.ticker,
        "decision": decision_str,
        "summary": summary,
        "full_analysis": final_report,
        "severity": severity,
        "specialist_insights": specialist_insights,
    }


@app.post("/agent/heartbeat-analyze")
async def heartbeat_analyze(req: HeartbeatAnalyzeAgentRequest):
    """Run full pipeline analysis for a single ticker (heartbeat)."""
    try:
        result = await asyncio.to_thread(_run_heartbeat_pipeline, req)
    except Exception as e:
        logger.exception("Heartbeat pipeline failed for %s", req.ticker)
        raise HTTPException(status_code=500, detail=str(e))
    return result


@app.post("/agent/parse-rule")
async def parse_rule(req: ParseRuleRequest):
    """Use LLM to parse a natural language rule into structured condition."""
    api_key = os.getenv("OPENROUTER_API_KEY", "")
    model = os.getenv(
        "FINLY_PANEL_MODEL", os.getenv("FINLY_AGENT_MODEL", "openai/gpt-4.1-mini")
    )
    base_url = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")

    system_prompt = """\
You parse investment monitoring rules from natural language into JSON.

Return ONLY a JSON object with these fields:
- ticker: string (stock symbol, uppercase)
- metric: string (one of: "price", "price_change_pct", "volume")
- operator: string (one of: "gt", "lt", "gte", "lte")
- threshold: number

Examples:
"Alert me if AAPL drops more than 5%" -> {"ticker": "AAPL", "metric": "price_change_pct", "operator": "lt", "threshold": -5}
"Notify when TSLA goes above $300" -> {"ticker": "TSLA", "metric": "price", "operator": "gt", "threshold": 300}
"Tell me if VCB falls below 90000" -> {"ticker": "VCB", "metric": "price", "operator": "lt", "threshold": 90000}

Return ONLY the JSON, no explanation."""

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": req.raw_rule},
                    ],
                    "temperature": 0,
                    "max_tokens": 200,
                },
            )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            # Extract JSON from response (handle markdown code blocks)
            content = content.strip()
            if content.startswith("```"):
                content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            parsed = json.loads(content)
            return parsed
    except Exception as e:
        logger.exception("Rule parsing failed")
        raise HTTPException(status_code=500, detail=f"Failed to parse rule: {e}")


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
