import { useMemo } from "react"

import { useOnboardingStore } from "@/stores/onboardingStore"
import { DEFAULT_STOCK_ACCOUNT_ID, getMockStockAccountById } from "@/utils/mockStockAccounts"
import { getTickerLogoUri } from "@/utils/tickerLogo"

type SelectedHolding = {
  ticker: string
  name: string
  logoUri?: string
  shares: number
  valueUsd: number
  changePercent: number
  allocationPercent: number
}

type SelectedPortfolioSnapshot = {
  totalValueUsd: number
  dailyPnlUsd: number
  dailyPnlPercent: number
  monthlyPnlPercent: number
  yearlyPnlPercent: number
  investedUsd: number
  cashUsd: number
}

type SelectedPortfolioData = {
  holdings: SelectedHolding[]
  snapshot: SelectedPortfolioSnapshot
}

const tickerNames: Record<string, string> = {
  AAPL: "Apple",
  ABBV: "AbbVie",
  AMZN: "Amazon",
  CVX: "Chevron",
  GOOGL: "Alphabet",
  HD: "Home Depot",
  JNJ: "Johnson & Johnson",
  JPM: "JPMorgan Chase",
  KO: "Coca-Cola",
  MCD: "McDonald's",
  META: "Meta Platforms",
  MSFT: "Microsoft",
  NVDA: "NVIDIA",
  PEP: "PepsiCo",
  PG: "Procter & Gamble",
  UNH: "UnitedHealth Group",
  V: "Visa",
  WMT: "Walmart",
  XOM: "Exxon Mobil",
}

const round = (value: number) => Math.round(value * 100) / 100

const hashTicker = (value: string) => {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

const estimateChangePercent = (ticker: string) => {
  const hash = hashTicker(ticker)
  return round((hash % 520) / 100 - 1.6)
}

export const useSelectedPortfolioData = (): SelectedPortfolioData => {
  const portfolioType = useOnboardingStore((state) => state.portfolioType)
  const stockAccountId = useOnboardingStore((state) => state.stockAccountId)

  return useMemo(() => {
    const resolvedAccountId =
      portfolioType === "stock" ? (stockAccountId ?? DEFAULT_STOCK_ACCOUNT_ID) : stockAccountId
    const account = getMockStockAccountById(resolvedAccountId)

    if (!account) {
      return {
        holdings: [],
        snapshot: {
          totalValueUsd: 0,
          dailyPnlUsd: 0,
          dailyPnlPercent: 0,
          monthlyPnlPercent: 0,
          yearlyPnlPercent: 0,
          investedUsd: 0,
          cashUsd: 0,
        },
      }
    }

    const enriched = account.holdings.map((holding) => {
      const changePercent = estimateChangePercent(holding.ticker)
      const costBasis = holding.quantity * holding.avg_cost
      const valueUsd = round(costBasis * (1 + changePercent / 100))

      return {
        ticker: holding.ticker,
        name: tickerNames[holding.ticker] ?? holding.ticker,
        logoUri: getTickerLogoUri(holding.ticker),
        shares: holding.quantity,
        valueUsd,
        changePercent,
        allocationPercent: 0,
      }
    })

    const totalValueUsd = enriched.reduce((sum, holding) => sum + holding.valueUsd, 0)
    const investedUsd = round(
      account.holdings.reduce((sum, holding) => sum + holding.quantity * holding.avg_cost, 0),
    )
    const holdings = enriched.map((holding) => ({
      ...holding,
      allocationPercent: totalValueUsd ? round((holding.valueUsd / totalValueUsd) * 100) : 0,
    }))

    const weightedChangePercent = investedUsd
      ? round(((totalValueUsd - investedUsd) / investedUsd) * 100)
      : 0
    const dailyPnlPercent = round(weightedChangePercent / 4 || 0)
    const dailyPnlUsd = round(totalValueUsd * (dailyPnlPercent / 100))
    const monthlyPnlPercent = round(dailyPnlPercent * 4.2)
    const yearlyPnlPercent = round(monthlyPnlPercent * 2.8)
    const cashUsd = round(Math.max(totalValueUsd * 0.08, 1000))

    return {
      holdings,
      snapshot: {
        totalValueUsd: round(totalValueUsd),
        dailyPnlUsd,
        dailyPnlPercent,
        monthlyPnlPercent,
        yearlyPnlPercent,
        investedUsd,
        cashUsd,
      },
    }
  }, [portfolioType, stockAccountId])
}
