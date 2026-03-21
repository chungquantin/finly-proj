"""Pydantic models for Finly API."""

from __future__ import annotations

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# User / Onboarding
# ---------------------------------------------------------------------------


class UserProfile(BaseModel):
    user_id: str
    risk_score: int = Field(default=50, ge=0, le=100)
    horizon: str = Field(default="medium", pattern="^(short|medium|long)$")
    knowledge: int = Field(default=1, ge=1, le=3)
    goals_brief: str = ""
    created_at: str | None = None
    updated_at: str | None = None


class OnboardingRequest(BaseModel):
    user_id: str
    risk_score: int = Field(default=50, ge=0, le=100)
    horizon: str = Field(default="medium", pattern="^(short|medium|long)$")
    knowledge: int = Field(default=1, ge=1, le=3)


class OnboardingResponse(BaseModel):
    profile: UserProfile
    welcome_message: str = ""
    audio_b64: str | None = None  # base64-encoded TTS audio (mp3)


# ---------------------------------------------------------------------------
# Portfolio
# ---------------------------------------------------------------------------


class PortfolioItem(BaseModel):
    asset_type: str = "stock"  # stock | crypto
    ticker: str
    quantity: float = 0
    avg_cost: float = 0
    wallet_address: str | None = None


class PortfolioImportRequest(BaseModel):
    user_id: str
    mode: str = "manual"  # manual | mock | csv
    items: list[PortfolioItem] = []
    csv_data: str | None = None  # raw CSV string for csv mode


class PortfolioResponse(BaseModel):
    user_id: str
    items: list[dict]


# ---------------------------------------------------------------------------
# Intake (conversational goal extraction)
# ---------------------------------------------------------------------------


class IntakeRequest(BaseModel):
    user_id: str
    message: str


class IntakeResponse(BaseModel):
    user_id: str
    message: str  # assistant reply (question or final brief)
    is_complete: bool = False  # true when intake is done
    follow_up_count: int = 0  # how many follow-ups so far
    goals_brief: str | None = None  # populated when is_complete=True
    audio_b64: str | None = None  # base64-encoded TTS audio (mp3), if available


# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------


class ChatRequest(BaseModel):
    user_id: str = "anonymous"
    message: str
    ticker: str | None = None
    stream: bool = False


class SpecialistInsight(BaseModel):
    role: str  # trader, analyst, researcher, advisor
    summary: str
    full_analysis: str = ""  # full reasoning from this agent


class ChatResponse(BaseModel):
    ticker: str
    decision: str  # BUY/HOLD/SELL
    summary: str
    specialist_insights: list[SpecialistInsight]
    full_report: str


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------


class ReportGenerateRequest(BaseModel):
    user_id: str
    ticker: str | None = None  # if None, inferred from intake brief or default
    portfolio: list[dict] | None = None  # optional — passed from mobile native storage


class TickerSuggestion(BaseModel):
    ticker: str
    reason: str = ""


class ReportResponse(BaseModel):
    report_id: str
    user_id: str
    ticker: str
    decision: str
    summary: str
    full_report: str
    agent_reasoning: dict  # per-agent detailed reasoning
    specialist_insights: list[
        SpecialistInsight
    ] = []  # per-agent summary + full analysis
    additional_tickers: list[TickerSuggestion] = []  # other recommended tickers
    intake_brief: str = ""


class TickerReportListItem(BaseModel):
    report_id: str
    user_id: str
    ticker: str
    decision: str
    summary: str
    intake_brief: str = ""
    created_at: str
    relation_type: str = "primary"
    relation_reason: str = ""


# ---------------------------------------------------------------------------
# Panel discussion (chat with team)
# ---------------------------------------------------------------------------


class PanelChatRequest(BaseModel):
    user_id: str
    message: str
    report_id: str | None = None  # references a specific report
    target_agents: list[str] | None = None  # e.g. ["advisor"], ["trader"]; None = advisor only


class AgentPanelMessage(BaseModel):
    agent_role: str
    agent_name: str
    response: str


class PanelChatResponse(BaseModel):
    user_id: str
    question: str
    agent_responses: list[AgentPanelMessage]
    memory_updates: list[str] = []  # any preferences extracted from the question


# ---------------------------------------------------------------------------
# Report regeneration
# ---------------------------------------------------------------------------


class ReportRegenerateRequest(BaseModel):
    user_id: str
    report_id: str | None = None  # regenerate from latest if None


# ---------------------------------------------------------------------------
# Heartbeat (unchanged)
# ---------------------------------------------------------------------------


class HeartbeatAlert(BaseModel):
    alert_id: str
    timestamp: str
    ticker: str
    alert_type: str
    headline: str
    body: str
    attributed_to: str
    severity: str


class MarketTicker(BaseModel):
    ticker: str
    price: float
    change_pct: float
    currency: str


# ---------------------------------------------------------------------------
# Ticker news
# ---------------------------------------------------------------------------


class TickerNewsItem(BaseModel):
    title: str
    url: str
    published_at: str = ""
    summary: str = ""
    source: str = ""


class TickerNewsResponse(BaseModel):
    ticker: str
    source: str
    items: list[TickerNewsItem] = []


# ---------------------------------------------------------------------------
# Voice onboarding
# ---------------------------------------------------------------------------


class VoiceOnboardingProfile(BaseModel):
    name: str | None = None
    risk: str | None = None  # beginner | intermediate | expert
    horizon: str | None = None  # short | medium | long
    knowledge: str | None = None  # novice | savvy | pro


class VoiceOnboardingRequest(BaseModel):
    user_id: str
    message: str | None = None  # text message (if using text fallback)
    audio_b64: str | None = None  # base64-encoded audio (for STT)
    audio_content_type: str = "audio/m4a"  # mime type of the audio
    is_initial: bool = False  # true to get the greeting without user input


class VoiceOnboardingResponse(BaseModel):
    user_id: str
    message: str
    audio_b64: str | None = None  # TTS response audio
    is_complete: bool = False
    turn_count: int = 0
    profile: VoiceOnboardingProfile | None = None
    transcript: str | None = None  # transcribed text from audio input
