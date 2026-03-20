/* eslint-disable no-restricted-imports */
import { Pressable, ScrollView, Text, View, ViewStyle } from "react-native"
import { useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"

import { useOnboardingStore } from "../stores/onboardingStore"
import { buildMockPortfolio } from "../utils/mockPortfolio"

const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value)

export function OnboardingCompleteScreen() {
  const router = useRouter()

  const riskExpertise = useOnboardingStore((state) => state.riskExpertise)
  const investmentHorizon = useOnboardingStore((state) => state.investmentHorizon)
  const financialKnowledge = useOnboardingStore((state) => state.financialKnowledge)
  const portfolioType = useOnboardingStore((state) => state.portfolioType)
  const walletAddress = useOnboardingStore((state) => state.walletAddress)
  const stockImportMethod = useOnboardingStore((state) => state.stockImportMethod)

  const completeOnboarding = useOnboardingStore((state) => state.completeOnboarding)

  const portfolio = buildMockPortfolio({
    riskExpertise,
    investmentHorizon,
    financialKnowledge,
    portfolioType,
    walletAddress,
    stockImportMethod,
  })

  const finish = () => {
    completeOnboarding()
    router.push("/dashboard")
  }

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerStyle={$scrollContentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View className="rounded-xl3 border border-border bg-card px-5 pb-6 pt-4 shadow-card">
            <View className="mt-2 items-center">
              <Text className="text-xs font-semi tracking-[2px] text-muted">STEP 4 OF 4</Text>
              <View className="mt-4 h-1.5 w-full rounded-full bg-border">
                <View className="h-1.5 w-full rounded-full bg-lilac" />
              </View>
            </View>

            <View className="mt-8 items-center">
              <View className="h-20 w-20 items-center justify-center rounded-xl3 bg-mint shadow-card">
                <Text className="text-[28px]">✅</Text>
              </View>
              <Text className="mt-7 text-center text-[30px] font-semi leading-[34px] text-ink">
                Profile complete
              </Text>
              <Text className="mt-2 text-center text-[16px] leading-6 text-muted">
                Your portfolio is ready. Here is your starter view.
              </Text>
            </View>

            <View className="mt-8 rounded-xl2 border border-border bg-[#FAFBFF] p-4">
              <Text className="text-sm font-semi tracking-[1.6px] text-muted">TOTAL BALANCE</Text>
              <Text className="mt-2 text-[30px] font-semi leading-[34px] text-ink">
                {money(portfolio.totalBalance)}
              </Text>
              <Text className="mt-1 text-[16px] font-semi text-[#16A34A]">
                +{portfolio.todayGainPct}% today
              </Text>
            </View>

            <View className="mt-4 rounded-xl2 border border-border bg-card p-4">
              <Text className="text-sm font-semi tracking-[1.6px] text-muted">PROFILE SUMMARY</Text>
              <Row label="Risk" value={riskExpertise} />
              <Row label="Investment taste" value={investmentHorizon} />
              <Row label="Knowledge" value={financialKnowledge} />
              <Row label="Portfolio type" value={portfolioType ?? "stock"} />
              <Row label="Onboarding source" value={portfolio.sourceLabel} />
            </View>

            <View className="mt-8">
              <Pressable
                className="h-16 items-center justify-center rounded-full bg-[#08153A]"
                onPress={finish}
                accessibilityRole="button"
              >
                <Text className="text-[20px] font-semi text-white">Go to Dashboard</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="mt-3 flex-row items-center justify-between border-b border-border pb-3">
      <Text className="text-[14px] text-muted">{label}</Text>
      <Text className="text-[14px] font-semi capitalize text-ink">{value}</Text>
    </View>
  )
}

const $scrollContentContainer: ViewStyle = {
  paddingHorizontal: 16,
  paddingTop: 12,
  paddingBottom: 24,
  flexGrow: 1,
}
