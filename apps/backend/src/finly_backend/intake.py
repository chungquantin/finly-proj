"""Intake conversation agent — narrows down user investment goals.

Uses a separate LLM call (OpenRouter) to act as the intake coordinator.
Max 2 follow-up questions after the user's initial request, then produces
a structured investment brief that feeds into the 4-agent pipeline.
"""

from __future__ import annotations

import json
import logging
import os

import httpx

from finly_backend.database import (
    append_conversation,
    get_conversation_history,
    get_memories,
    get_user,
    upsert_memory,
    update_user_field,
)

logger = logging.getLogger("finly_agents.intake")

MAX_FOLLOW_UPS = 2

INTAKE_SYSTEM_PROMPT = """\
You are Finly's intake coordinator — a friendly, concise financial assistant who helps users \
clarify their investment goals before our analyst team runs a deep analysis.

Your job:
1. Listen to the user's initial request about what they want (e.g., "I want to grow my money", \
"I'm interested in ESG investing", "help me pick tech stocks").
2. Ask at most {remaining} more clarifying question(s) to narrow down:
   - Specific sectors, themes, or tickers of interest
   - Any constraints (e.g., no gambling stocks, only dividends, ESG-only)
   - Expected timeframe alignment (confirm their horizon)
3. Keep questions short and conversational.
4. When you have enough info (or after {remaining} question(s)), produce a FINAL BRIEF.

User profile context:
- Risk tolerance: {risk_score}/100
- Investment horizon: {horizon}
- Knowledge level: {knowledge}/3
- Portfolio: {portfolio_summary}
- Previous memories: {memories_summary}

IMPORTANT RULES:
- If this is a follow-up message (conversation history provided), do NOT re-ask things already answered.
- When you are ready to finalize (either you have enough info or you've used all follow-ups), \
respond with a JSON block at the END of your message in this exact format:
```json
{{"is_complete": true, "goals_brief": "A 2-3 sentence summary of the user's investment goals, constraints, and preferences."}}
```
- If you still need to ask a question, respond with your question and include:
```json
{{"is_complete": false}}
```
- Always include exactly one JSON block at the end of your response.
"""


def _build_system_prompt(user: dict, follow_up_count: int) -> str:
    from finly_backend.database import get_portfolio

    portfolio = get_portfolio(user["user_id"])
    portfolio_summary = (
        "Empty"
        if not portfolio
        else ", ".join(f"{p['ticker']} x{p['quantity']}" for p in portfolio)
    )

    memories = get_memories(user["user_id"])
    memories_summary = (
        "None yet"
        if not memories
        else "; ".join(f"{m['memory_key']}: {m['memory_value']}" for m in memories[:10])
    )

    remaining = max(0, MAX_FOLLOW_UPS - follow_up_count)

    return INTAKE_SYSTEM_PROMPT.format(
        risk_score=user.get("risk_score", 50),
        horizon=user.get("horizon", "medium"),
        knowledge=user.get("knowledge", 1),
        portfolio_summary=portfolio_summary,
        memories_summary=memories_summary,
        remaining=remaining,
    )


def _count_follow_ups(user_id: str) -> int:
    """Count how many assistant messages exist in the intake conversation."""
    history = get_conversation_history(user_id, conv_type="intake", limit=100)
    return sum(1 for msg in history if msg["role"] == "assistant")


def _build_messages(
    user_id: str, user: dict, new_message: str
) -> tuple[list[dict], int]:
    """Build the full message list for the LLM call."""
    follow_up_count = _count_follow_ups(user_id)
    system_prompt = _build_system_prompt(user, follow_up_count)

    messages = [{"role": "system", "content": system_prompt}]

    # Add conversation history
    history = get_conversation_history(user_id, conv_type="intake", limit=100)
    for msg in history:
        messages.append({"role": msg["role"], "content": msg["content"]})

    # Add the new user message
    messages.append({"role": "user", "content": new_message})

    return messages, follow_up_count


def _parse_response(text: str) -> tuple[str, bool, str | None]:
    """Parse assistant response to extract message, completion status, and brief."""
    # Try to find JSON block
    is_complete = False
    goals_brief = None

    # Look for ```json ... ``` block
    import re

    json_match = re.search(r"```json\s*(\{.*?\})\s*```", text, re.DOTALL)
    if json_match:
        try:
            data = json.loads(json_match.group(1))
            is_complete = data.get("is_complete", False)
            goals_brief = data.get("goals_brief")
        except json.JSONDecodeError:
            pass
        # Remove JSON block from display message
        display_text = text[: json_match.start()].strip()
    else:
        # Try inline JSON at end
        json_match = re.search(r'\{[^{}]*"is_complete"[^{}]*\}', text)
        if json_match:
            try:
                data = json.loads(json_match.group())
                is_complete = data.get("is_complete", False)
                goals_brief = data.get("goals_brief")
            except json.JSONDecodeError:
                pass
            display_text = text[: json_match.start()].strip()
        else:
            display_text = text.strip()

    # When complete, always show a clean message with the goals summary.
    # The LLM's display text often references the JSON block we stripped,
    # leaving broken sentences like "here's a summary:" with nothing after.
    if is_complete and goals_brief:
        display_text = f"Got it! I've captured your investment goals: {goals_brief}. You can now generate your report."
    elif not display_text:
        display_text = text.strip()

    return display_text, is_complete, goals_brief


async def run_intake(user_id: str, message: str) -> dict:
    """Run one turn of the intake conversation.

    Returns dict with: message, is_complete, follow_up_count, goals_brief
    """
    user = get_user(user_id)
    if not user:
        # Auto-create user with defaults
        from finly_backend.database import upsert_user

        user = upsert_user(user_id)

    # Record user message
    append_conversation(user_id, "intake", "user", message)

    messages, follow_up_count = _build_messages(user_id, user, message)

    # Force completion if we've hit the follow-up cap
    if follow_up_count >= MAX_FOLLOW_UPS:
        messages[0]["content"] += (
            "\n\nIMPORTANT: You have used all follow-up questions. You MUST now produce "
            "the final brief with is_complete: true. Do NOT ask another question."
        )

    # Call OpenRouter
    api_key = os.getenv("OPENROUTER_API_KEY", "")
    model = os.getenv(
        "FINLY_INTAKE_MODEL", os.getenv("FINLY_AGENT_MODEL", "openai/gpt-4.1-mini")
    )
    base_url = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")

    async with httpx.AsyncClient(timeout=60.0) as client:
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
                "max_tokens": 800,
            },
        )
        resp.raise_for_status()
        data = resp.json()

    assistant_text = data["choices"][0]["message"]["content"]
    display_text, is_complete, goals_brief = _parse_response(assistant_text)

    # Record assistant response
    append_conversation(user_id, "intake", "assistant", display_text)

    # If complete, save the goals brief to the user profile
    if is_complete and goals_brief:
        update_user_field(user_id, "goals_brief", goals_brief)
        upsert_memory(user_id, "investment_goals", goals_brief, source="intake")

    new_follow_up_count = follow_up_count + 1

    return {
        "user_id": user_id,
        "message": display_text,
        "is_complete": is_complete,
        "follow_up_count": new_follow_up_count,
        "goals_brief": goals_brief,
    }


def reset_intake(user_id: str) -> None:
    """Clear intake conversation history to start fresh."""
    from finly_backend.database import get_db

    with get_db() as conn:
        conn.execute(
            "DELETE FROM conversations WHERE user_id = ? AND conv_type = 'intake'",
            (user_id,),
        )
