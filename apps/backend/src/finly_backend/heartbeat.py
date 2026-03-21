"""HEARTBEAT analysis system.

Provides:
1. One-shot portfolio risk analysis via the full TradingAgentsGraph pipeline
2. Background scheduler that evaluates user-defined rules every 15 minutes
   during market hours and triggers full pipeline analysis when conditions are met
"""

from __future__ import annotations

import asyncio
import logging
import threading
from datetime import datetime, timezone, timedelta

logger = logging.getLogger("finly_backend.heartbeat")

# US Eastern timezone offset (simplified — doesn't handle DST perfectly)
_ET_OFFSET = timedelta(hours=-4)  # EDT


def _is_market_hours() -> bool:
    """Check if US stock market is currently open (9:30-16:00 ET, weekdays)."""
    now_utc = datetime.now(timezone.utc)
    now_et = now_utc + _ET_OFFSET
    if now_et.weekday() >= 5:  # Saturday=5, Sunday=6
        return False
    market_open = now_et.replace(hour=9, minute=30, second=0, microsecond=0)
    market_close = now_et.replace(hour=16, minute=0, second=0, microsecond=0)
    return market_open <= now_et <= market_close


def _evaluate_condition(parsed: dict, market_price: float, prev_close: float) -> bool:
    """Evaluate a parsed rule condition against current market data."""
    metric = parsed.get("metric", "price")
    operator = parsed.get("operator", "lt")
    threshold = float(parsed.get("threshold", 0))

    if metric == "price":
        value = market_price
    elif metric == "price_change_pct":
        if prev_close == 0:
            return False
        value = ((market_price - prev_close) / prev_close) * 100
    else:
        return False  # unsupported metric

    if operator == "gt":
        return value > threshold
    elif operator == "lt":
        return value < threshold
    elif operator == "gte":
        return value >= threshold
    elif operator == "lte":
        return value <= threshold
    return False


def _fetch_market_price(ticker: str) -> tuple[float, float]:
    """Fetch current price and previous close for a ticker.

    Returns (current_price, prev_close). Uses yfinance for real data,
    falls back to mock for VN tickers.
    """
    try:
        from finly_backend.mock_data import is_vn_ticker
        if is_vn_ticker(ticker):
            from finly_backend.mock_data import _generate_ohlcv
            data = _generate_ohlcv(ticker, days=2)
            if len(data) >= 2:
                return data[-1]["Close"], data[-2]["Close"]
            elif data:
                return data[-1]["Close"], data[-1]["Open"]
            return 0.0, 0.0
    except Exception:
        pass

    try:
        import yfinance as yf
        t = yf.Ticker(ticker)
        hist = t.history(period="2d")
        if len(hist) >= 2:
            return float(hist["Close"].iloc[-1]), float(hist["Close"].iloc[-2])
        elif len(hist) >= 1:
            return float(hist["Close"].iloc[-1]), float(hist["Open"].iloc[-1])
    except Exception as e:
        logger.warning("Failed to fetch market price for %s: %s", ticker, e)

    return 0.0, 0.0


async def _check_rules_cycle() -> None:
    """Run one cycle of rule checking."""
    from finly_backend.database import (
        get_active_heartbeat_rules,
        save_heartbeat_result,
        update_rule_last_checked,
    )
    from finly_backend.context import build_user_context
    from finly_backend import agent_client

    if not _is_market_hours():
        logger.debug("Heartbeat: outside market hours, skipping rule check")
        return

    rules = get_active_heartbeat_rules()
    if not rules:
        return

    logger.info("Heartbeat: checking %d active rules", len(rules))

    # Group rules by user to build context once per user
    user_rules: dict[str, list[dict]] = {}
    for rule in rules:
        user_rules.setdefault(rule["user_id"], []).append(rule)

    for user_id, user_rule_list in user_rules.items():
        user_context = build_user_context(user_id)

        for rule in user_rule_list:
            try:
                parsed = rule["parsed_condition"]
                ticker = parsed.get("ticker", "").upper()
                if not ticker:
                    continue

                current_price, prev_close = _fetch_market_price(ticker)
                if current_price == 0:
                    logger.warning("Heartbeat: no price data for %s, skipping", ticker)
                    update_rule_last_checked(rule["id"])
                    continue

                triggered = _evaluate_condition(parsed, current_price, prev_close)
                update_rule_last_checked(rule["id"])

                if not triggered:
                    continue

                logger.info(
                    "Heartbeat: rule %s triggered for %s (user %s)",
                    rule["id"], ticker, user_id,
                )

                # Run full pipeline analysis
                try:
                    result = await agent_client.call_heartbeat_analyze(
                        ticker=ticker, user_context=user_context
                    )
                    save_heartbeat_result(
                        user_id=user_id,
                        ticker=ticker,
                        decision=result.get("decision", "HOLD"),
                        summary=result.get("summary", ""),
                        full_analysis=result.get("full_analysis", ""),
                        severity=result.get("severity", "info"),
                        rule_id=rule["id"],
                    )
                except Exception as e:
                    logger.exception(
                        "Heartbeat: pipeline failed for rule %s ticker %s: %s",
                        rule["id"], ticker, e,
                    )
            except Exception as e:
                logger.exception("Heartbeat: error processing rule %s: %s", rule["id"], e)


_scheduler_running = False
_scheduler_timer: threading.Timer | None = None
_CHECK_INTERVAL = 15 * 60  # 15 minutes


def _scheduler_tick() -> None:
    """Called every 15 minutes by the background timer."""
    global _scheduler_timer
    try:
        loop = asyncio.new_event_loop()
        loop.run_until_complete(_check_rules_cycle())
        loop.close()
    except Exception:
        logger.exception("Heartbeat scheduler tick failed")
    finally:
        # Schedule next tick
        if _scheduler_running:
            _scheduler_timer = threading.Timer(_CHECK_INTERVAL, _scheduler_tick)
            _scheduler_timer.daemon = True
            _scheduler_timer.start()


def start_heartbeat_scheduler() -> None:
    """Start the background heartbeat scheduler (15-min interval)."""
    global _scheduler_running, _scheduler_timer
    if _scheduler_running:
        return
    _scheduler_running = True
    logger.info("Heartbeat scheduler started (every %d seconds)", _CHECK_INTERVAL)
    _scheduler_timer = threading.Timer(_CHECK_INTERVAL, _scheduler_tick)
    _scheduler_timer.daemon = True
    _scheduler_timer.start()


def stop_heartbeat_scheduler() -> None:
    """Stop the background heartbeat scheduler."""
    global _scheduler_running, _scheduler_timer
    _scheduler_running = False
    if _scheduler_timer:
        _scheduler_timer.cancel()
        _scheduler_timer = None
    logger.info("Heartbeat scheduler stopped")
