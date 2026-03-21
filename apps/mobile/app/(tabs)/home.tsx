/* eslint-disable react-native/no-inline-styles */
/* eslint-disable react-native/no-color-literals */
/* eslint-disable no-restricted-imports */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Animated,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native"
import { useRouter } from "expo-router"
import { MotiView } from "moti"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"

import { HoldingRow } from "@/components/HoldingRow"
import { useMarketData } from "@/services/marketData"
import { usePortfolioGrowthHistory } from "@/services/portfolioHistory"
import { useOnboardingStore } from "@/stores/onboardingStore"
import { getRandomAgentAvatar } from "@/utils/agentAvatars"
import { getInvestorAvatarEmoji } from "@/utils/investorAvatar"
import { boardMessages, teamAgents } from "@/utils/mockAppData"
import { useSelectedPortfolioData } from "@/utils/selectedPortfolio"

const BORDER = "#EEF2F7"
const COLLAPSED_VISIBLE_HEIGHT = 228
const SNAP_THRESHOLD = 96
const PORTFOLIO_GROWTH_POINTS = [18, 24, 22, 31, 29, 37, 42, 40, 49, 58, 55, 64] as const

const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)

export default function HomeTab() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const [isTeamExpanded, setIsTeamExpanded] = useState(false)
  const investorName = useOnboardingStore((state) => state.name).trim() || "Investor"
  const riskExpertise = useOnboardingStore((state) => state.riskExpertise)
  const investmentHorizon = useOnboardingStore((state) => state.investmentHorizon)
  const financialKnowledge = useOnboardingStore((state) => state.financialKnowledge)
  const portfolioType = useOnboardingStore((state) => state.portfolioType)
  const { holdings, transactions, snapshot: portfolioSnapshot } = useSelectedPortfolioData()
  const avatarEmoji = useMemo(() => getInvestorAvatarEmoji(investorName), [investorName])
  const { quotes, isLoading, hasLiveQuotes } = useMarketData(
    holdings.map((holding) => holding.ticker),
  )
  const showPortfolioSkeleton = isLoading && !hasLiveQuotes
  const enrichedHoldings = useMemo(
    () =>
      holdings.map((holding) => {
        const liveQuote = quotes[holding.ticker]
        return {
          ...holding,
          valueUsd: liveQuote ? liveQuote.price * holding.shares : holding.valueUsd,
          changePercent: liveQuote?.change_pct ?? holding.changePercent,
        }
      }),
    [holdings, quotes],
  )
  const latestAgentMessages = useMemo(() => {
    return boardMessages.reduce<Record<string, string>>((acc, message) => {
      if (message.role !== "user" && !acc[message.author]) {
        acc[message.author] = message.message
      }
      return acc
    }, {})
  }, [])
  const totalValueUsd = useMemo(
    () => enrichedHoldings.reduce((sum, holding) => sum + holding.valueUsd, 0),
    [enrichedHoldings],
  )
  const growthHistory = usePortfolioGrowthHistory(transactions)
  const teamPreviewAgents = useMemo(() => teamAgents.slice(0, 4), [])
  const expandedHeight = Math.max(height - insets.top - 12, COLLAPSED_VISIBLE_HEIGHT)
  const sheetHeight = useRef(new Animated.Value(COLLAPSED_VISIBLE_HEIGHT)).current
  const dragStartHeightRef = useRef(COLLAPSED_VISIBLE_HEIGHT)

  const snapTo = useCallback(
    (expanded: boolean) => {
      const toValue = expanded ? expandedHeight : COLLAPSED_VISIBLE_HEIGHT
      setIsTeamExpanded(expanded)
      Animated.spring(sheetHeight, {
        toValue,
        useNativeDriver: true,
        bounciness: 0,
        speed: 18,
      }).start()
    },
    [expandedHeight, sheetHeight],
  )

  useEffect(() => {
    sheetHeight.setValue(isTeamExpanded ? expandedHeight : COLLAPSED_VISIBLE_HEIGHT)
  }, [expandedHeight, isTeamExpanded, sheetHeight])

  const headerPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx) && Math.abs(gestureState.dy) > 4,
        onPanResponderGrant: () => {
          sheetHeight.stopAnimation((value) => {
            dragStartHeightRef.current = value
          })
        },
        onPanResponderMove: (_, gestureState) => {
          const nextHeight = clamp(
            dragStartHeightRef.current - gestureState.dy,
            COLLAPSED_VISIBLE_HEIGHT,
            expandedHeight,
          )
          sheetHeight.setValue(nextHeight)
        },
        onPanResponderRelease: (_, gestureState) => {
          const currentHeight = clamp(
            dragStartHeightRef.current - gestureState.dy,
            COLLAPSED_VISIBLE_HEIGHT,
            expandedHeight,
          )
          const shouldExpand =
            gestureState.vy < -0.2 || currentHeight > COLLAPSED_VISIBLE_HEIGHT + SNAP_THRESHOLD

          snapTo(shouldExpand)
        },
        onPanResponderTerminate: () => {
          snapTo(isTeamExpanded)
        },
      }),
    [expandedHeight, isTeamExpanded, sheetHeight, snapTo],
  )

  return (
    <SafeAreaView className="flex-1 bg-[#FBFCFF]">
      <View className="flex-1">
        <ScrollView className="flex-1" contentContainerStyle={$scrollContent}>
          <MotiView
            animate={{ opacity: 1, translateY: 0 }}
            from={{ opacity: 0, translateY: 18 }}
            transition={{ delay: 60, duration: 420, type: "timing" }}
          >
            <View
              className="overflow-hidden rounded-[36px] border bg-white"
              style={{ borderColor: BORDER }}
            >
              <View className="rounded-[36px] px-5 pb-6 pt-4">
                <View className="items-center">
                  <View
                    className="h-24 w-24 items-center justify-center rounded-full border-[6px] bg-[#2453FF]"
                    style={{ borderColor: "#91FF66" }}
                  >
                    <Text className="font-sans text-[40px]">{avatarEmoji}</Text>
                  </View>
                  <Text className="mt-5 font-sans text-[31px] font-semibold text-[#0F1728] tracking-[-0.8px]">
                    {investorName}
                  </Text>
                </View>

                <MotiView
                  animate={{ opacity: 1, translateY: 0 }}
                  from={{ opacity: 0, translateY: 16 }}
                  transition={{ delay: 140, duration: 420, type: "timing" }}
                >
                  <InvestmentProfileCard
                    financialKnowledge={financialKnowledge}
                    investmentHorizon={investmentHorizon}
                    portfolioType={portfolioType}
                    riskExpertise={riskExpertise}
                  />
                </MotiView>

                <MotiView
                  animate={{ opacity: 1, translateY: 0 }}
                  from={{ opacity: 0, translateY: 16 }}
                  transition={{ delay: 180, duration: 420, type: "timing" }}
                >
                  <View
                    className="mt-8 flex-row items-end justify-between border-b pb-4"
                    style={{ borderColor: BORDER }}
                  >
                    <View>
                      <Text className="font-sans text-[18px] font-semibold text-[#0F1728]">
                        Portfolio
                      </Text>
                      <Text className="mt-1 font-sans text-[15px] text-[#7A8699]">
                        {enrichedHoldings.length} holdings
                      </Text>
                    </View>
                    {showPortfolioSkeleton ? (
                      <View className="h-8 w-32 rounded-full bg-[#EEF2F7]" />
                    ) : (
                      <Text className="font-sans text-[29px] font-semibold text-[#0F1728] tracking-[-0.7px]">
                        {money(totalValueUsd)}
                      </Text>
                    )}
                  </View>
                </MotiView>

                <MotiView
                  animate={{ opacity: 1, translateY: 0 }}
                  from={{ opacity: 0, translateY: 16 }}
                  transition={{ delay: 220, duration: 420, type: "timing" }}
                >
                  <PortfolioGrowthChart history={growthHistory} snapshot={portfolioSnapshot} />
                </MotiView>

                <MotiView
                  animate={{ opacity: 1, translateY: 0 }}
                  from={{ opacity: 0, translateY: 16 }}
                  transition={{ delay: 280, duration: 420, type: "timing" }}
                >
                  <View className="mt-1">
                    {showPortfolioSkeleton
                      ? [0, 1, 2].map((item) => <HoldingRowSkeleton key={item} />)
                      : enrichedHoldings.map((holding) => (
                          <HoldingRow
                            key={holding.ticker}
                            name={holding.name}
                            logoUri={holding.logoUri}
                            ticker={holding.ticker}
                            value={money(holding.valueUsd)}
                            allocationPercent={
                              (holding.valueUsd / Math.max(totalValueUsd, 1)) * 100
                            }
                            changePercent={holding.changePercent}
                            onPress={() => router.push(`/holding/${holding.ticker}`)}
                          />
                        ))}
                  </View>
                </MotiView>
              </View>
            </View>
          </MotiView>
        </ScrollView>

        <Animated.View
          className="absolute inset-x-0 bottom-0"
          style={[
            $teamSheetShadow,
            {
              height: sheetHeight,
            },
          ]}
        >
          <View
            className="flex-1 rounded-t-[40px] border bg-[#F6F8FF] px-4 pb-8 pt-2"
            style={{ borderColor: BORDER }}
          >
            <View {...headerPanResponder.panHandlers}>
              <Pressable className="items-center pb-3" onPress={() => snapTo(!isTeamExpanded)}>
                <View className="h-1.5 w-14 rounded-full bg-[#D6DDEA]" />
              </Pressable>

              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-4">
                  <Text className="font-sans text-[22px] font-semibold text-[#0F1728]">
                    Your Team
                  </Text>
                  {isTeamExpanded ? (
                    <Text className="mt-1 font-sans text-[14px] leading-5 text-[#7A8699]">
                      Live coverage from each specialist, with faster scanning across updates.
                    </Text>
                  ) : (
                    <StackedAgentAvatars agents={teamPreviewAgents} />
                  )}
                </View>
                <View className="items-end">
                  <Text className="pt-1 font-sans text-[14px] font-medium text-[#7A8699]">
                    4 online
                  </Text>
                  <Pressable className="mt-2" onPress={() => snapTo(!isTeamExpanded)}>
                    <Text className="font-sans text-[13px] font-medium text-[#2453FF]">
                      {isTeamExpanded ? "View less" : "View full"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {isTeamExpanded ? (
              <View className="mt-5 min-h-0 flex-1">
                <ScrollView
                  bounces
                  className="flex-1"
                  contentContainerStyle={$teamContent}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                >
                  {teamAgents.map((agent) => (
                    <AgentCard
                      key={agent.id}
                      agent={agent}
                      recentMessage={
                        latestAgentMessages[agent.name] ?? "Monitoring the market now."
                      }
                      onPress={() => router.push(`/agent/${agent.id}`)}
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  )
}

function HoldingRowSkeleton() {
  return (
    <View className="border-b border-[#EEF2F7] py-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <View className="h-10 w-10 rounded-full bg-[#EEF2F7]" />
          <View className="ml-3 gap-2">
            <View className="h-5 w-16 rounded-full bg-[#EEF2F7]" />
            <View className="h-4 w-24 rounded-full bg-[#EEF2F7]" />
          </View>
        </View>
        <View className="items-end gap-2">
          <View className="h-5 w-20 rounded-full bg-[#EEF2F7]" />
          <View className="h-4 w-14 rounded-full bg-[#EEF2F7]" />
        </View>
      </View>
    </View>
  )
}

function InvestmentProfileCard({
  financialKnowledge,
  investmentHorizon,
  portfolioType,
  riskExpertise,
}: {
  financialKnowledge: ReturnType<typeof useOnboardingStore.getState>["financialKnowledge"]
  investmentHorizon: ReturnType<typeof useOnboardingStore.getState>["investmentHorizon"]
  portfolioType: ReturnType<typeof useOnboardingStore.getState>["portfolioType"]
  riskExpertise: ReturnType<typeof useOnboardingStore.getState>["riskExpertise"]
}) {
  return (
    <View
      className="mt-6 rounded-[28px] border bg-[#F7FAFF] px-4 py-4"
      style={{ borderColor: BORDER }}
    >
      <View className="flex-row items-center justify-between">
        <Text className="font-sans text-[17px] font-semibold text-[#0F1728]">
          Investment profile
        </Text>
        <View className="rounded-full bg-[#EAF1FF] px-3 py-1.5">
          <Text className="font-sans text-[12px] font-medium text-[#2453FF]">
            {profileTypeLabel(portfolioType)}
          </Text>
        </View>
      </View>

      <View className="mt-4 flex-row flex-wrap">
        <ProfilePill label="Risk" value={riskLabel(riskExpertise)} />
        <ProfilePill label="Horizon" value={horizonLabel(investmentHorizon)} />
        <ProfilePill label="Knowledge" value={knowledgeLabel(financialKnowledge)} />
      </View>
    </View>
  )
}

function PortfolioGrowthChart({
  history,
  snapshot,
}: {
  history: ReturnType<typeof usePortfolioGrowthHistory>
  snapshot: {
    totalValueUsd: number
    dailyPnlUsd: number
    monthlyPnlPercent: number
  }
}) {
  const chartValues = useMemo(() => {
    if (history.hasLiveHistory && history.points.length > 1) {
      return history.points.map((point) => point.value)
    }
    return createFallbackPortfolioSeries(snapshot.totalValueUsd)
  }, [history.hasLiveHistory, history.points, snapshot.totalValueUsd])
  const points = useMemo(() => createChartPoints(chartValues, 272, 112), [chartValues])
  const lastPoint = points[points.length - 1]
  const latestValue = chartValues[chartValues.length - 1] ?? snapshot.totalValueUsd
  const monthlyChange = history.hasLiveHistory
    ? history.monthlyChangePercent
    : snapshot.monthlyPnlPercent
  const todayDelta = history.hasLiveHistory ? history.todayChangeUsd : snapshot.dailyPnlUsd

  return (
    <View
      className="mt-5 rounded-[30px] border bg-[#F7FAFF] px-4 py-4"
      style={{ borderColor: BORDER }}
    >
      <View className="flex-row items-start justify-between">
        <View>
          <Text className="font-sans text-[17px] font-semibold text-[#0F1728]">
            Portfolio growth
          </Text>
          <Text className="mt-1 font-sans text-[14px] text-[#7A8699]">Last 30 days</Text>
        </View>
        <View className="items-end">
          <Text
            className={`font-sans text-[16px] font-semibold ${monthlyChange >= 0 ? "text-[#22B45A]" : "text-[#F04438]"}`}
          >
            {monthlyChange >= 0 ? "+" : ""}
            {monthlyChange.toFixed(2)}%
          </Text>
          <Text className="mt-1 font-sans text-[13px] text-[#7A8699]">
            {todayDelta >= 0 ? "+" : "-"}
            {money(Math.abs(todayDelta))} today
          </Text>
        </View>
      </View>

      <View className="mt-4 h-[128px] overflow-hidden rounded-[24px] bg-white px-3 py-3">
        <View className="absolute inset-x-3 top-4 h-px bg-[#EEF2F7]" />
        <View className="absolute inset-x-3 top-[44px] h-px bg-[#EEF2F7]" />
        <View className="absolute inset-x-3 top-[84px] h-px bg-[#EEF2F7]" />

        <View className="h-full">
          {points.slice(0, -1).map((point, index) => (
            <View
              key={`segment-${point.x}`}
              className="absolute left-0 top-0 rounded-full bg-[#2453FF]"
              style={segmentStyle(point, points[index + 1])}
            />
          ))}

          {points.map((point, index) => (
            <View
              key={`point-${point.x}`}
              className={`absolute rounded-full border-2 border-white ${index === points.length - 1 ? "h-4 w-4 bg-[#91FF66]" : "h-3 w-3 bg-[#2453FF]"}`}
              style={{
                left: point.x - (index === points.length - 1 ? 8 : 6),
                top: point.y - (index === points.length - 1 ? 8 : 6),
              }}
            />
          ))}

          <View
            className="absolute rounded-[18px] bg-[#0F1728] px-2.5 py-1"
            style={{ left: Math.max(lastPoint.x - 58, 8), top: Math.max(lastPoint.y - 44, 0) }}
          >
            <Text className="font-sans text-[11px] font-medium text-white">
              {money(latestValue)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}

function ProfilePill({ label, value }: { label: string; value: string }) {
  return (
    <View className="mb-2 mr-2 rounded-[20px] bg-white px-3 py-2">
      <Text className="font-sans text-[11px] font-medium uppercase tracking-[0.8px] text-[#7A8699]">
        {label}
      </Text>
      <Text className="mt-1 font-sans text-[14px] font-semibold text-[#0F1728]">{value}</Text>
    </View>
  )
}

function AgentCard({
  agent,
  recentMessage,
  onPress,
}: {
  agent: (typeof teamAgents)[number]
  recentMessage: string
  onPress: () => void
}) {
  const avatar = getRandomAgentAvatar(agent.id)

  return (
    <Pressable
      className="mb-3 rounded-[24px] border bg-white px-4 py-4"
      style={{ borderColor: BORDER }}
      onPress={onPress}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 flex-row items-center pr-3">
          <View
            className="h-12 w-12 items-center justify-center rounded-full"
            style={{ backgroundColor: avatar.palette.background }}
          >
            <Image
              source={avatar.image}
              style={{ width: 48, height: 48, borderRadius: 999 }}
              resizeMode="cover"
            />
          </View>
          <View className="ml-3 flex-1">
            <Text className="font-sans text-[20px] font-semibold text-[#0F1728]">{agent.name}</Text>
            <Text className="mt-0.5 font-sans text-[15px] leading-5 text-[#7A8699]">
              {agent.role}
            </Text>
          </View>
        </View>
        <View className="flex-row items-center rounded-full bg-[#F2F5FB] px-2.5 py-1">
          <View className={`mr-1.5 h-2 w-2 rounded-full ${statusDotClassName(agent.status)}`} />
          <Text className="font-sans text-[11px] font-medium capitalize text-[#5F6B7A]">
            {agent.status}
          </Text>
        </View>
      </View>

      <View className="mt-4 flex-row flex-wrap items-center">
        <View className="mr-2 rounded-full bg-[#F7F9FD] px-2.5 py-1">
          <Text className="font-sans text-[12px] font-medium text-[#5F6B7A]">
            {agent.specialty}
          </Text>
        </View>
        <Text className="mt-1 font-sans text-[13px] text-[#7A8699]">{agent.lastUpdate}</Text>
      </View>

      <View className="mt-4 rounded-[20px] rounded-tl-[8px] bg-[#F4F7FC] px-4 py-4">
        <Text className="font-sans text-[15px] leading-7 text-[#445065]" numberOfLines={3}>
          {recentMessage}
        </Text>
      </View>

      <Text className="mt-4 font-sans text-[13px] leading-5 text-[#6B7586]">{agent.coverage}</Text>
    </Pressable>
  )
}

function StackedAgentAvatars({ agents }: { agents: (typeof teamAgents)[number][] }) {
  return (
    <View className="mt-4 flex-row items-center">
      {agents.map((agent, index) => {
        const avatar = getRandomAgentAvatar(agent.id)

        return (
          <View
            key={agent.id}
            className={`h-11 w-11 items-center justify-center rounded-full border-2 border-[#F6F8FF] ${index === 0 ? "" : "-ml-3"}`}
            style={{ backgroundColor: avatar.palette.background, zIndex: agents.length - index }}
          >
            <Image
              source={avatar.image}
              style={{ width: 44, height: 44, borderRadius: 999 }}
              resizeMode="cover"
            />
          </View>
        )
      })}
    </View>
  )
}

function statusDotClassName(status: (typeof teamAgents)[number]["status"]) {
  switch (status) {
    case "active":
      return "bg-[#2AB95A]"
    case "monitoring":
      return "bg-[#F58A24]"
    default:
      return "bg-[#9CA3AF]"
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function horizonLabel(value: "short" | "medium" | "long") {
  switch (value) {
    case "short":
      return "Short term"
    case "medium":
      return "Mid term"
    default:
      return "Long term"
  }
}

function knowledgeLabel(value: "novice" | "savvy" | "pro") {
  switch (value) {
    case "novice":
      return "Beginner"
    case "savvy":
      return "Intermediate"
    default:
      return "Advanced"
  }
}

function riskLabel(value: "beginner" | "intermediate" | "expert") {
  switch (value) {
    case "beginner":
      return "Low"
    case "intermediate":
      return "Mid"
    default:
      return "High"
  }
}

function profileTypeLabel(value: "crypto" | "stock" | null) {
  switch (value) {
    case "crypto":
      return "Crypto investor"
    case "stock":
      return "Stock investor"
    default:
      return "Profile set"
  }
}

function createChartPoints(values: readonly number[], width: number, height: number) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(max - min, 1)

  return values.map((value, index) => ({
    x: (index / (values.length - 1)) * width,
    y: height - ((value - min) / range) * height,
  }))
}

function createFallbackPortfolioSeries(latestValue: number) {
  const min = Math.min(...PORTFOLIO_GROWTH_POINTS)
  const max = Math.max(...PORTFOLIO_GROWTH_POINTS)
  const range = Math.max(max - min, 1)
  const startValue = latestValue * 0.88
  const valueRange = latestValue - startValue

  return PORTFOLIO_GROWTH_POINTS.map((point) => {
    const normalized = (point - min) / range
    return startValue + normalized * valueRange
  })
}

function segmentStyle(start: { x: number; y: number }, end: { x: number; y: number }) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.sqrt(dx * dx + dy * dy)
  const angle = `${(Math.atan2(dy, dx) * 180) / Math.PI}deg`
  const midpointX = (start.x + end.x) / 2
  const midpointY = (start.y + end.y) / 2

  return {
    height: 4,
    left: midpointX - length / 2,
    top: midpointY - 2,
    transform: [{ rotate: angle }],
    width: length,
  }
}

const $scrollContent = {
  paddingBottom: 220,
  paddingHorizontal: 14,
  paddingTop: 10,
}

const $teamContent = {
  paddingBottom: 120,
}

const $teamSheetShadow = {
  shadowColor: "#0F1728",
  shadowOffset: { width: 0, height: -10 },
  shadowOpacity: 0.14,
  shadowRadius: 24,
  elevation: 20,
}
