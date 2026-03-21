/* eslint-disable no-restricted-imports */
import { useMemo, useState } from "react"
import { Pressable, ScrollView, Text, View } from "react-native"
import { useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"

import { IosHeader } from "@/components/IosHeader"
import { TickerLogo } from "@/components/TickerLogo"
import { useMarketData } from "@/services/marketData"
import { useSelectedPortfolioData } from "@/utils/selectedPortfolio"

const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)

const sortLabels = {
  value: "Value",
  alphabet: "Alphabet",
  holdings: "Holdings",
} as const

type HoldingsSort = keyof typeof sortLabels

export default function PortfolioTab() {
  const router = useRouter()
  const [sortBy, setSortBy] = useState<HoldingsSort>("value")
  const { holdings, snapshot: portfolioSnapshot } = useSelectedPortfolioData()
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
    [holdings, quotes],
  )
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

  return (
    <SafeAreaView className="flex-1 bg-[#FBFCFF]">
      <ScrollView className="flex-1" contentContainerStyle={$scrollContent}>
        <IosHeader title="Portfolio" titleClassName="text-[20px] leading-[24px]" />

        <View className="px-4">
          <View className="rounded-[30px] border border-[#EEF2F7] bg-white p-5">
            <Text className="font-sans text-[13px] font-semibold tracking-[1.2px] text-[#7A8699]">
              TOTAL VALUE
            </Text>
            <Text className="mt-2 font-sans text-[34px] font-semibold leading-[40px] tracking-[-0.8px] text-[#0F1728]">
              {money(totalValueUsd)}
            </Text>
            <View className="mt-2 flex-row items-center justify-between">
              <Text className="font-sans text-[17px] font-semibold text-[#22B45A]">
                {dailyChangePct >= 0 ? "+" : ""}
                {dailyChangePct.toFixed(2)}% today
              </Text>
              <Text className="font-sans text-[15px] text-[#7A8699]">
                Invested {money(portfolioSnapshot.investedUsd)}
              </Text>
            </View>

            <View className="mt-5 flex-row gap-2">
              <Tag label={`${enrichedHoldings.length} holdings`} />
              <Tag label={`${money(portfolioSnapshot.cashUsd)} cash`} />
              <Tag label="Live quotes" />
            </View>
          </View>

          <View className="mt-4 rounded-[30px] border border-[#EEF2F7] bg-white p-4">
            <View className="flex-row items-center justify-between">
              <Text className="font-sans text-[24px] font-semibold text-[#0F1728]">Holdings</Text>
              <Text className="font-sans text-[14px] text-[#7A8699]">
                Sorted by {sortLabels[sortBy].toLowerCase()}
              </Text>
            </View>

            <View className="mt-4 flex-row flex-wrap gap-2">
              {(Object.entries(sortLabels) as [HoldingsSort, string][]).map(([key, label]) => {
                const isActive = key === sortBy

                return (
                  <Pressable
                    key={key}
                    className={`rounded-full border px-4 py-2 ${
                      isActive ? "border-[#2453FF] bg-[#2453FF]" : "border-[#E6EAF2] bg-[#F6F8FF]"
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

            {sortedHoldings.map((holding) => (
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
                      <Text className="font-sans text-[15px] text-[#7A8699]">{holding.name}</Text>
                    </View>
                  </View>
                  <View className="items-end">
                    <Text className="font-sans text-[20px] font-semibold text-[#0F1728]">
                      {money(holding.valueUsd)}
                    </Text>
                    <Text
                      className={`font-sans text-[15px] ${holding.changePercent >= 0 ? "text-[#22B45A]" : "text-[#F04438]"}`}
                    >
                      {holding.changePercent >= 0 ? "+" : ""}
                      {holding.changePercent}%
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
                    <Text className="ml-2 font-sans text-[13px] text-[#2453FF]">View board</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function Tag({ label }: { label: string }) {
  return (
    <View className="rounded-full bg-[#F3F6FC] px-3 py-2">
      <Text className="font-sans text-[13px] text-[#6B7586]">{label}</Text>
    </View>
  )
}

const $scrollContent = {
  paddingBottom: 120,
}
