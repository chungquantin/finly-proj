"""User memory system — extracts and stores contextual memories from conversations.

Memories are key-value pairs that capture user preferences, rejected suggestions,
updated goals, and other context. They are referenced during future conversations
and report generation.
"""

from __future__ import annotations

import json
import logging
import os

import httpx

from finly_backend.database import get_memories, get_user, upsert_memory

logger = logging.getLogger("finly_agents.memory")

EXTRACTION_PROMPT = """\
You are a memory extraction system for a financial advisory app. Analyze the following \
conversation exchange and extract any important user preferences, constraints, or context \
changes that should be remembered for future interactions.

User profile:
- Risk: {risk_score}/100, Horizon: {horizon}, Knowledge: {knowledge}/3

Existing memories:
{existing_memories}

Conversation to analyze:
User: {user_message}
Assistant: {assistant_message}

Extract memories as a JSON array. Each memory has a "key" (snake_case identifier) and "value" \
(concise description). Only extract genuinely new or updated information.

Examples of good memory keys:
- "prefers_esg" -> "User wants ESG-compliant investments only"
- "avoids_banking" -> "User explicitly said no banking stocks"
- "wants_dividends" -> "User prioritizes dividend-paying stocks"
- "risk_updated" -> "User said they want to be more aggressive, consider updating risk score"
- "interested_in_fpt" -> "User showed specific interest in FPT Corporation"

If the user explicitly changes a preference (e.g., "actually I'm more conservative"), \
include a memory with key "preference_update" and describe the change.

If nothing noteworthy, return an empty array: []

Respond with ONLY a JSON array, no other text.
"""


async def extract_and_store_memories(
    user_id: str,
    user_message: str,
    assistant_message: str,
) -> list[str]:
    """Analyze a conversation exchange and store extracted memories.

    Returns list of memory keys that were created/updated.
    """
    user = get_user(user_id)
    if not user:
        return []

    existing = get_memories(user_id)
    existing_str = (
        "\n".join(f"- {m['memory_key']}: {m['memory_value']}" for m in existing)
        or "None"
    )

    prompt = EXTRACTION_PROMPT.format(
        risk_score=user.get("risk_score", 50),
        horizon=user.get("horizon", "medium"),
        knowledge=user.get("knowledge", 1),
        existing_memories=existing_str,
        user_message=user_message,
        assistant_message=assistant_message,
    )

    api_key = os.getenv("OPENROUTER_API_KEY", "")
    model = os.getenv(
        "FINLY_MEMORY_MODEL", os.getenv("FINLY_AGENT_MODEL", "openai/gpt-4.1-mini")
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
                    "messages": [
                        {
                            "role": "system",
                            "content": "You extract structured memories from conversations. Respond with only a JSON array.",
                        },
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.3,
                    "max_tokens": 500,
                },
            )
            resp.raise_for_status()
            data = resp.json()

        raw = data["choices"][0]["message"]["content"].strip()

        # Parse JSON array from response
        # Handle potential markdown wrapping
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()

        memories = json.loads(raw)
        if not isinstance(memories, list):
            return []

        updated_keys = []
        for mem in memories:
            key = mem.get("key", "").strip()
            value = mem.get("value", "").strip()
            if key and value:
                upsert_memory(user_id, key, value, source="conversation")
                updated_keys.append(key)

                # Handle preference updates that should modify the user profile
                if key == "preference_update" or key == "risk_updated":
                    _apply_preference_update(user_id, value)

        return updated_keys

    except Exception as e:
        logger.warning(f"Memory extraction failed: {e}")
        return []


def _apply_preference_update(user_id: str, update_description: str) -> None:
    """Try to apply a preference update to the user profile.

    Looks for keywords like 'more aggressive', 'conservative', 'long term' etc.
    """
    from finly_backend.database import update_user_field

    desc_lower = update_description.lower()

    # Risk adjustments
    if "more aggressive" in desc_lower or "higher risk" in desc_lower:
        user = get_user(user_id)
        if user:
            new_risk = min(100, user["risk_score"] + 15)
            update_user_field(user_id, "risk_score", new_risk)
            upsert_memory(
                user_id,
                "risk_auto_adjusted",
                f"Risk score increased to {new_risk} based on user preference",
                source="system",
            )

    elif "more conservative" in desc_lower or "lower risk" in desc_lower:
        user = get_user(user_id)
        if user:
            new_risk = max(0, user["risk_score"] - 15)
            update_user_field(user_id, "risk_score", new_risk)
            upsert_memory(
                user_id,
                "risk_auto_adjusted",
                f"Risk score decreased to {new_risk} based on user preference",
                source="system",
            )

    # Horizon adjustments
    if "long term" in desc_lower or "longer horizon" in desc_lower:
        update_user_field(user_id, "horizon", "long")
    elif "short term" in desc_lower or "shorter horizon" in desc_lower:
        update_user_field(user_id, "horizon", "short")


def build_memory_context(user_id: str) -> str:
    """Build a formatted memory context string for agent system prompts."""
    memories = get_memories(user_id)
    if not memories:
        return "No stored preferences or context."
    lines = []
    for m in memories:
        lines.append(f"- {m['memory_key']}: {m['memory_value']}")
    return "\n".join(lines)
