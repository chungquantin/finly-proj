import { useEffect, useMemo, useRef, useState } from "react"
/* eslint-disable no-restricted-imports */
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type ScrollView as ScrollViewType,
  type ViewStyle,
} from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import Markdown from "react-native-markdown-display"
import { SafeAreaView } from "react-native-safe-area-context"

import { TickerLogo } from "@/components/TickerLogo"
import { useMarketData } from "@/services/marketData"
import { ThreadReportVersion, useAgentBoardStore } from "@/stores/agentBoardStore"
import { getRandomAgentAvatar } from "@/utils/agentAvatars"
import { useSelectedPortfolioData } from "@/utils/selectedPortfolio"
import { getTickerLogoUri } from "@/utils/tickerLogo"

const BLUE = "#2453FF"
const BLUE_SURFACE = "#F4F7FF"
const BORDER = "#EEF2F7"

const formatMessageTime = (value: string) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ""
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

const formatVersionTime = (value: string) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "Unknown time"
  return parsed.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const toThreadPreview = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return ""

  const finalReportIndex = trimmed.toLowerCase().indexOf("final report:")
  const rawPreview =
    finalReportIndex >= 0 ? trimmed.slice(finalReportIndex + "final report:".length) : trimmed

  return rawPreview.replace(/\*\*/g, "").replace(/\s+/g, " ").trim()
}

const decisionBadgeStyles = {
  Buy: {
    bg: "#EAF8EF",
    text: "#1E9A50",
  },
  Sell: {
    bg: "#FFF1F1",
    text: "#D64545",
  },
  Position: {
    bg: "#EEF3FF",
    text: "#2453FF",
  },
} as const

const agentIdentityByRole: Record<string, string> = {
  "analyst": "Kai - Analyst",
  "market analyst": "Kai - Market Analyst",
  "researcher": "Milo - Researcher",
  "trader": "Avery - Trader",
  "advisor": "Avery - Advisor",
  "risk assessor": "Noor - Trader",
  "portfolio manager": "Avery - Portfolio Manager",
}

