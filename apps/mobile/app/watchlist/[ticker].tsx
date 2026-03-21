/* eslint-disable no-restricted-imports */
import { Pressable, ScrollView, Text, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"

import { IosHeader } from "@/components/IosHeader"
import { TickerLogo } from "@/components/TickerLogo"
import { useMarketData } from "@/services/marketData"
import { useAgentBoardStore } from "@/stores/agentBoardStore"
import { useSelectedPortfolioData } from "@/utils/selectedPortfolio"
import { getTickerLogoUri } from "@/utils/tickerLogo"

export default function WatchlistTickerRoute() {
  const router = useRouter()
  const { ticker } = useLocalSearchParams<{ ticker: string }>()
  const normalizedTicker = (ticker ?? "").trim().toUpperCase()
  const threads = useAgentBoardStore((state) => state.threads)
  const { holdings } = useSelectedPortfolioData()
  const { quotes } = useMarketData(normalizedTicker ? [normalizedTicker] : [])
  const isHeldTicker = holdings.some((holding) => holding.ticker.trim().toUpperCase() === normalizedTicker)
  const latestThread = threads
    .filter((thread) => thread.ticker.trim().toUpperCase() === normalizedTicker)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]
  const liveQuote = quotes[normalizedTicker]

  if (!normalizedTicker) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
        <Text className="font-sans text-[28px] font-semibold text-[#0F1728]">Ticker not found</Text>
        <Pressable className="mt-4 rounded-full bg-[#2453FF] px-5 py-3" onPress={() => router.back()}>
          <Text className="font-sans text-[17px] font-semibold text-white">Go back</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-[#FBFCFF]">
      <ScrollView className="flex-1" contentContainerStyle={$content}>
        <IosHeader
          title={normalizedTicker}
          leftLabel="‹"
          rightLabel={liveQuote ? formatUsd(liveQuote.price) : "--"}
          onLeftPress={() => router.back()}
          titleClassName="text-[20px] leading-[24px]"
        />

        <View className="px-4">
          <View className="rounded-[30px] border border-[#EEF2F7] bg-white p-5">
            <View className="flex-row items-center">
              <TickerLogo ticker={normalizedTicker} logoUri={getTickerLogoUri(normalizedTicker)} />
              <View className="ml-3 flex-1">
                <Text className="font-sans text-[28px] font-semibold text-[#0F1728]">
                  {normalizedTicker}
                </Text>
                <Text className="font-sans text-[15px] text-[#7A8699]">Watchlist ticker</Text>
              </View>
              <View className="items-end">
                <Text className="font-sans text-[16px] font-semibold text-[#0F1728]">
                  {liveQuote ? formatUsd(liveQuote.price) : "--"}
                </Text>
                <Text
                  className={`mt-1 font-sans text-[14px] ${
                    !liveQuote
                      ? "text-[#7A8699]"
                      : liveQuote.change_pct >= 0
                        ? "text-[#1F8A4C]"
                        : "text-[#D64545]"
                  }`}
                >
                  {!liveQuote
                    ? "No live quote"
                    : `${liveQuote.change_pct >= 0 ? "+" : ""}${liveQuote.change_pct.toFixed(2)}%`}
                </Text>
              </View>
            </View>

            {latestThread ? (
              <View className="mt-5 rounded-[24px] bg-[#F7F9FC] p-4">
                <Text className="font-sans text-[14px] font-semibold tracking-[1.1px] text-[#7A8699]">
                  LATEST BOARD SUMMARY
                </Text>
                <Text className="mt-2 font-sans text-[17px] font-semibold text-[#0F1728]">
                  {latestThread.title}
                </Text>
                <Text className="mt-1 font-sans text-[14px] leading-6 text-[#607089]">
                  {latestThread.summary || latestThread.intake}
                </Text>
                <Pressable
                  className="mt-3 self-start rounded-full bg-[#2453FF] px-4 py-2"
                  onPress={() => router.push(`/thread/${latestThread.id}`)}
                >
                  <Text className="font-sans text-[13px] font-semibold text-white">
                    Open board thread
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View className="mt-5 rounded-[24px] bg-[#F7F9FC] p-4">
                <Text className="font-sans text-[14px] text-[#607089]">
                  No board thread yet for this ticker.
                </Text>
              </View>
            )}

            {isHeldTicker ? (
              <Pressable
                className="mt-4 self-start rounded-full border border-[#DCE6FF] bg-[#F4F7FF] px-4 py-2"
                onPress={() => router.push(`/holding/${normalizedTicker}`)}
              >
                <Text className="font-sans text-[13px] font-semibold text-[#2453FF]">
                  Open holding details
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function formatUsd(value: number) {
  return `$${value.toFixed(2)}`
}

const $content = {
  paddingBottom: 32,
}
