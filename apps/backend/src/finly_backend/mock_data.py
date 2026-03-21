"""Vietnamese stock mock data vendor for demo reliability.

Provides mock data for VN tickers (VCB, VNM, FPT, TPB) that mirrors
every yfinance function signature so the vendor routing layer can
transparently intercept calls without agent code changes.
"""

from __future__ import annotations

from datetime import datetime, timedelta

VN_TICKERS = {"VCB", "VNM", "FPT", "TPB"}

_BASE_PRICES = {
    "VCB": 95000,
    "VNM": 72000,
    "FPT": 135000,
    "TPB": 24500,
}


def is_vn_ticker(symbol: str) -> bool:
    """Check if symbol is a Vietnamese ticker (strips .VN suffix)."""
    clean = symbol.upper().replace(".VN", "").strip()
    return clean in VN_TICKERS


def _clean(symbol: str) -> str:
    return symbol.upper().replace(".VN", "").strip()


def _generate_ohlcv(symbol: str, days: int = 30) -> list[dict]:
    """Generate realistic OHLCV data for a VN ticker."""
    import random

    random.seed(hash(symbol) % 2**31)
    base = _BASE_PRICES.get(_clean(symbol), 50000)
    rows = []
    price = base
    end = datetime.now()
    start = end - timedelta(days=days)
    cur = start
    while cur <= end:
        if cur.weekday() < 5:  # skip weekends
            change = random.uniform(-0.025, 0.03)
            o = round(price)
            h = round(price * (1 + abs(change) + random.uniform(0, 0.01)))
            low = round(price * (1 - abs(change) - random.uniform(0, 0.01)))
            c = round(price * (1 + change))
            vol = random.randint(3_000_000, 15_000_000)
            rows.append(
                {
                    "Date": cur.strftime("%Y-%m-%d"),
                    "Open": o,
                    "High": h,
                    "Low": low,
                    "Close": c,
                    "Volume": vol,
                }
            )
            price = c
        cur += timedelta(days=1)
    return rows


# ---------------------------------------------------------------------------
# Mock functions — mirror yfinance signatures
# ---------------------------------------------------------------------------


def get_stock_data_mock(symbol: str, start_date: str = "", end_date: str = "") -> str:
    rows = _generate_ohlcv(symbol, days=30)
    header = "Date,Open,High,Low,Close,Volume"
    lines = [header] + [
        f"{r['Date']},{r['Open']},{r['High']},{r['Low']},{r['Close']},{r['Volume']}"
        for r in rows
    ]
    return "\n".join(lines)


def get_indicators_mock(
    symbol: str, indicator: str = "", curr_date: str = "", look_back_days: int = 30
) -> str:
    """Return a simple indicator summary string."""
    clean = _clean(symbol)
    base = _BASE_PRICES.get(clean, 50000)
    indicators = {
        "rsi": f"RSI(14): 55.2 — neutral momentum for {clean}",
        "macd": f"MACD: 120, Signal: 95, Histogram: 25 — mild bullish for {clean}",
        "macds": f"MACD Signal: 95 for {clean}",
        "macdh": f"MACD Histogram: 25 for {clean}",
        "close_50_sma": f"50-SMA: {base * 0.98:.0f} VND for {clean}",
        "close_200_sma": f"200-SMA: {base * 0.95:.0f} VND for {clean}",
        "close_10_ema": f"10-EMA: {base * 1.005:.0f} VND for {clean}",
        "boll": f"Bollinger Mid: {base:.0f} VND for {clean}",
        "boll_ub": f"Bollinger Upper: {base * 1.04:.0f} VND for {clean}",
        "boll_lb": f"Bollinger Lower: {base * 0.96:.0f} VND for {clean}",
        "atr": f"ATR(14): {base * 0.015:.0f} VND for {clean}",
        "vwma": f"VWMA: {base * 1.002:.0f} VND for {clean}",
    }
    if indicator and indicator in indicators:
        return indicators[indicator]
    return "\n".join(indicators.values())


