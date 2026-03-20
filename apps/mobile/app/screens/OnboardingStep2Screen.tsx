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
    iconBg: "bg-sky",
    iconColor: "text-ink",
  },
  {
    key: "manual",
    icon: "▦",
    title: "Manual Entry",
    subtitle: "Type in your assets manually",
    iconBg: "bg-lemon",
    iconColor: "text-ink",
  },
  {
    key: "csv",
    icon: "▤",
    title: "Attach CSV",
    subtitle: "Import from spreadsheet",
    iconBg: "bg-mint",
    iconColor: "text-ink",
  },
] as const

export function OnboardingStep2Screen() {
  const router = useRouter()

  const importMethod = useOnboardingStore((state) => state.importMethod)
  const setImportMethod = useOnboardingStore((state) => state.setImportMethod)

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView className="flex-1">
        <View className="mx-5 mt-4 flex-1 rounded-xl3 border border-border bg-card px-6 pb-6">
          <View className="mt-2 flex-row items-center justify-between">
            <Pressable
              className="h-10 w-10 items-center justify-center rounded-full bg-border"
              onPress={() => router.back()}
              accessibilityRole="button"
            >
              <Text className="font-semi text-lg text-muted">‹</Text>
            </Pressable>
            <Text className="font-bold text-xl text-ink">Import Portfolio</Text>
            <View className="w-10" />
          </View>

          <View className="mt-7">
            <View className="flex-row items-end justify-between">
              <Text className="font-semi text-xs tracking-[2px] text-muted">STEP 2 OF 5</Text>
              <Text className="font-semi text-xs tracking-[1px] text-accent">40 %</Text>
            </View>
            <View className="mt-3 h-1.5 w-full rounded-full bg-border">
              <View className="h-1.5 w-2/5 rounded-full bg-accent" />
            </View>
          </View>

          <View className="mt-10 items-center">
            <View className="h-24 w-24 items-center justify-center rounded-xl3 bg-peach shadow-card">
              <Text className="text-[30px] text-ink">▣</Text>
            </View>
            <Text className="mt-8 text-center font-bold text-[42px] leading-[48px] text-ink">
              How would you like to import?
            </Text>
            <Text className="mt-3 text-center font-medium text-[22px] leading-8 text-muted">
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
                      "rounded-xl2 border bg-card shadow-none",
                      selected ? "border-accent bg-lilac/30" : "border-border",
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
                          <Text className="font-bold text-[28px] leading-[34px] text-ink">
                            {option.title}
                          </Text>
                          <Text className="mt-1 font-medium text-[18px] leading-6 text-muted">
                            {option.subtitle}
                          </Text>
                        </View>
                      </View>

                      <Text className="font-semi text-xl text-muted">›</Text>
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
              className={cn("h-16 rounded-full", importMethod ? "bg-accent" : "bg-border")}
              textClassName={cn(importMethod ? "text-white" : "text-muted")}
            />
            <Text className="mt-4 text-center font-semi text-[11px] tracking-[2px] text-muted">
              PLEASE SELECT AN OPTION TO PROCEED
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  )
}
