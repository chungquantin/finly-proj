"""Thin async client for calling the Agent Server.

Used by the backend API server (server.py) to proxy requests
to the stateless agent server.
"""

from __future__ import annotations

import logging
import os
import json
from collections.abc import AsyncIterator

import httpx

logger = logging.getLogger("finly_backend.agent_client")

AGENT_SERVER_URL = os.getenv("FINLY_AGENT_SERVER_URL", "http://localhost:8001")

# Pipeline can be very slow (LLM calls + data fetching)
_PIPELINE_TIMEOUT = 180.0
_PANEL_TIMEOUT = 60.0
_HEALTH_TIMEOUT = 5.0
_HEARTBEAT_TIMEOUT = float(os.getenv("FINLY_HEARTBEAT_TIMEOUT", "120"))


class AgentServerUnavailable(Exception):
    """Raised when the agent server is not reachable."""


async def check_agent_health() -> bool:
    """Check if the agent server is healthy."""
    try:
        async with httpx.AsyncClient(timeout=_HEALTH_TIMEOUT) as client:
            resp = await client.get(f"{AGENT_SERVER_URL}/healthz")
            resp.raise_for_status()
            return resp.json().get("status") == "ok"
    except Exception:
        return False


async def call_pipeline(
    ticker: str,
    trade_date: str,
    user_context: str = "",
    portfolio_summary: str = "",
    selected_analysts: list[str] | None = None,
    model_name: str | None = None,
) -> dict:
    """Call the agent pipeline endpoint.

    Returns dict with: ticker, trade_date, decision, content,
    agent_reasoning, specialist_insights, summary.

    Raises AgentServerUnavailable if the agent server is down.
    """
    payload = {
        "ticker": ticker,
        "trade_date": trade_date,
        "user_context": user_context,
        "portfolio_summary": portfolio_summary,
        "selected_analysts": selected_analysts
        or ["market", "social", "news", "fundamentals"],
    }
    if model_name:
        payload["model_name"] = model_name

    try:
        async with httpx.AsyncClient(timeout=_PIPELINE_TIMEOUT) as client:
            resp = await client.post(
                f"{AGENT_SERVER_URL}/agent/run-pipeline", json=payload
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.ConnectError:
        raise AgentServerUnavailable(
            f"Agent server at {AGENT_SERVER_URL} is not reachable. "
            "Start it with: finly-agent-server"
        )
    except httpx.TimeoutException:
        raise AgentServerUnavailable(
            "Agent server timed out. The pipeline may be taking too long."
        )


async def call_panel_chat(
    message: str,
    report_data: dict,
    user_context: str = "",
    conversation_history: list[dict] | None = None,
    target_agents: list[str] | None = None,
) -> list[dict]:
    """Call the panel chat endpoint.

    Returns list of agent response dicts: [{agent_role, agent_name, response}, ...]

    Raises AgentServerUnavailable if the agent server is down.
    """
    payload = {
        "message": message,
        "report_data": report_data,
        "user_context": user_context,
        "conversation_history": conversation_history or [],
    }
    if target_agents is not None:
        payload["target_agents"] = target_agents

    try:
        async with httpx.AsyncClient(timeout=_PANEL_TIMEOUT) as client:
            resp = await client.post(
                f"{AGENT_SERVER_URL}/agent/panel-chat", json=payload
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("agent_responses", [])
    except httpx.ConnectError:
        raise AgentServerUnavailable(
            f"Agent server at {AGENT_SERVER_URL} is not reachable. "
            "Start it with: finly-agent-server"
        )
    except httpx.TimeoutException:
        raise AgentServerUnavailable("Agent server timed out during panel chat.")


async def call_panel_chat_stream(
    message: str,
    report_data: dict,
    user_context: str = "",
    conversation_history: list[dict] | None = None,
    target_agents: list[str] | None = None,
) -> AsyncIterator[dict]:
    """Call the streaming panel chat endpoint and yield SSE payloads."""
    payload = {
        "message": message,
        "report_data": report_data,
        "user_context": user_context,
        "conversation_history": conversation_history or [],
    }
    if target_agents is not None:
        payload["target_agents"] = target_agents

    try:
        async with httpx.AsyncClient(timeout=None) as client:
            try:
                async with client.stream(
                    "POST", f"{AGENT_SERVER_URL}/agent/panel-chat/stream", json=payload
                ) as resp:
                    resp.raise_for_status()
                    async for raw_line in resp.aiter_lines():
                        line = (raw_line or "").strip()
                        if not line.startswith("data:"):
                            continue
                        data = line[5:].strip()
                        if not data or data == "[DONE]":
                            continue
                        try:
                            yield json.loads(data)
                        except Exception:
                            logger.warning("Invalid panel stream payload from agent server")
                            continue
            except httpx.HTTPStatusError as e:
                # Backward compatibility: older agent-server builds may not expose
                # /agent/panel-chat/stream yet. Fallback to non-stream endpoint.
                if e.response.status_code != 404:
                    raise

                logger.warning(
                    "Agent stream endpoint missing (404). Falling back to non-stream panel chat."
                )
                fallback_resp = await client.post(
                    f"{AGENT_SERVER_URL}/agent/panel-chat", json=payload
                )
                fallback_resp.raise_for_status()
                fallback_data = fallback_resp.json()
                for item in fallback_data.get("agent_responses", []):
                    yield {"type": "agent_response", "response": item}
    except httpx.ConnectError:
        raise AgentServerUnavailable(
            f"Agent server at {AGENT_SERVER_URL} is not reachable. "
            "Start it with: finly-agent-server"
        )
    except httpx.TimeoutException:
        raise AgentServerUnavailable("Agent server timed out during panel chat stream.")


async def call_heartbeat_analyze(ticker: str, user_context: str = "") -> dict:
    """Call the heartbeat analysis endpoint for a single ticker."""
    payload = {"ticker": ticker, "user_context": user_context}
    try:
        async with httpx.AsyncClient(timeout=_HEARTBEAT_TIMEOUT) as client:
            resp = await client.post(
                f"{AGENT_SERVER_URL}/agent/heartbeat-analyze", json=payload
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPStatusError as e:
        # Degrade gracefully when the agent pipeline fails server-side.
        # Heartbeat should still return a usable alert payload instead of crashing.
        detail = ""
        try:
            detail = str(e.response.json().get("detail", "")).strip()
        except Exception:
            detail = (e.response.text or "").strip()
        logger.warning(
            "Heartbeat analyze fallback for %s due to agent server %s: %s",
            ticker,
            e.response.status_code,
            detail[:240],
        )
        fallback_summary = "Agent pipeline unavailable; using fallback heartbeat summary."
        if detail:
            fallback_summary = f"{fallback_summary} {detail[:140]}"
        return {
            "ticker": ticker,
            "decision": "HOLD",
            "summary": fallback_summary,
            "full_analysis": fallback_summary,
            "severity": "warning",
            "specialist_insights": {},
        }
    except httpx.ConnectError:
        raise AgentServerUnavailable(
            f"Agent server at {AGENT_SERVER_URL} is not reachable."
        )
    except httpx.TimeoutException:
        raise AgentServerUnavailable(
            f"Agent server timed out during heartbeat analysis after {_HEARTBEAT_TIMEOUT:.0f}s."
        )


async def call_parse_rule(raw_rule: str) -> dict:
    """Call the rule parsing endpoint to convert natural language to structured condition."""
    payload = {"raw_rule": raw_rule}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{AGENT_SERVER_URL}/agent/parse-rule", json=payload
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.ConnectError:
        raise AgentServerUnavailable(
            f"Agent server at {AGENT_SERVER_URL} is not reachable."
        )
    except httpx.TimeoutException:
        raise AgentServerUnavailable("Agent server timed out during rule parsing.")
