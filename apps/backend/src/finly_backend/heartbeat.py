"""HEARTBEAT proactive alert system.

Pre-built alert scenarios attributed to agent personas, with an
in-memory per-user queue. Alerts are returned and cleared on poll.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta

from finly_backend.models import HeartbeatAlert

SCENARIOS: dict[str, dict] = {
    "vcb_price_drop": {
        "ticker": "VCB",
        "alert_type": "price_drop",
        "headline": "VCB dropped 3.2% intraday on heavy volume",
        "body": "Vietcombank shares fell sharply this morning after foreign funds net-sold 1.2M shares. The Market Analyst notes RSI has entered oversold territory at 28, suggesting a potential rebound. Consider this a buying opportunity if your risk tolerance allows.",
        "attributed_to": "Market Analyst",
        "severity": "warning",
    },
    "fpt_earnings_beat": {
        "ticker": "FPT",
        "alert_type": "earnings_beat",
        "headline": "FPT Q1 earnings beat consensus by 15%",
        "body": "FPT Corporation reported pre-tax profit of 3.2T VND, exceeding Street estimates by 15%. IT services segment grew 28% YoY driven by AI/cloud contracts. The Fundamentals Analyst highlights the strong earnings momentum and recommends maintaining a BUY stance.",
        "attributed_to": "Fundamentals Analyst",
        "severity": "info",
    },
    "vnm_dividend": {
        "ticker": "VNM",
        "alert_type": "earnings_beat",
        "headline": "Vinamilk announces 4,000 VND/share special dividend",
        "body": "Vinamilk declared a special dividend of 4,000 VND/share (ex-date April 5). At current prices this represents a 5.5% yield. The Portfolio Manager notes this is attractive for income-focused investors.",
        "attributed_to": "Portfolio Manager",
        "severity": "info",
    },
    "hose_sector_move": {
        "ticker": "HOSE",
        "alert_type": "sector_move",
        "headline": "Banking sector rallies 2.5% on SBV credit growth cap increase",
        "body": "The State Bank of Vietnam raised the credit growth cap for well-capitalized banks from 14% to 16%. VCB, TPB, and other major banks surged. The News Analyst attributes the move to improving macro conditions and recommends overweighting financials.",
        "attributed_to": "News Analyst",
        "severity": "info",
    },
    "tpb_upgrade": {
        "ticker": "TPB",
        "alert_type": "earnings_beat",
        "headline": "Moody's upgrades TPBank, shares jump 4%",
        "body": "Moody's upgraded TPBank's outlook from stable to positive, citing improved asset quality and digital transformation progress. The Risk Assessor notes this reduces downside risk for TPB holders.",
        "attributed_to": "Risk Assessor",
        "severity": "info",
    },
    "global_fed_hold": {
        "ticker": "HOSE",
        "alert_type": "sector_move",
        "headline": "Fed holds rates, Vietnam equities rally on EM inflows",
        "body": "The Federal Reserve kept rates unchanged and signalled a possible June cut. Emerging markets including Vietnam saw strong inflows. The Market Analyst expects continued foreign buying of VN30 blue chips.",
        "attributed_to": "Market Analyst",
        "severity": "info",
    },
    "vcb_insider_buy": {
        "ticker": "VCB",
        "alert_type": "earnings_beat",
        "headline": "VCB board member buys 50,000 shares on open market",
        "body": "A VCB board member disclosed a purchase of 50,000 shares at market price. Insider buying often signals management confidence. The Sentiment Analyst notes this aligns with positive social media sentiment around VCB.",
        "attributed_to": "Sentiment Analyst",
        "severity": "info",
    },
    "fpt_contract_win": {
        "ticker": "FPT",
        "alert_type": "sector_move",
        "headline": "FPT signs $200M AI deal with major Japanese automaker",
        "body": "FPT Corporation announced a landmark $200M multi-year AI transformation contract. This is FPT's largest single deal ever and validates their AI capabilities. The Fundamentals Analyst sees this as a strong catalyst.",
        "attributed_to": "Fundamentals Analyst",
        "severity": "critical",
    },
    "hormuz_closure": {
        "ticker": "HOSE",
        "alert_type": "sector_move",
        "headline": "Strait of Hormuz closed — oil prices spike 12%",
        "body": "Reports of a naval blockade in the Strait of Hormuz sent Brent crude up 12% in early trading. Vietnam's import-dependent industries face margin pressure. The Risk Assessor recommends reducing exposure to energy-intensive sectors and monitoring PVD, GAS closely.",
        "attributed_to": "Risk Assessor",
        "severity": "critical",
    },
    "rsi_threshold": {
        "ticker": "VCB",
        "alert_type": "price_drop",
        "headline": "VCB RSI crosses above 70 — overbought signal",
        "body": "VCB's 14-day RSI has moved above 70, indicating overbought conditions. Historically this has preceded 3-5% pullbacks within 5 trading days. The Market Analyst suggests tightening stop-losses or taking partial profits.",
        "attributed_to": "Market Analyst",
        "severity": "warning",
    },
}

# In-memory alert queues: user_id -> list of alerts
_alert_queues: dict[str, list[HeartbeatAlert]] = {}


def _make_alert(scenario_key: str, offset_minutes: int = 0) -> HeartbeatAlert:
    s = SCENARIOS[scenario_key]
    ts = datetime.now() - timedelta(minutes=offset_minutes)
    return HeartbeatAlert(
        alert_id=uuid.uuid4().hex[:12],
        timestamp=ts.isoformat(),
        ticker=s["ticker"],
        alert_type=s["alert_type"],
        headline=s["headline"],
        body=s["body"],
        attributed_to=s["attributed_to"],
        severity=s["severity"],
    )


def trigger_alert(scenario_key: str, user_id: str = "broadcast") -> HeartbeatAlert:
    """Create and enqueue an alert for a user (or broadcast to all)."""
    if scenario_key not in SCENARIOS:
        raise ValueError(f"Unknown scenario: {scenario_key}")
    alert = _make_alert(scenario_key)
    _alert_queues.setdefault(user_id, []).append(alert)
    # Also add to broadcast if targeting specific user
    if user_id != "broadcast":
        _alert_queues.setdefault("broadcast", []).append(alert)
    return alert


def get_pending_alerts(user_id: str = "broadcast") -> list[HeartbeatAlert]:
    """Return and clear pending alerts for a user."""
    user_alerts = _alert_queues.pop(user_id, [])
    broadcast_alerts = (
        _alert_queues.pop("broadcast", []) if user_id != "broadcast" else []
    )
    # Deduplicate by alert_id
    seen = set()
    combined = []
    for a in user_alerts + broadcast_alerts:
        if a.alert_id not in seen:
            seen.add(a.alert_id)
            combined.append(a)
    return combined


def trigger_custom_alert(
    ticker: str,
    headline: str,
    body: str,
    severity: str = "info",
    attributed_to: str = "Finly",
    user_id: str = "broadcast",
) -> HeartbeatAlert:
    """Create and enqueue a custom ad-hoc alert (not from SCENARIOS)."""
    alert = HeartbeatAlert(
        alert_id=uuid.uuid4().hex[:12],
        timestamp=datetime.now().isoformat(),
        ticker=ticker.upper(),
        alert_type="custom",
        headline=headline,
        body=body,
        attributed_to=attributed_to,
        severity=severity,
    )
    _alert_queues.setdefault(user_id, []).append(alert)
    if user_id != "broadcast":
        _alert_queues.setdefault("broadcast", []).append(alert)
    return alert


def seed_demo_alerts() -> None:
    """Pre-populate demo alerts on startup."""
    keys = ["fpt_earnings_beat", "hose_sector_move", "vcb_insider_buy"]
    for i, key in enumerate(keys):
        alert = _make_alert(key, offset_minutes=(len(keys) - i) * 15)
        _alert_queues.setdefault("broadcast", []).append(alert)
