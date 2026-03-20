/* eslint-disable no-restricted-imports */
import { Pressable, Text, View } from "react-native"
import { useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"

import { Button, Card, CardContent } from "@/components/ui"
import { cn } from "@/lib/utils"
import { useOnboardingStore } from "@/stores/onboardingStore"

const horizons = [
  { key: "short", icon: "◌", title: "Short Term", subtitle: "1 - 3 years" },
  { key: "medium", icon: "↗", title: "Medium Term", subtitle: "3 - 7 years" },
  { key: "long", icon: "◎", title: "Long Term", subtitle: "7+ years" },
] as const

const riskLevels = ["beginner", "intermediate", "expert"] as const

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

  const selectedRiskIndex = riskLevels.findIndex((item) => item === selectedRisk)

  return (
    <View className="flex-1 bg-[#f6f7fb]">
      <SafeAreaView className="flex-1">
        <View className="mx-4 mt-3 flex-1 rounded-[28px] border border-[#eef0f6] bg-white px-5 pb-6">
          <View className="mt-4 items-center">
            <Text className="font-semi text-xs tracking-[2px] text-[#a9b0c1]">STEP 1 OF 5</Text>
            <View className="mt-4 h-1.5 w-full rounded-full bg-[#eef1f7]">
              <View className="h-1.5 w-1/5 rounded-full bg-[#d8b5f5]" />
            </View>
          </View>

          <View className="mt-8">
            <Text className="font-bold text-[40px] leading-[48px] text-[#222d44]">
              Build your profile
            </Text>
            <Text className="mt-2 font-medium text-base leading-6 text-[#9da6b8]">
              Help our AI understand your goals to personalize your investment strategy.
            </Text>
          </View>

          <View className="mt-7">
            <Text className="font-semi text-sm tracking-[1.5px] text-[#a8afbf]">
              RISK EXPERTISE
            </Text>
            <Card className="mt-3 rounded-[20px] border border-[#e8edf7] bg-[#f9fbff] shadow-none">
              <CardContent className="p-4">
                <View className="flex-row items-center justify-between px-1">
                  {(["Beginner", "Intermediate", "Expert"] as const).map((label, index) => (
                    <Pressable key={label} onPress={() => setRiskExpertise(riskLevels[index])}>
                      <Text
                        className={cn(
                          "font-semi text-xs",
                          selectedRiskIndex === index ? "text-[#5d6472]" : "text-[#b2b8c7]",
                        )}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <View className="mt-3">
                  <View className="h-2 rounded-full bg-[#ebeff7]" />
                  <View
                    className={cn(
                      "absolute top-[-5px] h-4 w-4 rounded-full border-2 border-white bg-[#d6a7f8]",
                      selectedRiskIndex === 0 ? "left-[2%]" : "",
                      selectedRiskIndex === 1 ? "left-[48%]" : "",
                      selectedRiskIndex === 2 ? "left-[92%]" : "",
                    )}
                  />
                </View>

                <View className="mt-4 items-center">
                  <View className="rounded-full bg-[#cbeed9] px-4 py-1">
                    <Text className="font-semi text-xs text-[#4f9d73]">Conservative Approach</Text>
                  </View>
                </View>
              </CardContent>
            </Card>
          </View>

          <View className="mt-6">
            <Text className="font-semi text-sm tracking-[1.5px] text-[#a8afbf]">
              INVESTMENT HORIZON
            </Text>
            <View className="mt-3 gap-3">
              {horizons.map((item) => {
                const selected = selectedHorizon === item.key
                return (
                  <Pressable key={item.key} onPress={() => setInvestmentHorizon(item.key)}>
                    <Card
                      className={cn(
                        "rounded-[20px] border bg-white shadow-none",
                        selected ? "border-[#f7dc83] shadow-card" : "border-[#edf0f6]",
                      )}
                    >
                      <CardContent className="flex-row items-center justify-between p-4">
                        <View className="flex-row items-center">
                          <View className="h-9 w-9 items-center justify-center rounded-xl bg-[#eef6ff]">
                            <Text className="font-semi text-sm text-[#91a2bf]">{item.icon}</Text>
                          </View>
                          <View className="ml-3">
                            <Text className="font-semi text-[24px] leading-[30px] text-[#263147]">
                              {item.title}
                            </Text>
                            <Text className="mt-1 font-medium text-sm text-[#b3bbca]">
                              {item.subtitle}
                            </Text>
                          </View>
                        </View>
                        {selected ? (
                          <View className="h-5 w-5 items-center justify-center rounded-full bg-[#f6c84f]">
                            <Text className="font-semi text-xs text-white">✓</Text>
                          </View>
                        ) : null}
                      </CardContent>
                    </Card>
                  </Pressable>
                )
              })}
            </View>
          </View>

          <View className="mt-6">
            <Text className="font-semi text-sm tracking-[1.5px] text-[#a8afbf]">
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
                      selected ? "border-[#d5ddef] bg-[#f8faff]" : "border-transparent",
                    )}
                  >
                    <Text className="text-2xl">{item.icon}</Text>
                    <Text className="mt-2 font-semi text-sm text-[#202a41]">{item.label}</Text>
                  </Pressable>
                )
              })}
            </View>
          </View>

          <View className="mt-auto pt-8">
            <Button
              label="Continue"
              className="h-16 rounded-full bg-[#08153a]"
              onPress={() => router.push("/onboarding/step-2")}
            />
            <Pressable className="items-center py-4">
              <Text className="font-medium text-sm text-[#bec5d2]">
                Skip for now, I&apos;ll do this later.
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  )
}
