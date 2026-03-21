/* eslint-disable react-native/no-inline-styles */
/* eslint-disable react-native/no-color-literals */
/* eslint-disable no-restricted-imports */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Animated,
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

import { TickerLogo } from "@/components/TickerLogo"
import { useMarketData } from "@/services/marketData"
import { useOnboardingStore } from "@/stores/onboardingStore"
import { getRandomAgentAvatar } from "@/utils/agentAvatars"
import { boardMessages, holdings, portfolioSnapshot, teamAgents } from "@/utils/mockAppData"

const avatarEmojis = ["😀", "😎", "🥳", "🦄", "🌈", "🚀", "🧠", "🐼", "🍀", "🎯"] as const
const BORDER = "#EEF2F7"
const COLLAPSED_VISIBLE_HEIGHT = 228
const SNAP_THRESHOLD = 96

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
  const investorName = useOnboardingStore((state) => state.name).trim() || "finlyinvestor"
  const avatarEmoji = useMemo(
    () => avatarEmojis[Math.floor(Math.random() * avatarEmojis.length)],
    [],
  )
  const { quotes } = useMarketData(holdings.map((holding) => holding.ticker))
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
    [quotes],
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
                    {investorName.toLowerCase()}.finly
                  </Text>
                  <Text className="mt-1 font-sans text-center text-[16px] text-[#7A8699]">
                    Rainbow-style investing, guided by your AI board
                  </Text>
                </View>

                <MotiView
                  animate={{ opacity: 1, translateY: 0 }}
                  from={{ opacity: 0, translateY: 16 }}
                  transition={{ delay: 140, duration: 420, type: "timing" }}
                >
                  <View
                    className="mt-8 flex-row items-end justify-between border-b pb-4"
                    style={{ borderColor: BORDER }}
                  >
                    <View>
                      <Text className="font-sans text-[18px] font-semibold text-[#0F1728]">
                        Tokens
                      </Text>
                      <Text className="mt-1 font-sans text-[15px] text-[#7A8699]">
                        {enrichedHoldings.length} holdings
                      </Text>
                    </View>
                    <Text className="font-sans text-[29px] font-semibold text-[#0F1728] tracking-[-0.7px]">
                      {money(totalValueUsd || portfolioSnapshot.totalValueUsd)}
                    </Text>
                  </View>
                </MotiView>

                <MotiView
                  animate={{ opacity: 1, translateY: 0 }}
                  from={{ opacity: 0, translateY: 16 }}
                  transition={{ delay: 220, duration: 420, type: "timing" }}
                >
                  <View className="mt-1">
                    {enrichedHoldings.map((holding) => (
                      <HoldingRow
                        key={holding.ticker}
                        name={holding.name}
                        logoUri={holding.logoUri}
                        ticker={holding.ticker}
                        value={money(holding.valueUsd)}
                        changePercent={holding.changePercent}
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
            <Text className="font-sans text-[20px]">{avatar.glyph}</Text>
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
            <Text className="font-sans text-[18px]">{avatar.glyph}</Text>
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

function HoldingRow({
  name,
  logoUri,
  ticker,
  value,
  changePercent,
}: {
  name: string
  logoUri?: string
  ticker: string
  value: string
  changePercent: number
}) {
  return (
    <View
      className="flex-row items-center justify-between border-b py-4 last:border-b-0"
      style={{ borderColor: BORDER }}
    >
      <View className="flex-row items-center">
        <TickerLogo ticker={ticker} logoUri={logoUri} />
        <View className="ml-3">
          <Text className="font-sans text-[18px] font-semibold text-[#0F1728]">{name}</Text>
          <Text className="font-sans text-[15px] text-[#7A8699]">{ticker}</Text>
        </View>
      </View>
      <View className="items-end">
        <Text className="font-sans text-[18px] font-semibold text-[#0F1728]">{value}</Text>
        <Text
          className={`font-sans text-[15px] ${changePercent >= 0 ? "text-[#22B45A]" : "text-[#F04438]"}`}
        >
          {changePercent >= 0 ? "+" : ""}
          {changePercent}%
        </Text>
      </View>
    </View>
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

const $scrollContent = {
  paddingBottom: 430,
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
