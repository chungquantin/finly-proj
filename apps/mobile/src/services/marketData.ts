import { useEffect, useMemo, useState } from "react"

import Config from "@/config"

export type MarketDataQuote = {
  ticker: string
  price: number
  change_pct: number
  currency: string
}

type MarketDataState = {
  quotes: Record<string, MarketDataQuote>
  isLoading: boolean
}

const MARKET_DATA_URL = resolveMarketDataUrl()

export async function fetchMarketData(tickers: string[]): Promise<MarketDataQuote[]> {
  if (!MARKET_DATA_URL) {
    return []
  }

  const params = new URLSearchParams({ tickers: tickers.join(",") })
  const response = await fetch(`${MARKET_DATA_URL}/api/market-data?${params.toString()}`)

  if (!response.ok) {
    throw new Error(`Market data request failed with status ${response.status}`)
  }

  return (await response.json()) as MarketDataQuote[]
}

export function useMarketData(tickers: string[]): MarketDataState {
  const [quotes, setQuotes] = useState<Record<string, MarketDataQuote>>({})
  const [isLoading, setIsLoading] = useState(false)
  const tickerKey = useMemo(() => tickers.join(","), [tickers])
  const stableTickers = useMemo(() => tickerKey.split(",").filter(Boolean), [tickerKey])

  useEffect(() => {
    let isActive = true

    if (!stableTickers.length) {
      setQuotes({})
      return
    }

    if (!MARKET_DATA_URL) {
      setQuotes({})
      return
    }

    setIsLoading(true)

    fetchMarketData(stableTickers)
      .then((items) => {
        if (!isActive) return

        const nextQuotes = items.reduce<Record<string, MarketDataQuote>>((acc, item) => {
          acc[item.ticker] = item
          return acc
        }, {})

        setQuotes(nextQuotes)
      })
      .catch(() => {
        if (!isActive) return
        setQuotes({})
      })
      .finally(() => {
        if (isActive) setIsLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [stableTickers])

  return { quotes, isLoading }
}

function resolveMarketDataUrl() {
  const candidates = [Config.MARKET_DATA_URL, Config.API_URL]

  for (const candidate of candidates) {
    if (!candidate) continue
    if (candidate.includes("rss2json.com")) continue
    return candidate.replace(/\/+$/, "")
  }

  return null
}
