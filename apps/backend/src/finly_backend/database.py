"""SQLite database layer for Finly agents."""

from __future__ import annotations

import json
import os
import sqlite3
import uuid
from contextlib import contextmanager
from typing import Any

DB_PATH = os.getenv("FINLY_DB_PATH", "") or os.path.join(
    os.getcwd(), "finly.db"
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
    conv_type     TEXT NOT NULL CHECK (conv_type IN ('intake', 'chat', 'panel', 'onboarding_voice')),
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
    specialist_insights_json TEXT DEFAULT '[]',
    intake_brief  TEXT DEFAULT '',
    created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS report_tickers (
    report_id      TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    user_id        TEXT NOT NULL REFERENCES users(user_id),
    ticker         TEXT NOT NULL,
    relation_type  TEXT NOT NULL CHECK (relation_type IN ('primary', 'related')),
    reason         TEXT DEFAULT '',
    created_at     TEXT DEFAULT (datetime('now')),
    UNIQUE(report_id, ticker)
);

CREATE INDEX IF NOT EXISTS idx_portfolios_user ON portfolios(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, conv_type);
CREATE INDEX IF NOT EXISTS idx_memories_user ON user_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_report_tickers_user_ticker ON report_tickers(user_id, ticker);
CREATE INDEX IF NOT EXISTS idx_report_tickers_report ON report_tickers(report_id);

CREATE TABLE IF NOT EXISTS heartbeat_rules (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(user_id),
    raw_rule        TEXT NOT NULL,
    parsed_condition TEXT NOT NULL,
    is_active       INTEGER DEFAULT 1,
    created_at      TEXT DEFAULT (datetime('now')),
    last_checked_at TEXT
);

CREATE TABLE IF NOT EXISTS heartbeat_results (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(user_id),
    rule_id         TEXT,
    ticker          TEXT NOT NULL,
    decision        TEXT NOT NULL,
    summary         TEXT NOT NULL,
    full_analysis   TEXT DEFAULT '',
    severity        TEXT DEFAULT 'info',
    is_read         INTEGER DEFAULT 0,
    created_at      TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (rule_id) REFERENCES heartbeat_rules(id)
);

CREATE INDEX IF NOT EXISTS idx_heartbeat_rules_user ON heartbeat_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_heartbeat_results_user ON heartbeat_results(user_id);
"""


_initialized = False


def _get_connection() -> sqlite3.Connection:
    global _initialized
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    if not _initialized:
        conn.executescript(_CREATE_TABLES)
        _initialized = True
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


def _migrate_conversations_conv_type(conn: sqlite3.Connection) -> None:
    """Recreate conversations table if its CHECK constraint is missing 'onboarding_voice'."""
    try:
        # Test if the new conv_type is accepted
        conn.execute(
            "INSERT INTO conversations (id, user_id, conv_type, role, content) VALUES (?, ?, ?, ?, ?)",
            ("__migration_test__", "__test__", "onboarding_voice", "system", "test"),
        )
        conn.execute("DELETE FROM conversations WHERE id = '__migration_test__'")
    except sqlite3.IntegrityError:
        # Old constraint — recreate table with updated constraint
        conn.executescript("""
            CREATE TABLE conversations_new (
                id            TEXT PRIMARY KEY,
                user_id       TEXT NOT NULL,
                conv_type     TEXT NOT NULL CHECK (conv_type IN ('intake', 'chat', 'panel', 'onboarding_voice')),
                role          TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
                agent_role    TEXT,
                content       TEXT NOT NULL,
                metadata_json TEXT DEFAULT '{}',
                created_at    TEXT DEFAULT (datetime('now'))
            );
            INSERT INTO conversations_new SELECT * FROM conversations;
            DROP TABLE conversations;
            ALTER TABLE conversations_new RENAME TO conversations;
            CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, conv_type);
        """)


def init_db() -> None:
    with get_db() as conn:
        conn.executescript(_CREATE_TABLES)
        _ensure_column(
            conn,
            "reports",
            "specialist_insights_json",
            "TEXT DEFAULT '[]'",
        )
        _ensure_column(
            conn,
            "report_tickers",
            "reason",
            "TEXT DEFAULT ''",
        )
        _migrate_conversations_conv_type(conn)


def _ensure_column(
    conn: sqlite3.Connection,
    table_name: str,
    column_name: str,
    column_definition: str,
) -> None:
    columns = {
        row["name"]
        for row in conn.execute(f"PRAGMA table_info({table_name})").fetchall()
    }
    if column_name not in columns:
        conn.execute(
            f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_definition}"
        )


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
    user_id: str,
    conv_type: str = "chat",
    limit: int = 50,
    metadata_filters: dict[str, Any] | None = None,
) -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            """SELECT * FROM conversations
               WHERE user_id = ? AND conv_type = ?
               ORDER BY created_at DESC LIMIT ?""",
            (user_id, conv_type, max(limit * 5, limit)),
        ).fetchall()
        results: list[dict] = []
        for row in reversed(rows):
            item = dict(row)
            metadata = json.loads(item.get("metadata_json", "{}") or "{}")
            item["metadata"] = metadata
            if metadata_filters:
                if not all(metadata.get(key) == value for key, value in metadata_filters.items()):
                    continue
            results.append(item)
        return results[-limit:]


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
    specialist_insights: list[dict],
    intake_brief: str = "",
    additional_tickers: list[dict] | None = None,
) -> dict:
    report_id = uuid.uuid4().hex[:12]
    normalized_primary = ticker.upper()
    additional_tickers = additional_tickers or []
    with get_db() as conn:
        conn.execute(
            """INSERT INTO reports (id, user_id, ticker, decision, summary, full_report, agent_reasoning_json, specialist_insights_json, intake_brief)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                report_id,
                user_id,
                normalized_primary,
                decision,
                summary,
                full_report,
                json.dumps(agent_reasoning),
                json.dumps(specialist_insights),
                intake_brief,
            ),
        )
        conn.execute(
            """INSERT OR IGNORE INTO report_tickers (report_id, user_id, ticker, relation_type, reason)
               VALUES (?, ?, ?, 'primary', '')""",
            (report_id, user_id, normalized_primary),
        )
        for suggestion in additional_tickers:
            raw_ticker = str(suggestion.get("ticker", "")).strip().upper()
            if not raw_ticker or raw_ticker == normalized_primary:
                continue
            reason = str(suggestion.get("reason", "")).strip()
            conn.execute(
                """INSERT OR IGNORE INTO report_tickers (report_id, user_id, ticker, relation_type, reason)
                   VALUES (?, ?, ?, 'related', ?)""",
                (report_id, user_id, raw_ticker, reason),
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
            d["specialist_insights"] = json.loads(
                d.pop("specialist_insights_json", "[]")
            )
            results.append(d)
        return results


def get_report_related_tickers(report_id: str) -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            """SELECT ticker, reason FROM report_tickers
               WHERE report_id = ? AND relation_type = 'related'
               ORDER BY created_at ASC""",
            (report_id,),
        ).fetchall()
        return [{"ticker": row["ticker"], "reason": row["reason"] or ""} for row in rows]