def get_fundamentals_mock(ticker: str, curr_date: str = None) -> str:
    clean = _clean(ticker)
    data = {
        "VCB": {
            "name": "Vietcombank (VCB)",
            "sector": "Banking",
            "market_cap": "430T VND",
            "pe_ratio": 15.2,
            "pb_ratio": 2.8,
            "roe": "22.5%",
            "npl_ratio": "0.68%",
            "summary": "Vietnam's largest state-owned commercial bank by market cap. Strong retail and corporate banking franchise with leading digital banking platform. Beneficiary of Vietnam's GDP growth and rising middle class.",
        },
        "VNM": {
            "name": "Vinamilk (VNM)",
            "sector": "Consumer Staples / Dairy",
            "market_cap": "150T VND",
            "pe_ratio": 18.5,
            "pb_ratio": 4.1,
            "roe": "28.3%",
            "npl_ratio": "N/A",
            "summary": "Vietnam's largest dairy company with ~55% market share. Expanding internationally (Cambodia, Myanmar). Dividend yield ~4%. Defensive stock in volatile markets.",
        },
        "FPT": {
            "name": "FPT Corporation (FPT)",
            "sector": "Technology / IT Services",
            "market_cap": "200T VND",
            "pe_ratio": 22.1,
            "pb_ratio": 5.3,
            "roe": "25.1%",
            "npl_ratio": "N/A",
            "summary": "Vietnam's largest IT company. Three pillars: IT services (global outsourcing), telecom, education. Strong AI/cloud initiatives. Revenue growing 20%+ YoY from global IT outsourcing contracts.",
        },
        "TPB": {
            "name": "TPBank (TPB)",
            "sector": "Banking",
            "market_cap": "42T VND",
            "pe_ratio": 8.5,
            "pb_ratio": 1.4,
            "roe": "18.2%",
            "npl_ratio": "0.85%",
            "summary": "Mid-cap private bank known for digital-first approach (LiveBank). Fast loan growth, improving asset quality. Higher risk/reward vs VCB. Targeting retail banking expansion.",
        },
    }
    info = data.get(clean, data["FPT"])
    lines = [f"Company: {info['name']}", f"Sector: {info['sector']}"]
    for k in ("market_cap", "pe_ratio", "pb_ratio", "roe", "npl_ratio"):
        lines.append(f"{k}: {info[k]}")
    lines.append(f"\n{info['summary']}")
    return "\n".join(lines)


def get_balance_sheet_mock(
    ticker: str, freq: str = "annual", curr_date: str = ""
) -> str:
    clean = _clean(ticker)
    sheets = {
        "VCB": "Total Assets: 1,850T VND | Total Equity: 120T VND | Total Liabilities: 1,730T VND | Customer Deposits: 1,350T VND | Loans Outstanding: 1,200T VND",
        "VNM": "Total Assets: 55T VND | Total Equity: 32T VND | Total Liabilities: 23T VND | Inventory: 6.2T VND | Cash: 3.1T VND",
        "FPT": "Total Assets: 75T VND | Total Equity: 35T VND | Total Liabilities: 40T VND | Cash: 8.5T VND | Receivables: 12T VND",
        "TPB": "Total Assets: 320T VND | Total Equity: 30T VND | Total Liabilities: 290T VND | Customer Deposits: 210T VND | Loans Outstanding: 195T VND",
    }
    return f"Balance Sheet ({freq}) for {clean}:\n{sheets.get(clean, sheets['FPT'])}"


def get_cashflow_mock(ticker: str, freq: str = "annual", curr_date: str = "") -> str:
    clean = _clean(ticker)
    cfs = {
        "VCB": "Operating CF: 45T VND | Investing CF: -12T VND | Financing CF: -8T VND | Net CF: 25T VND | Loan Growth: +14% YoY",
        "VNM": "Operating CF: 9.5T VND | Investing CF: -2.1T VND | Financing CF: -5.8T VND | Net CF: 1.6T VND | Dividends Paid: 5.2T VND",
        "FPT": "Operating CF: 10T VND | Investing CF: -4.5T VND | Financing CF: -2T VND | Net CF: 3.5T VND | Capex: 3.8T VND",
        "TPB": "Operating CF: 8T VND | Investing CF: -3T VND | Financing CF: -1.5T VND | Net CF: 3.5T VND | Loan Growth: +22% YoY",
    }
    return f"Cash Flow ({freq}) for {clean}:\n{cfs.get(clean, cfs['FPT'])}"


def get_income_statement_mock(
    ticker: str, freq: str = "annual", curr_date: str = ""
) -> str:
    clean = _clean(ticker)
    inc = {
        "VCB": "Net Interest Income: 42T VND | Non-Interest Income: 12T VND | Provisions: -8T VND | Pre-tax Profit: 41T VND | Net Profit: 33T VND | YoY Growth: +18%",
        "VNM": "Revenue: 60T VND | Gross Profit: 26T VND | EBITDA: 14T VND | Net Profit: 9.5T VND | YoY Growth: +5% | Gross Margin: 43%",
        "FPT": "Revenue: 55T VND | Gross Profit: 22T VND | EBITDA: 12T VND | Net Profit: 8T VND | YoY Growth: +22% | IT Services Revenue: 28T VND",
        "TPB": "Net Interest Income: 14T VND | Non-Interest Income: 4T VND | Provisions: -3T VND | Pre-tax Profit: 10T VND | Net Profit: 8T VND | YoY Growth: +25%",
    }
    return f"Income Statement ({freq}) for {clean}:\n{inc.get(clean, inc['FPT'])}"


