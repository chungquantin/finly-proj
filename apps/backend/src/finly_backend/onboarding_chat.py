"""Conversational voice onboarding — extracts investor profile through natural dialogue.

Uses OpenRouter LLM to chat with the user and extract: name, risk tolerance,
investment horizon, and financial knowledge level. Max 4 turns before forcing completion.
"""

from __future__ import annotations

import json
import logging
import os
import re
from collections.abc import AsyncIterator

import httpx

from finly_backend.database import (
    append_conversation,
    get_conversation_history,
)

logger = logging.getLogger("finly_backend.onboarding_chat")

MAX_TURNS = 4

ONBOARDING_SYSTEM_PROMPT = """\
You are Finly, a warm and friendly AI investment advisor onboarding a new user via voice conversation.

Your job is to naturally extract four pieces of information through casual conversation:
1. **Name** — What the user wants to be called
2. **Risk tolerance** — How comfortable they are with investment risk (map to: beginner/intermediate/expert)
3. **Investment horizon** — How long they plan to invest (map to: short/medium/long)
4. **Financial knowledge** — Their investing experience level (map to: novice/savvy/pro)

CONVERSATION GUIDELINES:
- Keep responses SHORT (2-3 sentences max) — this is voice, not text
- Be warm, casual, encouraging — like a friendly advisor, not a form
- Ask about 1-2 things per turn, don't overwhelm
- Use natural language, not jargon. E.g., "How long are you thinking of investing?" not "What is your investment horizon?"
- If the user gives vague answers, that's fine — infer the best match
- You can combine related questions naturally

TURN COUNT: This is turn {turn_count} of {max_turns}. \
{turn_guidance}

RESPONSE FORMAT:
Always end your response with a JSON block:
```json
{{"is_complete": false, "extracted": {{"name": null, "risk": null, "horizon": null, "knowledge": null}}}}
```

When you have enough info (or it's the last turn), set is_complete to true and fill in ALL fields:
- name: string (user's name)
- risk: "beginner" | "intermediate" | "expert"
- horizon: "short" | "medium" | "long"
- knowledge: "novice" | "savvy" | "pro"

For any fields the user didn't explicitly specify, use reasonable defaults:
- risk: "beginner" (safe default for new investors)
- horizon: "medium" (most common)
- knowledge: "novice" (assume beginner-friendly)
"""


def _turn_guidance(turn_count: int, max_turns: int) -> str:
    remaining = max_turns - turn_count
    if remaining <= 1:
        return (
            "IMPORTANT: This is your LAST turn. You MUST set is_complete to true "
            "and fill in all extracted fields with your best guesses for anything not yet answered."
        )
    if remaining == 2:
        return "You have 2 turns left. Try to gather remaining info efficiently."
    return "Take your time — get to know the user naturally."


def _build_system_prompt(turn_count: int) -> str:
    return ONBOARDING_SYSTEM_PROMPT.format(
        turn_count=turn_count,
        max_turns=MAX_TURNS,
        turn_guidance=_turn_guidance(turn_count, MAX_TURNS),
    )


def _count_turns(user_id: str) -> int:
    history = get_conversation_history(user_id, conv_type="onboarding_voice", limit=100)
    return sum(1 for msg in history if msg["role"] == "assistant")


def _parse_response(text: str) -> tuple[str, bool, dict | None]:
    """Extract display message, completion flag, and extracted profile from LLM response."""
    is_complete = False
    extracted = None

    # Look for ```json ... ``` block
    json_match = re.search(r"```json\s*(\{.*?\})\s*```", text, re.DOTALL)
    if json_match:
        try:
            data = json.loads(json_match.group(1))
            is_complete = data.get("is_complete", False)
            extracted = data.get("extracted")
        except json.JSONDecodeError:
            pass
        display_text = text[: json_match.start()].strip()
    else:
        # Try inline JSON
        json_match = re.search(r'\{[^{}]*"is_complete"[^{}]*\}', text)
        if not json_match:
            # Try multiline with extracted nested object
            json_match = re.search(
                r'\{\s*"is_complete"\s*:.*?"extracted"\s*:\s*\{[^}]*\}\s*\}',
                text,
                re.DOTALL,
            )
        if json_match:
            try:
                data = json.loads(json_match.group())
                is_complete = data.get("is_complete", False)
                extracted = data.get("extracted")
            except json.JSONDecodeError:
                pass
            display_text = text[: json_match.start()].strip()
        else:
            display_text = text.strip()

    if not display_text:
        display_text = text.strip()

    return display_text, is_complete, extracted


def _strip_json_tail_for_stream(text: str) -> str:
    """Remove trailing JSON directive block for progressive UI display."""
    fenced_idx = text.find("```json")
    if fenced_idx >= 0:
        return text[:fenced_idx].strip()

    inline_json_idx = text.find('{"is_complete"')
    if inline_json_idx >= 0:
        return text[:inline_json_idx].strip()

    return text


