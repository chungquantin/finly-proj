/* eslint-disable no-restricted-imports */
import { Pressable, Text, View } from "react-native"
import { useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"

import { Button, Card, CardContent } from "@/components/ui"
import { cn } from "@/lib/utils"
import { useOnboardingStore } from "@/stores/onboardingStore"

const importOptions = [
  {
    key: "screenshot",
    icon: "◉",
    title: "Upload Screenshot",
    subtitle: "AI-powered sync from app images",
    iconBg: "bg-[#cceff6]",
    iconColor: "text-[#3778c9]",
  },
  {
    key: "manual",
    icon: "▦",
    title: "Manual Entry",
    subtitle: "Type in your assets manually",
    iconBg: "bg-[#f7ebbe]",
    iconColor: "text-[#d5a229]",
  },
  {
    key: "csv",
    icon: "▤",
    title: "Attach CSV",
    subtitle: "Import from spreadsheet",
    iconBg: "bg-[#cdeebf]",
    iconColor: "text-[#4ba34c]",
  },
] as const

export function OnboardingStep2Screen() {
  const router = useRouter()

  const importMethod = useOnboardingStore((state) => state.importMethod)
  const setImportMethod = useOnboardingStore((state) => state.setImportMethod)

  return (
    <View className="flex-1 bg-[#f6f7fb]">
      <SafeAreaView className="flex-1">
        <View className="mx-4 mt-3 flex-1 rounded-[28px] border border-[#eef0f6] bg-white px-5 pb-6">
          <View className="mt-2 flex-row items-center justify-between">
            <Pressable
              className="h-10 w-10 items-center justify-center rounded-full bg-[#f5f6fb]"
              onPress={() => router.back()}
              accessibilityRole="button"
            >
              <Text className="font-semi text-lg text-[#9aa3b4]">‹</Text>
            </Pressable>
            <Text className="font-bold text-xl text-[#1f293f]">Import Portfolio</Text>
            <View className="w-10" />
          </View>

          <View className="mt-7">
            <View className="flex-row items-end justify-between">
              <Text className="font-semi text-xs tracking-[2px] text-[#a9b0c1]">STEP 2 OF 5</Text>
              <Text className="font-semi text-xs tracking-[1px] text-[#ec9dc5]">40 %</Text>
            </View>
            <View className="mt-3 h-1.5 w-full rounded-full bg-[#eef1f7]">
              <View className="h-1.5 w-2/5 rounded-full bg-[#f291c4]" />
            </View>
          </View>

          <View className="mt-10 items-center">
            <View className="h-24 w-24 items-center justify-center rounded-[28px] bg-[#f7f8fc] shadow-card">
              <Text className="text-[30px] text-[#ec9dc5]">▣</Text>
            </View>
            <Text className="mt-8 text-center font-bold text-[48px] leading-[54px] text-[#1e273f]">
              How would you like to import?
            </Text>
            <Text className="mt-3 text-center font-medium text-[26px] leading-9 text-[#98a1b3]">
              Choose the most convenient way to sync your assets.
            </Text>
          </View>

          <View className="mt-8 gap-4">
            {importOptions.map((option) => {
              const selected = importMethod === option.key
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setImportMethod(option.key)}
                  accessibilityRole="button"
                >
                  <Card
                    className={cn(
                      "rounded-[24px] border bg-[#f8f9fc] shadow-none",
                      selected ? "border-[#f5afd0]" : "border-[#edf0f6]",
                    )}
                  >
                    <CardContent className="flex-row items-center justify-between px-4 py-4">
                      <View className="flex-row items-center">
                        <View
                          className={cn(
                            "h-12 w-12 items-center justify-center rounded-full",
                            option.iconBg,
                          )}
                        >
                          <Text className={cn("font-semi text-lg", option.iconColor)}>
                            {option.icon}
                          </Text>
                        </View>
                        <View className="ml-3">
                          <Text className="font-bold text-[31px] leading-[38px] text-[#1e273f]">
                            {option.title}
                          </Text>
                          <Text className="mt-1 font-medium text-[21px] leading-7 text-[#9aa2b3]">
                            {option.subtitle}
                          </Text>
                        </View>
                      </View>

                      <Text className="font-semi text-xl text-[#c5cbda]">›</Text>
                    </CardContent>
                  </Card>
                </Pressable>
              )
            })}
          </View>

          <View className="mt-auto pt-10">
            <Button
              label="Continue  →"
              disabled={!importMethod}
              className={cn("h-16 rounded-full", importMethod ? "bg-[#08153a]" : "bg-[#f0f2f7]")}
              textClassName={cn(importMethod ? "text-white" : "text-[#bdc4d2]")}
            />
            <Text className="mt-4 text-center font-semi text-[11px] tracking-[2px] text-[#c0c7d5]">
              PLEASE SELECT AN OPTION TO PROCEED
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  )
}
