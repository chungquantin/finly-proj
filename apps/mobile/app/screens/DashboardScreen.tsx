/* eslint-disable no-restricted-imports */
import { ScrollView, Text, View, ViewStyle } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { useOnboardingStore } from "../stores/onboardingStore"
import { buildMockPortfolio } from "../utils/mockPortfolio"

const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value)

const compactMoney = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)

export function DashboardScreen() {
  const riskExpertise = useOnboardingStore((state) => state.riskExpertise)
  const investmentHorizon = useOnboardingStore((state) => state.investmentHorizon)
  const financialKnowledge = useOnboardingStore((state) => state.financialKnowledge)
  const portfolioType = useOnboardingStore((state) => state.portfolioType)
  const walletAddress = useOnboardingStore((state) => state.walletAddress)
  const stockImportMethod = useOnboardingStore((state) => state.stockImportMethod)

  const portfolio = buildMockPortfolio({
    riskExpertise,
    investmentHorizon,
    financialKnowledge,
    portfolioType,
    walletAddress,
    stockImportMethod,
  })

  const minValue = Math.min(...portfolio.points.map((item) => item.value))
  const maxValue = Math.max(...portfolio.points.map((item) => item.value))
  const range = Math.max(maxValue - minValue, 1)

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerStyle={$scrollContentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View className="rounded-xl3 bg-card px-5 pb-6 pt-4 shadow-card">
            <Text className="text-center text-[28px] font-semi text-ink">Dashboard</Text>
            <Text className="mt-1 text-center text-[14px] text-muted">Your portfolio snapshot</Text>

            <View className="mt-5 flex-row gap-3">
              <View className="flex-1 rounded-xl2 border border-border bg-[#F8F6FF] p-4">
                <Text className="text-[13px] text-muted">Total Value</Text>
                <Text className="mt-2 text-[28px] font-semi leading-[32px] text-ink">
                  {compactMoney(portfolio.totalBalance)}
                </Text>
                <Text className="mt-1 text-[14px] font-semi text-[#16A34A]">
                  +{portfolio.todayGainPct}%
                </Text>
              </View>
              <View className="flex-1 rounded-xl2 border border-border bg-[#F4F9FF] p-4">
                <Text className="text-[13px] text-muted">Today Gain</Text>
                <Text className="mt-2 text-[28px] font-semi leading-[32px] text-ink">
                  +{money(portfolio.todayGain)}
                </Text>
                <Text className="mt-1 text-[14px] font-semi text-[#16A34A]">
                  +{portfolio.portfolioChangePct}%
                </Text>
              </View>
            </View>

            <View className="mt-4 rounded-xl2 border border-border bg-card p-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-[20px] font-semi text-ink">Weekly Performance</Text>
                <View className="rounded-full bg-mint px-3 py-1">
                  <Text className="text-sm font-semi text-[#15803D]">
                    +{portfolio.portfolioChangePct}%
                  </Text>
                </View>
              </View>

              <View className="mt-4 h-32 justify-end">
                <View className="absolute inset-0 rounded-xl bg-[#FAFBFF]" />
                <View className="relative z-10 flex-row items-end justify-between px-2 pb-2">
                  {portfolio.points.map((point) => {
                    const height = 28 + ((point.value - minValue) / range) * 80
                    return (
                      <View key={point.day} className="items-center">
                        <View className="w-4 rounded-full bg-lilac" style={{ height }} />
                        <Text className="mt-2 text-xs font-semi text-muted">{point.day}</Text>
                      </View>
                    )
                  })}
                </View>
              </View>
            </View>

            <View className="mt-5">
              <Text className="text-[20px] font-semi text-ink">Active AI Team</Text>
              <View className="mt-3 flex-row flex-wrap justify-between gap-y-3">
                {portfolio.members.map((member) => (
                  <View
                    key={member.id}
                    className="w-[48%] rounded-xl2 border border-border bg-card p-3"
                  >
                    <View className="h-20 rounded-2xl bg-[#F8FAFF] items-center justify-center">
                      <Text className="text-3xl">{member.emoji}</Text>
                    </View>
                    <Text className="mt-3 text-[17px] font-semi text-ink">{member.role}</Text>
                    <Text className="mt-1 text-[13px] text-[#16A34A]">● {member.status}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const $scrollContentContainer: ViewStyle = {
  paddingHorizontal: 16,
  paddingTop: 12,
  paddingBottom: 24,
  flexGrow: 1,
}