def get_reports_for_ticker(user_id: str, ticker: str, limit: int = 20) -> list[dict]:
    normalized_ticker = ticker.strip().upper()
    with get_db() as conn:
        rows = conn.execute(
            """SELECT
                   r.*,
                   rt.ticker AS related_ticker,
                   rt.relation_type AS related_ticker_relation_type,
                   rt.reason AS related_ticker_reason
               FROM reports r
               INNER JOIN report_tickers rt ON rt.report_id = r.id
               WHERE r.user_id = ? AND rt.user_id = ? AND rt.ticker = ?
               ORDER BY r.created_at DESC
               LIMIT ?""",
            (user_id, user_id, normalized_ticker, limit),
        ).fetchall()
        results = []
        for r in rows:
            d = dict(r)
            d["agent_reasoning"] = json.loads(d.pop("agent_reasoning_json", "{}"))
            d["specialist_insights"] = json.loads(
                d.pop("specialist_insights_json", "[]")
            )
            results.append(d)
        return results


def get_latest_report(user_id: str) -> dict | None:
    reports = get_reports(user_id, limit=1)
    return reports[0] if reports else None


def get_report(report_id: str, user_id: str | None = None) -> dict | None:
    with get_db() as conn:
        if user_id:
            row = conn.execute(
                "SELECT * FROM reports WHERE id = ? AND user_id = ?",
                (report_id, user_id),
            ).fetchone()
        else:
            row = conn.execute(
                "SELECT * FROM reports WHERE id = ?",
                (report_id,),
            ).fetchone()
        if not row:
            return None
        result = dict(row)
        result["agent_reasoning"] = json.loads(result.pop("agent_reasoning_json", "{}"))
        result["specialist_insights"] = json.loads(
            result.pop("specialist_insights_json", "[]")
        )
        result["additional_tickers"] = get_report_related_tickers(report_id)
        return result


