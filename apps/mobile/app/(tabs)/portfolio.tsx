/* eslint-disable no-restricted-imports */
import { useMemo, useState } from "react"
import { Pressable, ScrollView, Text, View } from "react-native"
import { useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"

import { IosHeader } from "@/components/IosHeader"
import { TickerLogo } from "@/components/TickerLogo"
import { useMarketData } from "@/services/marketData"
import { useAgentBoardStore } from "@/stores/agentBoardStore"
import { useSelectedPortfolioData } from "@/utils/selectedPortfolio"
import { getTickerLogoUri } from "@/utils/tickerLogo"

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

const sortLabels = {
  value: "Value",
  alphabet: "Alphabet",
  holdings: "Holdings",
} as const

type HoldingsSort = keyof typeof sortLabels
type AssetTab = "assets" | "watchlist"

export default function PortfolioTab() {
  const router = useRouter()
  const [assetTab, setAssetTab] = useState<AssetTab>("assets")
  const [sortBy, setSortBy] = useState<HoldingsSort>("value")
  const { holdings, snapshot: portfolioSnapshot } = useSelectedPortfolioData()
  const boardThreads = useAgentBoardStore((state) => state.threads)
  const { quotes, isLoading, hasLiveQuotes } = useMarketData(
    holdings.map((holding) => holding.ticker),
  )
  const showPortfolioSkeleton = false
  const enrichedHoldings = useMemo(() => holdings.map((holding) => ({ ...holding })), [holdings])
  const totalValueUsd = useMemo(
    () => enrichedHoldings.reduce((sum, holding) => sum + holding.valueUsd, 0),
    [enrichedHoldings],
  )
  const previousValueUsd = useMemo(
    () =>
      enrichedHoldings.reduce((sum, holding) => {
        if (holding.changePercent <= -100) return sum + holding.valueUsd
        return sum + holding.valueUsd / (1 + holding.changePercent / 100)
      }, 0),
    [enrichedHoldings],
  )
  const dailyChangePct = useMemo(() => {
    if (!previousValueUsd) return portfolioSnapshot.dailyPnlPercent
    return ((totalValueUsd - previousValueUsd) / previousValueUsd) * 100
  }, [portfolioSnapshot.dailyPnlPercent, previousValueUsd, totalValueUsd])
  const dailyPnlUsd = useMemo(
    () => totalValueUsd - previousValueUsd,
    [previousValueUsd, totalValueUsd],
  )
  const totalPnlUsd = useMemo(
    () => totalValueUsd - portfolioSnapshot.investedUsd,
    [portfolioSnapshot.investedUsd, totalValueUsd],
  )
  const totalPnlPct = useMemo(() => {
    if (!portfolioSnapshot.investedUsd) return 0
    return (totalPnlUsd / portfolioSnapshot.investedUsd) * 100
  }, [portfolioSnapshot.investedUsd, totalPnlUsd])
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

  return (
    <SafeAreaView className="flex-1 bg-[#FBFCFF]">
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

          <View className="rounded-[30px] border border-[#EEF2F7] bg-white p-5">
            <Text className="font-sans text-[13px] font-semibold tracking-[1.2px] text-[#7A8699]">
              PROFIT / LOSS
            </Text>
            <Text
              className={`mt-2 font-sans text-[40px] font-semibold leading-[44px] tracking-[-0.8px] ${
                totalPnlUsd >= 0 ? "text-[#22B45A]" : "text-[#F04438]"
              }`}
            >
              {showPortfolioSkeleton ? " " : signedMoney(totalPnlUsd)}
            </Text>
            {showPortfolioSkeleton ? <SkeletonBlock className="mt-2 h-10 w-40" /> : null}

            <View className="mt-3 flex-row items-center gap-2">
              {showPortfolioSkeleton ? (
                <SkeletonBlock className="h-6 flex-1" />
              ) : (
                <Text
                  className={`flex-1 font-sans text-[18px] font-semibold ${
                    totalPnlUsd >= 0 ? "text-[#22B45A]" : "text-[#F04438]"
                  }`}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                  numberOfLines={1}
                >
                  {signedMoney(totalPnlUsd)} ({signedPct(totalPnlPct)})
                </Text>
              )}
              <Text
                className="font-sans text-[18px] font-semibold text-[#0F1728]"
                adjustsFontSizeToFit
                minimumFontScale={0.85}
                numberOfLines={1}
              >
                Total Gain/Loss
              </Text>
            </View>

            <View className="mt-2 flex-row items-center gap-2">
              {showPortfolioSkeleton ? (
                <SkeletonBlock className="h-6 flex-1" />
              ) : (
                <Text
                  className={`flex-1 font-sans text-[18px] font-semibold ${
                    dailyPnlUsd >= 0 ? "text-[#22B45A]" : "text-[#F04438]"
                  }`}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                  numberOfLines={1}
                >
                  {signedMoney(dailyPnlUsd)} ({signedPct(dailyChangePct)})
                </Text>
              )}
              <Text
                className="font-sans text-[18px] font-semibold text-[#0F1728]"
                adjustsFontSizeToFit
                minimumFontScale={0.85}
                numberOfLines={1}
              >
                Day&apos;s Gain/Loss
              </Text>
            </View>

            <View className="mt-5 flex-row gap-2">
              <Tag label={`${enrichedHoldings.length} assets`} />
              <Tag label={`${money(portfolioSnapshot.cashUsd)} cash`} />
              <Tag
                label={
                  isLoading
                    ? "Loading quotes..."
                    : hasLiveQuotes
                      ? "Live quotes"
                      : "Using fallback quotes"
                }
              />
            </View>
          </View>

          <View className="mt-4 rounded-[30px] border border-[#EEF2F7] bg-white p-4">
            <View className="flex-row items-center justify-between">
              <Text className="font-sans text-[24px] font-semibold text-[#0F1728]">
                {assetTab === "assets" ? "Assets" : "Watchlist"}
              </Text>
              {assetTab === "assets" ? (
                <Text className="font-sans text-[14px] text-[#7A8699]">
                  Sorted by {sortLabels[sortBy].toLowerCase()}
                </Text>
              ) : (
                <Text className="font-sans text-[14px] text-[#7A8699]">
                  Sorted by latest board update
                </Text>
              )}
            </View>

            {assetTab === "assets" ? (
              <>
                <View className="mt-4 flex-row flex-wrap gap-2">
                  {(Object.entries(sortLabels) as [HoldingsSort, string][]).map(([key, label]) => {
                    const isActive = key === sortBy

                    return (
                      <Pressable
                        key={key}
                        className={`rounded-full border px-4 py-2 ${
                          isActive
                            ? "border-[#2453FF] bg-[#2453FF]"
                            : "border-[#E6EAF2] bg-[#F6F8FF]"
                        }`}
                        onPress={() => setSortBy(key)}
                      >
                        <Text
                          className={`font-sans text-[13px] ${isActive ? "text-white" : "text-[#6B7586]"}`}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>

                {showPortfolioSkeleton ? (
                  <HoldingsSkeleton />
                ) : (
                  sortedHoldings.map((holding) => (
                    <Pressable
                      key={holding.ticker}
                      className="border-b border-[#EEF2F7] py-4 last:border-b-0"
                      onPress={() => router.push(`/holding/${holding.ticker}`)}
                    >
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center">
                          <TickerLogo ticker={holding.ticker} logoUri={holding.logoUri} />
                          <View className="ml-3">
                            <Text className="font-sans text-[20px] font-semibold text-[#0F1728]">
                              {holding.ticker}
                            </Text>
                            <Text className="font-sans text-[15px] text-[#7A8699]">
                              {holding.name}
                            </Text>
                          </View>
                        </View>
                        <View className="items-end">
                          <Text className="font-sans text-[20px] font-semibold text-[#0F1728]">
                            {money(holding.valueUsd)}
                          </Text>
                          <Text
                            className={`font-sans text-[15px] ${holding.totalGainUsd >= 0 ? "text-[#22B45A]" : "text-[#F04438]"}`}
                          >
                            {signedMoney(holding.totalGainUsd)}
                          </Text>
                        </View>
                      </View>
                      <View className="mt-2 flex-row items-center justify-between">
                        <Text className="font-sans text-[13px] text-[#7A8699]">
                          {holding.shares} shares
                        </Text>
                        <View className="flex-row items-center">
                          <Text className="font-sans text-[13px] text-[#7A8699]">
                            Allocation {holding.allocationPercent}%
                          </Text>
                          <Text className="ml-2 font-sans text-[13px] text-[#2453FF]">
                            View board
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  ))
                )}
              </>
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
                  className="border-b border-[#EEF2F7] py-4 last:border-b-0"
                  onPress={() => router.push(`/thread/${item.id}`)}
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
                    <Text className="ml-2 font-sans text-[13px] text-[#2453FF]">View board</Text>
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

function Tag({ label }: { label: string }) {
  return (
    <View className="rounded-full bg-[#F3F6FC] px-3 py-1.5">
      <Text className="font-sans text-[11px] text-[#6B7586]">{label}</Text>
    </View>
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
        active ? "border-[#2453FF] bg-[#2453FF]" : "border-[#E6EAF2] bg-white"
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

function HoldingsSkeleton() {
  return (
    <View className="mt-2">
      {[0, 1, 2].map((item) => (
        <View key={item} className="border-b border-[#EEF2F7] py-4 last:border-b-0">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="h-10 w-10 rounded-full bg-[#EEF2F7]" />
              <View className="ml-3 gap-2">
                <SkeletonBlock className="h-5 w-16" />
                <SkeletonBlock className="h-4 w-24" />
              </View>
            </View>
            <View className="items-end gap-2">
              <SkeletonBlock className="h-5 w-20" />
              <SkeletonBlock className="h-4 w-14" />
            </View>
          </View>
          <View className="mt-2 flex-row items-center justify-between">
            <SkeletonBlock className="h-4 w-20" />
            <SkeletonBlock className="h-4 w-28" />
          </View>
        </View>
      ))}
    </View>
  )
}

const $scrollContent = {
  paddingBottom: 120,
}