def get_insider_transactions_mock(ticker: str) -> str:
    clean = _clean(ticker)
    txns = {
        "VCB": "No significant insider transactions reported. State-owned (Nhà nước holds ~74.8%). Minor board member purchases of 5,000 shares.",
        "VNM": "CFO purchased 20,000 shares at 71,500 VND on 2026-03-10. Board member sold 50,000 shares at 73,200 VND on 2026-02-28. SCIC (state) holds ~36%.",
        "FPT": "Chairman Truong Gia Binh purchased 200,000 shares at 132,000 VND on 2026-03-05. Employee stock option plan exercised: 500,000 shares.",
        "TPB": "CEO purchased 100,000 shares at 24,000 VND on 2026-03-12. No other significant insider activity.",
    }
    return f"Insider Transactions for {clean}:\n{txns.get(clean, txns['FPT'])}"


def get_news_mock(ticker: str, start_date: str = "", end_date: str = "") -> str:
    clean = _clean(ticker)
    news = {
        "VCB": [
            {
                "title": "Vietcombank posts record Q1 2026 profit of 11T VND, up 20% YoY",
                "source": "VnExpress",
                "date": "2026-03-18",
            },
            {
                "title": "SBV keeps policy rates unchanged, boosting bank earnings outlook",
                "source": "Vietnam Investment Review",
                "date": "2026-03-15",
            },
            {
                "title": "Vietcombank launches AI-powered mobile banking features",
                "source": "Nikkei Asia",
                "date": "2026-03-12",
            },
            {
                "title": "Foreign investors net-buy VCB for 5th consecutive week",
                "source": "CafeF",
                "date": "2026-03-10",
            },
        ],
        "VNM": [
            {
                "title": "Vinamilk expands organic dairy line to 3 new provinces",
                "source": "VnExpress",
                "date": "2026-03-17",
            },
            {
                "title": "Vinamilk dividend yield remains attractive at 4.2% amid market volatility",
                "source": "SSI Research",
                "date": "2026-03-14",
            },
            {
                "title": "Vietnam dairy market to grow 8% in 2026, Vinamilk positioned to capture share",
                "source": "Euromonitor",
                "date": "2026-03-09",
            },
        ],
        "FPT": [
            {
                "title": "FPT wins $200M AI transformation deal with Japanese automaker",
                "source": "Nikkei Asia",
                "date": "2026-03-19",
            },
            {
                "title": "FPT Software revenue surges 28% YoY in Q1, driven by AI/cloud contracts",
                "source": "VnExpress",
                "date": "2026-03-16",
            },
            {
                "title": "Vietnam's FPT targets $1B in overseas IT revenue by 2027",
                "source": "TechInAsia",
                "date": "2026-03-11",
            },
            {
                "title": "FPT opens new AI R&D center in Da Nang with 2,000 engineer capacity",
                "source": "CafeF",
                "date": "2026-03-07",
            },
        ],
        "TPB": [
            {
                "title": "TPBank digital customers surpass 10M milestone",
                "source": "VnExpress",
                "date": "2026-03-18",
            },
            {
                "title": "TPBank Q1 pre-tax profit jumps 30% on strong retail lending",
                "source": "SSI Research",
                "date": "2026-03-14",
            },
            {
                "title": "Moody's upgrades TPBank outlook to positive",
                "source": "Vietnam Investment Review",
                "date": "2026-03-08",
            },
        ],
    }
    articles = news.get(clean, news["FPT"])
    lines = [f"Recent News for {clean}:"]
    for a in articles:
        lines.append(f"- [{a['date']}] {a['title']} ({a['source']})")
    return "\n".join(lines)


def get_global_news_mock(
    curr_date: str = "", look_back_days: int = 7, limit: int = 5
) -> str:
    articles = [
        {
            "title": "Fed holds rates steady, signals potential cut in June 2026",
            "source": "Reuters",
            "date": "2026-03-19",
        },
        {
            "title": "Vietnam GDP growth on track for 7.5% in 2026, World Bank says",
            "source": "World Bank",
            "date": "2026-03-17",
        },
        {
            "title": "HOSE index hits 1,350 — new 12-month high on foreign inflows",
            "source": "Bloomberg",
            "date": "2026-03-16",
        },
        {
            "title": "State Bank of Vietnam keeps refinancing rate at 4.5%, supporting credit growth",
            "source": "SBV",
            "date": "2026-03-14",
        },
        {
            "title": "US-China trade tensions ease after March summit, boosting EM sentiment",
            "source": "CNBC",
            "date": "2026-03-12",
        },
        {
            "title": "Vietnam approved for MSCI Emerging Market reclassification review in June",
            "source": "MSCI",
            "date": "2026-03-10",
        },
    ]
    lines = ["Global & Vietnam Market News:"]
    for a in articles[:limit]:
        lines.append(f"- [{a['date']}] {a['title']} ({a['source']})")
    return "\n".join(lines)
