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
  OnboardingRequest,
  OnboardingResponse,
  PanelHistoryMessage,
  PanelChatRequest,
  PanelChatResponse,
  PortfolioImportRequest,
  PortfolioResponse,
  ReportListItem,
  ReportGenerateRequest,
  ReportRegenerateRequest,
  ReportResponse,
  UserProfile,
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
