from __future__ import annotations

import asyncio
import json
import os
import re
import time
import uuid
from datetime import date
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

from tradingagents.default_config import DEFAULT_CONFIG
from tradingagents.graph.trading_graph import TradingAgentsGraph

load_dotenv()

DEFAULT_ANALYSTS = ["market", "social", "news", "fundamentals"]
TICKER_PATTERN = re.compile(r"\b\$?([A-Z]{2,6})\b")
DATE_PATTERN = re.compile(r"\b(\d{4}-\d{2}-\d{2})\b")


class Message(BaseModel):
    role: str
    content: Any


class ChatCompletionsRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    model: str = Field(default="finly-agents-v1")
    messages: list[Message]
    stream: bool = False
    ticker: str | None = None
    trade_date: str | None = None
    selected_analysts: list[str] | None = None


def _flatten_content(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict):
                text = item.get("text")
                if isinstance(text, str):
                    parts.append(text)
            elif isinstance(item, str):
                parts.append(item)
        return "\n".join(parts)
    return str(content)


def _extract_last_user_text(messages: list[Message]) -> str:
    for message in reversed(messages):
        if message.role == "user":
            return _flatten_content(message.content)
    return _flatten_content(messages[-1].content) if messages else ""


def _extract_ticker(text: str) -> str | None:
    for match in TICKER_PATTERN.finditer(text):
        value = match.group(1)
        if value not in {"BUY", "SELL", "HOLD", "USD", "VND", "JSON"}:
            return value
    return None


def _extract_trade_date(text: str) -> str | None:
    match = DATE_PATTERN.search(text)
    return match.group(1) if match else None


def _build_graph(model_name: str, selected_analysts: list[str]) -> TradingAgentsGraph:
    config = DEFAULT_CONFIG.copy()
    config["deep_think_llm"] = model_name
    config["quick_think_llm"] = model_name
    config["max_debate_rounds"] = int(os.getenv("FINLY_MAX_DEBATE_ROUNDS", "1"))
    config["max_risk_discuss_rounds"] = int(os.getenv("FINLY_MAX_RISK_ROUNDS", "1"))
    config["data_vendors"] = {
        "core_stock_apis": os.getenv("FINLY_VENDOR_CORE_STOCK", "yfinance"),
        "technical_indicators": os.getenv("FINLY_VENDOR_TECHNICAL", "yfinance"),
        "fundamental_data": os.getenv("FINLY_VENDOR_FUNDAMENTAL", "yfinance"),
        "news_data": os.getenv("FINLY_VENDOR_NEWS", "yfinance"),
    }
    return TradingAgentsGraph(debug=False, config=config, selected_analysts=selected_analysts)


def _run_finly_agents(request: ChatCompletionsRequest) -> dict[str, Any]:
    if not request.messages:
        raise HTTPException(status_code=400, detail="messages is required")

    prompt_text = _extract_last_user_text(request.messages)
    ticker = (request.ticker or _extract_ticker(prompt_text) or os.getenv("FINLY_DEFAULT_TICKER") or "FPT").upper()
    trade_date = request.trade_date or _extract_trade_date(prompt_text) or date.today().isoformat()

    selected_analysts = request.selected_analysts or DEFAULT_ANALYSTS
    model_name = os.getenv("FINLY_AGENT_MODEL", "gpt-5-mini")

    graph = _build_graph(model_name=model_name, selected_analysts=selected_analysts)
    final_state, decision = graph.propagate(ticker, trade_date)

    final_report = final_state.get("final_trade_decision", "")
    content = (
        f"Ticker: {ticker}\n"
        f"Trade date: {trade_date}\n"
        f"Decision: {str(decision).strip()}\n\n"
        f"Final report:\n{final_report}"
    ).strip()

    return {
        "ticker": ticker,
        "trade_date": trade_date,
        "decision": str(decision).strip(),
        "content": content,
    }


def _split_chunks(text: str, chunk_size: int = 120) -> list[str]:
    return [text[i : i + chunk_size] for i in range(0, len(text), chunk_size)] or [""]


def _sse_data(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


app = FastAPI(title="Finly Agents API", version="0.1.0")


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/v1/models")
def list_models() -> dict[str, Any]:
    now = int(time.time())
    return {
        "object": "list",
        "data": [
            {
                "id": "finly-agents-v1",
                "object": "model",
                "created": now,
                "owned_by": "finly",
            }
        ],
    }


@app.post("/v1/chat/completions")
async def chat_completions(request: ChatCompletionsRequest):
    created = int(time.time())
    completion_id = f"chatcmpl-{uuid.uuid4().hex}"

    result = await asyncio.to_thread(_run_finly_agents, request)
    assistant_text = result["content"]

    if not request.stream:
        return JSONResponse(
            {
                "id": completion_id,
                "object": "chat.completion",
                "created": created,
                "model": request.model,
                "choices": [
                    {
                        "index": 0,
                        "message": {"role": "assistant", "content": assistant_text},
                        "finish_reason": "stop",
                    }
                ],
            }
        )

    async def event_stream():
        yield _sse_data(
            {
                "id": completion_id,
                "object": "chat.completion.chunk",
                "created": created,
                "model": request.model,
                "choices": [{"index": 0, "delta": {"role": "assistant"}, "finish_reason": None}],
            }
        )

        for part in _split_chunks(assistant_text):
            yield _sse_data(
                {
                    "id": completion_id,
                    "object": "chat.completion.chunk",
                    "created": created,
                    "model": request.model,
                    "choices": [{"index": 0, "delta": {"content": part}, "finish_reason": None}],
                }
            )

        yield _sse_data(
            {
                "id": completion_id,
                "object": "chat.completion.chunk",
                "created": created,
                "model": request.model,
                "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
            }
        )
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


def run() -> None:
    import uvicorn

    host = os.getenv("FINLY_AGENTS_HOST", "0.0.0.0")
    port = int(os.getenv("FINLY_AGENTS_PORT", "8000"))
    uvicorn.run("finly_agents.server:app", host=host, port=port, reload=False)


if __name__ == "__main__":
    run()
