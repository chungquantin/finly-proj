import { create } from "zustand"

import { resolveScopedFinlyUserId } from "@/services/agentUser"
import { api } from "@/services/api"
import type {
  AgentPanelMessage,
  PanelHistoryMessage,
  PanelChatStreamEvent,
  ReportListItem,
  ReportResponse,
} from "@/services/api/types"
import { useOnboardingStore } from "@/stores/onboardingStore"
import { DEFAULT_STOCK_ACCOUNT_ID } from "@/utils/mockStockAccounts"
import { playBase64Audio } from "@/utils/playAudio"
import { loadString, saveString } from "@/utils/storage"

type ThreadStage = "intake" | "report_loading" | "report_ready" | "error"
type ThreadDecision = "Buy" | "Sell" | "Position"
type ThreadMessageKind = "intake" | "panel" | "system"

export type AgentThreadMessage = {
  id: string
  role: "user" | "assistant" | "agent" | "system"
  author: string
  content: string
  kind: ThreadMessageKind
  createdAt: string
  agentRole?: string
}

export type ThreadReportVersion = {
  id: string
  sourceReportId: string
  createdAt: string
  report: ReportResponse
}

export type AgentThread = {
  id: string
  userId: string
  title: string
  ticker: string
  decision: ThreadDecision
  intake: string
  summary: string
  updatedAt: string
  unreadCount: number
  participantAgentIds: string[]
  messages: AgentThreadMessage[]
  stage: ThreadStage
  followUpCount: number
  isBusy: boolean
  lastError?: string
  reportId?: string
  report?: ReportResponse
  reportVersions: ThreadReportVersion[]
  memoryUpdates: string[]
}

type PersistedAgentBoardState = {
  threads: AgentThread[]
}

type AgentBoardState = PersistedAgentBoardState & {
  accountScopeKey: string
  hydrated: boolean
  switchAccountScope: (scopeKey: string) => Promise<void>
  startThread: (message: string) => string
  sendThreadMessage: (threadId: string, message: string) => Promise<void>
  regenerateReport: (threadId: string) => Promise<void>
  closeThread: (threadId: string) => void
  refreshFromBackend: () => Promise<void>
}

const LEGACY_STORAGE_KEY = "finly.agent.board.v1"
const STORAGE_KEY_PREFIX = "finly.agent.board.v2"
const PARTICIPANT_AGENT_IDS = ["advisor", "analyst", "researcher", "trader"]
const ADVISOR_AUTHOR = "Advisor"

const nowIso = () => new Date().toISOString()

const makeId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const toDecision = (decision?: string): ThreadDecision => {
  const value = (decision ?? "").trim().toUpperCase()
  if (value === "BUY") return "Buy"
  if (value === "SELL") return "Sell"
  return "Position"
}

const resolveAgentRoleKey = (value?: string | null) => {
  const normalized = (value ?? "").trim().toLowerCase()
  if (!normalized) return "advisor"
  if (normalized.includes("advisor")) return "advisor"
  if (normalized.includes("analyst")) return "analyst"
  if (normalized.includes("research")) return "researcher"
  if (normalized.includes("trader")) return "trader"
  return "advisor"
}

const resolveAgentAuthor = (value?: string | null) => {
  const role = resolveAgentRoleKey(value)
  if (role === "advisor") return "Advisor"
  if (role === "analyst") return "Analyst"
  if (role === "researcher") return "Researcher"
  if (role === "trader") return "Trader"
  return ADVISOR_AUTHOR
}

const buildThreadTitle = (prompt: string, report?: ReportResponse) => {
  if (report?.ticker) {
    return `${report.ticker} outlook`
  }
  const trimmed = prompt.trim()
  if (!trimmed) return "New board conversation"
  return trimmed.length > 42 ? `${trimmed.slice(0, 42)}...` : trimmed
}

const createMessage = (
  role: AgentThreadMessage["role"],
  author: string,
  content: string,
  kind: ThreadMessageKind,
  extras: Partial<Pick<AgentThreadMessage, "agentRole" | "createdAt">> = {},
): AgentThreadMessage => ({
  id: makeId("msg"),
  role,
  author,
  content,
  kind,
  createdAt: extras.createdAt ?? nowIso(),
  agentRole: extras.agentRole,
})

