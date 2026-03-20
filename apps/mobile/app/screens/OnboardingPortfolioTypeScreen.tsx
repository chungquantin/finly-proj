/* eslint-disable no-restricted-imports */
import { Pressable, ScrollView, Text, View, ViewStyle } from "react-native"
import { useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"

import { cn } from "../lib/utils"
import { useOnboardingStore } from "../stores/onboardingStore"

const portfolioOptions = [
  {
    key: "crypto",
    title: "Crypto Portfolio",
    subtitle: "Connect wallet to import on-chain assets",
    icon: "₿",
    iconBg: "bg-lemon",
  },
  {
    key: "stock",
    title: "Stock Portfolio",
    subtitle: "Import positions by screenshot, manual, or CSV",
    icon: "📈",
    iconBg: "bg-sky",
  },
] as const

export function OnboardingPortfolioTypeScreen() {
  const router = useRouter()

  const portfolioType = useOnboardingStore((state) => state.portfolioType)
  const setPortfolioType = useOnboardingStore((state) => state.setPortfolioType)

  const goNext = () => {
    if (!portfolioType) return

    if (portfolioType === "crypto") {
      router.push("/onboarding/step-3/crypto")
      return
    }

    router.push("/onboarding/step-3/stock")
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
            <View className="mt-2 flex-row items-center justify-between">
              <Pressable
                className="h-10 w-10 items-center justify-center rounded-full bg-[#F3F4F6]"
                onPress={() => router.back()}
                accessibilityRole="button"
              >
                <Text className="text-base font-semi text-muted">‹</Text>
              </Pressable>
              <Text className="text-[18px] font-semi text-ink">Portfolio Type</Text>
              <View className="w-10" />
            </View>

            <View className="mt-6">
              <View className="flex-row items-end justify-between">
                <Text className="text-xs font-semi tracking-[1.5px] text-muted">STEP 2 OF 4</Text>
                <Text className="text-xs font-semi tracking-[1px] text-lilac">50 %</Text>
              </View>
              <View className="mt-3 h-1.5 w-full rounded-full bg-border">
                <View className="h-1.5 w-2/4 rounded-full bg-lilac" />
              </View>
            </View>

            <View className="mt-8 items-center">
              <View className="h-20 w-20 items-center justify-center rounded-xl3 bg-[#F8FAFF] shadow-card">
                <Text className="text-[28px]">🗂️</Text>
              </View>
              <Text className="mt-7 text-center text-[30px] font-semi leading-[34px] text-ink">
                What are you onboarding?
              </Text>
              <Text className="mt-2 text-center text-[16px] leading-6 text-muted">
                Select portfolio type to continue setup.
              </Text>
            </View>

            <View className="mt-8 gap-3">
              {portfolioOptions.map((option) => {
                const selected = portfolioType === option.key

                return (
                  <Pressable
                    key={option.key}
                    onPress={() => setPortfolioType(option.key)}
                    className={cn(
                      "rounded-xl2 border bg-card px-4 py-4",
                      selected ? "border-lilac bg-lilac/25 shadow-card" : "border-border",
                    )}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1 flex-row items-center">
                        <View
                          className={cn(
                            "h-11 w-11 items-center justify-center rounded-full",
                            option.iconBg,
                          )}
                        >
                          <Text className="text-xl">{option.icon}</Text>
                        </View>
                        <View className="ml-3 flex-1">
                          <Text
                            numberOfLines={1}
                            className="text-[17px] font-semi leading-6 text-ink"
                          >
                            {option.title}
                          </Text>
                          <Text numberOfLines={2} className="text-[14px] leading-5 text-muted">
                            {option.subtitle}
                          </Text>
                        </View>
                      </View>

                      <View
                        className={cn(
                          "ml-3 h-5 w-5 shrink-0 rounded-full border",
                          selected ? "border-lilac bg-lilac" : "border-border bg-card",
                        )}
                      />
                    </View>
                  </Pressable>
                )
              })}
            </View>

            <View className="mt-8">
              <Pressable
                className={cn(
                  "h-16 items-center justify-center rounded-full",
                  portfolioType ? "bg-[#08153A]" : "bg-[#EDF0F6]",
                )}
                onPress={goNext}
                accessibilityRole="button"
              >
                <Text
                  className={cn(
                    "text-[20px] font-semi",
                    portfolioType ? "text-white" : "text-muted",
                  )}
                >
                  Continue →
                </Text>
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
