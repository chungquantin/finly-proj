"""Portfolio import system — mock data, CSV prefill, manual input."""

from __future__ import annotations

import csv
import io
import logging

from finly_backend.database import add_portfolio_item, clear_portfolio, get_portfolio

logger = logging.getLogger("finly_agents.portfolio")

# Pre-built mock portfolios for demo
MOCK_PORTFOLIOS = {
    "conservative": [
        {"ticker": "VCB", "quantity": 500, "avg_cost": 92000, "asset_type": "stock"},
        {"ticker": "VNM", "quantity": 300, "avg_cost": 70000, "asset_type": "stock"},
    ],
    "moderate": [
        {"ticker": "VCB", "quantity": 300, "avg_cost": 92000, "asset_type": "stock"},
        {"ticker": "FPT", "quantity": 200, "avg_cost": 125000, "asset_type": "stock"},
        {"ticker": "VNM", "quantity": 150, "avg_cost": 70000, "asset_type": "stock"},
    ],
    "aggressive": [
        {"ticker": "FPT", "quantity": 500, "avg_cost": 125000, "asset_type": "stock"},
        {"ticker": "TPB", "quantity": 1000, "avg_cost": 22000, "asset_type": "stock"},
        {"ticker": "VCB", "quantity": 100, "avg_cost": 92000, "asset_type": "stock"},
    ],
}

# Mock CSV content for the "prefill" option
MOCK_CSV_CONTENT = """\
ticker,quantity,avg_cost
VCB,300,92000
FPT,200,125000
VNM,150,70000
TPB,500,22000
"""


def import_mock(user_id: str, profile_type: str = "moderate") -> list[dict]:
    """Import a pre-built mock portfolio based on risk profile."""
    clear_portfolio(user_id)
    items = MOCK_PORTFOLIOS.get(profile_type, MOCK_PORTFOLIOS["moderate"])
    for item in items:
        add_portfolio_item(
            user_id=user_id,
            asset_type=item["asset_type"],
            ticker=item["ticker"],
            quantity=item["quantity"],
            avg_cost=item["avg_cost"],
        )
    return get_portfolio(user_id)


def import_csv(user_id: str, csv_data: str) -> list[dict]:
    """Parse CSV string and import portfolio items.

    Expected CSV format:
        ticker,quantity,avg_cost
        VCB,300,92000
        FPT,200,125000
    """
    clear_portfolio(user_id)
    reader = csv.DictReader(io.StringIO(csv_data.strip()))
    for row in reader:
        ticker = row.get("ticker", "").strip().upper()
        if not ticker:
            continue
        try:
            quantity = float(row.get("quantity", 0))
            avg_cost = float(row.get("avg_cost", 0))
        except (ValueError, TypeError):
            continue
        asset_type = row.get("asset_type", "stock").strip().lower()
        if asset_type not in ("stock", "crypto"):
            asset_type = "stock"
        add_portfolio_item(
            user_id=user_id,
            asset_type=asset_type,
            ticker=ticker,
            quantity=quantity,
            avg_cost=avg_cost,
        )
    return get_portfolio(user_id)


def import_manual(user_id: str, items: list[dict]) -> list[dict]:
    """Import manually provided portfolio items.

    Each item: {ticker, quantity, avg_cost, asset_type?, wallet_address?}
    """
    clear_portfolio(user_id)
    for item in items:
        ticker = item.get("ticker", "").strip().upper()
        if not ticker:
            continue
        add_portfolio_item(
            user_id=user_id,
            asset_type=item.get("asset_type", "stock"),
            ticker=ticker,
            quantity=float(item.get("quantity", 0)),
            avg_cost=float(item.get("avg_cost", 0)),
            wallet_address=item.get("wallet_address"),
        )
    return get_portfolio(user_id)


def import_portfolio(user_id: str, mode: str, items: list[dict] | None = None, csv_data: str | None = None) -> list[dict]:
    """Unified portfolio import entry point."""
    if mode == "mock":
        # Determine profile type from user's risk score
        from finly_backend.database import get_user
        user = get_user(user_id)
        risk = user.get("risk_score", 50) if user else 50
        if risk <= 30:
            profile_type = "conservative"
        elif risk <= 70:
            profile_type = "moderate"
        else:
            profile_type = "aggressive"
        return import_mock(user_id, profile_type)

    elif mode == "csv":
        data = csv_data or MOCK_CSV_CONTENT
        return import_csv(user_id, data)

    elif mode == "manual":
        return import_manual(user_id, items or [])

    else:
        raise ValueError(f"Unknown import mode: {mode}")


def get_portfolio_summary(user_id: str) -> str:
    """Return a human-readable portfolio summary for agent context."""
    items = get_portfolio(user_id)
    if not items:
        return "No portfolio holdings."
    lines = []
    for p in items:
        line = f"{p['ticker']}: {p['quantity']} shares @ {p['avg_cost']} avg cost"
        if p.get("wallet_address"):
            line += f" (wallet: {p['wallet_address'][:8]}...)"
        lines.append(line)
    return "; ".join(lines)
