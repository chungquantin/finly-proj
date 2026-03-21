/* eslint-disable no-restricted-imports */
import { Pressable, ScrollView, Text, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"

import { IosHeader } from "@/components/IosHeader"
import { TickerLogo } from "@/components/TickerLogo"
import { boardThreads, holdingDecisions } from "@/utils/mockAppData"
import { useSelectedPortfolioData } from "@/utils/selectedPortfolio"

const decisionColors = {
  Buy: { background: "#E9F7EF", text: "#1F8A4C" },
  Sell: { background: "#FFF1F1", text: "#D64545" },
  Position: { background: "#EEF3FF", text: "#2453FF" },
} as const

export default function HoldingDetailRoute() {
  const router = useRouter()
  const { ticker } = useLocalSearchParams<{ ticker: string }>()
  const { holdings } = useSelectedPortfolioData()
  const holding = holdings.find((item) => item.ticker === ticker)
  const decision =
    holdingDecisions.find((item) => item.ticker === ticker) ??
    (ticker
      ? {
          ticker,
          decision: "Position",
          intake: "Monitor position and wait for stronger signal",
          conviction: "Medium",
          targetPosition: "Maintain current size",
          nextReview: "Next week",
          rationale: [
            "Portfolio-selected holding imported from onboarding.",
            "No dedicated board thesis exists yet for this ticker.",
            "Start a new board thread to generate a full recommendation.",
          ],
          relatedThreadIds: [],
        }
      : null)
  const relatedThreads = boardThreads.filter((thread) =>
    decision?.relatedThreadIds.includes(thread.id),
  )

  if (!holding || !decision) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
        <Text className="font-sans text-[28px] font-semibold text-[#0F1728]">
          Holding not found
        </Text>
        <Pressable
          className="mt-4 rounded-full bg-[#2453FF] px-5 py-3"
          onPress={() => router.back()}
        >
          <Text className="font-sans text-[17px] font-semibold text-white">Go back</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-[#FBFCFF]">
      <ScrollView className="flex-1" contentContainerStyle={$content}>
        <IosHeader
          title={holding.ticker}
          leftLabel="‹"
          rightLabel=""
          onLeftPress={() => router.back()}
          titleClassName="text-[20px] leading-[24px]"
        />

        <View className="px-4">
          <View className="rounded-[30px] border border-[#EEF2F7] bg-white p-5">
            <View className="flex-row items-center">
              <TickerLogo ticker={holding.ticker} logoUri={holding.logoUri} />
              <View className="ml-3 flex-1">
                <Text className="font-sans text-[28px] font-semibold text-[#0F1728]">
                  {holding.name}
                </Text>
                <Text className="font-sans text-[15px] text-[#7A8699]">
                  Allocation {holding.allocationPercent}% · {holding.shares} shares
                </Text>
              </View>
              <View
                className="rounded-full px-3 py-2"
                style={{ backgroundColor: decisionColors[decision.decision].background }}
              >
                <Text
                  className="font-sans text-[13px] font-semibold"
                  style={{ color: decisionColors[decision.decision].text }}
                >
                  {decision.decision}
                </Text>
              </View>
            </View>

            <View className="mt-5 rounded-[24px] bg-[#F7F9FC] p-4">
              <Text className="font-sans text-[14px] font-semibold tracking-[1.1px] text-[#7A8699]">
                BOARD INTAKE
              </Text>
              <Text className="mt-2 font-sans text-[20px] font-semibold text-[#0F1728]">
                {decision.intake}
              </Text>
              <View className="mt-4 flex-row flex-wrap gap-2">
                <Tag label={`Conviction: ${decision.conviction}`} />
                <Tag label={`Target: ${decision.targetPosition}`} />
                <Tag label={`Review: ${decision.nextReview}`} />
              </View>
            </View>

            <View className="mt-5 rounded-[24px] bg-[#FBFBFD] p-4">
              <Text className="font-sans text-[18px] font-semibold text-[#0F1728]">
                Decision rationale
              </Text>
              <View className="mt-4 gap-3">
                {decision.rationale.map((item) => (
                  <View key={item} className="flex-row">
                    <Text className="mr-2 font-sans text-[16px] leading-7 text-[#2453FF]">•</Text>
                    <Text className="flex-1 font-sans text-[15px] leading-7 text-[#425168]">
                      {item}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View className="mt-5 rounded-[24px] bg-[#FBFBFD] p-4">
              <Text className="font-sans text-[18px] font-semibold text-[#0F1728]">
                Related conversation threads
              </Text>
              <View className="mt-4 gap-3">
                {relatedThreads.map((thread) => (
                  <Pressable
                    key={thread.id}
                    className="rounded-[22px] border border-[#EEF2F7] bg-white px-4 py-4"
                    onPress={() => router.push(`/thread/${thread.id}`)}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1 pr-3">
                        <Text className="font-sans text-[17px] font-semibold text-[#0F1728]">
                          {thread.title}
                        </Text>
                        <Text className="mt-1 font-sans text-[14px] text-[#7A8699]">
                          {thread.intake}
                        </Text>
                      </View>
                      <Text className="font-sans text-[13px] text-[#7A8699]">
                        {thread.updatedAt}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function Tag({ label }: { label: string }) {
  return (
    <View className="rounded-full bg-[#F3F6FC] px-3 py-2">
      <Text className="font-sans text-[13px] text-[#607089]">{label}</Text>
    </View>
  )
}

const $content = {
  paddingBottom: 32,
}
