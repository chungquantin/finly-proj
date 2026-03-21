/* eslint-disable no-restricted-imports */
import { useCallback, useRef, useState } from "react"
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  ViewStyle,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { api } from "../services/api"
import type {
  AgentPanelMessage,
  IntakeResponse,
  ReportResponse,
  SpecialistInsightReport,
  TickerSuggestion,
} from "../services/api/types"
import { useOnboardingStore } from "../stores/onboardingStore"
import { buildMockPortfolio } from "../utils/mockPortfolio"
import { playBase64Audio, stopAudio } from "../utils/playAudio"

const USER_ID = "user_mvp_1"

const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value)

const compactMoney = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  text: string
  audioB64?: string | null
}

type PanelMessage = {
  id: string
  role: "user" | "panel"
  text: string
  agents?: AgentPanelMessage[]
}

type Tab = "intake" | "report" | "team"

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DashboardScreen() {
  const riskExpertise = useOnboardingStore((s) => s.riskExpertise)
  const investmentHorizon = useOnboardingStore((s) => s.investmentHorizon)
  const financialKnowledge = useOnboardingStore((s) => s.financialKnowledge)
  const portfolioType = useOnboardingStore((s) => s.portfolioType)
  const walletAddress = useOnboardingStore((s) => s.walletAddress)
  const stockImportMethod = useOnboardingStore((s) => s.stockImportMethod)

  const portfolio = buildMockPortfolio({
    riskExpertise,
    investmentHorizon,
    financialKnowledge,
    portfolioType,
    walletAddress,
    stockImportMethod,
  })

  const [tab, setTab] = useState<Tab>("intake")

  // Intake state
  const [intakeMessages, setIntakeMessages] = useState<ChatMessage[]>([])
  const [intakeInput, setIntakeInput] = useState("")
  const [intakeLoading, setIntakeLoading] = useState(false)
  const [intakeComplete, setIntakeComplete] = useState(false)

  // Report state
  const [report, setReport] = useState<ReportResponse | null>(null)
  const [reportLoading, setReportLoading] = useState(false)

  // Panel state
  const [panelMessages, setPanelMessages] = useState<PanelMessage[]>([])
  const [panelInput, setPanelInput] = useState("")
  const [panelLoading, setPanelLoading] = useState(false)

  const msgIdRef = useRef(0)
  const nextId = () => String(++msgIdRef.current)

  // -----------------------------------------------------------------------
  // Intake chat
  // -----------------------------------------------------------------------

  const sendIntake = useCallback(async () => {
    const text = intakeInput.trim()
    if (!text || intakeLoading) return

    setIntakeInput("")
    const userMsg: ChatMessage = { id: nextId(), role: "user", text }
    setIntakeMessages((prev) => [...prev, userMsg])
    setIntakeLoading(true)

    try {
      const result = await api.intake({ user_id: USER_ID, message: text })
      if (__DEV__) console.log("Intake result:", JSON.stringify(result, null, 2))
      if (result.kind === "ok") {
        const d = result.data
        const assistantMsg: ChatMessage = {
          id: nextId(),
          role: "assistant",
          text: d.message,
          audioB64: d.audio_b64,
        }
        setIntakeMessages((prev) => [...prev, assistantMsg])

        if (d.audio_b64) {
          playBase64Audio(d.audio_b64).catch(() => {})
        }

        if (d.is_complete) {
          setIntakeComplete(true)
        }
      } else {
        // Show error as a message so user can see what went wrong
        const errMsg: ChatMessage = {
          id: nextId(),
          role: "assistant",
          text: `[Error: ${result.kind}] Could not reach the server. Check that the backend is running.`,
        }
        setIntakeMessages((prev) => [...prev, errMsg])
      }
    } catch (e) {
      const errMsg: ChatMessage = {
        id: nextId(),
        role: "assistant",
        text: `[Error] ${e instanceof Error ? e.message : String(e)}`,
      }
      setIntakeMessages((prev) => [...prev, errMsg])
      if (__DEV__) console.error("Intake error:", e)
    } finally {
      setIntakeLoading(false)
    }
  }, [intakeInput, intakeLoading])

  // -----------------------------------------------------------------------
  // Report generation
  // -----------------------------------------------------------------------

  const [reportError, setReportError] = useState<string | null>(null)

  const generateReport = useCallback(async () => {
    if (reportLoading) return
    setReportLoading(true)
    setReportError(null)

    try {
      const result = await api.generateReport({
        user_id: USER_ID,
        portfolio: portfolio.members.map((m) => ({
          asset_type: "stock",
          ticker: m.role,
          quantity: 100,
          avg_cost: 50000,
        })),
      })
      if (__DEV__) console.log("Report result:", JSON.stringify(result).slice(0, 500))
      if (result.kind === "ok") {
        setReport(result.report)
        setTab("report")
      } else {
        setReportError(`Report failed: ${result.kind}`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setReportError(`Report error: ${msg}`)
      if (__DEV__) console.error("Report generation error:", e)
    } finally {
      setReportLoading(false)
    }
  }, [reportLoading, portfolio])

  // -----------------------------------------------------------------------
  // Panel chat
  // -----------------------------------------------------------------------

  const sendPanelChat = useCallback(async () => {
    const text = panelInput.trim()
    if (!text || panelLoading) return

    setPanelInput("")
    const userMsg: PanelMessage = { id: nextId(), role: "user", text }
    setPanelMessages((prev) => [...prev, userMsg])
    setPanelLoading(true)

    try {
      const result = await api.panelChat({
        user_id: USER_ID,
        message: text,
        report_id: report?.report_id,
      })
      if (result.kind === "ok") {
        const panelMsg: PanelMessage = {
          id: nextId(),
          role: "panel",
          text: "",
          agents: result.data.agent_responses,
        }
        setPanelMessages((prev) => [...prev, panelMsg])
      }
    } catch (e) {
      if (__DEV__) console.error("Panel chat error:", e)
    } finally {
      setPanelLoading(false)
    }
  }, [panelInput, panelLoading, report])

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerStyle={$scrollContentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Portfolio header */}
          <View className="rounded-xl3 bg-card px-5 pb-5 pt-4 shadow-card">
            <Text className="text-center text-[28px] font-semi text-ink">Dashboard</Text>
            <View className="mt-4 flex-row gap-3">
              <View className="flex-1 rounded-xl2 border border-border bg-[#F8F6FF] p-3">
                <Text className="text-[13px] text-muted">Total Value</Text>
                <Text className="mt-1 text-[24px] font-semi text-ink">
                  {compactMoney(portfolio.totalBalance)}
                </Text>
              </View>
              <View className="flex-1 rounded-xl2 border border-border bg-[#F4F9FF] p-3">
                <Text className="text-[13px] text-muted">Today</Text>
                <Text className="mt-1 text-[24px] font-semi text-[#16A34A]">
                  +{money(portfolio.todayGain)}
                </Text>
              </View>
            </View>
          </View>

          {/* Tab bar */}
          <View className="mt-4 flex-row gap-2 px-1">
            {(["intake", "report", "team"] as Tab[]).map((t) => (
              <Pressable
                key={t}
                onPress={() => {
                  stopAudio()
                  setTab(t)
                }}
                className={`flex-1 items-center rounded-full py-3 ${
                  tab === t ? "bg-[#08153A]" : "bg-card border border-border"
                }`}
              >
                <Text
                  className={`text-[14px] font-semi capitalize ${
                    tab === t ? "text-white" : "text-muted"
                  }`}
                >
                  {t === "intake" ? "Goals" : t === "report" ? "Report" : "AI Team"}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Tab content */}
          <View className="mt-4 rounded-xl3 bg-card px-4 pb-5 pt-4 shadow-card">
            {tab === "intake" && (
              <IntakeTab
                messages={intakeMessages}
                input={intakeInput}
                setInput={setIntakeInput}
                onSend={sendIntake}
                loading={intakeLoading}
                complete={intakeComplete}
                onGenerateReport={generateReport}
                reportLoading={reportLoading}
                reportError={reportError}
              />
            )}
            {tab === "report" && <ReportTab report={report} loading={reportLoading} />}
            {tab === "team" && (
              <PanelTab
                messages={panelMessages}
                input={panelInput}
                setInput={setPanelInput}
                onSend={sendPanelChat}
                loading={panelLoading}
                hasReport={!!report}
              />
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Intake Tab
// ---------------------------------------------------------------------------

function IntakeTab({
  messages,
  input,
  setInput,
  onSend,
  loading,
  complete,
  onGenerateReport,
  reportLoading,
}: {
  messages: ChatMessage[]
  input: string
  setInput: (v: string) => void
  onSend: () => void
  loading: boolean
  complete: boolean
  onGenerateReport: () => void
  reportLoading: boolean
  reportError: string | null
}) {
  return (
    <View>
      <Text className="text-[20px] font-semi text-ink">Investment Goals</Text>
      <Text className="mt-1 text-[14px] text-muted">
        {complete
          ? "Goals captured! Generate your report."
          : "Tell me about your investment interests."}
      </Text>

      {messages.length > 0 && (
        <View className="mt-4 max-h-[300px]">
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
            {messages.map((msg) => (
              <View
                key={msg.id}
                className={`mb-3 rounded-xl2 p-3 ${
                  msg.role === "user"
                    ? "ml-8 bg-[#08153A]"
                    : "mr-8 border border-border bg-[#F8FAFF]"
                }`}
              >
                <Text
                  className={`text-[14px] leading-5 ${
                    msg.role === "user" ? "text-white" : "text-ink"
                  }`}
                >
                  {msg.text}
                </Text>
                {msg.role === "assistant" && msg.audioB64 && (
                  <Pressable
                    className="mt-2 self-start rounded-full bg-lilac/20 px-3 py-1"
                    onPress={() => playBase64Audio(msg.audioB64!)}
                  >
                    <Text className="text-xs font-semi text-lilac">Replay</Text>
                  </Pressable>
                )}
              </View>
            ))}
            {loading && (
              <View className="mb-3 mr-8 items-center rounded-xl2 border border-border bg-[#F8FAFF] p-3">
                <ActivityIndicator size="small" />
              </View>
            )}
          </ScrollView>
        </View>
      )}

      {!complete && (
        <View className="mt-4 flex-row items-center gap-2">
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="e.g. I'm interested in Vietnamese tech..."
            placeholderTextColor="#9CA3AF"
            onSubmitEditing={onSend}
            returnKeyType="send"
            className="flex-1 rounded-xl2 border border-border bg-card px-4 py-3 text-[14px] text-ink"
          />
          <Pressable
            className="h-12 w-12 items-center justify-center rounded-full bg-[#08153A]"
            onPress={onSend}
            disabled={loading}
          >
            <Text className="text-lg text-white">{loading ? "..." : ">"}</Text>
          </Pressable>
        </View>
      )}

      {reportError && (
        <View className="mt-3 rounded-xl2 border border-[#FCA5A5] bg-[#FEF2F2] p-3">
          <Text className="text-[13px] text-[#DC2626]">{reportError}</Text>
        </View>
      )}

      {complete && (
        <Pressable
          className="mt-4 h-14 items-center justify-center rounded-full bg-lilac"
          onPress={onGenerateReport}
          disabled={reportLoading}
        >
          {reportLoading ? (
            <View className="flex-row items-center gap-2">
              <ActivityIndicator color="white" size="small" />
              <Text className="text-[16px] font-semi text-white">Generating report...</Text>
            </View>
          ) : (
            <Text className="text-[16px] font-semi text-white">Generate Investment Report</Text>
          )}
        </Pressable>
      )}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Report Tab
// ---------------------------------------------------------------------------

const AGENT_META: Record<string, { label: string; color: string; icon: string }> = {
  analyst: { label: "Analyst", color: "#7C3AED", icon: "📊" },
  researcher: { label: "Researcher", color: "#2563EB", icon: "🔍" },
  trader: { label: "Trader", color: "#DC2626", icon: "📈" },
  advisor: { label: "Advisor", color: "#16A34A", icon: "🧠" },
}

function InsightCard({ insight }: { insight: SpecialistInsightReport }) {
  const [expanded, setExpanded] = useState(false)
  const meta = AGENT_META[insight.role] ?? { label: insight.role, color: "#666", icon: "💬" }

  return (
    <Pressable
      className="mb-3 rounded-2xl border border-border bg-white p-4"
      onPress={() => setExpanded((v) => !v)}
      style={{ borderLeftWidth: 3, borderLeftColor: meta.color }}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Text className="text-[16px]">{meta.icon}</Text>
          <Text className="text-[15px] font-semi" style={{ color: meta.color }}>
            {meta.label}
          </Text>
        </View>
        <Text className="text-[12px] text-muted">{expanded ? "Hide" : "Details"}</Text>
      </View>
      <Text className="mt-2 text-[14px] leading-[22px] text-ink" numberOfLines={expanded ? undefined : 3}>
        {insight.summary}
      </Text>
      {expanded && insight.full_analysis && insight.full_analysis !== insight.summary && (
        <View className="mt-3 rounded-xl border border-border/50 bg-[#F8FAFF] p-3">
          <Text className="text-[13px] leading-5 text-muted">{insight.full_analysis}</Text>
        </View>
      )}
    </Pressable>
  )
}

function TickerCard({ ticker }: { ticker: TickerSuggestion }) {
  return (
    <View className="mr-3 w-[140px] rounded-2xl border border-border bg-white p-3">
      <Text className="text-[18px] font-semi text-ink">{ticker.ticker}</Text>
      <Text className="mt-1 text-[12px] leading-4 text-muted" numberOfLines={3}>
        {ticker.reason}
      </Text>
    </View>
  )
}

function DecisionBadge({ decision }: { decision: string }) {
  const config =
    decision === "BUY"
      ? { bg: "#DCFCE7", text: "#16A34A", label: "Buy" }
      : decision === "SELL"
        ? { bg: "#FEE2E2", text: "#DC2626", label: "Sell" }
        : { bg: "#FEF9C3", text: "#CA8A04", label: "Hold" }

  return (
    <View className="rounded-full px-4 py-1.5" style={{ backgroundColor: config.bg }}>
      <Text className="text-[14px] font-semi" style={{ color: config.text }}>
        {config.label}
      </Text>
    </View>
  )
}

function ReportTab({
  report,
  loading,
}: {
  report: ReportResponse | null
  loading: boolean
}) {
  const [showFullReport, setShowFullReport] = useState(false)

  if (loading) {
    return (
      <View className="items-center py-12">
        <ActivityIndicator size="large" />
        <Text className="mt-4 text-center text-[16px] text-muted">
          Your investment team is researching...{"\n"}This may take 30-60 seconds.
        </Text>
      </View>
    )
  }

  if (!report) {
    return (
      <View className="items-center py-12">
        <Text className="text-[48px]">📊</Text>
        <Text className="mt-4 text-center text-[16px] text-muted">
          Complete the goals intake first,{"\n"}then generate a report.
        </Text>
      </View>
    )
  }

  const insights = report.specialist_insights ?? []
  const extras = report.additional_tickers ?? []

  return (
    <View>
      {/* Hero: Primary ticker + decision */}
      <View className="items-center rounded-2xl bg-[#08153A] px-5 py-6">
        <Text className="text-[13px] font-semi tracking-[1.5px] text-white/60">
          PRIMARY RECOMMENDATION
        </Text>
        <Text className="mt-2 text-[32px] font-semi text-white">{report.ticker}</Text>
        <View className="mt-3">
          <DecisionBadge decision={report.decision} />
        </View>
      </View>

      {/* Summary */}
      <View className="mt-4 rounded-2xl border border-border bg-white p-4">
        <Text className="text-[13px] font-semi tracking-[1px] text-muted">SUMMARY</Text>
        <Text className="mt-2 text-[15px] leading-[24px] text-ink">{report.summary}</Text>
      </View>

      {/* Agent Insights */}
      {insights.length > 0 && (
        <View className="mt-5">
          <Text className="mb-3 text-[13px] font-semi tracking-[1px] text-muted">
            TEAM ANALYSIS
          </Text>
          {insights.map((ins) => (
            <InsightCard key={ins.role} insight={ins} />
          ))}
        </View>
      )}

      {/* Additional Ticker Suggestions */}
      {extras.length > 0 && (
        <View className="mt-5">
          <Text className="mb-3 text-[13px] font-semi tracking-[1px] text-muted">
            ALSO WORTH EXPLORING
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {extras.map((t) => (
              <TickerCard key={t.ticker} ticker={t} />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Goals */}
      {report.intake_brief ? (
        <View className="mt-5 rounded-2xl border border-border bg-[#F8FAFF] p-4">
          <Text className="text-[13px] font-semi tracking-[1px] text-muted">YOUR GOALS</Text>
          <Text className="mt-2 text-[14px] leading-[22px] text-ink">{report.intake_brief}</Text>
        </View>
      ) : null}

      {/* Full Report (collapsible) */}
      <Pressable
        className="mt-5 rounded-2xl border border-border bg-white p-4"
        onPress={() => setShowFullReport((v) => !v)}
      >
        <View className="flex-row items-center justify-between">
          <Text className="text-[13px] font-semi tracking-[1px] text-muted">FULL REPORT</Text>
          <Text className="text-[12px] text-lilac">{showFullReport ? "Collapse" : "Expand"}</Text>
        </View>
        {showFullReport ? (
          <Text className="mt-3 text-[13px] leading-5 text-muted">{report.full_report}</Text>
        ) : (
          <Text className="mt-2 text-[13px] leading-5 text-muted" numberOfLines={4}>
            {report.full_report}
          </Text>
        )}
      </Pressable>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Panel Chat Tab (AI Team)
// ---------------------------------------------------------------------------

function PanelTab({
  messages,
  input,
  setInput,
  onSend,
  loading,
  hasReport,
}: {
  messages: PanelMessage[]
  input: string
  setInput: (v: string) => void
  onSend: () => void
  loading: boolean
  hasReport: boolean
}) {
  return (
    <View>
      <Text className="text-[20px] font-semi text-ink">AI Team</Text>
      <Text className="mt-1 text-[14px] text-muted">
        {hasReport
          ? "Ask your investment team anything about the report."
          : "Generate a report first to chat with the team."}
      </Text>

      {messages.length > 0 && (
        <View className="mt-4 max-h-[500px]">
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
            {messages.map((msg) =>
              msg.role === "user" ? (
                <View key={msg.id} className="mb-4 ml-12 rounded-2xl bg-[#08153A] px-4 py-3">
                  <Text className="text-[14px] leading-5 text-white">{msg.text}</Text>
                </View>
              ) : (
                <View key={msg.id} className="mb-4">
                  {msg.agents?.map((agent) => {
                    const meta = AGENT_META[agent.agent_role] ?? {
                      label: agent.agent_name,
                      color: "#666",
                      icon: "💬",
                    }
                    return (
                      <View
                        key={agent.agent_role}
                        className="mb-2 rounded-2xl border border-border bg-white p-4"
                        style={{ borderLeftWidth: 3, borderLeftColor: meta.color }}
                      >
                        <View className="flex-row items-center gap-2">
                          <Text className="text-[14px]">{meta.icon}</Text>
                          <Text
                            className="text-[14px] font-semi"
                            style={{ color: meta.color }}
                          >
                            {meta.label}
                          </Text>
                        </View>
                        <Text className="mt-2 text-[14px] leading-[22px] text-ink">
                          {agent.response}
                        </Text>
                      </View>
                    )
                  })}
                </View>
              ),
            )}
            {loading && (
              <View className="mb-3 items-center py-6">
                <ActivityIndicator size="small" />
                <Text className="mt-2 text-[13px] text-muted">Team is discussing...</Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}

      {hasReport && (
        <View className="mt-4 flex-row items-center gap-2">
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask the team something..."
            placeholderTextColor="#9CA3AF"
            onSubmitEditing={onSend}
            returnKeyType="send"
            className="flex-1 rounded-2xl border border-border bg-white px-4 py-3 text-[14px] text-ink"
          />
          <Pressable
            className="h-12 w-12 items-center justify-center rounded-full bg-[#08153A]"
            onPress={onSend}
            disabled={loading}
          >
            <Text className="text-lg text-white">{loading ? "..." : ">"}</Text>
          </Pressable>
        </View>
      )}
    </View>
  )
}

const $scrollContentContainer: ViewStyle = {
  paddingHorizontal: 16,
  paddingTop: 12,
  paddingBottom: 24,
  flexGrow: 1,
  gap: 0,
}
