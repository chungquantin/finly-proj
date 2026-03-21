"""Panel discussion — each agent responds individually to user follow-up questions.

After a report is generated, the user can "chat with the team". Each of the 4 agents
(Analyst, Researcher, Trader, Advisor) responds to the user's question from their own
perspective, referencing their section of the report.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os

import httpx

from finly_agents.context import build_user_context
from finly_agents.database import (
    append_conversation,
    get_conversation_history,
    get_latest_report,
    get_memories,
    get_user,
)

logger = logging.getLogger("finly_agents.panel")

AGENT_PERSONAS = {
    "analyst": {
        "name": "Analyst",
        "report_keys": ["fundamentals_report", "sentiment_report"],
        "system_prompt": """\
You are Finly's Analyst. You evaluate whether a stock looks strong or weak by \
combining company financials with investor sentiment. You explain things in plain, \
everyday language — no jargon.

Your analysis from the latest report:
{agent_report}

Full team report summary:
{report_summary}

{user_context}

Answer in 1-2 sentences using simple language a beginner investor would understand.""",
    },
    "researcher": {
        "name": "Researcher",
        "report_keys": ["news_report"],
        "system_prompt": """\
You are Finly's Researcher. You track the latest news, economic trends, and events \
that could move a stock's price. You explain things in plain, everyday language — no jargon.

Your research from the latest report:
{agent_report}

Full team report summary:
{report_summary}

{user_context}

Answer in 1-2 sentences using simple language a beginner investor would understand.""",
    },
    "trader": {
        "name": "Trader",
        "report_keys": ["market_report"],
        "system_prompt": """\
You are Finly's Trader. You focus on chart patterns and trading signals to suggest \
good times to buy or sell. You explain things in plain, everyday language — no jargon.

Your trading analysis from the latest report:
{agent_report}

Full team report summary:
{report_summary}

{user_context}

Answer in 1-2 sentences using simple language a beginner investor would understand.""",
    },
    "advisor": {
        "name": "Advisor",
        "report_keys": ["fundamentals_report", "sentiment_report", "news_report", "market_report"],
        "system_prompt": """\
You are Finly's Advisor. You pull together everything the Analyst, Researcher, and \
Trader found and give a final recommendation that fits the user's personal situation — \
their risk comfort, goals, and current portfolio. You explain things in plain, everyday \
language — no jargon.

Team analysis:
{agent_report}

Debate outcomes:
{debate_summary}

Full team report summary:
{report_summary}

{user_context}

Answer in 1-2 sentences using simple language a beginner investor would understand. \
Always tie your answer back to the user's risk profile and goals.""",
    },
}


async def _call_agent(
    agent_key: str,
    persona: dict,
    user_question: str,
    report: dict,
    user_context: str,
    conversation_history: list[dict],
) -> dict:
    """Call a single agent in the panel."""
    reasoning = report.get("agent_reasoning", {})

    # Combine all report_keys for this persona
    report_keys = persona.get("report_keys", [])
    parts = []
    for key in report_keys:
        text = reasoning.get(key, "")
        if text:
            parts.append(text)
    agent_report = "\n\n".join(parts) if parts else "No data available."

    report_summary = report.get("summary", "No report generated yet.")

    # Build debate summary for the Advisor
    debate_summary = ""
    if agent_key == "advisor":
        inv_debate = reasoning.get("investment_debate", {})
        risk_debate = reasoning.get("risk_debate", {})
        debate_parts = []
        if inv_debate.get("judge_decision"):
            debate_parts.append(f"Investment debate conclusion: {inv_debate['judge_decision']}")
        if risk_debate.get("judge_decision"):
            debate_parts.append(f"Risk debate conclusion: {risk_debate['judge_decision']}")
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

    # Add recent panel conversation history (last 6 messages)
    for msg in conversation_history[-6:]:
        if msg.get("agent_role") == agent_key or msg.get("role") == "user":
            messages.append({"role": msg["role"], "content": msg["content"]})

    messages.append({"role": "user", "content": user_question})

    api_key = os.getenv("OPENROUTER_API_KEY", "")
    model = os.getenv("FINLY_PANEL_MODEL", os.getenv("FINLY_AGENT_MODEL", "openai/gpt-4.1-mini"))
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
        response_text = f"I'm having trouble responding right now. Please try again."

    return {
        "agent_role": agent_key,
        "agent_name": persona["name"],
        "response": response_text,
    }


async def run_panel_discussion(
    user_id: str,
    message: str,
    report_id: str | None = None,
) -> dict:
    """Run a panel discussion — all 4 agents respond to the user's question in parallel.

    Returns dict with: user_id, question, agent_responses[], memory_updates[]
    """
    # Get the report to reference
    report = get_latest_report(user_id)
    if not report:
        return {
            "user_id": user_id,
            "question": message,
            "agent_responses": [
                {
                    "agent_role": "system",
                    "agent_name": "Finly",
                    "response": "No report has been generated yet. Please generate a report first.",
                }
            ],
            "memory_updates": [],
        }

    user_context = build_user_context(user_id)
    conversation_history = get_conversation_history(user_id, conv_type="panel", limit=20)

    # Record user message
    append_conversation(user_id, "panel", "user", message)

    # Run all 4 agents in parallel
    tasks = []
    for agent_key, persona in AGENT_PERSONAS.items():
        tasks.append(
            _call_agent(agent_key, persona, message, report, user_context, conversation_history)
        )

    agent_responses = await asyncio.gather(*tasks)

    # Record each agent's response
    for resp in agent_responses:
        append_conversation(
            user_id, "panel", "assistant", resp["response"], agent_role=resp["agent_role"]
        )

    # Extract memories from the interaction (fire and forget)
    memory_updates = []
    try:
        from finly_agents.memory import extract_and_store_memories

        combined_response = "\n".join(
            f"[{r['agent_name']}]: {r['response']}" for r in agent_responses
        )
        memory_updates = await extract_and_store_memories(user_id, message, combined_response)
    except Exception as e:
        logger.warning(f"Memory extraction in panel failed: {e}")

    return {
        "user_id": user_id,
        "question": message,
        "agent_responses": agent_responses,
        "memory_updates": memory_updates,
    }
