import { getMockStockAccountById } from "./mockStockAccounts"
import type {
  FinancialKnowledge,
  InvestmentHorizon,
  PortfolioType,
  RiskExpertise,
  StockAccountId,
} from "../stores/onboardingStore"

export type PortfolioPoint = {
  day: string
  value: number
}

export type TeamMember = {
  id: string
  role: string
  status: "Active"
  emoji: string
}

export type MockPortfolio = {
  totalBalance: number
  todayGain: number
  todayGainPct: number
  portfolioChangePct: number
  points: PortfolioPoint[]
  members: TeamMember[]
  sourceLabel: string
}

type SeedInput = {
  riskExpertise: RiskExpertise
  investmentHorizon: InvestmentHorizon
  financialKnowledge: FinancialKnowledge
  portfolioType: PortfolioType | null
  stockAccountId: StockAccountId | null
  walletAddress: string
}

const riskWeights: Record<RiskExpertise, number> = {
  beginner: 1,
  intermediate: 1.2,
  expert: 1.45,
}

const horizonWeights: Record<InvestmentHorizon, number> = {
  short: 0.9,
  medium: 1,
  long: 1.25,
}

const knowledgeWeights: Record<FinancialKnowledge, number> = {
  novice: 0.92,
  savvy: 1,
  pro: 1.18,
}

const hash = (value: string) => {
  let hashed = 0
  for (let i = 0; i < value.length; i += 1) {
    hashed = (hashed << 5) - hashed + value.charCodeAt(i)
    hashed |= 0
  }

  return Math.abs(hashed)
}

const money = (value: number) => Math.round(value * 100) / 100

export const buildMockPortfolio = (input: SeedInput): MockPortfolio => {
  const seedText = [
    input.riskExpertise,
    input.investmentHorizon,
    input.financialKnowledge,
    input.portfolioType ?? "none",
    input.stockAccountId ?? "none",
    input.walletAddress,
  ].join("|")

  const seed = hash(seedText)
  const base = 32000
  const weighted =
    riskWeights[input.riskExpertise] *
    horizonWeights[input.investmentHorizon] *
    knowledgeWeights[input.financialKnowledge]
  const stockAccount = getMockStockAccountById(input.stockAccountId)
  const stockCostBasis = stockAccount
    ? stockAccount.holdings.reduce((sum, holding) => sum + holding.quantity * holding.avg_cost, 0)
    : null
  const marketTilt = ((seed % 19) - 9) / 1000
  const profileTilt = (weighted - 1) * 0.03
  const todayGainPct = money(0.4 + (seed % 18) / 10)

  const balance =
    input.portfolioType === "stock" && stockCostBasis
      ? money(stockCostBasis * (1 + 0.02 + profileTilt + marketTilt))
      : money(base * weighted + (seed % 12000))

  const gain = money(balance * (todayGainPct / 100))
  const gainPct = money((gain / balance) * 100)
  const portfolioChangePct = money(6 + (seed % 80) / 10)

  const weekdays = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
  const points = weekdays.map((day, index) => {
    const growthCurve = 0.88 + index * 0.02
    const wave = Math.sin((index + 1) * 1.1 + (seed % 7)) * (balance * 0.015)
    const noise = (((seed >> (index + 1)) % 30) - 15) * 18
    return {
      day,
      value: money(balance * growthCurve + wave + noise),
    }
  })

  const sourceLabel =
    input.portfolioType === "crypto"
      ? "Wallet onboarding"
      : stockAccount
        ? `Stock account: ${stockAccount.name}`
        : "Stock import"

  return {
    totalBalance: balance,
    todayGain: gain,
    todayGainPct: gainPct,
    portfolioChangePct,
    points,
    sourceLabel,
    members: [
      { id: "trader", role: "Trader", status: "Active", emoji: "🤖" },
      { id: "analyst", role: "Analyst", status: "Active", emoji: "📊" },
      { id: "advisor", role: "Advisor", status: "Active", emoji: "🧠" },
      { id: "researcher", role: "Researcher", status: "Active", emoji: "🛰️" },
    ],
  }
}