const buildReportVersion = (report: ReportResponse, createdAt = nowIso()): ThreadReportVersion => ({
  id: makeId("report_version"),
  sourceReportId: report.report_id,
  createdAt,
  report,
})

const buildThreadFromReport = (report: ReportListItem): AgentThread => {
  const initialReport: ReportResponse = {
    report_id: report.id,
    user_id: report.user_id,
    ticker: report.ticker,
    decision: report.decision,
    summary: report.summary,
    full_report: report.full_report,
    agent_reasoning: report.agent_reasoning,
    specialist_insights: report.specialist_insights,
    additional_tickers: [],
    intake_brief: report.intake_brief,
  }

  return {
    id: report.id,
    userId: report.user_id,
    title: buildThreadTitle(report.intake_brief || report.summary, initialReport),
    ticker: report.ticker,
    decision: toDecision(report.decision),
    intake: report.intake_brief || "Generated from saved report",
    summary: report.summary,
    updatedAt: report.created_at,
    unreadCount: 0,
    participantAgentIds: PARTICIPANT_AGENT_IDS,
    messages: [],
    stage: "report_ready",
    followUpCount: 0,
    isBusy: false,
    reportId: report.id,
    report: initialReport,
    reportVersions: [buildReportVersion(initialReport, report.created_at)],
    memoryUpdates: [],
  }
}

const mergeThread = (threads: AgentThread[], nextThread: AgentThread) => {
  const existingIndex = threads.findIndex((thread) => thread.id === nextThread.id)
  if (existingIndex === -1) return [nextThread, ...threads]

  const copy = [...threads]
  copy[existingIndex] = nextThread
  return copy
}

const toStorageSafeScope = (scopeKey: string) => scopeKey.replace(/[^a-zA-Z0-9_-]/g, "_")

const storageKeyForScope = (scopeKey: string) =>
  `${STORAGE_KEY_PREFIX}.${toStorageSafeScope(scopeKey)}`

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

const persistThreads = async (threads: AgentThread[], scopeKey: string) => {
  const payload: PersistedAgentBoardState = { threads }
  await saveString(storageKeyForScope(scopeKey), JSON.stringify(payload))
}

const parsePersistedState = (raw: string | null): PersistedAgentBoardState | null => {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as PersistedAgentBoardState
    if (!Array.isArray(parsed.threads)) return null
    return {
      threads: parsed.threads.map(normalizeThread),
    }
  } catch {
    return null
  }
}

const normalizeThread = (thread: AgentThread): AgentThread => ({
  ...thread,
  messages: (thread.messages ?? []).map((message) => {
    if (message.role === "assistant" && message.author === "Finly") {
      return {
        ...message,
        author: ADVISOR_AUTHOR,
        agentRole: resolveAgentRoleKey(message.agentRole),
      }
    }
    return message
  }),
  reportVersions:
    Array.isArray(thread.reportVersions) && thread.reportVersions.length > 0
      ? thread.reportVersions
      : thread.report
        ? [buildReportVersion(thread.report, thread.updatedAt || nowIso())]
        : [],
  memoryUpdates: Array.isArray(thread.memoryUpdates) ? thread.memoryUpdates : [],
})

const syncReportIntoThread = (thread: AgentThread, report: ReportResponse): AgentThread => {
  const normalizedThread = normalizeThread(thread)
  const reportNotice = createMessage(
    "system",
    "Finly",
    `Team report ready for ${report.ticker}: ${report.decision}.`,
    "system",
  )

  const nextVersion = buildReportVersion(report)

  return {
    ...normalizedThread,
    title: buildThreadTitle(normalizedThread.intake || normalizedThread.title, report),
    ticker: report.ticker,
    decision: toDecision(report.decision),
    summary: report.summary,
    updatedAt: nowIso(),
    stage: "report_ready",
    isBusy: false,
    lastError: undefined,
    reportId: report.report_id,
    report,
    reportVersions: [...normalizedThread.reportVersions, nextVersion],
    participantAgentIds: PARTICIPANT_AGENT_IDS,
    messages: [...normalizedThread.messages, reportNotice],
  }
}

const mapPanelHistoryMessage = (item: PanelHistoryMessage): AgentThreadMessage => {
  if (item.role === "user") {
    return createMessage("user", "You", item.content, "panel", {
      createdAt: item.created_at,
    })
  }

  if (item.role === "assistant") {
    const agentRole = resolveAgentRoleKey(item.agent_role)
    return createMessage("agent", resolveAgentAuthor(item.agent_role), item.content, "panel", {
      createdAt: item.created_at,
      agentRole,
    })
  }

  return createMessage("system", "Finly", item.content, "system", {
    createdAt: item.created_at,
  })
}

