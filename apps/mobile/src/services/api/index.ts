/**
 * Finly API client — wraps apisauce for all backend calls.
 */
import { ApiResponse, ApisauceInstance, create } from "apisauce"

import Config from "@/config"

import { GeneralApiProblem, getGeneralApiProblem } from "./apiProblem"
import type {
  ApiConfig,
  ChatRequest,
  ChatResponse,
  IntakeRequest,
  IntakeResponse,
  MarketHistoryBatchResponse,
  MarketDataQuote,
  OnboardingRequest,
  OnboardingResponse,
  PanelHistoryMessage,
  PanelChatRequest,
  PanelChatResponse,
  PanelChatStreamEvent,
  PortfolioImportRequest,
  PortfolioResponse,
  ReportListItem,
  ReportGenerateRequest,
  ReportRegenerateRequest,
  ReportResponse,
  UserProfile,
  VoiceOnboardingResponse,
} from "./types"

export const DEFAULT_API_CONFIG: ApiConfig = {
  url: Config.API_URL,
  timeout: 30000,
}

export class Api {
  apisauce: ApisauceInstance
  config: ApiConfig

  constructor(config: ApiConfig = DEFAULT_API_CONFIG) {
    this.config = config
    this.apisauce = create({
      baseURL: this.config.url,
      timeout: this.config.timeout,
      headers: { Accept: "application/json" },
    })
  }

  // -----------------------------------------------------------------------
  // Onboarding
  // -----------------------------------------------------------------------

  async onboarding(
    req: OnboardingRequest,
  ): Promise<{ kind: "ok"; data: OnboardingResponse } | GeneralApiProblem> {
    const response: ApiResponse<OnboardingResponse> = await this.apisauce.post(
      "/api/onboarding",
      req,
    )
    if (!response.ok) {
      const problem = getGeneralApiProblem(response)
      if (problem) return problem
    }
    return { kind: "ok", data: response.data! }
  }

  async getProfile(
    userId: string,
  ): Promise<{ kind: "ok"; profile: UserProfile } | GeneralApiProblem> {
    const response: ApiResponse<UserProfile> = await this.apisauce.get(
      `/api/user/${userId}/profile`,
    )
    if (!response.ok) {
      const problem = getGeneralApiProblem(response)
      if (problem) return problem
    }
    return { kind: "ok", profile: response.data! }
  }

  // -----------------------------------------------------------------------
  // Voice onboarding
  // -----------------------------------------------------------------------

  async voiceOnboardingGreeting(
    userId: string,
  ): Promise<{ kind: "ok"; data: VoiceOnboardingResponse } | GeneralApiProblem> {
    const response: ApiResponse<VoiceOnboardingResponse> = await this.apisauce.post(
      "/api/onboarding/voice",
      { user_id: userId, is_initial: true },
    )
    if (!response.ok) {
      const problem = getGeneralApiProblem(response)
      if (problem) return problem
    }
    return { kind: "ok", data: response.data! }
  }

  async voiceOnboardingMessage(
    userId: string,
    message: string,
  ): Promise<{ kind: "ok"; data: VoiceOnboardingResponse } | GeneralApiProblem> {
    const response: ApiResponse<VoiceOnboardingResponse> = await this.apisauce.post(
      "/api/onboarding/voice",
      { user_id: userId, message },
      { timeout: 60000 },
    )
    if (!response.ok) {
      const problem = getGeneralApiProblem(response)
      if (problem) return problem
    }
    return { kind: "ok", data: response.data! }
  }

  async voiceOnboardingUpload(
    userId: string,
    audioUri: string,
  ): Promise<{ kind: "ok"; data: VoiceOnboardingResponse } | GeneralApiProblem> {
    // Use FormData for multipart audio upload
    const formData = new FormData()
    formData.append("user_id", userId)
    formData.append("audio", {
      uri: audioUri,
      type: "audio/m4a",
      name: "recording.m4a",
    } as unknown as Blob)

    const response: ApiResponse<VoiceOnboardingResponse> = await this.apisauce.post(
      "/api/onboarding/voice/upload",
      formData,
      {
        timeout: 60000,
        headers: { "Content-Type": "multipart/form-data" },
      },
    )
    if (!response.ok) {
      const problem = getGeneralApiProblem(response)
      if (problem) return problem
    }
    return { kind: "ok", data: response.data! }
  }

