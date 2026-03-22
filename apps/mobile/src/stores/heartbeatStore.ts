import { create } from "zustand"

import { resolveScopedFinlyUserId } from "@/services/agentUser"
import { api } from "@/services/api"
import type { HeartbeatRuleResponse, HeartbeatResultResponse } from "@/services/api/types"
import { useOnboardingStore } from "@/stores/onboardingStore"
import { DEFAULT_STOCK_ACCOUNT_ID } from "@/utils/mockStockAccounts"
import { loadString, saveString } from "@/utils/storage"

// ---------------------------------------------------------------------------
// Demo: NVDA Export Ban Crash Scenario
// ---------------------------------------------------------------------------

const DEMO_TICKERS = ["NVDA", "MSFT", "GOOGL", "META", "AAPL"]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LiveResult = {
  decision: string
  summary: string
  severity: string
}

type HeartbeatState = {
  // Persisted
  rules: HeartbeatRuleResponse[]
  results: HeartbeatResultResponse[]

  // Transient
  hydrated: boolean
  isAnalyzing: boolean
  analyzingTickers: string[]
  completedTickers: string[]
  currentTicker: string | null
  liveResults: Record<string, LiveResult>
  isCreatingRule: boolean
  lastAnalysisError: string | null

  // Actions
  refresh: (userId: string) => Promise<void>
  startAnalysis: (userId: string, tickers?: string[]) => Promise<void>
  startDemoAnalysis: () => Promise<void>
  createRule: (userId: string, rawRule: string) => Promise<void>
  deleteRule: (ruleId: string) => Promise<void>
  toggleRule: (ruleId: string) => Promise<void>
  markRead: (resultId: string) => Promise<void>
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = "finly.heartbeat.v1"

type PersistedHeartbeatState = {
  rules: HeartbeatRuleResponse[]
  results: HeartbeatResultResponse[]
}

const persist = async (rules: HeartbeatRuleResponse[], results: HeartbeatResultResponse[]) => {
  const payload: PersistedHeartbeatState = { rules, results }
  await saveString(STORAGE_KEY, JSON.stringify(payload))
}

const loadPersisted = async (): Promise<PersistedHeartbeatState | null> => {
  const raw = await loadString(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as PersistedHeartbeatState
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Account scope (same pattern as agentBoardStore)
// ---------------------------------------------------------------------------

const resolveAccountScopeKey = (
  state: ReturnType<typeof useOnboardingStore.getState> = useOnboardingStore.getState(),
) => {
  if (state.portfolioType === "stock") {
    return `stock:${state.stockAccountId ?? DEFAULT_STOCK_ACCOUNT_ID}`
  }
  if (state.portfolioType === "crypto") {
    const wallet = state.walletAddress.trim().toLowerCase()
    return `crypto:${wallet || "default"}`
  }
  return "default"
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useHeartbeatStore = create<HeartbeatState>((set, get) => ({
  rules: [],
  results: [],
  hydrated: false,
  isAnalyzing: false,
  analyzingTickers: [],
  completedTickers: [],
  currentTicker: null,
  liveResults: {},
  isCreatingRule: false,
  lastAnalysisError: null,

  refresh: async (userId: string) => {
    const [rulesRes, resultsRes] = await Promise.all([
      api.getHeartbeatRules(userId),
      api.getHeartbeatResults(userId),
    ])
    const rules = rulesRes.kind === "ok" ? rulesRes.rules : get().rules
    const results = resultsRes.kind === "ok" ? resultsRes.results : get().results
    set({ rules, results })
    await persist(rules, results)
  },

  startAnalysis: async (userId: string, tickers?: string[]) => {
    const normalizedTickers =
      tickers?.map((ticker) => ticker.trim().toUpperCase()).filter((ticker) => ticker.length > 0) ??
      []
    const uniqueTickers = normalizedTickers.length > 0 ? Array.from(new Set(normalizedTickers)) : []

    set({
      isAnalyzing: true,
      liveResults: {},
      completedTickers: [],
      currentTicker: null,
      analyzingTickers: uniqueTickers,
      lastAnalysisError: null,
    })

    const analyzeResult = await api.heartbeatAnalyzeStream(
      userId,
      uniqueTickers.length > 0 ? uniqueTickers : undefined,
      (event: Record<string, unknown>) => {
        switch (event.type) {
          case "started":
            set({ analyzingTickers: (event.tickers as string[]) ?? [] })
            break
          case "ticker_start":
            set({ currentTicker: event.ticker as string })
            break
          case "ticker_done":
            set({
              currentTicker: null,
              completedTickers: [...get().completedTickers, event.ticker as string],
              liveResults: {
                ...get().liveResults,
                [event.ticker as string]: {
                  decision: event.decision as string,
                  summary: event.summary as string,
                  severity: event.severity as string,
                },
              },
            })
            break
          case "ticker_error":
            set({
              currentTicker: null,
              completedTickers: [...get().completedTickers, event.ticker as string],
              liveResults: {
                ...get().liveResults,
                [event.ticker as string]: {
                  decision: "ERROR",
                  summary: (event.error as string) ?? "Analysis failed",
                  severity: "critical",
                },
              },
            })
            break
          case "done":
            set({ isAnalyzing: false, currentTicker: null })
            void get().refresh(userId)
            break
        }
      },
    )

    if (analyzeResult.kind !== "ok") {
      set({
        isAnalyzing: false,
        currentTicker: null,
        lastAnalysisError:
          analyzeResult.kind === "cannot-connect"
            ? "Cannot connect to backend. Check API server and agent server."
            : "Analysis failed before streaming response. Check backend logs.",
      })
      return
    }

    // Safety — mark done if stream ended without "done" event
    if (get().isAnalyzing) {
      set({ isAnalyzing: false, currentTicker: null })
    }
  },

  startDemoAnalysis: async () => {
    const scopeKey = resolveAccountScopeKey()
    const userId = resolveScopedFinlyUserId(scopeKey)

    set({
      isAnalyzing: true,
      liveResults: {},
      completedTickers: [],
      currentTicker: null,
      analyzingTickers: DEMO_TICKERS,
    })

    await api.heartbeatAnalyzeStream(userId, DEMO_TICKERS, (event: Record<string, unknown>) => {
      switch (event.type) {
        case "started":
          set({ analyzingTickers: (event.tickers as string[]) ?? DEMO_TICKERS })
          break
        case "ticker_start":
          set({ currentTicker: event.ticker as string })
          break
        case "ticker_done":
          set({
            currentTicker: null,
            completedTickers: [...get().completedTickers, event.ticker as string],
            liveResults: {
              ...get().liveResults,
              [event.ticker as string]: {
                decision: event.decision as string,
                summary: event.summary as string,
                severity: event.severity as string,
              },
            },
          })
          break
        case "ticker_error":
          set({
            currentTicker: null,
            completedTickers: [...get().completedTickers, event.ticker as string],
            liveResults: {
              ...get().liveResults,
              [event.ticker as string]: {
                decision: "ERROR",
                summary: (event.error as string) ?? "Analysis failed",
                severity: "critical",
              },
            },
          })
          break
        case "done":
          set({ isAnalyzing: false, currentTicker: null })
          void get().refresh(userId)
          break
      }
    })

    // Safety — mark done if stream ended without "done" event
    if (get().isAnalyzing) {
      set({ isAnalyzing: false, currentTicker: null })
    }
  },

  createRule: async (userId: string, rawRule: string) => {
    set({ isCreatingRule: true })
    try {
      const res = await api.createHeartbeatRule(userId, rawRule)
      if (res.kind === "ok") {
        const rules = [res.rule, ...get().rules]
        set({ rules })
        await persist(rules, get().results)
      }
    } finally {
      set({ isCreatingRule: false })
    }
  },

  deleteRule: async (ruleId: string) => {
    const res = await api.deleteHeartbeatRule(ruleId)
    if (res.kind === "ok") {
      const rules = get().rules.filter((r) => r.id !== ruleId)
      set({ rules })
      await persist(rules, get().results)
    }
  },

  toggleRule: async (ruleId: string) => {
    const res = await api.toggleHeartbeatRule(ruleId)
    if (res.kind === "ok") {
      const rules = get().rules.map((r) => (r.id === ruleId ? res.rule : r))
      set({ rules })
      await persist(rules, get().results)
    }
  },

  markRead: async (resultId: string) => {
    const res = await api.markHeartbeatResultRead(resultId)
    if (res.kind === "ok") {
      const results = get().results.map((r) => (r.id === resultId ? { ...r, is_read: true } : r))
      set({ results })
      await persist(get().rules, results)
    }
  },
}))

// ---------------------------------------------------------------------------
// Auto-hydrate on module load
// ---------------------------------------------------------------------------

void (async () => {
  const persisted = await loadPersisted()
  if (persisted) {
    useHeartbeatStore.setState({
      rules: persisted.rules,
      results: persisted.results,
      hydrated: true,
    })
  } else {
    useHeartbeatStore.setState({ hydrated: true })
  }

  // Fetch latest from backend
  const scopeKey = resolveAccountScopeKey()
  const userId = resolveScopedFinlyUserId(scopeKey)
  await useHeartbeatStore.getState().refresh(userId)
})()
