import { getTickerLogoUri } from "@/utils/tickerLogo"

export type TeamAgent = {
  id: string
  name: string
  avatar: string
  role: string
  specialty: string
  bio: string
  mandate: string
  status: "active" | "monitoring" | "idle"
  confidence: number
  lastUpdate: string
  location: string
  decisionStyle: string
  timeHorizon: string
  riskBias: string
  coverage: string
  responseCadence: string
  primaryObjective: string
  focusAreas: string[]
  strengths: string[]
  watchlist: string[]
  attributes: { label: string; value: string }[]
}

export type Holding = {
  ticker: string
  name: string
  logoUri?: string
  shares: number
  valueUsd: number
  changePercent: number
  allocationPercent: number
}

export type BoardMessage = {
  id: string
  author: string
  role: "user" | "portfolio-manager" | "market-analyst" | "risk-assessor" | "researcher"
  avatar: string
  message: string
  time: string
  reaction?: string
}

export type BoardThread = {
  id: string
  title: string
  ticker: string
  decision: "Buy" | "Sell" | "Position"
  intake: string
  summary: string
  updatedAt: string
  unreadCount: number
  participantAgentIds: string[]
  messages: BoardMessage[]
}

export type HoldingDecision = {
  ticker: string
  decision: "Buy" | "Sell" | "Position"
  intake: string
  conviction: string
  targetPosition: string
  nextReview: string
  rationale: string[]
  relatedThreadIds: string[]
}

export const portfolioSnapshot = {
  totalValueUsd: 184230,
  dailyPnlUsd: 2140,
  dailyPnlPercent: 1.17,
  monthlyPnlPercent: 6.8,
  yearlyPnlPercent: 18.4,
  investedUsd: 155000,
  cashUsd: 12400,
}

