/* eslint-disable no-restricted-imports */
import { Pressable, ScrollView, Text, View, ViewStyle } from "react-native"
import { useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"

import { cn } from "../lib/utils"
import { useOnboardingStore } from "../stores/onboardingStore"

const riskLevels = ["beginner", "intermediate", "expert"] as const

const horizons = [
  { key: "short", icon: "◌", title: "Short Term", subtitle: "1 - 3 years", iconBg: "bg-sky" },
  { key: "medium", icon: "↗", title: "Medium Term", subtitle: "3 - 7 years", iconBg: "bg-lemon" },
  { key: "long", icon: "◎", title: "Long Term", subtitle: "7+ years", iconBg: "bg-peach" },
] as const

const knowledge = [
  { key: "novice", icon: "🌱", label: "Novice" },
  { key: "savvy", icon: "💡", label: "Savvy" },
  { key: "pro", icon: "💼", label: "Pro" },
] as const

export function ThemeShowcaseScreen() {
  const router = useRouter()

  const selectedRisk = useOnboardingStore((state) => state.riskExpertise)
  const selectedHorizon = useOnboardingStore((state) => state.investmentHorizon)
  const selectedKnowledge = useOnboardingStore((state) => state.financialKnowledge)

  const setRiskExpertise = useOnboardingStore((state) => state.setRiskExpertise)
  const setInvestmentHorizon = useOnboardingStore((state) => state.setInvestmentHorizon)
  const setFinancialKnowledge = useOnboardingStore((state) => state.setFinancialKnowledge)
  const setPortfolioType = useOnboardingStore((state) => state.setPortfolioType)
  const setWalletAddress = useOnboardingStore((state) => state.setWalletAddress)
  const setStockImportMethod = useOnboardingStore((state) => state.setStockImportMethod)
  const setOnboardingCompleted = useOnboardingStore((state) => state.setOnboardingCompleted)

  const selectedRiskIndex = riskLevels.findIndex((item) => item === selectedRisk)

  const continueToStep2 = () => {
    setOnboardingCompleted(false)
    router.push("/onboarding/step-2")
  }

  const skipToStep4 = () => {
    setPortfolioType("stock")
    setWalletAddress("")
    setStockImportMethod("manual")
    setOnboardingCompleted(false)
    router.push("/onboarding/step-4")
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
              <Text className="font-semi text-xs tracking-[2px] text-muted">STEP 1 OF 4</Text>
              <View className="mt-4 h-1.5 w-full rounded-full bg-border">
                <View className="h-1.5 w-1/4 rounded-full bg-lilac" />
              </View>
            </View>

            <View className="mt-7">
              <Text className="font-semi text-[32px] leading-[36px] text-ink">
                Build your profile
              </Text>
              <Text className="mt-2 text-[16px] leading-6 text-muted">
                Help our AI understand your goals to personalize your investment strategy.
              </Text>
            </View>

            <View className="mt-8">
              <Text className="text-sm font-semi tracking-[1.6px] text-muted">RISK EXPERTISE</Text>
              <View className="mt-3 rounded-xl2 border border-border bg-[#F8FAFF] p-4">
                <View className="flex-row items-center justify-between px-1">
                  {(["Beginner", "Intermediate", "Expert"] as const).map((label, index) => (
                    <Pressable key={label} onPress={() => setRiskExpertise(riskLevels[index])}>
                      <Text
                        className={cn(
                          "text-xs font-semi",
                          selectedRiskIndex === index ? "text-ink" : "text-muted",
                        )}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <View className="mt-3">
                  <View className="h-2 rounded-full bg-border" />
                  <View
                    className={cn(
                      "absolute top-[-5px] h-4 w-4 rounded-full border-2 border-card bg-lilac",
                      selectedRiskIndex === 0 ? "left-[2%]" : "",
                      selectedRiskIndex === 1 ? "left-[48%]" : "",
                      selectedRiskIndex === 2 ? "left-[92%]" : "",
                    )}
                  />
                </View>

                <View className="mt-4 items-center">
                  <View className="rounded-full bg-mint px-4 py-1">
                    <Text className="text-xs font-semi text-[#15803D]">Conservative Approach</Text>
                  </View>
                </View>
              </View>
            </View>

            <View className="mt-7">
              <Text className="text-sm font-semi tracking-[1.6px] text-muted">
                INVESTMENT TASTE
              </Text>
              <View className="mt-3 gap-3">
                {horizons.map((item) => {
                  const selected = selectedHorizon === item.key

                  return (
                    <Pressable
                      key={item.key}
                      onPress={() => setInvestmentHorizon(item.key)}
                      className={cn(
                        "rounded-xl2 border bg-card px-4 py-4",
                        selected ? "border-warning shadow-card" : "border-border",
                      )}
                    >
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center">
                          <View
                            className={cn(
                              "h-11 w-11 items-center justify-center rounded-2xl",
                              item.iconBg,
                            )}
                          >
                            <Text className="text-sm font-semi text-ink">{item.icon}</Text>
                          </View>
                          <View className="ml-3">
                            <Text className="text-[18px] font-semi leading-6 text-ink">
                              {item.title}
                            </Text>
                            <Text className="mt-1 text-[14px] text-muted">{item.subtitle}</Text>
                          </View>
                        </View>
                        {selected ? (
                          <View className="h-5 w-5 items-center justify-center rounded-full bg-warning">
                            <Text className="text-xs font-semi text-ink">✓</Text>
                          </View>
                        ) : null}
                      </View>
                    </Pressable>
                  )
                })}
              </View>
            </View>

            <View className="mt-7">
              <Text className="text-sm font-semi tracking-[1.6px] text-muted">
                FINANCIAL KNOWLEDGE
              </Text>
              <View className="mt-3 flex-row justify-between">
                {knowledge.map((item) => {
                  const selected = selectedKnowledge === item.key
                  return (
                    <Pressable
                      key={item.key}
                      onPress={() => setFinancialKnowledge(item.key)}
                      className={cn(
                        "w-[31%] items-center rounded-2xl border px-2 py-3",
                        selected ? "border-lilac bg-lilac/30" : "border-border bg-card",
                      )}
                    >
                      <Text className="text-2xl">{item.icon}</Text>
                      <Text className="mt-2 text-sm font-semi text-ink">{item.label}</Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>

            <View className="mt-8">
              <Pressable
                className="h-16 items-center justify-center rounded-full bg-[#08153A]"
                onPress={continueToStep2}
                accessibilityRole="button"
              >
                <Text className="text-[20px] font-semi text-white">Continue</Text>
              </Pressable>
              <Pressable className="items-center py-4" onPress={skipToStep4}>
                <Text className="text-sm text-muted">Skip for now, I&apos;ll do this later.</Text>
              </Pressable>
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
