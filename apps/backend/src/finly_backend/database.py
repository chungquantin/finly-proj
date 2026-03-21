"""SQLite database layer for Finly agents."""

from __future__ import annotations

import json
import os
import sqlite3
import uuid
from contextlib import contextmanager
from typing import Any

DB_PATH = os.getenv(
    "FINLY_DB_PATH", os.path.join(os.path.dirname(__file__), "finly.db")
)

_CREATE_TABLES = """
CREATE TABLE IF NOT EXISTS users (
    user_id       TEXT PRIMARY KEY,
    risk_score    INTEGER DEFAULT 50 CHECK (risk_score BETWEEN 0 AND 100),
    horizon       TEXT DEFAULT 'medium' CHECK (horizon IN ('short', 'medium', 'long')),
    knowledge     INTEGER DEFAULT 1 CHECK (knowledge BETWEEN 1 AND 3),
    goals_brief   TEXT DEFAULT '',
    created_at    TEXT DEFAULT (datetime('now')),
    updated_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS portfolios (
    id            TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL REFERENCES users(user_id),
    asset_type    TEXT NOT NULL CHECK (asset_type IN ('stock', 'crypto')),
    ticker        TEXT NOT NULL,
    quantity      REAL DEFAULT 0,
    avg_cost      REAL DEFAULT 0,
    wallet_address TEXT,
    created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversations (
    id            TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL REFERENCES users(user_id),
    conv_type     TEXT NOT NULL CHECK (conv_type IN ('intake', 'chat', 'panel')),
    role          TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    agent_role    TEXT,
    content       TEXT NOT NULL,
    metadata_json TEXT DEFAULT '{}',
    created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_memories (
    id            TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL REFERENCES users(user_id),
    memory_key    TEXT NOT NULL,
    memory_value  TEXT NOT NULL,
    source        TEXT DEFAULT 'conversation',
    created_at    TEXT DEFAULT (datetime('now')),
    updated_at    TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, memory_key)
);

CREATE TABLE IF NOT EXISTS reports (
    id            TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL REFERENCES users(user_id),
    ticker        TEXT NOT NULL,
    decision      TEXT,
    summary       TEXT,
    full_report   TEXT,
    agent_reasoning_json TEXT DEFAULT '{}',
    intake_brief  TEXT DEFAULT '',
    created_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_portfolios_user ON portfolios(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, conv_type);
CREATE INDEX IF NOT EXISTS idx_memories_user ON user_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id);
"""


def _get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def get_db():
    conn = _get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    with get_db() as conn:
        conn.executescript(_CREATE_TABLES)


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------


def upsert_user(
    user_id: str,
    risk_score: int = 50,
    horizon: str = "medium",
    knowledge: int = 1,
    goals_brief: str = "",
) -> dict:
    with get_db() as conn:
        conn.execute(
            """INSERT INTO users (user_id, risk_score, horizon, knowledge, goals_brief, updated_at)
               VALUES (?, ?, ?, ?, ?, datetime('now'))
               ON CONFLICT(user_id) DO UPDATE SET
                   risk_score = excluded.risk_score,
                   horizon = excluded.horizon,
                   knowledge = excluded.knowledge,
                   goals_brief = CASE WHEN excluded.goals_brief = '' THEN users.goals_brief ELSE excluded.goals_brief END,
                   updated_at = datetime('now')""",
            (user_id, risk_score, horizon, knowledge, goals_brief),
        )
        row = conn.execute(
            "SELECT * FROM users WHERE user_id = ?", (user_id,)
        ).fetchone()
        return dict(row)


def get_user(user_id: str) -> dict | None:
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE user_id = ?", (user_id,)
        ).fetchone()
        return dict(row) if row else None


def update_user_field(user_id: str, field: str, value: Any) -> dict | None:
    allowed = {"risk_score", "horizon", "knowledge", "goals_brief"}
    if field not in allowed:
        raise ValueError(f"Cannot update field: {field}")
    with get_db() as conn:
        conn.execute(
            f"UPDATE users SET {field} = ?, updated_at = datetime('now') WHERE user_id = ?",
            (value, user_id),
        )
        row = conn.execute(
            "SELECT * FROM users WHERE user_id = ?", (user_id,)
        ).fetchone()
        return dict(row) if row else None


# ---------------------------------------------------------------------------
# Portfolios
# ---------------------------------------------------------------------------


