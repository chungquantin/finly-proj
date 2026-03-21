"""Build user context string for injection into agent system prompts."""

from __future__ import annotations

from finly_backend.database import get_user, get_memories
from finly_backend.portfolio import get_portfolio_summary

HORIZON_LABELS = {
    "short": "Short-term (< 6 months)",
    "medium": "Medium-term (6 months – 2 years)",
    "long": "Long-term (2+ years)",
}

KNOWLEDGE_LABELS = {
    1: "Beginner — explain simply, avoid jargon",
    2: "Intermediate — can handle standard financial concepts",
    3: "Advanced — comfortable with technical analysis and complex instruments",
}


def build_user_context(user_id: str) -> str:
    """Build a comprehensive user context string for agent prompts.

    Includes risk profile, investment horizon, knowledge level,
    portfolio holdings, investment goals, and stored memories.
    """
    user = get_user(user_id)
    if not user:
        return ""

    risk = user.get("risk_score", 50)
    horizon = user.get("horizon", "medium")
    knowledge = user.get("knowledge", 1)
    goals = user.get("goals_brief", "")

    # Risk label
    if risk <= 25:
        risk_label = "Very Conservative"
    elif risk <= 40:
        risk_label = "Conservative"
    elif risk <= 60:
        risk_label = "Moderate"
    elif risk <= 75:
        risk_label = "Aggressive"
    else:
        risk_label = "Very Aggressive"

    portfolio_summary = get_portfolio_summary(user_id)

    memories = get_memories(user_id)
    memory_lines = []
    for m in memories:
        if m["memory_key"] not in ("investment_goals",):  # avoid duplication with goals
            memory_lines.append(f"- {m['memory_key']}: {m['memory_value']}")
    memory_str = "\n".join(memory_lines) if memory_lines else "None"

    # Knowledge-adaptive language instructions
    if knowledge <= 1:
        lang_instructions = """\
- Use simple, everyday language — explain like you're talking to a friend who is new to investing.
- Avoid jargon. If you must use a financial term, briefly explain what it means in parentheses.
- Use analogies and relatable examples to explain concepts.
- Say "the stock price went up" not "the equity appreciated"."""
    elif knowledge == 2:
        lang_instructions = """\
- Use clear language with standard financial terms (P/E ratio, market cap, dividends, etc.).
- You can reference common concepts without over-explaining, but still avoid obscure jargon.
- Be concise — this investor knows the basics."""
    else:
        lang_instructions = """\
- Use precise financial terminology freely (alpha, Sharpe ratio, DCF, sector rotation, etc.).
- Include technical details and quantitative analysis where relevant.
- This investor is experienced — be direct and data-driven, skip basic explanations."""

    context = f"""\
INVESTOR PROFILE
- Risk tolerance: {risk}/100 ({risk_label})
- Investment horizon: {HORIZON_LABELS.get(horizon, horizon)}
- Knowledge level: {knowledge}/3 ({KNOWLEDGE_LABELS.get(knowledge, "Unknown")})

INVESTMENT GOALS
{goals or "Not specified yet."}

CURRENT PORTFOLIO
{portfolio_summary}

USER PREFERENCES & MEMORIES
{memory_str}

INSTRUCTIONS FOR AGENTS
{lang_instructions}
- Keep answers short: 1 paragraph for reports, 1-2 sentences for chat.
- Match your advice to this investor's risk comfort and time horizon.
- If risk < 40, focus on safety and protecting their money.
- If risk > 70, focus on growth opportunities.
- Consider what they already own — don't suggest putting too much in one thing.
- Reference any stored preferences from the user's memories.
"""
    return context.strip()