# ---------------------------------------------------------------------------
# Heartbeat Rules
# ---------------------------------------------------------------------------


def create_heartbeat_rule(
    user_id: str,
    raw_rule: str,
    parsed_condition: dict,
) -> dict:
    rule_id = uuid.uuid4().hex[:12]
    with get_db() as conn:
        conn.execute(
            """INSERT INTO heartbeat_rules (id, user_id, raw_rule, parsed_condition)
               VALUES (?, ?, ?, ?)""",
            (rule_id, user_id, raw_rule, json.dumps(parsed_condition)),
        )
        row = conn.execute(
            "SELECT * FROM heartbeat_rules WHERE id = ?", (rule_id,)
        ).fetchone()
        return dict(row)


def get_heartbeat_rules(user_id: str) -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM heartbeat_rules WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
        results = []
        for r in rows:
            d = dict(r)
            d["parsed_condition"] = json.loads(d["parsed_condition"])
            results.append(d)
        return results


def get_active_heartbeat_rules() -> list[dict]:
    """Get all active rules across all users (for scheduler)."""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM heartbeat_rules WHERE is_active = 1 ORDER BY user_id",
        ).fetchall()
        results = []
        for r in rows:
            d = dict(r)
            d["parsed_condition"] = json.loads(d["parsed_condition"])
            results.append(d)
        return results


def delete_heartbeat_rule(rule_id: str) -> bool:
    with get_db() as conn:
        cursor = conn.execute(
            "DELETE FROM heartbeat_rules WHERE id = ?", (rule_id,)
        )
        return cursor.rowcount > 0


def toggle_heartbeat_rule(rule_id: str) -> dict | None:
    with get_db() as conn:
        conn.execute(
            "UPDATE heartbeat_rules SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END WHERE id = ?",
            (rule_id,),
        )
        row = conn.execute(
            "SELECT * FROM heartbeat_rules WHERE id = ?", (rule_id,)
        ).fetchone()
        if not row:
            return None
        d = dict(row)
        d["parsed_condition"] = json.loads(d["parsed_condition"])
        return d


def update_rule_last_checked(rule_id: str) -> None:
    with get_db() as conn:
        conn.execute(
            "UPDATE heartbeat_rules SET last_checked_at = datetime('now') WHERE id = ?",
            (rule_id,),
        )


# ---------------------------------------------------------------------------
# Heartbeat Results
# ---------------------------------------------------------------------------


def save_heartbeat_result(
    user_id: str,
    ticker: str,
    decision: str,
    summary: str,
    full_analysis: str = "",
    severity: str = "info",
    rule_id: str | None = None,
) -> dict:
    result_id = uuid.uuid4().hex[:12]
    with get_db() as conn:
        conn.execute(
            """INSERT INTO heartbeat_results (id, user_id, rule_id, ticker, decision, summary, full_analysis, severity)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (result_id, user_id, rule_id, ticker.upper(), decision, summary, full_analysis, severity),
        )
        row = conn.execute(
            "SELECT * FROM heartbeat_results WHERE id = ?", (result_id,)
        ).fetchone()
        return dict(row)


def get_heartbeat_results(user_id: str, unread_only: bool = False, limit: int = 50) -> list[dict]:
    with get_db() as conn:
        if unread_only:
            rows = conn.execute(
                "SELECT * FROM heartbeat_results WHERE user_id = ? AND is_read = 0 ORDER BY created_at DESC LIMIT ?",
                (user_id, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM heartbeat_results WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
                (user_id, limit),
            ).fetchall()
        return [dict(r) for r in rows]


def mark_heartbeat_result_read(result_id: str) -> bool:
    with get_db() as conn:
        cursor = conn.execute(
            "UPDATE heartbeat_results SET is_read = 1 WHERE id = ?", (result_id,)
        )
        return cursor.rowcount > 0


def get_heartbeat_unread_count(user_id: str) -> int:
    with get_db() as conn:
        row = conn.execute(
            "SELECT COUNT(*) as cnt FROM heartbeat_results WHERE user_id = ? AND is_read = 0",
            (user_id,),
        ).fetchone()
        return row["cnt"] if row else 0