async def run_onboarding_chat(user_id: str, message: str) -> dict:
    """Run one turn of the voice onboarding conversation.

    Returns: {user_id, message, is_complete, turn_count, profile}
    profile is populated when is_complete=True with {name, risk, horizon, knowledge}.
    """
    turn_count = _count_turns(user_id)

    # Record user message
    append_conversation(user_id, "onboarding_voice", "user", message)

    # Build messages
    system_prompt = _build_system_prompt(turn_count + 1)
    messages = [{"role": "system", "content": system_prompt}]

    history = get_conversation_history(user_id, conv_type="onboarding_voice", limit=100)
    for msg in history:
        messages.append({"role": msg["role"], "content": msg["content"]})

    messages.append({"role": "user", "content": message})

    # Force completion on last turn
    if turn_count + 1 >= MAX_TURNS:
        messages[0]["content"] += (
            "\n\nIMPORTANT: You MUST now produce is_complete: true and fill in ALL "
            "extracted fields. Do NOT ask another question."
        )

    # Call LLM
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
                "max_tokens": 400,
            },
        )
        resp.raise_for_status()
        data = resp.json()

    assistant_text = data["choices"][0]["message"]["content"]
    display_text, is_complete, extracted = _parse_response(assistant_text)

    # Record assistant response
    append_conversation(user_id, "onboarding_voice", "assistant", display_text)

    new_turn_count = turn_count + 1

    # Build profile from extracted data
    profile = None
    if is_complete and extracted:
        profile = {
            "name": extracted.get("name") or "Investor",
            "risk": extracted.get("risk") or "beginner",
            "horizon": extracted.get("horizon") or "medium",
            "knowledge": extracted.get("knowledge") or "novice",
        }

    return {
        "user_id": user_id,
        "message": display_text,
        "is_complete": is_complete,
        "turn_count": new_turn_count,
        "profile": profile,
    }


async def run_onboarding_chat_stream(user_id: str, message: str) -> AsyncIterator[dict]:
    """Stream one onboarding turn token-by-token, then emit final structured result."""
    turn_count = _count_turns(user_id)

    append_conversation(user_id, "onboarding_voice", "user", message)

    system_prompt = _build_system_prompt(turn_count + 1)
    messages = [{"role": "system", "content": system_prompt}]

    history = get_conversation_history(user_id, conv_type="onboarding_voice", limit=100)
    for msg in history:
        messages.append({"role": msg["role"], "content": msg["content"]})

    messages.append({"role": "user", "content": message})

    if turn_count + 1 >= MAX_TURNS:
        messages[0]["content"] += (
            "\n\nIMPORTANT: You MUST now produce is_complete: true and fill in ALL "
            "extracted fields. Do NOT ask another question."
        )

    api_key = os.getenv("OPENROUTER_API_KEY", "")
    model = os.getenv(
        "FINLY_INTAKE_MODEL", os.getenv("FINLY_AGENT_MODEL", "openai/gpt-4.1-mini")
    )
    base_url = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")

    yield {"type": "started"}

    raw_text = ""
    streamed_text = ""

    async with httpx.AsyncClient(timeout=60.0) as client:
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
                "max_tokens": 400,
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

                delta = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                if not delta:
                    continue

                raw_text += str(delta)
                visible = _strip_json_tail_for_stream(raw_text)
                if len(visible) <= len(streamed_text):
                    continue
                next_delta = visible[len(streamed_text) :]
                streamed_text = visible
                if next_delta:
                    yield {"type": "delta", "delta": next_delta}

    display_text, is_complete, extracted = _parse_response(raw_text)
    append_conversation(user_id, "onboarding_voice", "assistant", display_text)

    new_turn_count = turn_count + 1
    profile = None
    if is_complete and extracted:
        profile = {
            "name": extracted.get("name") or "Investor",
            "risk": extracted.get("risk") or "beginner",
            "horizon": extracted.get("horizon") or "medium",
            "knowledge": extracted.get("knowledge") or "novice",
        }

    yield {
        "type": "done",
        "result": {
            "user_id": user_id,
            "message": display_text,
            "is_complete": is_complete,
            "turn_count": new_turn_count,
            "profile": profile,
        },
    }


def get_initial_greeting() -> str:
    """Return the first message Finly says to start the onboarding conversation."""
    return (
        "Hey there! I'm Finly, your AI investment advisor. "
        "I'd love to get to know you a bit before we dive in. "
        "What's your name?"
    )


def reset_onboarding_chat(user_id: str) -> None:
    """Clear onboarding voice conversation history."""
    from finly_backend.database import get_db

    with get_db() as conn:
        conn.execute(
            "DELETE FROM conversations WHERE user_id = ? AND conv_type = 'onboarding_voice'",
            (user_id,),
        )
