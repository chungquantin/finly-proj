from typing import Annotated

# Import from yfinance vendor
from .y_finance import (
    get_YFin_data_online,
    get_stock_stats_indicators_window,
    get_fundamentals as get_yfinance_fundamentals,
    get_balance_sheet as get_yfinance_balance_sheet,
    get_cashflow as get_yfinance_cashflow,
    get_income_statement as get_yfinance_income_statement,
    get_insider_transactions as get_yfinance_insider_transactions,
)
from .yfinance_news import get_news_yfinance, get_global_news_yfinance

# Configuration and routing logic
from .config import get_config

# Tools organized by category
TOOLS_CATEGORIES = {
    "core_stock_apis": {
        "description": "OHLCV stock price data",
        "tools": ["get_stock_data"],
    },
    "technical_indicators": {
        "description": "Technical analysis indicators",
        "tools": ["get_indicators"],
    },
    "fundamental_data": {
        "description": "Company fundamentals",
        "tools": ["get_fundamentals", "get_balance_sheet", "get_cashflow", "get_income_statement"],
    },
    "news_data": {
        "description": "News and insider data",
        "tools": ["get_news", "get_global_news", "get_insider_transactions"],
    },
}

VENDOR_LIST = ["yfinance", "mock_vn"]

# Mapping of methods to their vendor-specific implementations
VENDOR_METHODS = {
    "get_stock_data": {"yfinance": get_YFin_data_online},
    "get_indicators": {"yfinance": get_stock_stats_indicators_window},
    "get_fundamentals": {"yfinance": get_yfinance_fundamentals},
    "get_balance_sheet": {"yfinance": get_yfinance_balance_sheet},
    "get_cashflow": {"yfinance": get_yfinance_cashflow},
    "get_income_statement": {"yfinance": get_yfinance_income_statement},
    "get_news": {"yfinance": get_news_yfinance},
    "get_global_news": {"yfinance": get_global_news_yfinance},
    "get_insider_transactions": {"yfinance": get_yfinance_insider_transactions},
}


def get_category_for_method(method: str) -> str:
    """Get the category that contains the specified method."""
    for category, info in TOOLS_CATEGORIES.items():
        if method in info["tools"]:
            return category
    raise ValueError(f"Method '{method}' not found in any category")


def get_vendor(category: str, method: str = None) -> str:
    """Get the configured vendor for a data category or specific tool method."""
    config = get_config()

    if method:
        tool_vendors = config.get("tool_vendors", {})
        if method in tool_vendors:
            return tool_vendors[method]

    return config.get("data_vendors", {}).get(category, "yfinance")


def route_to_vendor(method: str, *args, **kwargs):
    """Route method calls to yfinance (or VN mock data for VN tickers)."""
    # Vietnamese ticker mock data interception
    from finly_agents.mock_data import is_vn_ticker
    if args and isinstance(args[0], str) and is_vn_ticker(args[0]):
        from finly_agents import mock_data
        mock_fn = getattr(mock_data, f"{method}_mock", None)
        if mock_fn:
            return mock_fn(*args, **kwargs)

    if method not in VENDOR_METHODS:
        raise ValueError(f"Method '{method}' not supported")

    impl_func = VENDOR_METHODS[method]["yfinance"]
    return impl_func(*args, **kwargs)