export const teamAgents: TeamAgent[] = [
  {
    id: "portfolio-manager",
    name: "Avery",
    avatar: "AV",
    role: "Portfolio Manager",
    specialty: "Allocation and execution plan",
    bio: "Avery translates team research into a portfolio plan, balancing conviction, sizing, and timing so the portfolio stays aligned with the user's target risk.",
    mandate:
      "Own allocation decisions, propose rebalances, and turn agent input into a single investable action plan.",
    status: "active",
    confidence: 0.84,
    lastUpdate: "2m ago",
    location: "Allocation Desk",
    decisionStyle: "Decisive, portfolio-first",
    timeHorizon: "2 to 8 weeks",
    riskBias: "Moderate",
    coverage: "Cross-sector equity allocation",
    responseCadence: "Real-time on major market moves",
    primaryObjective: "Compound returns while keeping concentration and cash levels within plan.",
    focusAreas: ["Position sizing", "Capital rotation", "Entry timing", "Cash deployment"],
    strengths: [
      "Synthesizes conflicting agent views into one executable plan",
      "Keeps portfolio weights aligned to target exposure",
      "Adapts quickly when new data changes conviction",
    ],
    watchlist: ["VCB", "FPT", "MWG", "Defensive dividend names"],
    attributes: [
      { label: "Win Rate", value: "71%" },
      { label: "Avg Rebalance", value: "3.2 positions" },
      { label: "Max Conviction", value: "22% position cap" },
      { label: "Cash Target", value: "6% to 12%" },
    ],
  },
  {
    id: "market-analyst",
    name: "Kai",
    avatar: "KA",
    role: "Market Analyst",
    specialty: "Macro and trend detection",
    bio: "Kai tracks market regime, liquidity conditions, and momentum shifts to flag when the environment supports offense, defense, or patient waiting.",
    mandate:
      "Interpret macro signals and market breadth so the board understands when trends are healthy, fading, or reversing.",
    status: "active",
    confidence: 0.79,
    lastUpdate: "4m ago",
    location: "Market Intelligence",
    decisionStyle: "Signal-driven, probabilistic",
    timeHorizon: "1 day to 6 weeks",
    riskBias: "Adaptive",
    coverage: "Macro, rates, breadth, momentum",
    responseCadence: "Every open and key macro print",
    primaryObjective:
      "Detect market regime changes before they materially impact portfolio positioning.",
    focusAreas: ["Breadth", "Rates sensitivity", "Sector leadership", "Momentum decay"],
    strengths: [
      "Identifies early trend fatigue before price fully rolls over",
      "Frames market conditions in plain language for the team",
      "Separates tactical noise from structural direction",
    ],
    watchlist: ["VNINDEX breadth", "Rate expectations", "Banking leadership", "Foreign inflows"],
    attributes: [
      { label: "Signal Confidence", value: "79%" },
      { label: "Macro Windows", value: "5 tracked" },
      { label: "Alert Latency", value: "< 3 min" },
      { label: "Regime State", value: "Late-cycle risk-on" },
    ],
  },
  {
    id: "risk-assessor",
    name: "Noor",
    avatar: "NO",
    role: "Risk Assessor",
    specialty: "Drawdown and volatility guardrails",
    bio: "Noor pressure-tests every proposed move against loss limits, concentration constraints, and volatility shock scenarios before the team acts.",
    mandate:
      "Protect downside by enforcing exposure guardrails, stress assumptions, and escalation rules for fast-changing conditions.",
    status: "monitoring",
    confidence: 0.88,
    lastUpdate: "1m ago",
    location: "Risk Control",
    decisionStyle: "Guardrail-first, disciplined",
    timeHorizon: "Intraday to 1 month",
    riskBias: "Defensive",
    coverage: "Drawdown, volatility, exposure limits",
    responseCadence: "Continuous monitoring",
    primaryObjective: "Keep portfolio losses contained while preserving room for selective upside.",
    focusAreas: ["VaR", "Concentration", "Stop-loss discipline", "Scenario stress"],
    strengths: [
      "Flags hidden correlation risk across seemingly different names",
      "Maintains discipline when conviction runs ahead of evidence",
      "Escalates fast when volatility regimes break",
    ],
    watchlist: [
      "Single-name concentration",
      "Correlation clusters",
      "Event risk calendar",
      "Liquidity gaps",
    ],
    attributes: [
      { label: "Portfolio VaR", value: "4.8%" },
      { label: "Stress Scenarios", value: "12 active" },
      { label: "Loss Trigger", value: "-6% weekly" },
      { label: "Monitoring Mode", value: "Elevated" },
    ],
  },
  {
    id: "researcher",
    name: "Milo",
    avatar: "MI",
    role: "Researcher",
    specialty: "Catalyst and earnings research",
    bio: "Milo hunts for company-specific catalysts, fundamental changes, and earnings narratives that can create asymmetric upside or warn against weak stories.",
    mandate:
      "Supply the board with concise company research, catalyst tracking, and fast reads on earnings-quality signals.",
    status: "idle",
    confidence: 0.74,
    lastUpdate: "8m ago",
    location: "Research Lab",
    decisionStyle: "Thesis-driven, evidence-heavy",
    timeHorizon: "2 weeks to 2 quarters",
    riskBias: "Selective",
    coverage: "Catalysts, earnings, company updates",
    responseCadence: "On filings, news, and earnings",
    primaryObjective:
      "Surface the highest-upside ideas with enough evidence for the board to act confidently.",
    focusAreas: ["Earnings quality", "Catalyst mapping", "Management signals", "Valuation context"],
    strengths: [
      "Turns noisy filings into a short, useful thesis summary",
      "Separates durable catalysts from one-day headlines",
      "Builds clear bull and bear cases for each idea",
    ],
    watchlist: ["Earnings revisions", "Guidance changes", "Insider activity", "Sector catalysts"],
    attributes: [
      { label: "Live Dossiers", value: "18 names" },
      { label: "Catalyst Queue", value: "6 upcoming" },
      { label: "Earnings Hit Rate", value: "68%" },
      { label: "Research Depth", value: "High conviction" },
    ],
  },
]