def add_portfolio_item(
    user_id: str,
    asset_type: str,
    ticker: str,
    quantity: float = 0,
    avg_cost: float = 0,
    wallet_address: str | None = None,
) -> dict:
    item_id = uuid.uuid4().hex[:12]
    with get_db() as conn:
        conn.execute(
            """INSERT INTO portfolios (id, user_id, asset_type, ticker, quantity, avg_cost, wallet_address)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                item_id,
                user_id,
                asset_type,
                ticker.upper(),
                quantity,
                avg_cost,
                wallet_address,
            ),
        )
        row = conn.execute(
            "SELECT * FROM portfolios WHERE id = ?", (item_id,)
        ).fetchone()
        return dict(row)


def get_portfolio(user_id: str) -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM portfolios WHERE user_id = ? ORDER BY created_at", (user_id,)
        ).fetchall()
        return [dict(r) for r in rows]


def clear_portfolio(user_id: str) -> None:
    with get_db() as conn:
        conn.execute("DELETE FROM portfolios WHERE user_id = ?", (user_id,))


# ---------------------------------------------------------------------------
# Conversations
# ---------------------------------------------------------------------------


def append_conversation(
    user_id: str,
    conv_type: str,
    role: str,
    content: str,
    agent_role: str | None = None,
    metadata: dict | None = None,
) -> dict:
    msg_id = uuid.uuid4().hex[:12]
    with get_db() as conn:
        conn.execute(
            """INSERT INTO conversations (id, user_id, conv_type, role, agent_role, content, metadata_json)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                msg_id,
                user_id,
                conv_type,
                role,
                agent_role,
                content,
                json.dumps(metadata or {}),
            ),
        )
        row = conn.execute(
            "SELECT * FROM conversations WHERE id = ?", (msg_id,)
        ).fetchone()
        return dict(row)


def get_conversation_history(
    user_id: str, conv_type: str = "chat", limit: int = 50
) -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            """SELECT * FROM conversations
               WHERE user_id = ? AND conv_type = ?
               ORDER BY created_at DESC LIMIT ?""",
            (user_id, conv_type, limit),
        ).fetchall()
        return [dict(r) for r in reversed(rows)]


# ---------------------------------------------------------------------------
# User Memories
# ---------------------------------------------------------------------------


def upsert_memory(
    user_id: str, key: str, value: str, source: str = "conversation"
) -> dict:
    mem_id = uuid.uuid4().hex[:12]
    with get_db() as conn:
        conn.execute(
            """INSERT INTO user_memories (id, user_id, memory_key, memory_value, source, updated_at)
               VALUES (?, ?, ?, ?, ?, datetime('now'))
               ON CONFLICT(user_id, memory_key) DO UPDATE SET
                   memory_value = excluded.memory_value,
                   source = excluded.source,
                   updated_at = datetime('now')""",
            (mem_id, user_id, key, value, source),
        )
        row = conn.execute(
            "SELECT * FROM user_memories WHERE user_id = ? AND memory_key = ?",
            (user_id, key),
        ).fetchone()
        return dict(row)


def get_memories(user_id: str) -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM user_memories WHERE user_id = ? ORDER BY updated_at DESC",
            (user_id,),
        ).fetchall()
        return [dict(r) for r in rows]


def get_memory(user_id: str, key: str) -> str | None:
    with get_db() as conn:
        row = conn.execute(
            "SELECT memory_value FROM user_memories WHERE user_id = ? AND memory_key = ?",
            (user_id, key),
        ).fetchone()
        return row["memory_value"] if row else None


def delete_memory(user_id: str, key: str) -> bool:
    with get_db() as conn:
        cursor = conn.execute(
            "DELETE FROM user_memories WHERE user_id = ? AND memory_key = ?",
            (user_id, key),
        )
        return cursor.rowcount > 0


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------


def save_report(
    user_id: str,
    ticker: str,
    decision: str,
    summary: str,
    full_report: str,
    agent_reasoning: dict,
    intake_brief: str = "",
) -> dict:
    report_id = uuid.uuid4().hex[:12]
    with get_db() as conn:
        conn.execute(
            """INSERT INTO reports (id, user_id, ticker, decision, summary, full_report, agent_reasoning_json, intake_brief)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                report_id,
                user_id,
                ticker,
                decision,
                summary,
                full_report,
                json.dumps(agent_reasoning),
                intake_brief,
            ),
        )
        row = conn.execute(
            "SELECT * FROM reports WHERE id = ?", (report_id,)
        ).fetchone()
        return dict(row)


def get_reports(user_id: str, limit: int = 10) -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM reports WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
        results = []
        for r in rows:
            d = dict(r)
            d["agent_reasoning"] = json.loads(d.pop("agent_reasoning_json", "{}"))
            results.append(d)
        return results


def get_latest_report(user_id: str) -> dict | None:
    reports = get_reports(user_id, limit=1)
    return reports[0] if reports else None
