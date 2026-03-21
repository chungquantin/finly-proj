"""Financial Datasets API vendor (https://api.financialdatasets.ai/).

Drop-in alternative to yfinance for stock data, fundamentals, and financials.
Requires FINANCIAL_DATASETS_API_KEY env var.
"""

from __future__ import annotations

import os
from datetime import datetime
from typing import Annotated

import httpx

_BASE_URL = "https://api.financialdatasets.ai"
_TIMEOUT = 30.0


def _api_key() -> str:
    key = os.getenv("FINANCIAL_DATASETS_API_KEY", "")
    if not key:
        raise RuntimeError("FINANCIAL_DATASETS_API_KEY is not set")
    return key


class FinancialDatasetsError(Exception):
    """Raised when the API returns an error so callers can fall back gracefully."""
    pass


def _get(path: str, params: dict | None = None) -> dict:
    headers = {"X-API-Key": _api_key()}
    with httpx.Client(timeout=_TIMEOUT, follow_redirects=True) as client:
        resp = client.get(f"{_BASE_URL}{path}", headers=headers, params=params or {})
        if resp.status_code == 402:
            raise FinancialDatasetsError(
                f"Financial Datasets API: Payment required for {params}. "
                "This ticker/data may not be available on the current plan."
            )
        if resp.status_code >= 400:
            raise FinancialDatasetsError(
                f"Financial Datasets API error {resp.status_code} for {path}: {resp.text[:200]}"
            )
        return resp.json()


# ---------------------------------------------------------------------------
# Stock price data
# ---------------------------------------------------------------------------

def get_stock_data(
    symbol: Annotated[str, "ticker symbol of the company"],
    start_date: Annotated[str, "Start date in yyyy-mm-dd format"],
    end_date: Annotated[str, "End date in yyyy-mm-dd format"],
) -> str:
    """Get OHLCV stock price data from Financial Datasets API."""
    try:
        data = _get("/prices", params={
            "ticker": symbol.upper(),
            "interval": "day",
            "start_date": start_date,
            "end_date": end_date,
        })
    except FinancialDatasetsError as e:
        return f"[Data unavailable] {e}"

    prices = data.get("prices", [])
    if not prices:
        return f"No price data found for '{symbol}' between {start_date} and {end_date}"

    header = (
        f"# Stock data for {symbol.upper()} from {start_date} to {end_date}\n"
        f"# Total records: {len(prices)}\n"
        f"# Source: Financial Datasets API\n\n"
        "Date,Open,High,Low,Close,Volume\n"
    )

    rows = []
    for p in prices:
        rows.append(
            f"{p.get('time', '')},{p.get('open', '')},{p.get('high', '')},"
            f"{p.get('low', '')},{p.get('close', '')},{p.get('volume', '')}"
        )

    return header + "\n".join(rows)


# ---------------------------------------------------------------------------
# Fundamentals
# ---------------------------------------------------------------------------

def get_fundamentals(
    ticker: Annotated[str, "ticker symbol of the company"],
    curr_date: Annotated[str, "current date"] = None,
) -> str:
    """Get company fundamentals overview from Financial Datasets API."""
    try:
        data = _get("/financials/metrics", params={
            "ticker": ticker.upper(),
            "period": "ttm",
            "limit": 1,
        })
    except FinancialDatasetsError as e:
        return f"[Data unavailable] {e}"

    metrics = data.get("financials", [])
    if not metrics:
        return f"No fundamentals data found for '{ticker}'"

    m = metrics[0]
    fields = [
        ("Ticker", ticker.upper()),
        ("Period", m.get("period")),
        ("Revenue", m.get("revenue")),
        ("Net Income", m.get("net_income")),
        ("EPS", m.get("earnings_per_share")),
        ("PE Ratio", m.get("price_to_earnings_ratio")),
        ("Price to Book", m.get("price_to_book_ratio")),
        ("Debt to Equity", m.get("debt_to_equity_ratio")),
        ("Current Ratio", m.get("current_ratio")),
        ("Return on Equity", m.get("return_on_equity")),
        ("Return on Assets", m.get("return_on_assets")),
        ("Gross Margin", m.get("gross_margin")),
        ("Operating Margin", m.get("operating_margin")),
        ("Net Margin", m.get("net_margin")),
        ("Free Cash Flow", m.get("free_cash_flow")),
        ("Market Cap", m.get("market_cap")),
        ("Dividend Yield", m.get("dividend_yield")),
    ]

    lines = [f"{label}: {value}" for label, value in fields if value is not None]
    header = (
        f"# Company Fundamentals for {ticker.upper()}\n"
        f"# Source: Financial Datasets API\n\n"
    )
    return header + "\n".join(lines)