export const holdings: Holding[] = [
  {
    ticker: "NVDA",
    name: "NVIDIA",
    logoUri: getTickerLogoUri("NVDA"),
    shares: 120,
    valueUsd: 46200,
    changePercent: 2.4,
    allocationPercent: 25.1,
  },
  {
    ticker: "TSLA",
    name: "Tesla",
    logoUri: getTickerLogoUri("TSLA"),
    shares: 95,
    valueUsd: 31800,
    changePercent: 1.1,
    allocationPercent: 17.3,
  },
  {
    ticker: "MSFT",
    name: "Microsoft",
    logoUri: getTickerLogoUri("MSFT"),
    shares: 84,
    valueUsd: 29650,
    changePercent: 0.8,
    allocationPercent: 16.1,
  },
  {
    ticker: "AAPL",
    name: "Apple",
    logoUri: getTickerLogoUri("AAPL"),
    shares: 136,
    valueUsd: 22140,
    changePercent: -0.3,
    allocationPercent: 12.0,
  },
]

export const boardThreads: BoardThread[] = [
  {
    id: "nvda-dip-plan",
    title: "NVDA add on pullback",
    ticker: "NVDA",
    decision: "Buy",
    intake: "Scale in if price retraces 3-5%",
    summary:
      "The board wants to keep NVIDIA as a core winner, but only add into controlled weakness.",
    updatedAt: "2m ago",
    unreadCount: 2,
    participantAgentIds: ["portfolio-manager", "market-analyst", "risk-assessor"],
    messages: [
      {
        id: "1",
        author: "You",
        role: "user",
        avatar: "YU",
        message: "Do we still want to add to NVDA if the rally cools off this week?",
        time: "09:12",
      },
      {
        id: "2",
        author: "Avery",
        role: "portfolio-manager",
        avatar: "AV",
        message: "Yes. I would only add in two clips and keep total position sizing capped at 9%.",
        time: "09:13",
        reaction: "📌",
      },
      {
        id: "3",
        author: "Kai",
        role: "market-analyst",
        avatar: "KA",
        message:
          "Momentum is still strong, but chasing strength here is lower quality than buying a controlled retrace.",
        time: "09:14",
      },
      {
        id: "4",
        author: "Noor",
        role: "risk-assessor",
        avatar: "NO",
        message:
          "Risk is acceptable if we stagger entries and keep the add below 2% NAV this week.",
        time: "09:15",
        reaction: "🛡️",
      },
    ],
  },
  {
    id: "tsla-trim-risk",
    title: "TSLA volatility trim",
    ticker: "TSLA",
    decision: "Sell",
    intake: "Trim into spikes above current range",
    summary:
      "The board wants to reduce Tesla exposure on strength while volatility stays elevated.",
    updatedAt: "9m ago",
    unreadCount: 0,
    participantAgentIds: ["portfolio-manager", "risk-assessor"],
    messages: [
      {
        id: "1",
        author: "You",
        role: "user",
        avatar: "YU",
        message: "Should we still trim Tesla if it squeezes again this afternoon?",
        time: "10:02",
      },
      {
        id: "2",
        author: "Noor",
        role: "risk-assessor",
        avatar: "NO",
        message:
          "Yes. The name still carries outsized single-name volatility relative to our current portfolio guardrails.",
        time: "10:03",
        reaction: "⚠️",
      },
      {
        id: "3",
        author: "Avery",
        role: "portfolio-manager",
        avatar: "AV",
        message:
          "I would trim 15% of the line into strength and rotate that capital into calmer large-cap exposure.",
        time: "10:04",
      },
    ],
  },
  {
    id: "msft-core-position",
    title: "MSFT core hold",
    ticker: "MSFT",
    decision: "Position",
    intake: "Hold core and add only on broad tech weakness",
    summary:
      "Microsoft stays a core holding. The board is not forcing a move without a better entry.",
    updatedAt: "13m ago",
    unreadCount: 1,
    participantAgentIds: ["market-analyst", "researcher"],
    messages: [
      {
        id: "1",
        author: "You",
        role: "user",
        avatar: "YU",
        message: "What is the board view on Microsoft after the recent AI headlines?",
        time: "08:44",
      },
      {
        id: "2",
        author: "Kai",
        role: "market-analyst",
        avatar: "KA",
        message:
          "Leadership is intact. I would not chase, but I also would not reduce a quality core winner here.",
        time: "08:45",
      },
      {
        id: "3",
        author: "Milo",
        role: "researcher",
        avatar: "MI",
        message:
          "Fundamental support remains strong and the AI narrative is still backed by visible enterprise demand.",
        time: "08:46",
        reaction: "🔥",
      },
    ],
  },
  {
    id: "aapl-defensive-build",
    title: "AAPL defensive reload",
    ticker: "AAPL",
    decision: "Buy",
    intake: "Accumulate slowly over the next two reviews",
    summary: "Apple is viewed as a steadier large-cap add while the board rotates toward quality.",
    updatedAt: "21m ago",
    unreadCount: 0,
    participantAgentIds: ["portfolio-manager", "researcher", "risk-assessor"],
    messages: [
      {
        id: "1",
        author: "You",
        role: "user",
        avatar: "YU",
        message: "If we want something steadier, is Apple the right place to add next?",
        time: "08:20",
      },
      {
        id: "2",
        author: "Milo",
        role: "researcher",
        avatar: "MI",
        message:
          "For a calmer quality add, yes. The setup is less explosive than NVIDIA but cleaner for staged accumulation.",
        time: "08:21",
      },
      {
        id: "3",
        author: "Avery",
        role: "portfolio-manager",
        avatar: "AV",
        message: "I would build the position across two review windows rather than all at once.",
        time: "08:22",
      },
    ],
  },
]

