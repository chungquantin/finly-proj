/* eslint-disable no-restricted-imports */
import { useState } from "react"
import { ActivityIndicator, Pressable, Text, View, ViewStyle } from "react-native"
import { useRouter } from "expo-router"
import { MotiView } from "moti"

import { AiryScreenShell } from "../components/AiryScreenShell"
import { IosHeader } from "../components/IosHeader"
import { TickerLogoStack } from "../components/TickerLogoStack"
import { FINLY_DEFAULT_USER_ID } from "../services/agentUser"
import { api } from "../services/api"
import { useOnboardingStore } from "../stores/onboardingStore"
import { buildMockPortfolio } from "../utils/mockPortfolio"
import { DEFAULT_STOCK_ACCOUNT_ID, getMockStockAccountById } from "../utils/mockStockAccounts"
import { playBase64Audio } from "../utils/playAudio"

const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value)

const knowledgeMap = { novice: 1, savvy: 2, pro: 3 } as const
const riskMap = { beginner: 25, intermediate: 50, expert: 80 } as const

export function OnboardingCompleteScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const riskExpertise = useOnboardingStore((s) => s.riskExpertise)
  const investmentHorizon = useOnboardingStore((s) => s.investmentHorizon)
  const financialKnowledge = useOnboardingStore((s) => s.financialKnowledge)
  const portfolioType = useOnboardingStore((s) => s.portfolioType)
  const walletAddress = useOnboardingStore((s) => s.walletAddress)
  const stockAccountId = useOnboardingStore((s) => s.stockAccountId)
  const completeOnboarding = useOnboardingStore((s) => s.completeOnboarding)
  const selectedStockAccount = getMockStockAccountById(
    stockAccountId ?? (portfolioType === "stock" ? DEFAULT_STOCK_ACCOUNT_ID : null),
  )

  const portfolio = buildMockPortfolio({
    riskExpertise,
    investmentHorizon,
    financialKnowledge,
    portfolioType,
    walletAddress,
    stockAccountId,
  })

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back()
      return
    }

    router.replace("/onboarding/step-2")
  }

  const finish = async () => {
    if (loading) return
    setLoading(true)

    try {
      const userId = FINLY_DEFAULT_USER_ID

      const result = await api.onboarding({
        user_id: userId,
        risk_score: riskMap[riskExpertise],
        horizon: investmentHorizon,
        knowledge: knowledgeMap[financialKnowledge],
      })

      if (portfolioType === "stock") {
        await api.importPortfolio({
          user_id: userId,
          mode: "manual",
          items: selectedStockAccount?.holdings ?? [],
        })
      } else {
        await api.importPortfolio({
          user_id: userId,
          mode: "mock",
          items: [],
        })
      }

      if (result.kind === "ok" && result.data.audio_b64) {
        playBase64Audio(result.data.audio_b64).catch(() => {})
      }

      completeOnboarding()
      router.push("/home")
    } catch (e) {
      if (__DEV__) console.error("Onboarding API error:", e)
      completeOnboarding()
      router.push("/home")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AiryScreenShell variant="soft" contentContainerStyle={$contentContainer}>
      <View className="mt-2 rounded-[36px] border border-[#F1F2F6] bg-white px-4 pb-6 pt-5">
        <IosHeader
          title="Portfolio ready"
          titleClassName="text-[20px] leading-[24px]"
          leftLabel="‹"
          onLeftPress={handleBack}
        />

        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 300 }}
        >
          <View className="mt-3 rounded-[24px] bg-[#F8FAFF] px-4 py-4">
            <Text className="font-sans text-[12px] font-semibold tracking-[1.2px] text-[#8E8E93]">
              STEP 3 OF 3
            </Text>
            <Text className="font-sans mt-2 text-[25px] font-semibold leading-[30px] text-[#111111]">
              Profile complete
            </Text>
            <Text className="font-sans mt-1.5 text-[15px] leading-5 text-[#6B7280]">
              Your portfolio is ready. Here is your starter view.
            </Text>

            <View className="mt-4 h-1.5 w-full rounded-full bg-[#E9EBF2]">
              <View className="h-1.5 w-full rounded-full bg-[#2453FF]" />
            </View>
          </View>
        </MotiView>

        <MotiView
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 300, delay: 70 }}
        >
          <View className="mt-4 rounded-[24px] border border-[#F1F2F6] bg-[#FAFBFF] p-4">
            <Text className="font-sans text-[13px] font-semibold tracking-[1.6px] text-[#8E8E93]">
              TOTAL BALANCE
            </Text>
            {selectedStockAccount ? (
              <View className="mt-3 flex-row items-center justify-between">
                <TickerLogoStack tickers={selectedStockAccount.logos} size={32} />
                <Text className="font-sans text-[12px] font-medium text-[#6B7280]">
                  {selectedStockAccount.provider}
                </Text>
              </View>
            ) : null}
            <Text className="font-sans mt-2 text-[30px] font-semibold leading-[34px] text-[#111111]">
              {money(portfolio.totalBalance)}
            </Text>
            <Text className="font-sans mt-1 text-[16px] font-semibold text-[#16A34A]">
              +{portfolio.todayGainPct}% today
            </Text>
          </View>
        </MotiView>

        <MotiView
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 300, delay: 120 }}
        >
          <View className="mt-4 rounded-[24px] border border-[#F1F2F6] bg-white p-4">
            <Text className="font-sans text-[13px] font-semibold tracking-[1.6px] text-[#8E8E93]">
              PROFILE SUMMARY
            </Text>
            <Row label="Risk" value={riskLabel(riskExpertise)} />
            <Row label="Investment horizon" value={investmentHorizon} />
            <Row label="Knowledge" value={knowledgeLabel(financialKnowledge)} />
            <Row label="Portfolio type" value={portfolioType ?? "stock"} />
            {selectedStockAccount ? (
              <Row label="Selected account" value={selectedStockAccount.name} />
            ) : null}
            <Row label="Onboarding source" value={portfolio.sourceLabel} />
          </View>
        </MotiView>

        <MotiView
          from={{ opacity: 0, translateY: 14 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 300, delay: 180 }}
        >
          <View className="mt-4">
            <Pressable
              className="h-14 items-center justify-center rounded-[22px] bg-[#34C759]"
              onPress={finish}
              disabled={loading}
              accessibilityRole="button"
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="font-sans text-[17px] font-semibold text-white">Continue</Text>
              )}
            </Pressable>
          </View>
        </MotiView>
      </View>
    </AiryScreenShell>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="mt-3 flex-row items-center justify-between border-b border-[#ECEEF4] pb-3">
      <Text className="text-[13px] text-[#6B7280]">{label}</Text>
      <Text className="text-[13px] font-semibold text-[#111111]">{value}</Text>
    </View>
  )
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

const $contentContainer: ViewStyle = {
  paddingTop: 10,
  paddingBottom: 24,
}
