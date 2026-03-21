/* eslint-disable no-restricted-imports */
import { Pressable, Text, View, ViewStyle } from "react-native"
import { useRouter } from "expo-router"
import { MotiView } from "moti"

import { AiryScreenShell } from "../components/AiryScreenShell"
import { IosHeader } from "../components/IosHeader"
import { cn } from "../lib/utils"
import { useOnboardingStore } from "../stores/onboardingStore"

const portfolioOptions = [
  {
    key: "crypto",
    title: "Crypto Portfolio",
    subtitle: "Connect wallet to import on-chain assets",
    icon: "CR",
    iconBg: "bg-lemon",
  },
  {
    key: "stock",
    title: "Stock Portfolio",
    subtitle: "Import positions by screenshot, manual, or CSV",
    icon: "ST",
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

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back()
      return
    }

    router.replace("/onboarding/step-1")
  }

  return (
    <AiryScreenShell variant="soft" contentContainerStyle={$contentContainer}>
      <View className="mt-2 rounded-[36px] border border-[#F1F2F6] bg-white px-4 pb-6 pt-5">
        <IosHeader
          title="Portfolio type"
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
            <Text className="text-[12px] font-semibold tracking-[1.2px] text-[#8E8E93]">
              STEP 2 OF 4
            </Text>
            <Text className="mt-2 text-[25px] font-semibold leading-[30px] text-[#111111]">
              What are you onboarding?
            </Text>
            <Text className="mt-1.5 text-[15px] leading-5 text-[#6B7280]">
              Select a portfolio type to continue setup.
            </Text>

            <View className="mt-4 h-1.5 w-full rounded-full bg-[#E9EBF2]">
              <View className="h-1.5 w-2/4 rounded-full bg-[#2453FF]" />
            </View>
          </View>
        </MotiView>

        <MotiView
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 300, delay: 80 }}
        >
          <View className="mt-4 gap-4">
            {portfolioOptions.map((option) => {
              const selected = portfolioType === option.key

              return (
                <Pressable
                  key={option.key}
                  onPress={() => setPortfolioType(option.key)}
                  className={cn(
                    "rounded-[24px] border bg-white px-4 py-4",
                    selected ? "border-[#2453FF] bg-[#F8FAFF]" : "border-[#F1F2F6]",
                  )}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 flex-row items-center">
                      <View
                        className={cn(
                          "h-12 w-12 items-center justify-center rounded-full",
                          option.iconBg,
                        )}
                      >
                        <Text className="text-[16px] font-semibold text-[#1F2937]">
                          {option.icon}
                        </Text>
                      </View>
                      <View className="ml-3 flex-1">
                        <Text
                          numberOfLines={1}
                          className="text-[16px] font-semibold leading-5 text-ink"
                        >
                          {option.title}
                        </Text>
                        <Text numberOfLines={2} className="text-[13px] leading-5 text-muted">
                          {option.subtitle}
                        </Text>
                      </View>
                    </View>

                    <View
                      className={cn(
                        "ml-3 h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                        selected ? "border-[#2453FF] bg-[#EEF2FF]" : "border-[#D6DBE6] bg-white",
                      )}
                    >
                      {selected ? <View className="h-3.5 w-3.5 rounded-full bg-[#2453FF]" /> : null}
                    </View>
                  </View>
                </Pressable>
              )
            })}
          </View>
        </MotiView>

        <MotiView
          from={{ opacity: 0, translateY: 14 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 300, delay: 150 }}
        >
          <View className="mt-4">
            <Pressable
              className={cn(
                "h-14 items-center justify-center rounded-[22px]",
                portfolioType ? "bg-[#34C759]" : "bg-[#E7EAF3]",
              )}
              onPress={goNext}
              disabled={!portfolioType}
              accessibilityRole="button"
            >
              <Text
                className={cn(
                  "text-[17px] font-semibold",
                  portfolioType ? "text-white" : "text-muted",
                )}
              >
                Continue
              </Text>
            </Pressable>
          </View>
        </MotiView>
      </View>
    </AiryScreenShell>
  )
}

const $contentContainer: ViewStyle = {
  paddingTop: 10,
  paddingBottom: 24,
}