export const boardMessages: BoardMessage[] = boardThreads[0].messages

export const holdingDecisions: HoldingDecision[] = [
  {
    ticker: "NVDA",
    decision: "Buy",
    intake: "Scale in if price retraces 3-5%",
    conviction: "High",
    targetPosition: "8% to 9% max weight",
    nextReview: "After next earnings setup check",
    rationale: [
      "Leadership remains intact across AI infrastructure",
      "Board prefers buying weakness over chasing breakouts",
      "Risk remains manageable with staggered entries",
    ],
    relatedThreadIds: ["nvda-dip-plan", "msft-core-position"],
  },
  {
    ticker: "TSLA",
    decision: "Sell",
    intake: "Trim 15% of the position into strength",
    conviction: "Medium",
    targetPosition: "Reduce from 17.3% to near 14.5%",
    nextReview: "On next volatility spike",
    rationale: [
      "Position is contributing outsized portfolio volatility",
      "Board sees cleaner risk-adjusted opportunities elsewhere",
      "Trimming preserves upside while lowering concentration",
    ],
    relatedThreadIds: ["tsla-trim-risk"],
  },
  {
    ticker: "MSFT",
    decision: "Position",
    intake: "Hold core and add only on broad tech weakness",
    conviction: "High",
    targetPosition: "Maintain near current 16.1% weight",
    nextReview: "At next macro and earnings checkpoint",
    rationale: [
      "Core thesis remains intact",
      "No urgency to chase after extended price action",
      "Acts as quality exposure inside the growth sleeve",
    ],
    relatedThreadIds: ["msft-core-position", "nvda-dip-plan"],
  },
  {
    ticker: "AAPL",
    decision: "Buy",
    intake: "Accumulate gradually over two review windows",
    conviction: "Medium",
    targetPosition: "Increase toward 14% weight",
    nextReview: "Next board rotation review",
    rationale: [
      "Board wants more stable mega-cap exposure",
      "Apple improves quality balance versus higher-beta names",
      "Gradual adds reduce timing risk",
    ],
    relatedThreadIds: ["aapl-defensive-build"],
  },
]