  async voiceOnboardingReset(
    userId: string,
  ): Promise<{ kind: "ok" } | GeneralApiProblem> {
    const response = await this.apisauce.post(
      `/api/onboarding/voice/reset?user_id=${userId}`,
    )
    if (!response.ok) {
      const problem = getGeneralApiProblem(response)
      if (problem) return problem
    }
    return { kind: "ok" }
  }

  // -----------------------------------------------------------------------
  // Portfolio
  // -----------------------------------------------------------------------

  async importPortfolio(
    req: PortfolioImportRequest,
  ): Promise<{ kind: "ok"; portfolio: PortfolioResponse } | GeneralApiProblem> {
    const response: ApiResponse<PortfolioResponse> = await this.apisauce.post(
      "/api/portfolio/import",
      req,
    )
    if (!response.ok) {
      const problem = getGeneralApiProblem(response)
      if (problem) return problem
    }
    return { kind: "ok", portfolio: response.data! }
  }

  async getPortfolio(
    userId: string,
  ): Promise<{ kind: "ok"; portfolio: PortfolioResponse } | GeneralApiProblem> {
    const response: ApiResponse<PortfolioResponse> = await this.apisauce.get(
      `/api/user/${userId}/portfolio`,
    )
    if (!response.ok) {
      const problem = getGeneralApiProblem(response)
      if (problem) return problem
    }
    return { kind: "ok", portfolio: response.data! }
  }

  async getMarketData(
    tickers: string[],
  ): Promise<{ kind: "ok"; quotes: MarketDataQuote[] } | GeneralApiProblem> {
    const query = new URLSearchParams({
      tickers: tickers.join(","),
    })
    const response: ApiResponse<MarketDataQuote[]> = await this.apisauce.get(
      `/api/market-data?${query.toString()}`,
    )
    if (!response.ok) {
      const problem = getGeneralApiProblem(response)
      if (problem) return problem
    }
    return { kind: "ok", quotes: response.data ?? [] }
  }

  async getMarketDataHistoryBatch(
    tickers: string[],
    period = "1mo",
    interval = "1d",
  ): Promise<{ kind: "ok"; history: MarketHistoryBatchResponse } | GeneralApiProblem> {
    const query = new URLSearchParams({
      tickers: tickers.join(","),
      period,
      interval,
    })
    const response: ApiResponse<MarketHistoryBatchResponse> = await this.apisauce.get(
      `/api/market-data/history/batch?${query.toString()}`,
    )
    if (!response.ok) {
      const problem = getGeneralApiProblem(response)
      if (problem) return problem
    }
    return {
      kind: "ok",
      history: response.data ?? { period, interval, results: {} },
    }
  }

  // -----------------------------------------------------------------------
  // Intake (conversational goal extraction)
  // -----------------------------------------------------------------------

  async intake(
    req: IntakeRequest,
  ): Promise<{ kind: "ok"; data: IntakeResponse } | GeneralApiProblem> {
    const response: ApiResponse<IntakeResponse> = await this.apisauce.post("/api/intake", req, {
      timeout: 60000,
    })
    if (!response.ok) {
      const problem = getGeneralApiProblem(response)
      if (problem) return problem
    }
    return { kind: "ok", data: response.data! }
  }

  async intakeReset(userId: string): Promise<{ kind: "ok" } | GeneralApiProblem> {
    const response = await this.apisauce.post(`/api/intake/reset?user_id=${userId}`)
    if (!response.ok) {
      const problem = getGeneralApiProblem(response)
      if (problem) return problem
    }
    return { kind: "ok" }
  }

  // -----------------------------------------------------------------------
  // Report generation
  // -----------------------------------------------------------------------

  async generateReport(
    req: ReportGenerateRequest,
  ): Promise<{ kind: "ok"; report: ReportResponse } | GeneralApiProblem> {
    // Pipeline can take 30-60s
    const response: ApiResponse<ReportResponse> = await this.apisauce.post(
      "/api/report/generate",
      req,
      { timeout: 120000 },
    )
    if (!response.ok) {
      const problem = getGeneralApiProblem(response)
      if (problem) return problem
    }
    return { kind: "ok", report: response.data! }
  }

  async regenerateReport(
    req: ReportRegenerateRequest,
  ): Promise<{ kind: "ok"; report: ReportResponse } | GeneralApiProblem> {
    const response: ApiResponse<ReportResponse> = await this.apisauce.post(
      "/api/report/regenerate",
      req,
      { timeout: 120000 },
    )
    if (!response.ok) {
      const problem = getGeneralApiProblem(response)
      if (problem) return problem
    }
    return { kind: "ok", report: response.data! }
  }

