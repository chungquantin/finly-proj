/* eslint-disable no-restricted-imports */
import { Pressable, ScrollView, Text, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"

import { IosHeader } from "@/components/IosHeader"
import { TickerLogo } from "@/components/TickerLogo"
import { useAgentBoardStore } from "@/stores/agentBoardStore"
import { boardThreads, holdingDecisions } from "@/utils/mockAppData"
import { useSelectedPortfolioData } from "@/utils/selectedPortfolio"

const decisionColors = {
  Buy: { background: "#E9F7EF", text: "#1F8A4C" },
  Sell: { background: "#FFF1F1", text: "#D64545" },
  Position: { background: "#EEF3FF", text: "#2453FF" },
} as const

const QUICK_PROMPT_TEMPLATES = [
  "Should I add more {ticker} this month?",
  "What would make you upgrade {ticker} from Position to Buy?",
  "What are the main downside risks for {ticker} in the next quarter?",
  "If I rotate out of {ticker}, what are better alternatives right now?",
] as const

export default function HoldingDetailRoute() {
  const router = useRouter()
  const { ticker } = useLocalSearchParams<{ ticker: string }>()
  const { holdings, transactions } = useSelectedPortfolioData()
  const startThread = useAgentBoardStore((state) => state.startThread)
  const holding = holdings.find((item) => item.ticker === ticker)
  const holdingTransactions = transactions
    .filter((transaction) => transaction.ticker === ticker)
    .sort((left, right) => right.executedAt.localeCompare(left.executedAt))
  const buyTransactions = holdingTransactions.filter((transaction) => transaction.side === "buy")
  const totalGain = buyTransactions.reduce(
    (sum, transaction) =>
      sum + lotGainUsd(holding?.valueUsd ?? 0, holding?.shares ?? 0, transaction),
    0,
  )
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
  const quickPrompts = QUICK_PROMPT_TEMPLATES.map((template) =>
    template.replace("{ticker}", (ticker ?? "").toUpperCase()),
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

  const handleCreateThread = (prompt: string) => {
    const threadId = startThread(prompt)
    router.push(`/thread/${threadId}`)
  }

  return (
    <SafeAreaView className="flex-1 bg-[#FBFCFF]">
      <ScrollView className="flex-1" contentContainerStyle={$content}>
        <IosHeader
          title={holding.ticker}
          leftLabel="‹"
          rightLabel={formatSignedUsd(totalGain)}
          onLeftPress={() => router.back()}
          titleClassName="text-[20px] leading-[24px]"
          rightLabelClassName={totalGain >= 0 ? "text-[#1F8A4C]" : "text-[#D64545]"}
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
                Transactions
              </Text>
              <Text className="mt-1 font-sans text-[14px] text-[#7A8699]">
                Time each share lot was bought
              </Text>

              <View className="mt-4 gap-3">
                {buyTransactions.length ? (
                  buyTransactions.map((transaction) => {
                    const gain = lotGainUsd(holding.valueUsd, holding.shares, transaction)
                    return (
                      <View
                        key={`${transaction.ticker}-${transaction.executedAt}-${transaction.quantity}-${transaction.price}`}
                        className="rounded-[18px] border border-[#EEF2F7] bg-white px-4 py-3"
                      >
                        <View className="flex-row items-center justify-between">
                          <Text className="font-sans text-[15px] font-semibold text-[#0F1728]">
                            Bought {transaction.quantity} shares
                          </Text>
                          <View className="items-end">
                            <Text className="font-sans text-[14px] text-[#425168]">
                              ${transaction.price.toFixed(2)}
                            </Text>
                            <Text
                              className={`mt-0.5 font-sans text-[13px] font-semibold ${
                                gain >= 0 ? "text-[#1F8A4C]" : "text-[#D64545]"
                              }`}
                            >
                              {formatGain(gain)}
                            </Text>
                          </View>
                        </View>
                        <Text className="mt-1 font-sans text-[13px] text-[#7A8699]">
                          {formatExecutedAt(transaction.executedAt)}
                        </Text>
                      </View>
                    )
                  })
                ) : (
                  <View className="rounded-[18px] border border-[#EEF2F7] bg-white px-4 py-3">
                    <Text className="font-sans text-[14px] text-[#7A8699]">
                      No buy transactions recorded for this holding.
                    </Text>
                  </View>
                )}
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
              <Pressable
                className="mt-4 flex-row items-center justify-center rounded-[16px] bg-[#2453FF] px-4 py-3"
                onPress={() =>
                  handleCreateThread(`Build a fresh investment plan for ${holding.ticker}.`)
                }
              >
                <Text className="font-sans text-[15px] font-semibold text-white">
                  Create new conversation thread
                </Text>
              </Pressable>
              <View className="mt-3 flex-row flex-wrap gap-2">
                {quickPrompts.map((prompt) => (
                  <Pressable
                    key={prompt}
                    className="rounded-full border border-[#DCE6FF] bg-[#F4F7FF] px-3 py-2"
                    onPress={() => handleCreateThread(prompt)}
                  >
                    <Text className="font-sans text-[13px] text-[#2453FF]">{prompt}</Text>
                  </Pressable>
                ))}
              </View>
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

function formatExecutedAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function lotGainUsd(
  holdingValueUsd: number,
  holdingShares: number,
  transaction: { quantity: number; price: number },
) {
  if (!holdingShares) return 0
  const currentPrice = holdingValueUsd / holdingShares
  return (currentPrice - transaction.price) * transaction.quantity
}

function formatGain(value: number) {
  const abs = Math.abs(value)
  const sign = value >= 0 ? "+" : "-"
  return `${sign}$${abs.toFixed(2)} gain`
}

function formatSignedUsd(value: number) {
  const abs = Math.abs(value)
  const sign = value >= 0 ? "+" : "-"
  return `${sign}$${abs.toFixed(2)}`
}

const $content = {
  paddingBottom: 32,
}
