"""LangChain @tool wrappers for Exa.ai search functions.

These tools are conditionally added to news and social media analysts
when the EXA_API_KEY environment variable is set.
"""

from __future__ import annotations

import os
from typing import Annotated

from langchain_core.tools import tool


def exa_available() -> bool:
    """Check if Exa.ai API key is configured."""
    return bool(os.getenv("EXA_API_KEY", ""))


@tool
def exa_search_news(
    ticker: Annotated[str, "Stock ticker symbol"],
    start_date: Annotated[str, "Start date in yyyy-mm-dd format"],
    end_date: Annotated[str, "End date in yyyy-mm-dd format"],
) -> str:
    """
    Search for recent news about a stock using Exa.ai web search.
    Returns news articles, analysis, and market commentary from across the web.
    Complements traditional news feeds with broader web coverage.
    Args:
        ticker (str): Stock ticker symbol
        start_date (str): Start date in yyyy-mm-dd format
        end_date (str): End date in yyyy-mm-dd format
    Returns:
        str: Formatted news search results
    """
    from tradingagents.dataflows.exa_search import exa_search_news as _exa_search_news

    return _exa_search_news(ticker, start_date, end_date)


@tool
def exa_search_social(
    ticker: Annotated[str, "Stock ticker symbol"],
    start_date: Annotated[str, "Start date in yyyy-mm-dd format"],
    end_date: Annotated[str, "End date in yyyy-mm-dd format"],
) -> str:
    """
    Search for social media discussions and investor sentiment about a stock using Exa.ai.
    Returns discussions, opinions, and sentiment from forums, blogs, and social media.
    Args:
        ticker (str): Stock ticker symbol
        start_date (str): Start date in yyyy-mm-dd format
        end_date (str): End date in yyyy-mm-dd format
    Returns:
        str: Formatted social media and sentiment results
    """
    from tradingagents.dataflows.exa_search import (
        exa_search_social as _exa_search_social,
    )

    return _exa_search_social(ticker, start_date, end_date)
