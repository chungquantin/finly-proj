/* eslint-disable no-restricted-imports */
import { Pressable, Text, TextInput, View, ViewStyle } from "react-native"
import { useRouter } from "expo-router"
import { MotiView } from "moti"

import { AiryScreenShell } from "@/components/AiryScreenShell"
import { IosHeader } from "@/components/IosHeader"
import { cn } from "@/lib/utils"
import { useOnboardingStore } from "@/stores/onboardingStore"
import { DEFAULT_STOCK_ACCOUNT_ID } from "@/utils/mockStockAccounts"

const riskLevels = [
  { key: "beginner", label: "Low" },
  { key: "intermediate", label: "Mid" },
  { key: "expert", label: "High" },
] as const

const horizons = [
  { key: "short", title: "Short term", subtitle: "1-3 years" },
  { key: "medium", title: "Medium term", subtitle: "3-7 years" },
  { key: "long", title: "Long term", subtitle: "7+ years" },
] as const

const knowledgeLevels = [
  { key: "novice", label: "Beginner" },
  { key: "savvy", label: "Intermediate" },
  { key: "pro", label: "Expert" },
] as const

export function ThemeShowcaseScreen() {
  const router = useRouter()

  const name = useOnboardingStore((state) => state.name)
  const selectedRisk = useOnboardingStore((state) => state.riskExpertise)
  const selectedHorizon = useOnboardingStore((state) => state.investmentHorizon)
  const selectedKnowledge = useOnboardingStore((state) => state.financialKnowledge)

  const setName = useOnboardingStore((state) => state.setName)
  const setRiskExpertise = useOnboardingStore((state) => state.setRiskExpertise)
  const setInvestmentHorizon = useOnboardingStore((state) => state.setInvestmentHorizon)
  const setFinancialKnowledge = useOnboardingStore((state) => state.setFinancialKnowledge)
  const setPortfolioType = useOnboardingStore((state) => state.setPortfolioType)
  const setWalletAddress = useOnboardingStore((state) => state.setWalletAddress)
  const setStockAccountId = useOnboardingStore((state) => state.setStockAccountId)
  const setOnboardingCompleted = useOnboardingStore((state) => state.setOnboardingCompleted)

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back()
      return
    }

    router.replace("/(tabs)/settings")
  }

  const continueToStep2 = () => {
    setPortfolioType("stock")
    setWalletAddress("")
    setStockAccountId(DEFAULT_STOCK_ACCOUNT_ID)
    setOnboardingCompleted(false)
    router.push("/onboarding/step-2")
  }

  const skipToStep4 = () => {
    setPortfolioType("stock")
    setWalletAddress("")
    setStockAccountId(DEFAULT_STOCK_ACCOUNT_ID)
    setOnboardingCompleted(false)
    router.push("/onboarding/step-4")
  }

  return (
    <AiryScreenShell variant="soft" contentContainerStyle={$contentContainer}>
      <View className="mt-2 rounded-[36px] border border-[#F1F2F6] bg-white px-4 pb-6 pt-5">
        <IosHeader
          title="Add portfolio"
          titleClassName="text-[20px] leading-[24px]"
          leftLabel="‹"
          onLeftPress={handleBack}
        />

        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 320 }}
        >
          <View className="mt-3 rounded-[24px] bg-[#F8FAFF] px-4 py-4">
            <Text className="font-sans text-[12px] font-semibold tracking-[1.2px] text-[#8E8E93]">
              STEP 1 OF 3
            </Text>
            <Text className="font-sans mt-2 text-[25px] font-semibold leading-[30px] text-[#111111]">
              Build your investor profile
            </Text>
            <Text className="font-sans mt-1.5 text-[15px] leading-5 text-[#6B7280]">
              Match your dashboard experience to your goals, comfort level, and investing style.
            </Text>

            <View className="mt-4 h-1.5 w-full rounded-full bg-[#E9EBF2]">
              <View className="h-1.5 w-1/3 rounded-full bg-[#2453FF]" />
            </View>
          </View>
        </MotiView>

        <MotiView
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 320, delay: 60 }}
        >
          <SectionCard className="mt-4">
            <Text className="font-sans text-[13px] font-semibold tracking-[1.2px] text-[#8E8E93]">
              NAME
            </Text>
            <Text className="font-sans mt-2 text-[20px] font-semibold text-[#111111]">
              What should we call you?
            </Text>
            <TextInput
              className="font-sans mt-4 rounded-[22px] border border-[#E7EAF2] bg-[#F8F9FC] px-4 py-4 text-[17px] text-[#111111]"
              placeholder="Enter your name"
              placeholderTextColor="#A1A1AA"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoCorrect={false}
            />
          </SectionCard>
        </MotiView>

        <MotiView
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 320, delay: 100 }}
        >
          <SectionCard className="mt-4">
            <View>
              <Text className="font-sans text-[13px] font-semibold tracking-[1.2px] text-[#8E8E93]">
                RISK PROFILE
              </Text>
              <Text className="font-sans mt-2 text-[20px] font-semibold text-[#111111]">
                Risk expertise
              </Text>
            </View>

            <View className="mt-4 flex-row items-center justify-between">
              {riskLevels.map((item) => (
                <Chip
                  key={item.key}
                  label={item.label}
                  selected={selectedRisk === item.key}
                  onPress={() => setRiskExpertise(item.key)}
                />
              ))}
            </View>
          </SectionCard>
        </MotiView>

        <MotiView
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 320, delay: 140 }}
        >
          <SectionCard className="mt-4">
            <Text className="font-sans text-[13px] font-semibold tracking-[1.2px] text-[#8E8E93]">
              TIMEFRAME
            </Text>
            <Text className="font-sans mt-2 text-[20px] font-semibold text-[#111111]">
              Investment horizon
            </Text>

            <View className="mt-4">
              {horizons.map((item) => {
                const selected = selectedHorizon === item.key

                return (
                  <Pressable
                    key={item.key}
                    className="flex-row items-center justify-between border-b border-[#ECEEF4] py-4 last:border-b-0"
                    onPress={() => setInvestmentHorizon(item.key)}
                  >
                    <View>
                      <Text className="font-sans text-[18px] font-semibold text-[#111111]">
                        {item.title}
                      </Text>
                      <Text className="font-sans mt-1 text-[15px] text-[#8E8E93]">
                        {item.subtitle}
                      </Text>
                    </View>

                    <View
                      className={cn(
                        "h-7 w-7 items-center justify-center rounded-full border",
                        selected ? "border-[#2453FF] bg-[#EEF2FF]" : "border-[#D6DBE6] bg-white",
                      )}
                    >
                      {selected ? <View className="h-3.5 w-3.5 rounded-full bg-[#2453FF]" /> : null}
                    </View>
                  </Pressable>
                )
              })}
            </View>
          </SectionCard>
        </MotiView>

        <MotiView
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 320, delay: 180 }}
        >
          <SectionCard className="mt-4">
            <Text className="font-sans text-[13px] font-semibold tracking-[1.2px] text-[#8E8E93]">
              EXPERIENCE
            </Text>
            <Text className="font-sans mt-2 text-[20px] font-semibold text-[#111111]">
              Financial knowledge
            </Text>

            <View className="mt-4 flex-row items-center justify-between">
              {knowledgeLevels.map((item) => (
                <Chip
                  key={item.key}
                  label={item.label}
                  selected={selectedKnowledge === item.key}
                  onPress={() => setFinancialKnowledge(item.key)}
                />
              ))}
            </View>
          </SectionCard>
        </MotiView>

        <MotiView
          from={{ opacity: 0, translateY: 14 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 320, delay: 220 }}
        >
          <Pressable
            className="mt-5 h-14 items-center justify-center rounded-[22px] bg-[#34C759]"
            onPress={continueToStep2}
          >
            <Text className="font-sans text-[17px] font-semibold text-white">Continue</Text>
          </Pressable>
        </MotiView>

        <Pressable className="items-center py-4" onPress={skipToStep4}>
          <Text className="font-sans text-[15px] font-medium text-[#8E8E93]">Skip for now</Text>
        </Pressable>
      </View>
    </AiryScreenShell>
  )
}

function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <View className={cn("rounded-[24px] border border-[#F1F2F6] bg-white p-4", className)}>
      {children}
    </View>
  )
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      className={cn("rounded-full px-4 py-2", selected ? "bg-[#2453FF]" : "bg-[#F3F5FA]")}
      onPress={onPress}
    >
      <Text
        className={cn(
          "font-sans text-[15px] font-medium",
          selected ? "text-white" : "text-[#6B7280]",
        )}
      >
        {label}
      </Text>
    </Pressable>
  )
}

const $contentContainer: ViewStyle = {
  paddingTop: 10,
  paddingBottom: 24,
}
