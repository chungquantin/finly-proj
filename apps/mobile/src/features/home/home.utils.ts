export const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)

export const formatLocalDateKey = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function shortHeadline(title: string) {
  const normalized = title.replace(/\s+/g, " ").trim()
  if (normalized.length <= 66) return normalized
  return `${normalized.slice(0, 63)}...`
}

export function buildTeamInsights(
  holdings: Array<{ ticker: string; valueUsd: number; changePercent: number }>,
  totalValueUsd: number,
  advisorNewsSummary: string,
) {
  if (holdings.length === 0) {
    return {
      Avery:
        "Portfolio is currently in cash. Start with broad diversification and staggered entries.",
      Kai: "No holdings yet, so market-regime guidance is to wait for quality setups and avoid impulse entries.",
      Noor: "When first positions are opened, use small tranches and clear stop levels to control early risk.",
      Milo: "Build a starter watchlist and track catalysts before concentrating into any single theme.",
    }
  }

  const sorted = [...holdings].sort((a, b) => b.valueUsd - a.valueUsd)
  const topHolding = sorted[0]
  const weightedMove =
    holdings.reduce((sum, holding) => sum + holding.changePercent * holding.valueUsd, 0) /
    Math.max(totalValueUsd, 1)
  const bestHolding = [...holdings].sort((a, b) => b.changePercent - a.changePercent)[0]
  const weakestHolding = [...holdings].sort((a, b) => a.changePercent - b.changePercent)[0]
  const regime = weightedMove > 0.5 ? "constructive" : weightedMove < -0.5 ? "defensive" : "mixed"

  return {
    Avery: `Overall portfolio is ${regime} across ${holdings.length} holdings with largest weight in ${topHolding.ticker}. ${advisorNewsSummary}`,
    Kai: `Portfolio breadth is ${regime}: relative strength is led by ${bestHolding.ticker} while ${weakestHolding.ticker} lags. Keep feedback at portfolio level and avoid concentration drift.`,
    Noor: `Execution feedback: treat current holdings as one basket, scale adds/trims in clips, and keep risk controls tighter on weaker names like ${weakestHolding.ticker}.`,
    Milo: `Across current holdings, fundamentals stay mixed; prioritize catalyst checks on your largest positions, especially ${topHolding.ticker}, before changing sizing.`,
  }
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function horizonMeta(value: "short" | "medium" | "long") {
  switch (value) {
    case "short":
      return { label: "1-2 years" }
    case "medium":
      return { label: "3-5 years" }
    default:
      return { label: "5+ years" }
  }
}

export function knowledgeMeta(value: "novice" | "savvy" | "pro") {
  switch (value) {
    case "novice":
      return { level: 1, progress: 0.34, label: "Beginner" }
    case "savvy":
      return { level: 2, progress: 0.67, label: "Intermediate" }
    default:
      return { level: 3, progress: 1, label: "Advanced" }
  }
}

export function riskMeta(value: "beginner" | "intermediate" | "expert") {
  switch (value) {
    case "beginner":
      return {
        label: "Low",
        progress: 0.18,
      }
    case "intermediate":
      return {
        label: "Mid",
        progress: 0.52,
      }
    default:
      return {
        label: "High",
        progress: 0.86,
      }
  }
}