export default function ThreadDetailRoute() {
  const router = useRouter()
  const { holdings } = useSelectedPortfolioData()
  const { id } = useLocalSearchParams<{ id: string }>()
  const thread = useAgentBoardStore((state) => state.threads.find((item) => item.id === id))
  const sendThreadMessage = useAgentBoardStore((state) => state.sendThreadMessage)
  const regenerateReport = useAgentBoardStore((state) => state.regenerateReport)
  const closeThread = useAgentBoardStore((state) => state.closeThread)
  const scrollViewRef = useRef<ScrollViewType>(null)
  const [draft, setDraft] = useState("")
  const [isOptionsVisible, setIsOptionsVisible] = useState(false)
  const [isVersionsVisible, setIsVersionsVisible] = useState(false)
  const [isReportDetailVisible, setIsReportDetailVisible] = useState(false)
  const [isFullReportVisible, setIsFullReportVisible] = useState(false)
  const [selectedReportVersionId, setSelectedReportVersionId] = useState<string | null>(null)

  const canSend = draft.trim().length > 0 && !thread?.isBusy

  const participantAvatars = useMemo(
    () =>
      (thread?.participantAgentIds ?? []).map((agentId) => ({
        id: agentId,
        avatar: getRandomAgentAvatar(agentId),
      })),
    [thread?.participantAgentIds],
  )
  const reportVersions = useMemo(() => {
    if (!thread) return []
    if (thread.reportVersions.length > 0) return [...thread.reportVersions].reverse()
    if (!thread.report) return []
    return [
      {
        id: "report_legacy",
        sourceReportId: thread.report.report_id,
        createdAt: thread.updatedAt,
        report: thread.report,
      } satisfies ThreadReportVersion,
    ]
  }, [thread])
  const activeReportVersion = useMemo(() => {
    if (reportVersions.length === 0) return null
    if (!selectedReportVersionId) return reportVersions[0]
    return (
      reportVersions.find((version) => version.id === selectedReportVersionId) ?? reportVersions[0]
    )
  }, [reportVersions, selectedReportVersionId])
  const hasReadyReport = thread?.stage === "report_ready" && reportVersions.length > 0
  const reportTickers = useMemo(() => {
    if (!activeReportVersion) return []
    const primaryTicker = activeReportVersion.report.ticker.trim().toUpperCase()
    const relatedTickers = activeReportVersion.report.additional_tickers
      .map((item) => item.ticker.trim().toUpperCase())
      .filter(Boolean)
    return Array.from(new Set([primaryTicker, ...relatedTickers].filter(Boolean)))
  }, [activeReportVersion])
  const { quotes } = useMarketData(reportTickers)
  const holdingsByTicker = useMemo(
    () =>
      holdings.reduce<Record<string, (typeof holdings)[number]>>((acc, item) => {
        acc[item.ticker.trim().toUpperCase()] = item
        return acc
      }, {}),
    [holdings],
  )

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true })
  }, [thread?.messages.length])

  useEffect(() => {
    if (!activeReportVersion) return
    setSelectedReportVersionId(activeReportVersion.id)
  }, [activeReportVersion])

  function handleBack() {
    if (router.canGoBack()) {
      router.back()
      return
    }
    router.replace("/(tabs)/board")
  }

  if (!thread) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
        <Text className="font-sans text-[28px] font-semibold text-[#0F1728]">Thread not found</Text>
        <Pressable
          className="mt-4 rounded-full bg-[#2453FF] px-5 py-3"
          onPress={handleBack}
        >
          <Text className="font-sans text-[17px] font-semibold text-white">Go back</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  const normalizedTicker = thread.ticker.trim().toUpperCase()
  const showThreadLogo = Boolean(normalizedTicker) && normalizedTicker !== "BOARD"
  const threadHolding = holdings.find((holding) => holding.ticker === thread.ticker)
  const threadLogoUri = showThreadLogo
    ? threadHolding?.logoUri ?? getTickerLogoUri(thread.ticker)
    : undefined

  const handleSend = async () => {
    const nextMessage = draft.trim()
    if (!nextMessage) return
    setDraft("")
    await sendThreadMessage(thread.id, nextMessage)
    scrollViewRef.current?.scrollToEnd({ animated: true })
  }

  const handleRegenerate = async () => {
    await regenerateReport(thread.id)
    scrollViewRef.current?.scrollToEnd({ animated: true })
  }

  const handleCloseThread = () => {
    closeThread(thread.id)
    handleBack()
  }
  const resolveCurrentPrice = (ticker: string) => {
    const normalizedTicker = ticker.trim().toUpperCase()
    const liveQuote = quotes[normalizedTicker]?.price
    if (typeof liveQuote === "number" && Number.isFinite(liveQuote)) return liveQuote

    const holdingMatch = holdingsByTicker[normalizedTicker]
    if (!holdingMatch || !holdingMatch.shares) return null

    return holdingMatch.valueUsd / holdingMatch.shares
  }
  const handleOpenTickerDetail = (ticker: string) => {
    const normalizedTicker = ticker.trim().toUpperCase()
    if (!normalizedTicker || normalizedTicker === "BOARD") return
    const isHeldTicker = Boolean(holdingsByTicker[normalizedTicker])
    router.push(isHeldTicker ? `/holding/${normalizedTicker}` : `/watchlist/${normalizedTicker}`)
  }

  return (
    <SafeAreaView className="flex-1 bg-[#FBFCFF]">
      <View className="flex-1 bg-[#FBFCFF]">
        <View className="px-4 pb-4 pt-2">
          <View
            className="flex-row items-center justify-between rounded-[28px] border bg-white px-3 py-3"
            style={{ borderColor: BORDER }}
          >
            <Pressable
              className="h-11 w-11 items-center justify-center rounded-full"
              style={{ backgroundColor: BLUE_SURFACE }}
              onPress={handleBack}
            >
              <Ionicons name="chevron-back" size={24} color={BLUE} />
            </Pressable>

            <View className="ml-3 flex-1 flex-row items-center">
              {showThreadLogo ? <TickerLogo ticker={thread.ticker} logoUri={threadLogoUri} /> : null}

              <View className={`${showThreadLogo ? "ml-3" : ""} flex-1`}>
                <Text className="font-sans text-[20px] font-semibold text-[#0F1728]">
                  {thread.title}
                </Text>
              </View>
            </View>

            <Pressable className="flex-row items-center">
              <Pressable
                className="h-11 w-11 items-center justify-center rounded-full"
                style={{ backgroundColor: BLUE_SURFACE }}
                onPress={() => setIsVersionsVisible(true)}
                disabled={reportVersions.length === 0}
              >
                <View>
                  <Ionicons
                    name="document-text-outline"
                    size={20}
                    color={reportVersions.length > 0 ? BLUE : "#A7B2C4"}
                  />
                  {thread.stage === "report_ready" ? (
                    <View className="absolute -right-1 -top-1 h-4 w-4 items-center justify-center rounded-full bg-[#22B45A]">
                      <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                    </View>
                  ) : null}
                </View>
              </Pressable>

              <Pressable
                className="ml-2 h-11 w-11 items-center justify-center rounded-full"
                style={{ backgroundColor: BLUE_SURFACE }}
                onPress={() => setIsOptionsVisible(true)}
              >
                <Ionicons name="ellipsis-horizontal" size={20} color={BLUE} />
              </Pressable>
            </Pressable>
          </View>
        </View>

        <ScrollView
          ref={scrollViewRef}
          className="flex-1"
          contentContainerStyle={$threadContent}
          showsVerticalScrollIndicator={false}
        >
          <View className="rounded-[24px] border border-[#EEF2F7] bg-white p-4">
            <Text className="font-sans text-[12px] font-semibold tracking-[1.2px] text-[#7A8699]">
              STATUS
            </Text>
            <Text className="mt-2 font-sans text-[20px] font-semibold text-[#0F1728]">
              {thread.stage === "intake"
                ? `Intake in progress (${thread.followUpCount}/2 follow-ups used)`
                : thread.stage === "report_loading"
                  ? "Generating team report"
                  : thread.stage === "error"
                    ? "Needs attention"
                    : `${thread.decision} on ${thread.ticker}`}
            </Text>
            <Text
              className="mt-2 font-sans text-[15px] leading-6 text-[#607089]"
              numberOfLines={3}
              ellipsizeMode="tail"
            >
              {toThreadPreview(thread.lastError || thread.summary)}
            </Text>
            {thread.isBusy ? (
              <View className="mt-3 flex-row items-center">
                <ActivityIndicator color={BLUE} />
                <Text className="ml-3 font-sans text-[14px] text-[#607089]">
                  Advisor is working on this thread.
                </Text>
              </View>
            ) : null}
          </View>

          {thread.memoryUpdates.length > 0 ? (
            <View className="mt-4 rounded-[24px] border border-[#E7F0FF] bg-[#F4F7FF] p-4">
              <Text className="font-sans text-[12px] font-semibold tracking-[1.2px] text-[#4E6AA8]">
                MEMORY UPDATES
              </Text>
              <Text className="mt-2 font-sans text-[15px] leading-6 text-[#36507D]">
                {thread.memoryUpdates.join(", ")}
              </Text>
            </View>
          ) : null}

          <View className="mt-4">
            <Text className="mb-3 font-sans text-[12px] font-semibold tracking-[1.2px] text-[#7A8699]">
              CONVERSATION
            </Text>
            {thread.messages.map((item) => {
              const isUser = item.role === "user"
              const isSystem = item.role === "system"
              const displayAuthor =
                item.role === "assistant" && item.author === "Finly" ? "Advisor" : item.author
              const avatarSeed = item.agentRole || displayAuthor
              const avatar = !isUser && !isSystem ? getRandomAgentAvatar(avatarSeed) : null

              return (
                <View
                  key={item.id}
                  className={`mb-4 ${isUser ? "items-end" : "items-start"}`}
                  style={isUser ? $outgoingRow : undefined}
                >
                  {isSystem ? (
                    <View className="w-full items-center">
                      <View className="self-center rounded-full bg-[#F4F7FF] px-4 py-2">
                        <Text className="font-sans text-[13px] text-[#607089]">{item.content}</Text>
                      </View>
                      {item.content.startsWith("Team report ready") &&
                      hasReadyReport &&
                      activeReportVersion ? (
                        <View className="mt-3 w-full">
                          <ReportPreviewCard
                            version={activeReportVersion}
                            ctaLabel="View full report"
                            onPress={() => setIsFullReportVisible(true)}
                            onTickerPress={handleOpenTickerDetail}
                            resolvePrice={resolveCurrentPrice}
                          />
                        </View>
                      ) : null}
                    </View>
                  ) : !isUser ? (
                    <View className="mb-1 flex-row items-end">
                      <View
                        className="mr-2 h-8 w-8 items-center justify-center rounded-full"
                        style={{ backgroundColor: avatar?.palette.background ?? "#DDE7FF" }}
                      >
                        {avatar ? (
                          <Image
                            source={avatar.image}
                            style={{ width: 32, height: 32, borderRadius: 999 }}
                            resizeMode="cover"
                          />
                        ) : null}
                      </View>

                      <View className="max-w-[78%]">
                        <Text className="mb-1 ml-1 font-sans text-[13px] text-[#98A1B2]">
                          {displayAuthor}
                        </Text>
                        <View
                          className="rounded-[20px] rounded-bl-[8px] border bg-[#F7F9FC] px-4 py-3"
                          style={{ borderColor: BORDER }}
                        >
                          <Text className="font-sans text-[17px] leading-6 text-[#0F1728]">
                            {item.content}
                          </Text>
                        </View>
                        <Text className="ml-2 mt-1 font-sans text-[12px] text-[#98A1B2]">
                          {formatMessageTime(item.createdAt)}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View className="max-w-[78%]">
                      <View style={$outgoingBubble}>
                        <Text className="font-sans text-[18px] leading-6 text-white">
                          {item.content}
                        </Text>
                      </View>

                      <View className="mt-2 flex-row items-center justify-end">
                        {participantAvatars.map(
                          ({ id: agentIdValue, avatar: participant }, index) => (
                            <View
                              key={`${item.id}-${agentIdValue}`}
                              className={`h-7 w-7 items-center justify-center rounded-full border-2 border-white ${
                                index === 0 ? "" : "-ml-1.5"
                              }`}
                              style={{ backgroundColor: participant.palette.background }}
                            >
                              <Image
                                source={participant.image}
                                style={{ width: 28, height: 28, borderRadius: 999 }}
                                resizeMode="cover"
                              />
                            </View>
                          ),
                        )}
                      </View>
                      <Text className="mt-1 text-right font-sans text-[12px] text-[#98A1B2]">
                        {formatMessageTime(item.createdAt)}
                      </Text>
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        </ScrollView>

        <View className="border-t bg-white px-3 pb-4 pt-3" style={{ borderColor: BORDER }}>
          <View className="flex-row items-center">
            <Pressable
              className="mr-2 h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: BLUE_SURFACE }}
              onPress={() => setIsOptionsVisible(true)}
            >
              <Ionicons name="ellipsis-horizontal" size={20} color={BLUE} />
            </Pressable>

            <View className="flex-1 flex-row items-center rounded-full bg-[#F3F6FC] px-4 py-2.5">
              <TextInput
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={() => {
                  void handleSend()
                }}
                placeholder={
                  thread.stage === "intake"
                    ? "Answer Advisor's follow-up"
                    : "Ask the team to refine the report"
                }
                placeholderTextColor="#94A0B3"
                className="flex-1 text-[16px] text-[#0F1728]"
                returnKeyType="send"
                editable={!thread.isBusy}
              />
            </View>

            <Pressable
              className="ml-2 h-10 w-10 items-center justify-center rounded-full"
              style={canSend ? $sendButtonActive : $sendButtonDisabled}
              onPress={() => {
                void handleSend()
              }}
              disabled={!canSend}
            >
              {thread.isBusy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
              )}
            </Pressable>
          </View>
        </View>

        <Modal
          transparent
          animationType="fade"
          visible={isOptionsVisible}
          onRequestClose={() => setIsOptionsVisible(false)}
        >
          <Pressable style={$modalBackdrop} onPress={() => setIsOptionsVisible(false)}>
            <Pressable style={$modalCard} onPress={() => {}}>
              <Text className="font-sans text-[18px] font-semibold text-[#0F1728]">
                Thread actions
              </Text>
              <OptionRow
                icon="refresh-outline"
                label="Regenerate report"
                onPress={() => {
                  setIsOptionsVisible(false)
                  void handleRegenerate()
                }}
              />
              <OptionRow
                icon="close-outline"
                label="Close"
                onPress={() => {
                  setIsOptionsVisible(false)
                  handleCloseThread()
                }}
              />
            </Pressable>
          </Pressable>
        </Modal>

        <Modal
          transparent
          animationType="fade"
          visible={isVersionsVisible}
          onRequestClose={() => setIsVersionsVisible(false)}
        >
          <Pressable style={$modalBackdrop} onPress={() => setIsVersionsVisible(false)}>
            <Pressable style={$modalCard} onPress={() => {}}>
              <Text className="font-sans text-[18px] font-semibold text-[#0F1728]">
                Report versions
              </Text>
              {reportVersions.length === 0 ? (
                <Text className="mt-3 font-sans text-[14px] text-[#607089]">
                  No report generated yet.
                </Text>
              ) : (
                <View className="mt-3">
                  {reportVersions.map((version, index) => {
                    const selected = activeReportVersion?.id === version.id
                    return (
                      <Pressable
                        key={version.id}
                        className={`mb-2 rounded-[18px] border px-4 py-3 ${selected ? "border-[#2453FF] bg-[#F4F7FF]" : "border-[#E8EDF7] bg-[#F9FBFF]"}`}
                        onPress={() => {
                          setSelectedReportVersionId(version.id)
                          setIsVersionsVisible(false)
                          setIsFullReportVisible(true)
                        }}
                      >
                        <Text className="font-sans text-[15px] font-semibold text-[#0F1728]">
                          Version {reportVersions.length - index}
                        </Text>
                        <View className="mt-1 self-start">
                          <DecisionBadge decision={toDecisionLabel(version.report.decision)} />
                        </View>
                        <Text className="font-sans text-[13px] text-[#6B7586]">
                          {version.report.decision} {version.report.ticker} ·{" "}
                          {formatVersionTime(version.createdAt)}
                        </Text>
                        <Text
                          className="mt-1 font-sans text-[13px] text-[#4D5D75]"
                          numberOfLines={1}
                        >
                          {version.report.summary}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>
              )}
            </Pressable>
          </Pressable>
        </Modal>

        <Modal
          transparent
          animationType="slide"
          visible={isReportDetailVisible}
          onRequestClose={() => setIsReportDetailVisible(false)}
        >
          <View style={$modalBackdrop}>
            <View style={$reportDetailCard}>
              <View className="mb-3 flex-row items-center justify-between">
                <Text className="font-sans text-[18px] font-semibold text-[#0F1728]">
                  Report preview
                </Text>
                <Pressable
                  className="h-9 w-9 items-center justify-center rounded-full bg-[#F2F6FF]"
                  onPress={() => setIsReportDetailVisible(false)}
                >
                  <Ionicons name="close" size={18} color={BLUE} />
                </Pressable>
              </View>

              {activeReportVersion ? (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <ReportPreviewCard
                    version={activeReportVersion}
                    ctaLabel="Open report versions for details"
                    showRelatedStocks
                    onReadFullReport={() => setIsFullReportVisible(true)}
                    onTickerPress={handleOpenTickerDetail}
                    resolvePrice={resolveCurrentPrice}
                  />
                </ScrollView>
              ) : (
                <Text className="font-sans text-[15px] text-[#607089]">
                  No report data available.
                </Text>
              )}
            </View>
          </View>
        </Modal>

        <Modal
          transparent
          animationType="slide"
          visible={isFullReportVisible}
          onRequestClose={() => setIsFullReportVisible(false)}
        >
          <View style={$modalBackdrop}>
            <View style={$reportDetailCard}>
              <View className="mb-3 flex-row items-center justify-between">
                <Text className="font-sans text-[18px] font-semibold text-[#0F1728]">
                  Full report
                </Text>
                <Pressable
                  className="h-9 w-9 items-center justify-center rounded-full bg-[#F2F6FF]"
                  onPress={() => setIsFullReportVisible(false)}
                >
                  <Ionicons name="close" size={18} color={BLUE} />
                </Pressable>
              </View>

              {activeReportVersion ? (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text className="font-sans text-[12px] font-semibold tracking-[1px] text-[#6076A6]">
                    {formatVersionTime(activeReportVersion.createdAt)}
                  </Text>
                  <Text className="mt-1 font-sans text-[20px] font-semibold text-[#0F1728]">
                    {activeReportVersion.report.decision} {activeReportVersion.report.ticker}
                  </Text>
                  <View className="mt-2 self-start">
                    <DecisionBadge
                      decision={toDecisionLabel(activeReportVersion.report.decision)}
                    />
                  </View>

                  <Text className="mt-4 font-sans text-[15px] font-semibold text-[#0F1728]">
                    Final report
                  </Text>
                  <View className="mt-2">
                    <Markdown style={markdownStyles}>
                      {activeReportVersion.report.full_report}
                    </Markdown>
                  </View>

                  {activeReportVersion.report.specialist_insights.length > 0 ? (
                    <View className="mt-4">
                      <Text className="font-sans text-[15px] font-semibold text-[#0F1728]">
                        Specialist insights
                      </Text>
                      {activeReportVersion.report.specialist_insights.map((insight) => {
                        const avatar = getRandomAgentAvatar(insight.role)

                        return (
                          <View key={insight.role} className="mt-2 rounded-[16px] bg-[#F8FAFD] p-3">
                            <View className="flex-row items-center">
                              <View
                                className="h-9 w-9 items-center justify-center rounded-full"
                                style={{ backgroundColor: avatar.palette.background }}
                              >
                                <Image
                                  source={avatar.image}
                                  style={{ width: 36, height: 36, borderRadius: 999 }}
                                  resizeMode="cover"
                                />
                              </View>
                              <Text className="ml-2 font-sans text-[14px] font-semibold text-[#0F1728]">
                                {resolveAgentIdentity(insight.role)}
                              </Text>
                            </View>

                            <View className="mt-2">
                              <Markdown style={markdownStyles}>{insight.summary}</Markdown>
                            </View>
                            {insight.full_analysis ? (
                              <View className="mt-1">
                                <Markdown style={markdownStyles}>{insight.full_analysis}</Markdown>
                              </View>
                            ) : null}
                          </View>
                        )
                      })}
                    </View>
                  ) : null}
                </ScrollView>
              ) : (
                <Text className="font-sans text-[15px] text-[#607089]">
                  No report data available.
                </Text>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  )
}

function OptionRow({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onPress: () => void
}) {
  return (
    <Pressable
      className="mt-3 flex-row items-center rounded-[18px] bg-[#F7F9FC] px-4 py-3"
      onPress={onPress}
    >
      <Ionicons name={icon} size={20} color={BLUE} />
      <Text className="ml-3 font-sans text-[16px] text-[#0F1728]">{label}</Text>
    </Pressable>
  )
}

function toDecisionLabel(value: string): "Buy" | "Sell" | "Position" {
  const normalized = value.trim().toUpperCase()
  if (normalized === "BUY") return "Buy"
  if (normalized === "SELL") return "Sell"
  return "Position"
}

function DecisionBadge({ decision }: { decision: "Buy" | "Sell" | "Position" }) {
  const palette = decisionBadgeStyles[decision]
  return (
    <View className="rounded-full px-3 py-1.5" style={{ backgroundColor: palette.bg }}>
      <Text className="font-sans text-[12px] font-semibold" style={{ color: palette.text }}>
        {decision.toUpperCase()}
      </Text>
    </View>
  )
}

function resolveAgentIdentity(role: string) {
  const normalized = role.trim().toLowerCase()
  return agentIdentityByRole[normalized] ?? `${capitalizeWords(role)} - ${capitalizeWords(role)}`
}

function capitalizeWords(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")
}

function ReportPreviewCard({
  version,
  ctaLabel,
  onPress,
  showRelatedStocks = false,
  onReadFullReport,
  onTickerPress,
  resolvePrice,
}: {
  version: ThreadReportVersion
  ctaLabel: string
  onPress?: () => void
  showRelatedStocks?: boolean
  onReadFullReport?: () => void
  onTickerPress?: (ticker: string) => void
  resolvePrice?: (ticker: string) => number | null
}) {
  const primaryTicker = version.report.ticker.trim().toUpperCase()
  const relatedTickers = version.report.additional_tickers
    .map((item) => item.ticker.trim().toUpperCase())
    .filter((ticker) => ticker && ticker !== primaryTicker)
  const displayedRelatedTickers = relatedTickers.slice(0, 4)
  const hiddenRelatedCount = Math.max(relatedTickers.length - displayedRelatedTickers.length, 0)
  const currentPrice = resolvePrice?.(primaryTicker) ?? null
  const currentPriceLabel = typeof currentPrice === "number" ? formatUsd(currentPrice) : "Price unavailable"

  return (
    <View className="rounded-[20px] border border-[#E3EBFF] bg-[#F5F8FF] px-4 py-3">
      <View className="flex-row items-center justify-between">
        <Text className="font-sans text-[12px] font-semibold tracking-[1px] text-[#5A74AD]">
          REPORT READY
        </Text>
        <Text className="font-sans text-[12px] text-[#6B7586]">
          {formatVersionTime(version.createdAt)}
        </Text>
      </View>
      <Text className="mt-1 font-sans text-[16px] font-semibold text-[#0F1728]">
        {version.report.decision} {version.report.ticker}
      </Text>
      <View className="mt-2 self-start">
        <DecisionBadge decision={toDecisionLabel(version.report.decision)} />
      </View>
      <View className="mt-3 rounded-[16px] border border-[#DCE5FA] bg-[#FFFFFF] px-3 py-2.5">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Pressable
              onPress={() => onTickerPress?.(primaryTicker)}
              disabled={!onTickerPress}
              hitSlop={8}
            >
              <TickerLogo ticker={primaryTicker} logoUri={getTickerLogoUri(primaryTicker)} size={36} />
            </Pressable>
            <View className="ml-3">
              <Text className="font-sans text-[12px] text-[#6B7586]">Ticker</Text>
              <Text className="font-sans text-[15px] font-semibold text-[#0F1728]">
                {primaryTicker}
              </Text>
            </View>
          </View>
          <View className="items-end">
            <Text className="font-sans text-[12px] text-[#6B7586]">Current price</Text>
            <Text className="font-sans text-[15px] font-semibold text-[#0F1728]">
              {currentPriceLabel}
            </Text>
          </View>
        </View>
      </View>
      <Text className="mt-2 font-sans text-[14px] leading-5 text-[#4D5D75]" numberOfLines={2}>
        {version.report.summary}
      </Text>

      {showRelatedStocks && displayedRelatedTickers.length > 0 ? (
        <View className="mt-3">
          <Text className="font-sans text-[12px] font-semibold tracking-[1px] text-[#6076A6]">
            RELATED STOCKS
          </Text>
          <View className="mt-2 flex-row items-center">
            {displayedRelatedTickers.map((ticker, index) => (
              <View key={ticker} className={index === 0 ? "" : "-ml-2"}>
                <Pressable onPress={() => onTickerPress?.(ticker)} disabled={!onTickerPress} hitSlop={8}>
                  <TickerLogo ticker={ticker} logoUri={getTickerLogoUri(ticker)} size={28} />
                </Pressable>
              </View>
            ))}
            {hiddenRelatedCount > 0 ? (
              <View className="-ml-2 h-7 min-w-7 items-center justify-center rounded-full border border-[#DCE5FA] bg-[#FFFFFF] px-2">
                <Text className="font-sans text-[11px] font-semibold text-[#607089]">
                  +{hiddenRelatedCount}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {onPress ? (
        <Pressable className="mt-2 self-start" onPress={onPress}>
          <Text className="font-sans text-[13px] font-medium text-[#2453FF]">{ctaLabel}</Text>
        </Pressable>
      ) : (
        <Text className="mt-2 font-sans text-[13px] font-medium text-[#2453FF]">{ctaLabel}</Text>
      )}
      {onReadFullReport ? (
        <Pressable className="mt-2 self-start" onPress={onReadFullReport}>
          <Text className="font-sans text-[13px] font-semibold text-[#2453FF]">
            Read full report
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}

function formatUsd(value: number) {
  return `$${value.toFixed(2)}`
}

const $threadContent: ViewStyle = {
  paddingHorizontal: 16,
  paddingTop: 20,
  paddingBottom: 32,
  backgroundColor: "#FBFCFF",
}

const $outgoingRow: ViewStyle = {
  alignSelf: "flex-end",
}

const $outgoingBubble: ViewStyle = {
  borderRadius: 22,
  borderBottomRightRadius: 8,
  paddingHorizontal: 16,
  paddingVertical: 12,
  backgroundColor: BLUE,
}

const $modalBackdrop: ViewStyle = {
  flex: 1,
  justifyContent: "flex-end",
  backgroundColor: "rgba(15, 23, 40, 0.28)",
  padding: 16,
}

const $modalCard: ViewStyle = {
  borderRadius: 28,
  backgroundColor: "#FFFFFF",
  padding: 20,
}

const $reportDetailCard: ViewStyle = {
  borderRadius: 28,
  backgroundColor: "#FFFFFF",
  padding: 20,
  maxHeight: "85%",
}

const $sendButtonActive: ViewStyle = {
  backgroundColor: BLUE,
}

const $sendButtonDisabled: ViewStyle = {
  backgroundColor: "#BFD0FF",
}

const markdownStyles = {
  body: {
    color: "#425168",
    fontSize: 15,
    lineHeight: 28,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 14,
    color: "#425168",
    fontSize: 15,
    lineHeight: 28,
  },
  strong: {
    color: "#0F1728",
    fontWeight: "700",
  },
  bullet_list: {
    marginTop: 2,
    marginBottom: 10,
  },
  ordered_list: {
    marginTop: 2,
    marginBottom: 10,
  },
  list_item: {
    marginBottom: 4,
  },
  heading1: {
    color: "#0F1728",
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 10,
  },
  heading2: {
    color: "#0F1728",
    fontSize: 19,
    lineHeight: 27,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 8,
  },
  heading3: {
    color: "#0F1728",
    fontSize: 17,
    lineHeight: 25,
    fontWeight: "700",
    marginTop: 6,
    marginBottom: 6,
  },
  blockquote: {
    borderLeftWidth: 2,
    borderLeftColor: "#D6E1FF",
    backgroundColor: "#F7FAFF",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  code_inline: {
    backgroundColor: "#EEF3FF",
    color: "#29468F",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  code_block: {
    backgroundColor: "#F4F7FF",
    borderRadius: 12,
    padding: 10,
    color: "#2C3C59",
  },
}
