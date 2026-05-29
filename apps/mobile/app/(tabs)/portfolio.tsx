/* eslint-disable no-restricted-imports */
import { useMemo, useState } from "react"
import { Pressable, ScrollView, Text, View } from "react-native"
import { useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"

import { HoldingRow } from "@/components/HoldingRow"
import { IosHeader } from "@/components/IosHeader"
import { TickerLogo } from "@/components/TickerLogo"
import { useMarketData } from "@/services/marketData"
import { useAgentBoardStore } from "@/stores/agentBoardStore"
import { uiTokens } from "@/theme/uiTokens"
import { useSelectedPortfolioData } from "@/utils/selectedPortfolio"
import { getTickerLogoUri } from "@/utils/tickerLogo"

const PORTFOLIO_BORDER = uiTokens.border

const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)

const moneyWithCents = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)

const signedMoney = (value: number) => `${value >= 0 ? "+" : "-"}${moneyWithCents(Math.abs(value))}`

const signedPct = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`
const roundToCents = (value: number) => Math.round(value * 100) / 100
const formatLastRefresh = (timestamp: number | null) => {
  if (!timestamp) return "Last refresh unavailable"
  const date = new Date(timestamp)
  const absOffsetMinutes = Math.abs(date.getTimezoneOffset())
  const offsetHours = Math.floor(absOffsetMinutes / 60)
  const offsetMinutes = absOffsetMinutes % 60
  const offsetSign = date.getTimezoneOffset() <= 0 ? "+" : "-"
  const gmtOffset =
    offsetMinutes === 0
      ? `GMT${offsetSign}${offsetHours}`
      : `GMT${offsetSign}${offsetHours}:${offsetMinutes.toString().padStart(2, "0")}`

  const label = date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
  return `Last refresh ${label} ${gmtOffset}`
}

const sortLabels = {
  value: "Value",
  alphabet: "A-Z",
  holdings: "Share Size",
} as const

type HoldingsSort = keyof typeof sortLabels
type AssetTab = "assets" | "watchlist"

export default function PortfolioTab() {
  const router = useRouter()
  const [assetTab, setAssetTab] = useState<AssetTab>("assets")
  const [sortBy, setSortBy] = useState<HoldingsSort>("value")
  const { holdings, snapshot: portfolioSnapshot } = useSelectedPortfolioData()
  const boardThreads = useAgentBoardStore((state) => state.threads)
  const { quotes, lastUpdatedAt } = useMarketData(holdings.map((holding) => holding.ticker))
  const showPortfolioSkeleton = false
  const enrichedHoldings = useMemo(() => {
    const withLiveValues = holdings.map((holding) => {
      const liveQuote = quotes[holding.ticker]
      const valueUsd = liveQuote
        ? roundToCents(liveQuote.price * holding.shares)
        : roundToCents(holding.valueUsd)
      return {
        ...holding,
        valueUsd,
        changePercent: liveQuote?.change_pct ?? holding.changePercent,
      }
    })
    const totalValue = withLiveValues.reduce((sum, holding) => sum + holding.valueUsd, 0)
    if (totalValue <= 0) {
      return withLiveValues.map((holding) => ({ ...holding, allocationPercent: 0 }))
    }

    return withLiveValues.map((holding) => ({
      ...holding,
      allocationPercent: (holding.valueUsd / totalValue) * 100,
    }))
  }, [holdings, quotes])
  const totalValueUsd = useMemo(
    () => enrichedHoldings.reduce((sum, holding) => sum + holding.valueUsd, 0),
    [enrichedHoldings],
  )
  const totalPnlUsd = useMemo(
    () => totalValueUsd - portfolioSnapshot.investedUsd,
    [portfolioSnapshot.investedUsd, totalValueUsd],
  )
  const totalPnlPct = useMemo(() => {
    if (!portfolioSnapshot.investedUsd) return 0
    return (totalPnlUsd / portfolioSnapshot.investedUsd) * 100
  }, [portfolioSnapshot.investedUsd, totalPnlUsd])
  const accountBalanceUsd = useMemo(() => totalValueUsd, [totalValueUsd])
  const totalPnlLabel = totalPnlUsd >= 0 ? "Total Gain" : "Total Loss"
  const sortedHoldings = useMemo(() => {
    const nextHoldings = [...enrichedHoldings]

    switch (sortBy) {
      case "alphabet":
        return nextHoldings.sort((left, right) => left.ticker.localeCompare(right.ticker))
      case "holdings":
        return nextHoldings.sort((left, right) => right.shares - left.shares)
      case "value":
      default:
        return nextHoldings.sort((left, right) => right.valueUsd - left.valueUsd)
    }
  }, [enrichedHoldings, sortBy])
  const watchlistRows = useMemo(() => {
    const heldTickers = new Set(enrichedHoldings.map((holding) => holding.ticker))
    const latestThreadByTicker = new Map<
      string,
      {
        id: string
        ticker: string
        summary: string
        updatedAt: string
      }
    >()

    boardThreads.forEach((thread) => {
      if (thread.ticker === "BOARD" || heldTickers.has(thread.ticker)) return

      const current = latestThreadByTicker.get(thread.ticker)
      const nextTimestamp = new Date(thread.updatedAt).getTime()
      const currentTimestamp = current
        ? new Date(current.updatedAt).getTime()
        : Number.NEGATIVE_INFINITY

      if (!current || nextTimestamp >= currentTimestamp) {
        latestThreadByTicker.set(thread.ticker, {
          id: thread.id,
          ticker: thread.ticker,
          summary: thread.summary || thread.intake || "Board conversation available",
          updatedAt: thread.updatedAt,
        })
      }
    })

    return Array.from(latestThreadByTicker.values())
      .map((item) => {
        const liveQuote = quotes[item.ticker]
        return {
          ...item,
          valueUsd: liveQuote?.price ?? null,
          changePercent: liveQuote?.change_pct ?? null,
        }
      })
      .sort(
        (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
      )
  }, [boardThreads, enrichedHoldings, quotes])
  const handleOpenTickerDetail = (ticker: string) => {
    const normalizedTicker = ticker.trim().toUpperCase()
    router.push(`/holding/${normalizedTicker}`)
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: uiTokens.surfaceBackground }}>
      <ScrollView className="flex-1" contentContainerStyle={$scrollContent}>
        <IosHeader title="Assets" titleClassName="text-[20px] leading-[24px]" />

        <View className="px-4">
          <View className="mb-3 mt-1 flex-row gap-2">
            <SegmentTab
              active={assetTab === "assets"}
              label="Assets"
              onPress={() => setAssetTab("assets")}
            />
            <SegmentTab
              active={assetTab === "watchlist"}
              label="Watchlist"
              onPress={() => setAssetTab("watchlist")}
            />
          </View>

          <View
            className="rounded-[30px] border bg-white p-5"
            style={{ borderColor: PORTFOLIO_BORDER }}
          >
            <View className="mt-2 flex-row items-end">
              <Text className="font-sans text-[40px] font-semibold leading-[44px] tracking-[-0.8px] text-black">
                {moneyWithCents(accountBalanceUsd)}
              </Text>
              <Text className="ml-2 pb-1 font-sans text-[12px] text-[#98A2B3]">
                Initial amount {moneyWithCents(portfolioSnapshot.investedUsd)}
              </Text>
            </View>
            {showPortfolioSkeleton ? <SkeletonBlock className="mt-2 h-10 w-40" /> : null}

            <View className="mt-3 flex-row items-center">
              <Text
                className={`font-sans text-[17px] font-bold ${
                  totalPnlUsd >= 0 ? "text-[#22B45A]" : "text-[#F04438]"
                }`}
              >
                {signedMoney(totalPnlUsd)} ({signedPct(totalPnlPct)})
              </Text>
              <Text className="ml-2 font-sans text-[17px] font-bold text-[#0F1728]">
                {totalPnlLabel}
              </Text>
            </View>
            <Text className="mt-1 font-sans text-[11px] text-[#98A2B3]">
              {formatLastRefresh(lastUpdatedAt)}
            </Text>
          </View>

          <View
            className="mt-4 rounded-[30px] border bg-white p-4"
            style={{ borderColor: PORTFOLIO_BORDER }}
          >
            <View className="flex-row items-center">
              <Text className="font-sans text-[24px] font-semibold text-[#0F1728]">
                {assetTab === "assets" ? "Assets" : "Watchlist"}
              </Text>
            </View>

            {assetTab === "assets" ? (
              sortedHoldings.length === 0 ? (
                <View className="mt-4 rounded-[20px] bg-[#F6F8FF] p-4">
                  <Text className="font-sans text-[16px] font-semibold text-[#0F1728]">
                    No assets yet
                  </Text>
                  <Text className="mt-1 font-sans text-[14px] leading-6 text-[#7A8699]">
                    Your assets will appear here once added.
                  </Text>
                </View>
              ) : (
                <>
                  <View className="mt-4 flex-row gap-2">
                    <SortButton
                      active={sortBy === "value"}
                      label={sortLabels.value}
                      onPress={() => setSortBy("value")}
                    />
                    <SortButton
                      active={sortBy === "alphabet"}
                      label={sortLabels.alphabet}
                      onPress={() => setSortBy("alphabet")}
                    />
                    <SortButton
                      active={sortBy === "holdings"}
                      label={sortLabels.holdings}
                      onPress={() => setSortBy("holdings")}
                    />
                  </View>

                  <View className="mt-2">
                    {sortedHoldings.map((holding) => (
                      <HoldingRow
                        key={holding.ticker}
                        name={holding.name}
                        logoUri={holding.logoUri}
                        ticker={holding.ticker}
                        shares={holding.shares}
                        value={money(holding.valueUsd)}
                        allocationPercent={holding.allocationPercent}
                        changePercent={holding.changePercent}
                        onPress={() => handleOpenTickerDetail(holding.ticker)}
                        borderColor={PORTFOLIO_BORDER}
                      />
                    ))}
                  </View>
                </>
              )
            ) : watchlistRows.length === 0 ? (
              <View className="mt-4 rounded-[20px] bg-[#F6F8FF] p-4">
                <Text className="font-sans text-[16px] font-semibold text-[#0F1728]">
                  No watchlist names yet
                </Text>
                <Text className="mt-1 font-sans text-[14px] leading-6 text-[#7A8699]">
                  Search stocks in Board. New reports for symbols you do not hold will appear here.
                </Text>
              </View>
            ) : (
              watchlistRows.map((item) => (
                <Pressable
                  key={item.ticker}
                  className="border-b py-4 last:border-b-0"
                  style={({ hovered }) => [
                    { borderColor: PORTFOLIO_BORDER },
                    hovered ? $hoverCardOutline : null,
                  ]}
                  onPress={() => router.push(`/watchlist/${item.ticker}`)}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center">
                      <TickerLogo ticker={item.ticker} logoUri={getTickerLogoUri(item.ticker)} />
                      <View className="ml-3">
                        <Text className="font-sans text-[20px] font-semibold text-[#0F1728]">
                          {item.ticker}
                        </Text>
                        <Text className="font-sans text-[15px] text-[#7A8699]">Watchlist</Text>
                      </View>
                    </View>
                    <View className="items-end">
                      <Text className="font-sans text-[20px] font-semibold text-[#0F1728]">
                        {item.valueUsd === null ? "--" : money(item.valueUsd)}
                      </Text>
                      <Text
                        className={`font-sans text-[15px] ${
                          item.changePercent === null
                            ? "text-[#7A8699]"
                            : item.changePercent >= 0
                              ? "text-[#22B45A]"
                              : "text-[#F04438]"
                        }`}
                      >
                        {item.changePercent === null
                          ? "No live quote"
                          : `${item.changePercent >= 0 ? "+" : ""}${item.changePercent}%`}
                      </Text>
                    </View>
                  </View>
                  <View className="mt-2 flex-row items-center justify-between">
                    <Text className="mr-4 flex-1 font-sans text-[13px] text-[#7A8699]">
                      {item.summary}
                    </Text>
                  </View>
                  <Text className="mt-1 font-sans text-[13px] text-[#7A8699]">
                    Added from board thread
                  </Text>
                </Pressable>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function SortButton({
  active,
  label,
  onPress,
}: {
  active: boolean
  label: string
  onPress: () => void
}) {
  return (
    <Pressable
      className={`rounded-full px-4 py-2 border ${
        active ? "bg-black border-black" : "bg-[#F3F6FC] border-[#E6EAF2]"
      }`}
      onPress={onPress}
    >
      <Text
        className={`font-sans text-[14px] font-semibold ${active ? "text-white" : "text-black"}`}
      >
        {label}
      </Text>
    </Pressable>
  )
}

function SegmentTab({
  active,
  label,
  onPress,
}: {
  active: boolean
  label: string
  onPress: () => void
}) {
  return (
    <Pressable
      className={`rounded-full border px-4 py-1.5 ${
        active ? "border-black bg-black" : "border-[#E6EAF2] bg-white"
      }`}
      onPress={onPress}
    >
      <Text
        className={`font-sans text-[12px] font-semibold ${active ? "text-white" : "text-[#6B7586]"}`}
      >
        {label}
      </Text>
    </Pressable>
  )
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <View className={`rounded-full bg-[#EEF2F7] ${className}`} />
}

const $scrollContent = {
  paddingBottom: 120,
}

const $hoverCardOutline = {
  borderWidth: 1,
  borderColor: "#000000",
  borderRadius: 14,
}
