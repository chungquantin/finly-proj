/* eslint-disable no-restricted-imports */
import { useCallback, useState } from "react"
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { MotiView } from "moti"
import { SafeAreaView } from "react-native-safe-area-context"

import { AnalysisCard } from "@/components/heartbeat/AnalysisCard"
import { RuleCard } from "@/components/heartbeat/RuleCard"
import { IosHeader } from "@/components/IosHeader"
import { TickerLogo } from "@/components/TickerLogo"
import { resolveScopedFinlyUserId } from "@/services/agentUser"
import { useHeartbeatStore } from "@/stores/heartbeatStore"
import { useOnboardingStore } from "@/stores/onboardingStore"
import { DEFAULT_STOCK_ACCOUNT_ID } from "@/utils/mockStockAccounts"
import { useSelectedPortfolioData } from "@/utils/selectedPortfolio"
import { getTickerLogoUri } from "@/utils/tickerLogo"

const BLUE = "#2453FF"
const BORDER = "#C7D0DC"

const decisionColors: Record<string, { bg: string; text: string }> = {
  BUY: { bg: "#E9F7EF", text: "#1F8A4C" },
  HOLD: { bg: "#FFF8E6", text: "#B8860B" },
  SELL: { bg: "#FFF1F1", text: "#D64545" },
  ERROR: { bg: "#FFF1F1", text: "#D64545" },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const resolveAccountScopeKey = () => {
  const state = useOnboardingStore.getState()
  if (state.portfolioType === "stock") {
    return `stock:${state.stockAccountId ?? DEFAULT_STOCK_ACCOUNT_ID}`
  }
  if (state.portfolioType === "crypto") {
    const wallet = state.walletAddress.trim().toLowerCase()
    return `crypto:${wallet || "default"}`
  }
  return "default"
}

const getUserId = () => resolveScopedFinlyUserId(resolveAccountScopeKey())

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function HeartbeatTab() {
  const { holdings } = useSelectedPortfolioData()

  // Store
  const rules = useHeartbeatStore((s) => s.rules)
  const results = useHeartbeatStore((s) => s.results)
  const hydrated = useHeartbeatStore((s) => s.hydrated)
  const isAnalyzing = useHeartbeatStore((s) => s.isAnalyzing)
  const analyzingTickers = useHeartbeatStore((s) => s.analyzingTickers)
  const completedTickers = useHeartbeatStore((s) => s.completedTickers)
  const currentTicker = useHeartbeatStore((s) => s.currentTicker)
  const liveResults = useHeartbeatStore((s) => s.liveResults)
  const isCreatingRule = useHeartbeatStore((s) => s.isCreatingRule)

  const startAnalysis = useHeartbeatStore((s) => s.startAnalysis)
  const createRule = useHeartbeatStore((s) => s.createRule)
  const deleteRule = useHeartbeatStore((s) => s.deleteRule)
  const toggleRule = useHeartbeatStore((s) => s.toggleRule)
  const markRead = useHeartbeatStore((s) => s.markRead)

  // Local
  const [ruleDraft, setRuleDraft] = useState("")

  const handleAnalyze = useCallback(() => {
    if (isAnalyzing) return
    void startAnalysis(getUserId())
  }, [isAnalyzing, startAnalysis])

  const handleCreateRule = useCallback(() => {
    const text = ruleDraft.trim()
    if (!text || isCreatingRule) return
    setRuleDraft("")
    void createRule(getUserId(), text)
  }, [ruleDraft, isCreatingRule, createRule])

  const hasHoldings = holdings.length > 0

  return (
    <SafeAreaView className="flex-1 bg-[#FBFCFF]">
      <ScrollView contentContainerStyle={$scrollContent}>
        <IosHeader title="Heartbeat" titleClassName="text-[20px] leading-[24px]" />

        <View className="px-4">
          {/* ─── Analyze Card ─── */}
          <MotiView
            from={{ opacity: 0, translateY: 16 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: 60, duration: 420, type: "timing" }}
          >
            <View
              className="rounded-[30px] border bg-white p-5"
              style={{ borderColor: BORDER }}
            >
              <Text className="font-sans text-[24px] font-semibold text-[#0F1728]">
                Portfolio Risk Scan
              </Text>
              <Text className="mt-1 font-sans text-[15px] text-[#7A8699]">
                Run full AI analysis across your holdings
              </Text>

              <Pressable
                className="mt-4 items-center rounded-full py-3"
                style={{
                  backgroundColor: isAnalyzing || !hasHoldings ? "#BFD0FF" : BLUE,
                }}
                disabled={isAnalyzing || !hasHoldings}
                onPress={handleAnalyze}
              >
                {isAnalyzing ? (
                  <View className="flex-row items-center gap-2">
                    <ActivityIndicator color="#FFFFFF" size="small" />
                    <Text className="font-sans text-[16px] font-semibold text-white">
                      Analyzing...
                    </Text>
                  </View>
                ) : (
                  <Text className="font-sans text-[16px] font-semibold text-white">
                    {hasHoldings ? "Analyze Now" : "Import portfolio first"}
                  </Text>
                )}
              </Pressable>

              {!hasHoldings && !isAnalyzing && (
                <Text className="mt-2 text-center font-sans text-[13px] text-[#7A8699]">
                  Add holdings in the Portfolio tab to get started
                </Text>
              )}

              {/* Live progress */}
              {isAnalyzing && analyzingTickers.length > 0 && (
                <View className="mt-4">
                  {analyzingTickers.map((ticker) => {
                    const isDone = completedTickers.includes(ticker)
                    const isCurrent = currentTicker === ticker
                    const live = liveResults[ticker]
                    const colors = live
                      ? decisionColors[live.decision] ?? decisionColors.HOLD
                      : null

                    return (
                      <View
                        key={ticker}
                        className="flex-row items-center border-b py-3"
                        style={{ borderColor: "#EEF2F7" }}
                      >
                        <TickerLogo
                          ticker={ticker}
                          logoUri={getTickerLogoUri(ticker)}
                        />
                        <Text className="ml-3 flex-1 font-sans text-[16px] font-semibold text-[#0F1728]">
                          {ticker}
                        </Text>

                        {isCurrent && (
                          <ActivityIndicator color={BLUE} size="small" />
                        )}
                        {isDone && live && (
                          <View
                            className="rounded-full px-3 py-1"
                            style={{ backgroundColor: colors!.bg }}
                          >
                            <Text
                              className="font-sans text-[12px] font-semibold"
                              style={{ color: colors!.text }}
                            >
                              {live.decision}
                            </Text>
                          </View>
                        )}
                        {!isDone && !isCurrent && (
                          <Text className="font-sans text-[13px] text-[#94A0B3]">
                            Waiting...
                          </Text>
                        )}
                      </View>
                    )
                  })}
                </View>
              )}
            </View>
          </MotiView>

          {/* ─── Rules Card ─── */}
          <MotiView
            from={{ opacity: 0, translateY: 16 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: 140, duration: 420, type: "timing" }}
          >
            <View
              className="mt-4 rounded-[30px] border bg-white p-4"
              style={{ borderColor: BORDER }}
            >
              <Text className="font-sans text-[24px] font-semibold text-[#0F1728]">
                Monitoring Rules
              </Text>

              {/* Rule input */}
              <View className="mt-3 flex-row items-center">
                <View className="flex-1 rounded-full bg-[#F3F6FC] px-4 py-2.5">
                  <TextInput
                    value={ruleDraft}
                    onChangeText={setRuleDraft}
                    placeholder="Alert me if AAPL drops 5%"
                    placeholderTextColor="#94A0B3"
                    className="font-sans text-[16px] text-[#0F1728]"
                    returnKeyType="send"
                    onSubmitEditing={handleCreateRule}
                    editable={!isCreatingRule}
                  />
                </View>
                <Pressable
                  className="ml-2 h-11 w-11 items-center justify-center rounded-full"
                  style={{
                    backgroundColor:
                      ruleDraft.trim() && !isCreatingRule ? BLUE : "#BFD0FF",
                  }}
                  disabled={!ruleDraft.trim() || isCreatingRule}
                  onPress={handleCreateRule}
                >
                  {isCreatingRule ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Ionicons name="add" size={20} color="#FFFFFF" />
                  )}
                </Pressable>
              </View>

              {/* Rules list */}
              {rules.length === 0 ? (
                <View className="mt-4 rounded-[20px] bg-[#F6F8FF] p-4">
                  <Text className="font-sans text-[16px] font-semibold text-[#0F1728]">
                    No rules yet
                  </Text>
                  <Text className="mt-1 font-sans text-[14px] leading-6 text-[#7A8699]">
                    Create a rule in natural language and we'll monitor it during
                    market hours.
                  </Text>
                </View>
              ) : (
                <View className="mt-2">
                  {rules.map((rule) => (
                    <RuleCard
                      key={rule.id}
                      rule={rule}
                      onToggle={(id) => void toggleRule(id)}
                      onDelete={(id) => void deleteRule(id)}
                    />
                  ))}
                </View>
              )}
            </View>
          </MotiView>

          {/* ─── Results Card ─── */}
          <MotiView
            from={{ opacity: 0, translateY: 16 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: 220, duration: 420, type: "timing" }}
          >
            <View
              className="mt-4 rounded-[30px] border bg-white p-4"
              style={{ borderColor: BORDER }}
            >
              <Text className="font-sans text-[24px] font-semibold text-[#0F1728]">
                Recent Results
              </Text>

              {!hydrated ? (
                <View className="mt-4 items-center py-6">
                  <ActivityIndicator color={BLUE} />
                </View>
              ) : results.length === 0 ? (
                <View className="mt-4 rounded-[20px] bg-[#F6F8FF] p-4">
                  <Text className="font-sans text-[16px] font-semibold text-[#0F1728]">
                    No results yet
                  </Text>
                  <Text className="mt-1 font-sans text-[14px] leading-6 text-[#7A8699]">
                    Run a portfolio scan or create monitoring rules to see
                    analysis results here.
                  </Text>
                </View>
              ) : (
                <View className="mt-2">
                  {results.map((result) => (
                    <AnalysisCard
                      key={result.id}
                      result={result}
                      onMarkRead={(id) => void markRead(id)}
                    />
                  ))}
                </View>
              )}
            </View>
          </MotiView>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const $scrollContent = {
  paddingBottom: 120,
}