  async getReports(
    userId: string,
  ): Promise<{ kind: "ok"; reports: ReportListItem[] } | GeneralApiProblem> {
    const response: ApiResponse<ReportListItem[]> = await this.apisauce.get(
      `/api/user/${userId}/reports`,
    )
    if (!response.ok) {
      const problem = getGeneralApiProblem(response)
      if (problem) return problem
    }
    return { kind: "ok", reports: response.data ?? [] }
  }

  async getReport(
    userId: string,
    reportId: string,
  ): Promise<{ kind: "ok"; report: ReportResponse } | GeneralApiProblem> {
    const response: ApiResponse<ReportResponse> = await this.apisauce.get(
      `/api/report/${reportId}?user_id=${encodeURIComponent(userId)}`,
    )
    if (!response.ok) {
      const problem = getGeneralApiProblem(response)
      if (problem) return problem
    }
    return { kind: "ok", report: response.data! }
  }

  async getPanelHistory(
    userId: string,
    reportId: string,
  ): Promise<{ kind: "ok"; messages: PanelHistoryMessage[] } | GeneralApiProblem> {
    const response: ApiResponse<PanelHistoryMessage[]> = await this.apisauce.get(
      `/api/report/${reportId}/panel-history?user_id=${encodeURIComponent(userId)}`,
    )
    if (!response.ok) {
      const problem = getGeneralApiProblem(response)
      if (problem) return problem
    }
    return { kind: "ok", messages: response.data ?? [] }
  }

  // -----------------------------------------------------------------------
  // Panel discussion (chat with team)
  // -----------------------------------------------------------------------

  async panelChat(
    req: PanelChatRequest,
  ): Promise<{ kind: "ok"; data: PanelChatResponse } | GeneralApiProblem> {
    const response: ApiResponse<PanelChatResponse> = await this.apisauce.post(
      "/api/report/chat",
      req,
      { timeout: 60000 },
    )
    if (!response.ok) {
      const problem = getGeneralApiProblem(response)
      if (problem) return problem
    }
    return { kind: "ok", data: response.data! }
  }

  async panelChatStream(
    req: PanelChatRequest,
    onEvent: (event: PanelChatStreamEvent) => void,
  ): Promise<{ kind: "ok" } | GeneralApiProblem> {
    try {
      const url = `${this.config.url}/api/report/chat/stream`
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Accept": "text/event-stream",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(req),
      })

      if (!response.ok) {
        return { kind: "bad-data" }
      }

      // Fallback for environments without ReadableStream support.
      if (!response.body) {
        const fallback = await this.panelChat(req)
        if (fallback.kind !== "ok") return fallback
        onEvent({ type: "started" })
        for (const message of fallback.data.agent_responses) {
          onEvent({ type: "agent_message_start", message })
          onEvent({ type: "agent_message_delta", message, delta: message.response })
          onEvent({ type: "agent_message_done", message })
        }
        onEvent({
          type: "memory_updates",
          memory_updates: fallback.data.memory_updates,
        })
        onEvent({ type: "done" })
        return { kind: "ok" }
      }

      const decoder = new TextDecoder()
      const reader = response.body.getReader()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const raw of lines) {
          const line = raw.trim()
          if (!line.startsWith("data:")) continue
          const payload = line.slice(5).trim()
          if (!payload || payload === "[DONE]") continue
          try {
            const event = JSON.parse(payload) as PanelChatStreamEvent
            onEvent(event)
          } catch {
            // Ignore malformed SSE payloads from the network.
          }
        }
      }

      return { kind: "ok" }
    } catch {
      return { kind: "cannot-connect", temporary: true }
    }
  }

  // -----------------------------------------------------------------------
  // General chat
  // -----------------------------------------------------------------------

  async chat(req: ChatRequest): Promise<{ kind: "ok"; data: ChatResponse } | GeneralApiProblem> {
    const response: ApiResponse<ChatResponse> = await this.apisauce.post("/api/chat", req, {
      timeout: 120000,
    })
    if (!response.ok) {
      const problem = getGeneralApiProblem(response)
      if (problem) return problem
    }
    return { kind: "ok", data: response.data! }
  }
}

// Singleton instance
export const api = new Api()