export const useAgentBoardStore = create<AgentBoardState>((set, get) => ({
  accountScopeKey: resolveAccountScopeKey(),
  threads: [],
  hydrated: false,
  switchAccountScope: async (scopeKey) => {
    if (!scopeKey || scopeKey === get().accountScopeKey) return

    const persisted = parsePersistedState(await loadString(storageKeyForScope(scopeKey)))
    set({
      accountScopeKey: scopeKey,
      threads: persisted?.threads ?? [],
      hydrated: true,
    })
    await get().refreshFromBackend()
  },

  startThread: (message) => {
    const prompt = message.trim()
    const threadId = makeId("thread")
    const createdAt = nowIso()
    const userMessage = createMessage("user", "You", prompt, "intake", { createdAt })
    const userId = resolveScopedFinlyUserId(get().accountScopeKey)

    const thread: AgentThread = {
      id: threadId,
      userId,
      title: buildThreadTitle(prompt),
      ticker: "BOARD",
      decision: "Position",
      intake: prompt,
      summary: prompt,
      updatedAt: createdAt,
      unreadCount: 0,
      participantAgentIds: PARTICIPANT_AGENT_IDS,
      messages: [userMessage],
      stage: "intake",
      followUpCount: 0,
      isBusy: true,
      reportVersions: [],
      memoryUpdates: [],
    }

    set((state) => ({ threads: [thread, ...state.threads] }))

    void (async () => {
      const result = await api.intake({
        user_id: userId,
        message: prompt,
      })

      if (result.kind !== "ok") {
        set((state) => ({
          threads: state.threads.map((item) =>
            item.id === threadId
              ? {
                  ...item,
                  stage: "error",
                  isBusy: false,
                  lastError: "Unable to reach Finly intake. Please try again.",
                }
              : item,
          ),
        }))
        return
      }

      if (result.data.audio_b64) {
        void playBase64Audio(result.data.audio_b64)
      }

      const assistantMessage = createMessage(
        "assistant",
        ADVISOR_AUTHOR,
        result.data.message,
        "intake",
        {
          agentRole: "advisor",
        },
      )

      set((state) => ({
        threads: state.threads.map((item) => {
          if (item.id !== threadId) return item
          const nextThread: AgentThread = {
            ...item,
            messages: [...item.messages, assistantMessage],
            followUpCount: result.data.follow_up_count,
            updatedAt: nowIso(),
            summary: result.data.goals_brief || result.data.message,
            stage: result.data.is_complete ? "report_loading" : "intake",
            isBusy: result.data.is_complete,
            lastError: undefined,
          }
          return nextThread
        }),
      }))

      if (!result.data.is_complete) return

      const reportResult = await api.generateReport({
        user_id: userId,
      })

      set((state) => ({
        threads: state.threads.map((item) => {
          if (item.id !== threadId) return item
          if (reportResult.kind !== "ok") {
            return {
              ...item,
              stage: "error",
              isBusy: false,
              lastError: "Report generation failed. You can try again.",
            }
          }
          return syncReportIntoThread(item, reportResult.report)
        }),
      }))
    })()

    return threadId
  },

  sendThreadMessage: async (threadId, message) => {
    const prompt = message.trim()
    if (!prompt) return

    const existing = get().threads.find((thread) => thread.id === threadId)
    if (!existing || existing.isBusy) return

    const userMessage = createMessage(
      "user",
      "You",
      prompt,
      existing.stage === "intake" ? "intake" : "panel",
    )

    set((state) => ({
      threads: state.threads.map((thread) =>
        thread.id === threadId
          ? {
              ...thread,
              isBusy: true,
              updatedAt: nowIso(),
              messages: [...thread.messages, userMessage],
            }
          : thread,
      ),
    }))

    if (existing.stage === "intake") {
      const intakeResult = await api.intake({
        user_id: existing.userId,
        message: prompt,
      })

      if (intakeResult.kind !== "ok") {
        set((state) => ({
          threads: state.threads.map((thread) =>
            thread.id === threadId
              ? {
                  ...thread,
                  stage: "error",
                  isBusy: false,
                  lastError: "Unable to continue intake right now.",
                }
              : thread,
          ),
        }))
        return
      }

      if (intakeResult.data.audio_b64) {
        void playBase64Audio(intakeResult.data.audio_b64)
      }

      const assistantMessage = createMessage(
        "assistant",
        ADVISOR_AUTHOR,
        intakeResult.data.message,
        "intake",
        { agentRole: "advisor" },
      )

      set((state) => ({
        threads: state.threads.map((thread) => {
          if (thread.id !== threadId) return thread
          return {
            ...thread,
            messages: [...thread.messages, assistantMessage],
            followUpCount: intakeResult.data.follow_up_count,
            summary: intakeResult.data.goals_brief || intakeResult.data.message,
            intake: intakeResult.data.goals_brief || thread.intake,
            stage: intakeResult.data.is_complete ? "report_loading" : "intake",
            isBusy: intakeResult.data.is_complete,
            lastError: undefined,
            updatedAt: nowIso(),
          }
        }),
      }))

      if (!intakeResult.data.is_complete) return

      const reportResult = await api.generateReport({
        user_id: existing.userId,
      })

      set((state) => ({
        threads: state.threads.map((thread) => {
          if (thread.id !== threadId) return thread
          if (reportResult.kind !== "ok") {
            return {
              ...thread,
              stage: "error",
              isBusy: false,
              lastError: "Report generation failed. Please try again.",
            }
          }
          return syncReportIntoThread(thread, reportResult.report)
        }),
      }))
      return
    }

    const pendingMessageIdsByRole: Record<string, string> = {}
    let latestMemoryUpdates: string[] = []
    let streamError: string | null = null

    const streamResult = await api.panelChatStream(
      {
        user_id: existing.userId,
        report_id: existing.reportId,
        message: prompt,
      },
      (event: PanelChatStreamEvent) => {
        if (event.type === "error") {
          streamError = "Team chat failed. Please try again."
          return
        }

        if (event.type === "memory_updates") {
          latestMemoryUpdates = event.memory_updates ?? []
          return
        }

        if (!event.message) return
        const message = event.message as AgentPanelMessage
        const roleKey = message.agent_role || message.agent_name.toLowerCase()

        if (event.type === "agent_message_start") {
          const id = makeId(`stream_${roleKey}`)
          pendingMessageIdsByRole[roleKey] = id
          set((state) => ({
            threads: state.threads.map((thread) => {
              if (thread.id !== threadId) return thread
              return {
                ...thread,
                messages: [
                  ...thread.messages,
                  {
                    id,
                    role: "agent",
                    author: message.agent_name,
                    content: "",
                    kind: "panel",
                    createdAt: nowIso(),
                    agentRole: message.agent_role,
                  },
                ],
              }
            }),
          }))
          return
        }

        if (event.type === "agent_message_delta") {
          const id = pendingMessageIdsByRole[roleKey]
          if (!id) return
          const delta = event.delta ?? ""
          set((state) => ({
            threads: state.threads.map((thread) => {
              if (thread.id !== threadId) return thread
              return {
                ...thread,
                messages: thread.messages.map((item) =>
                  item.id === id ? { ...item, content: `${item.content}${delta}` } : item,
                ),
              }
            }),
          }))
          return
        }

        if (event.type === "agent_message_done") {
          const id = pendingMessageIdsByRole[roleKey]
          if (!id) {
            set((state) => ({
              threads: state.threads.map((thread) => {
                if (thread.id !== threadId) return thread
                return {
                  ...thread,
                  messages: [
                    ...thread.messages,
                    createMessage("agent", message.agent_name, message.response, "panel", {
                      agentRole: message.agent_role,
                    }),
                  ],
                }
              }),
            }))
            return
          }
          set((state) => ({
            threads: state.threads.map((thread) => {
              if (thread.id !== threadId) return thread
              return {
                ...thread,
                messages: thread.messages.map((item) =>
                  item.id === id ? { ...item, content: message.response } : item,
                ),
              }
            }),
          }))
        }
      },
    )

    if (streamResult.kind !== "ok" || streamError) {
      set((state) => ({
        threads: state.threads.map((thread) =>
          thread.id === threadId
            ? {
                ...thread,
                stage: "error",
                isBusy: false,
                lastError: streamError || "Team chat failed. Please try again.",
              }
            : thread,
        ),
      }))
      return
    }

    const memoryMessage =
      latestMemoryUpdates.length > 0
        ? createMessage(
            "system",
            "Finly",
            `Memory updated: ${latestMemoryUpdates.join(", ")}`,
            "system",
          )
        : null

    set((state) => ({
      threads: state.threads.map((thread) => {
        if (thread.id !== threadId) return thread
        return {
          ...thread,
          stage: "report_ready",
          isBusy: false,
          lastError: undefined,
          updatedAt: nowIso(),
          messages: [...thread.messages, ...(memoryMessage ? [memoryMessage] : [])],
          memoryUpdates: latestMemoryUpdates,
        }
      }),
    }))
  },

  regenerateReport: async (threadId) => {
    const thread = get().threads.find((item) => item.id === threadId)
    if (!thread || thread.isBusy || !thread.reportId) return

    set((state) => ({
      threads: state.threads.map((item) =>
        item.id === threadId
          ? {
              ...item,
              stage: "report_loading",
              isBusy: true,
              lastError: undefined,
            }
          : item,
      ),
    }))

    const result = await api.regenerateReport({
      user_id: thread.userId,
      report_id: thread.reportId,
    })

    set((state) => ({
      threads: state.threads.map((item) => {
        if (item.id !== threadId) return item
        if (result.kind !== "ok") {
          return {
            ...item,
            stage: "error",
            isBusy: false,
            lastError: "Unable to regenerate the report.",
          }
        }
        return syncReportIntoThread(item, result.report)
      }),
    }))
  },

  closeThread: (threadId) => {
    set((state) => ({
      threads: state.threads.filter((thread) => thread.id !== threadId),
    }))
  },

  refreshFromBackend: async () => {
    const userId = resolveScopedFinlyUserId(get().accountScopeKey)
    const reportsResult = await api.getReports(userId)
    if (reportsResult.kind !== "ok") {
      set({ hydrated: true })
      return
    }
    const availableReportIds = new Set(reportsResult.reports.map((report) => report.id))

    const persisted = get().threads
    const existingReportIds = new Set(
      persisted.map((thread) => thread.reportId).filter((value): value is string => Boolean(value)),
    )

    let nextThreads = [...persisted]
    for (const report of reportsResult.reports) {
      if (!existingReportIds.has(report.id)) {
        nextThreads = mergeThread(nextThreads, buildThreadFromReport(report))
      }
    }

    for (const thread of nextThreads) {
      if (!thread.reportId || thread.messages.some((message) => message.kind === "panel")) continue
      if (!availableReportIds.has(thread.reportId)) continue
      const historyResult = await api.getPanelHistory(thread.userId, thread.reportId)
      if (historyResult.kind !== "ok" || historyResult.messages.length === 0) continue
      const panelMessages = historyResult.messages.map(mapPanelHistoryMessage)
      nextThreads = nextThreads.map((item) =>
        item.id === thread.id
          ? {
              ...item,
              messages: [
                ...item.messages.filter((message) => message.kind !== "panel"),
                ...panelMessages,
              ],
            }
          : item,
      )
    }

    set({ threads: nextThreads, hydrated: true })
  },
}))

void (async () => {
  const initialScopeKey = resolveAccountScopeKey()
  let persisted = parsePersistedState(await loadString(storageKeyForScope(initialScopeKey)))
  if (!persisted) {
    persisted = parsePersistedState(await loadString(LEGACY_STORAGE_KEY))
    if (persisted) {
      await persistThreads(persisted.threads, initialScopeKey)
    }
  }

  if (persisted) {
    useAgentBoardStore.setState({
      accountScopeKey: initialScopeKey,
      threads: persisted.threads,
      hydrated: true,
    })
  } else {
    useAgentBoardStore.setState({ accountScopeKey: initialScopeKey, hydrated: true })
  }
  await useAgentBoardStore.getState().refreshFromBackend()
})()

useAgentBoardStore.subscribe((state) => {
  void persistThreads(state.threads, state.accountScopeKey)
})

let lastScopeKey = resolveAccountScopeKey()
useOnboardingStore.subscribe((state) => {
  const nextScopeKey = resolveAccountScopeKey(state)
  if (nextScopeKey === lastScopeKey) return
  lastScopeKey = nextScopeKey
  void useAgentBoardStore.getState().switchAccountScope(nextScopeKey)
})
