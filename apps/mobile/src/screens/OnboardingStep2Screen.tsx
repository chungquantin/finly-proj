/* eslint-disable no-restricted-imports */
import { Pressable, ScrollView, Text, View, ViewStyle } from "react-native"
import { useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"

import { cn } from "../lib/utils"
import { useOnboardingStore } from "../stores/onboardingStore"

const importOptions = [
  {
    key: "screenshot",
    icon: "📸",
    title: "Upload Screenshot",
    subtitle: "AI-powered sync from app images",
    iconBg: "bg-sky",
  },
  {
    key: "manual",
    icon: "⌨️",
    title: "Manual Entry",
    subtitle: "Type in your assets manually",
    iconBg: "bg-lemon",
  },
  {
    key: "csv",
    icon: "📄",
    title: "Attach CSV",
    subtitle: "Import from spreadsheet",
    iconBg: "bg-mint",
  },
] as const

export function OnboardingStep2Screen() {
  const router = useRouter()

  const stockImportMethod = useOnboardingStore((state) => state.stockImportMethod)
  const setStockImportMethod = useOnboardingStore((state) => state.setStockImportMethod)

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
              <Text className="text-[18px] font-semi text-ink">Import Portfolio</Text>
              <View className="w-10" />
            </View>

            <View className="mt-6">
              <View className="flex-row items-end justify-between">
                <Text className="text-xs font-semi tracking-[1.5px] text-muted">STEP 3 OF 4</Text>
                <Text className="text-xs font-semi tracking-[1px] text-lilac">75 %</Text>
              </View>
              <View className="mt-3 h-1.5 w-full rounded-full bg-border">
                <View className="h-1.5 w-3/4 rounded-full bg-lilac" />
              </View>
            </View>

            <View className="mt-8 items-center">
              <View className="h-20 w-20 items-center justify-center rounded-xl3 bg-[#F8FAFF] shadow-card">
                <Text className="text-[28px]">💳</Text>
              </View>
              <Text className="mt-7 text-center text-[30px] font-semi leading-[34px] text-ink">
                How would you like to import?
              </Text>
              <Text className="mt-2 text-center text-[16px] leading-6 text-muted">
                Choose the most convenient way to sync your assets.
              </Text>
            </View>

            <View className="mt-8 gap-4">
              {importOptions.map((option) => {
                const selected = stockImportMethod === option.key

                return (
                  <Pressable
                    key={option.key}
                    onPress={() => setStockImportMethod(option.key)}
                    className={cn(
                      "rounded-xl2 border bg-card px-4 py-4 shadow-card",
                      selected ? "border-lilac bg-lilac/20" : "border-border",
                    )}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center">
                        <View
                          className={cn(
                            "h-12 w-12 items-center justify-center rounded-full",
                            option.iconBg,
                          )}
                        >
                          <Text className="text-xl">{option.icon}</Text>
                        </View>
                        <View className="ml-3">
                          <Text className="text-[17px] font-semi leading-6 text-ink">
                            {option.title}
                          </Text>
                          <Text className="text-[14px] leading-5 text-muted">
                            {option.subtitle}
                          </Text>
                        </View>
                      </View>

                      <Text className="text-lg font-semi text-muted">›</Text>
                    </View>
                  </Pressable>
                )
              })}
            </View>

            <View className="mt-8">
              <Pressable
                className={cn(
                  "h-16 items-center justify-center rounded-full",
                  stockImportMethod ? "bg-[#08153A]" : "bg-[#EDF0F6]",
                )}
                disabled={!stockImportMethod}
                onPress={() => router.push("/onboarding/step-4")}
                accessibilityRole="button"
              >
                <Text
                  className={cn(
                    "text-[20px] font-semi",
                    stockImportMethod ? "text-white" : "text-muted",
                  )}
                >
                  Continue →
                </Text>
              </Pressable>
              <Text className="mt-4 text-center text-[11px] text-muted">
                Select one option to continue
              </Text>
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
