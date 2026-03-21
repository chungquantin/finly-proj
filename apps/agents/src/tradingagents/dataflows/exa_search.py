"""Exa.ai search integration for news and social media data.

Provides web search capabilities as a supplement to existing yfinance/alpha_vantage
news tools. Requires EXA_API_KEY env var.
"""

from __future__ import annotations

import os

import httpx

_BASE_URL = "https://api.exa.ai"
_TIMEOUT = 30.0


def _api_key() -> str:
    key = os.getenv("EXA_API_KEY", "")
    if not key:
        raise RuntimeError("EXA_API_KEY is not set")
    return key


def _search(
    query: str,
    start_date: str,
    end_date: str,
    num_results: int = 10,
    category: str | None = None,
) -> list[dict]:
    """Run an Exa search and return results."""
    headers = {
        "x-api-key": _api_key(),
        "Content-Type": "application/json",
    }
    body: dict = {
        "query": query,
        "startPublishedDate": f"{start_date}T00:00:00.000Z",
        "endPublishedDate": f"{end_date}T23:59:59.000Z",
        "numResults": num_results,
        "type": "neural",
        "contents": {
            "text": {"maxCharacters": 1000},
            "highlights": {"numSentences": 3},
        },
    }
    if category:
        body["category"] = category

    with httpx.Client(timeout=_TIMEOUT) as client:
        resp = client.post(f"{_BASE_URL}/search", headers=headers, json=body)
        resp.raise_for_status()
        return resp.json().get("results", [])


def _format_results(results: list[dict], source_label: str) -> str:
    """Format Exa results into a readable string."""
    if not results:
        return f"No {source_label} results found."

    parts = [f"# {source_label} — {len(results)} results\n"]
    for i, r in enumerate(results, 1):
        title = r.get("title", "Untitled")
        url = r.get("url", "")
        published = r.get("publishedDate", "")[:10]
        text = r.get("text", "")
        highlights = r.get("highlights", [])

        part = f"## {i}. {title}\n"
        if published:
            part += f"Published: {published}\n"
        if url:
            part += f"URL: {url}\n"
        if highlights:
            part += "Key points:\n"
            for h in highlights:
                part += f"  - {h}\n"
        elif text:
            # Truncate text to first 500 chars
            part += f"{text[:500]}...\n" if len(text) > 500 else f"{text}\n"

        parts.append(part)

    return "\n".join(parts)


def exa_search_news(
    ticker: str,
    start_date: str,
    end_date: str,
) -> str:
    """Search for recent news about a stock using Exa.ai.

    Args:
        ticker: Stock ticker symbol
        start_date: Start date in yyyy-mm-dd format
        end_date: End date in yyyy-mm-dd format

    Returns:
        Formatted string of news search results
    """
    query = f"{ticker} stock market news analysis"
    results = _search(query, start_date, end_date, num_results=8, category="news")
    return _format_results(results, f"Exa News for {ticker}")


def exa_search_social(
    ticker: str,
    start_date: str,
    end_date: str,
) -> str:
    """Search for social media discussions and sentiment about a stock using Exa.ai.

    Args:
        ticker: Stock ticker symbol
        start_date: Start date in yyyy-mm-dd format
        end_date: End date in yyyy-mm-dd format

    Returns:
        Formatted string of social media and discussion results
    """
    query = f"{ticker} stock investor sentiment discussion opinion"
    results = _search(query, start_date, end_date, num_results=8)
    return _format_results(results, f"Exa Social/Sentiment for {ticker}")
