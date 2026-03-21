import type { PortfolioItem } from "@/services/api/types"
import type { StockAccountId } from "@/stores/onboardingStore"

export type MockStockAccount = {
  id: StockAccountId
  name: string
  provider: string
  logos: string[]
  holdings: PortfolioItem[]
}

export const DEFAULT_STOCK_ACCOUNT_ID: StockAccountId = "balanced-index"

export const MOCK_STOCK_ACCOUNTS: MockStockAccount[] = [
  {
    id: "growth-tech",
    name: "Account A",
    provider: "Robinhood",
    logos: ["NVDA", "AAPL", "MSFT", "AMZN"],
    holdings: [
      { asset_type: "stock", ticker: "NVDA", quantity: 12, avg_cost: 742.4 },
      { asset_type: "stock", ticker: "AAPL", quantity: 18, avg_cost: 173.2 },
      { asset_type: "stock", ticker: "MSFT", quantity: 8, avg_cost: 392.8 },
      { asset_type: "stock", ticker: "AMZN", quantity: 10, avg_cost: 156.1 },
    ],
  },
  {
    id: "dividend-core",
    name: "Account B",
    provider: "Fidelity",
    logos: ["JNJ", "PG", "KO", "PEP"],
    holdings: [
      { asset_type: "stock", ticker: "JNJ", quantity: 22, avg_cost: 151.7 },
      { asset_type: "stock", ticker: "PG", quantity: 17, avg_cost: 145.3 },
      { asset_type: "stock", ticker: "KO", quantity: 40, avg_cost: 61.2 },
      { asset_type: "stock", ticker: "PEP", quantity: 12, avg_cost: 171.5 },
      { asset_type: "stock", ticker: "XOM", quantity: 15, avg_cost: 109.4 },
      { asset_type: "stock", ticker: "CVX", quantity: 11, avg_cost: 154.8 },
      { asset_type: "stock", ticker: "MCD", quantity: 8, avg_cost: 287.1 },
      { asset_type: "stock", ticker: "WMT", quantity: 20, avg_cost: 63.9 },
      { asset_type: "stock", ticker: "HD", quantity: 7, avg_cost: 348.6 },
      { asset_type: "stock", ticker: "ABBV", quantity: 14, avg_cost: 168.2 },
    ],
  },
  {
    id: "balanced-index",
    name: "Account C",
    provider: "Charles Schwab",
    logos: ["AAPL", "MSFT", "GOOGL", "META"],
    holdings: [
      { asset_type: "stock", ticker: "AAPL", quantity: 20, avg_cost: 173.2 },
      { asset_type: "stock", ticker: "MSFT", quantity: 9, avg_cost: 392.8 },
      { asset_type: "stock", ticker: "AMZN", quantity: 14, avg_cost: 156.1 },
      { asset_type: "stock", ticker: "GOOGL", quantity: 16, avg_cost: 146.3 },
      { asset_type: "stock", ticker: "META", quantity: 7, avg_cost: 488.4 },
      { asset_type: "stock", ticker: "JPM", quantity: 12, avg_cost: 188.2 },
      { asset_type: "stock", ticker: "UNH", quantity: 5, avg_cost: 512.5 },
      { asset_type: "stock", ticker: "XOM", quantity: 13, avg_cost: 109.4 },
      { asset_type: "stock", ticker: "V", quantity: 11, avg_cost: 272.7 },
      { asset_type: "stock", ticker: "JNJ", quantity: 12, avg_cost: 151.7 },
      { asset_type: "stock", ticker: "PG", quantity: 14, avg_cost: 145.3 },
      { asset_type: "stock", ticker: "HD", quantity: 8, avg_cost: 348.6 },
    ],
  },
]

export const getMockStockAccountById = (
  id: StockAccountId | null | undefined,
): MockStockAccount | null => {
  if (!id) return null
  return MOCK_STOCK_ACCOUNTS.find((account) => account.id === id) ?? null
}
