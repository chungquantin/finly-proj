"""User profile and chat history — SQLite-backed.

This module wraps the database layer to maintain backward compatibility
with existing code that imports from profiles.py.
"""

from __future__ import annotations

from finly_backend.database import (
    append_conversation,
    get_conversation_history,
    get_user,
    upsert_user,
)
from finly_backend.models import OnboardingRequest, UserProfile


def create_or_update_profile(req: OnboardingRequest) -> UserProfile:
    row = upsert_user(
        user_id=req.user_id,
        risk_score=req.risk_score,
        horizon=req.horizon,
        knowledge=req.knowledge,
    )
    return UserProfile(**row)


def get_profile(user_id: str) -> UserProfile | None:
    row = get_user(user_id)
    if not row:
        return None
    return UserProfile(**row)


def append_chat(user_id: str, role: str, content: str) -> None:
    append_conversation(user_id, "chat", role, content)


def get_chat_history(user_id: str, limit: int = 20) -> list[dict]:
    return get_conversation_history(user_id, "chat", limit=limit)
