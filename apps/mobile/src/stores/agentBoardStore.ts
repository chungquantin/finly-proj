import { create } from "zustand"

import { FINLY_DEFAULT_USER_ID } from "@/services/agentUser"
import { api } from "@/services/api"
import type {
  AgentPanelMessage,
  PanelHistoryMessage,
  ReportListItem,
  ReportResponse,
} from "@/services/api/types"
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
  memoryUpdates: string[]
}

type PersistedAgentBoardState = {
  threads: AgentThread[]
}

type AgentBoardState = PersistedAgentBoardState & {
  hydrated: boolean
  startThread: (message: string) => string
  sendThreadMessage: (threadId: string, message: string) => Promise<void>
  regenerateReport: (threadId: string) => Promise<void>
  closeThread: (threadId: string) => void
  refreshFromBackend: () => Promise<void>
}

const STORAGE_KEY = "finly.agent.board.v1"
const PARTICIPANT_AGENT_IDS = ["advisor", "analyst", "researcher", "trader"]

const nowIso = () => new Date().toISOString()

const makeId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const toDecision = (decision?: string): ThreadDecision => {
  const value = (decision ?? "").trim().toUpperCase()
  if (value === "BUY") return "Buy"
  if (value === "SELL") return "Sell"
  return "Position"
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

const buildThreadFromReport = (report: ReportListItem): AgentThread => ({
  id: report.id,
  userId: report.user_id,
  title: buildThreadTitle(report.intake_brief || report.summary, {
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
  }),
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
  report: {
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
  },
  memoryUpdates: [],
})

const mergeThread = (threads: AgentThread[], nextThread: AgentThread) => {
  const existingIndex = threads.findIndex((thread) => thread.id === nextThread.id)
  if (existingIndex === -1) return [nextThread, ...threads]

  const copy = [...threads]
  copy[existingIndex] = nextThread
  return copy
}

const persistThreads = async (threads: AgentThread[]) => {
  const payload: PersistedAgentBoardState = { threads }
  await saveString(STORAGE_KEY, JSON.stringify(payload))
}

const parsePersistedState = (raw: string | null): PersistedAgentBoardState | null => {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as PersistedAgentBoardState
    if (!Array.isArray(parsed.threads)) return null
    return parsed
  } catch {
    return null
  }
}

const syncReportIntoThread = (thread: AgentThread, report: ReportResponse): AgentThread => {
  const reportNotice = createMessage(
    "system",
    "Finly",
    `Team report ready for ${report.ticker}: ${report.decision}.`,
    "system",
  )

  return {
    ...thread,
    title: buildThreadTitle(thread.intake || thread.title, report),
    ticker: report.ticker,
    decision: toDecision(report.decision),
    summary: report.summary,
    updatedAt: nowIso(),
    stage: "report_ready",
    isBusy: false,
    lastError: undefined,
    reportId: report.report_id,
    report,
    participantAgentIds: PARTICIPANT_AGENT_IDS,
    messages: [...thread.messages, reportNotice],
  }
}

const mapPanelHistoryMessage = (item: PanelHistoryMessage): AgentThreadMessage => {
  if (item.role === "user") {
    return createMessage("user", "You", item.content, "panel", {
      createdAt: item.created_at,
    })
  }

  if (item.role === "assistant") {
    return createMessage("agent", item.agent_role || "Finly", item.content, "panel", {
      createdAt: item.created_at,
      agentRole: item.agent_role ?? undefined,
    })
  }

  return createMessage("system", "Finly", item.content, "system", {
    createdAt: item.created_at,
  })
}

export const useAgentBoardStore = create<AgentBoardState>((set, get) => ({
  threads: [],
  hydrated: false,

  startThread: (message) => {
    const prompt = message.trim()
    const threadId = makeId("thread")
    const createdAt = nowIso()
    const userMessage = createMessage("user", "You", prompt, "intake", { createdAt })

    const thread: AgentThread = {
      id: threadId,
      userId: FINLY_DEFAULT_USER_ID,
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
      memoryUpdates: [],
    }

    set((state) => ({ threads: [thread, ...state.threads] }))

    void (async () => {
      const result = await api.intake({
        user_id: FINLY_DEFAULT_USER_ID,
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

      const assistantMessage = createMessage("assistant", "Finly", result.data.message, "intake")

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
        user_id: FINLY_DEFAULT_USER_ID,
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
        "Finly",
        intakeResult.data.message,
        "intake",
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

    const panelResult = await api.panelChat({
      user_id: existing.userId,
      report_id: existing.reportId,
      message: prompt,
    })

    if (panelResult.kind !== "ok") {
      set((state) => ({
        threads: state.threads.map((thread) =>
          thread.id === threadId
            ? {
                ...thread,
                stage: "error",
                isBusy: false,
                lastError: "Team chat failed. Please try again.",
              }
            : thread,
        ),
      }))
      return
    }

    const agentMessages = panelResult.data.agent_responses.map((response: AgentPanelMessage) =>
      createMessage("agent", response.agent_name, response.response, "panel", {
        agentRole: response.agent_role,
      }),
    )

    const memoryMessage =
      panelResult.data.memory_updates.length > 0
        ? createMessage(
            "system",
            "Finly",
            `Memory updated: ${panelResult.data.memory_updates.join(", ")}`,
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
          messages: [
            ...thread.messages,
            ...agentMessages,
            ...(memoryMessage ? [memoryMessage] : []),
          ],
          memoryUpdates: panelResult.data.memory_updates,
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
    const reportsResult = await api.getReports(FINLY_DEFAULT_USER_ID)
    if (reportsResult.kind !== "ok") {
      set({ hydrated: true })
      return
    }

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
  const persisted = parsePersistedState(await loadString(STORAGE_KEY))
  if (persisted) {
    useAgentBoardStore.setState({ threads: persisted.threads, hydrated: true })
  } else {
    useAgentBoardStore.setState({ hydrated: true })
  }
  await useAgentBoardStore.getState().refreshFromBackend()
})()

useAgentBoardStore.subscribe((state) => {
  void persistThreads(state.threads)
})
