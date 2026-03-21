/**
 * Finly API client — wraps apisauce for all backend calls.
 */
import { ApiResponse, ApisauceInstance, create } from "apisauce"

import Config from "@/config"
import { GeneralApiProblem, getGeneralApiProblem } from "./apiProblem"
import type {
  ApiConfig,
  ApiFeedResponse,
  ChatRequest,
  ChatResponse,
  EpisodeItem,
  IntakeRequest,
  IntakeResponse,
  OnboardingRequest,
  OnboardingResponse,
  PanelChatRequest,
  PanelChatResponse,
  PortfolioImportRequest,
  PortfolioResponse,
  ReportGenerateRequest,
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

  async chat(
    req: ChatRequest,
  ): Promise<{ kind: "ok"; data: ChatResponse } | GeneralApiProblem> {
    const response: ApiResponse<ChatResponse> = await this.apisauce.post("/api/chat", req, {
      timeout: 120000,
    })
    if (!response.ok) {
      const problem = getGeneralApiProblem(response)
      if (problem) return problem
    }
    return { kind: "ok", data: response.data! }
  }

  // -----------------------------------------------------------------------
  // Legacy demo method (kept for existing screens)
  // -----------------------------------------------------------------------

  async getEpisodes(): Promise<{ kind: "ok"; episodes: EpisodeItem[] } | GeneralApiProblem> {
    const response: ApiResponse<ApiFeedResponse> = await this.apisauce.get(
      `api.json?rss_url=https%3A%2F%2Ffeeds.simplecast.com%2FhEI_f9Dx`,
    )
    if (!response.ok) {
      const problem = getGeneralApiProblem(response)
      if (problem) return problem
    }
    try {
      const episodes: EpisodeItem[] = response.data?.items.map((raw) => ({ ...raw })) ?? []
      return { kind: "ok", episodes }
    } catch (e) {
      if (__DEV__ && e instanceof Error) {
        console.error(`Bad data: ${e.message}\n${response.data}`, e.stack)
      }
      return { kind: "bad-data" }
    }
  }
}

// Singleton instance
export const api = new Api()
