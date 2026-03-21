/**
 * Finly API types — mirrors the Pydantic models from the backend.
 */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface ApiConfig {
  url: string
  timeout: number
}

// ---------------------------------------------------------------------------
// User / Onboarding
// ---------------------------------------------------------------------------

export interface UserProfile {
  user_id: string
  risk_score: number
  horizon: "short" | "medium" | "long"
  knowledge: number
  goals_brief: string
  created_at: string | null
  updated_at: string | null
}

export interface OnboardingRequest {
  user_id: string
  risk_score: number
  horizon: "short" | "medium" | "long"
  knowledge: number
}

export interface OnboardingResponse {
  profile: UserProfile
  welcome_message: string
  audio_b64: string | null
}

// ---------------------------------------------------------------------------
// Portfolio
// ---------------------------------------------------------------------------

export interface PortfolioItem {
  asset_type: "stock" | "crypto"
  ticker: string
  quantity: number
  avg_cost: number
  wallet_address?: string
}

export interface PortfolioImportRequest {
  user_id: string
  mode: "manual" | "mock" | "csv"
  items?: PortfolioItem[]
  csv_data?: string
}

export interface PortfolioResponse {
  user_id: string
  items: Record<string, unknown>[]
}

// ---------------------------------------------------------------------------
// Intake (conversational goal extraction)
// ---------------------------------------------------------------------------

export interface IntakeRequest {
  user_id: string
  message: string
}

export interface IntakeResponse {
  user_id: string
  message: string
  is_complete: boolean
  follow_up_count: number
  goals_brief: string | null
  audio_b64?: string | null
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export interface ReportGenerateRequest {
  user_id: string
  ticker?: string
  portfolio?: Record<string, unknown>[]
}

export interface TickerSuggestion {
  ticker: string
  reason: string
}

export interface SpecialistInsightReport {
  role: string
  summary: string
  full_analysis: string
}

export interface ReportResponse {
  report_id: string
  user_id: string
  ticker: string
  decision: string
  summary: string
  full_report: string
  agent_reasoning: Record<string, unknown>
  specialist_insights: SpecialistInsightReport[]
  additional_tickers: TickerSuggestion[]
  intake_brief: string
}

// ---------------------------------------------------------------------------
// Panel discussion (chat with team)
// ---------------------------------------------------------------------------

export interface PanelChatRequest {
  user_id: string
  message: string
  report_id?: string
}

export interface AgentPanelMessage {
  agent_role: string
  agent_name: string
  response: string
}

export interface PanelChatResponse {
  user_id: string
  question: string
  agent_responses: AgentPanelMessage[]
  memory_updates: string[]
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export interface ChatRequest {
  user_id: string
  message: string
  ticker?: string
}

export interface SpecialistInsight {
  role: string
  summary: string
  full_analysis: string
}

export interface ChatResponse {
  ticker: string
  decision: string
  summary: string
  specialist_insights: SpecialistInsight[]
  full_report: string
}

// ---------------------------------------------------------------------------
// Heartbeat
// ---------------------------------------------------------------------------

export interface HeartbeatAlert {
  alert_id: string
  timestamp: string
  ticker: string
  alert_type: string
  headline: string
  body: string
  attributed_to: string
  severity: string
}

// ---------------------------------------------------------------------------
// Legacy (kept for demo screens)
// ---------------------------------------------------------------------------

export interface EpisodeItem {
  title: string
  pubDate: string
  link: string
  guid: string
  author: string
  thumbnail: string
  description: string
  content: string
  enclosure: {
    link: string
    type: string
    length: number
    duration: number
    rating: { scheme: string; value: string }
  }
  categories: string[]
}

export interface ApiFeedResponse {
  status: string
  feed: {
    url: string
    title: string
    link: string
    author: string
    description: string
    image: string
  }
  items: EpisodeItem[]
}