# ---------------------------------------------------------------------------
# Financial statements
# ---------------------------------------------------------------------------

def _get_financial_statement(
    ticker: str,
    statement_type: str,
    freq: str = "quarterly",
    curr_date: str = None,
) -> str:
    """Generic financial statement fetcher."""
    period = "quarterly" if freq.lower() == "quarterly" else "annual"
    try:
        data = _get(f"/financials/{statement_type}", params={
            "ticker": ticker.upper(),
            "period": period,
            "limit": 4,
        })
    except FinancialDatasetsError as e:
        return f"[Data unavailable] {e}"

    key = statement_type.replace("-", "_") + "s"
    statements = data.get(key, data.get("financials", []))
    if not statements:
        return f"No {statement_type} data found for '{ticker}'"

    # Format as readable text
    header = (
        f"# {statement_type.replace('-', ' ').title()} for {ticker.upper()} ({freq})\n"
        f"# Source: Financial Datasets API\n\n"
    )

    parts = []
    for stmt in statements:
        period_label = stmt.get("period", "")
        fiscal_date = stmt.get("fiscal_date_ending", stmt.get("report_period", ""))
        part_lines = [f"## Period: {period_label} ending {fiscal_date}"]
        for k, v in stmt.items():
            if k not in ("ticker", "period", "fiscal_date_ending", "report_period", "cik", "company_name"):
                if v is not None:
                    part_lines.append(f"  {k}: {v}")
        parts.append("\n".join(part_lines))

    return header + "\n\n".join(parts)


def get_balance_sheet(
    ticker: Annotated[str, "ticker symbol of the company"],
    freq: Annotated[str, "frequency: 'annual' or 'quarterly'"] = "quarterly",
    curr_date: Annotated[str, "current date"] = None,
) -> str:
    """Get balance sheet data from Financial Datasets API."""
    return _get_financial_statement(ticker, "balance-sheets", freq, curr_date)


def get_cashflow(
    ticker: Annotated[str, "ticker symbol of the company"],
    freq: Annotated[str, "frequency: 'annual' or 'quarterly'"] = "quarterly",
    curr_date: Annotated[str, "current date"] = None,
) -> str:
    """Get cash flow data from Financial Datasets API."""
    return _get_financial_statement(ticker, "cash-flow-statements", freq, curr_date)


def get_income_statement(
    ticker: Annotated[str, "ticker symbol of the company"],
    freq: Annotated[str, "frequency: 'annual' or 'quarterly'"] = "quarterly",
    curr_date: Annotated[str, "current date"] = None,
) -> str:
    """Get income statement data from Financial Datasets API."""
    return _get_financial_statement(ticker, "income-statements", freq, curr_date)


# ---------------------------------------------------------------------------
# Technical indicators (proxy via price data)
# ---------------------------------------------------------------------------

def get_indicators(
    symbol: Annotated[str, "ticker symbol of the company"],
    indicator: Annotated[str, "technical indicator name"],
    curr_date: Annotated[str, "current date YYYY-mm-dd"],
    look_back_days: Annotated[int, "days to look back"] = 30,
) -> str:
    """Financial Datasets API doesn't provide indicators directly.

    Falls back to fetching price data — the caller should use another vendor
    for technical indicators or this will raise to trigger fallback.
    """
    raise NotImplementedError(
        "Financial Datasets API does not provide technical indicators. "
        "Use yfinance or alpha_vantage for technical indicators."
    )
