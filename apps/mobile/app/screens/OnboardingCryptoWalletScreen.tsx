/* eslint-disable no-restricted-imports */
import { useMemo } from "react"
import { Pressable, ScrollView, Text, TextInput, View, ViewStyle } from "react-native"
import { useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"

import { cn } from "../lib/utils"
import { useOnboardingStore } from "../stores/onboardingStore"

const WALLET_MIN_LENGTH = 8

export function OnboardingCryptoWalletScreen() {
  const router = useRouter()

  const walletAddress = useOnboardingStore((state) => state.walletAddress)
  const setWalletAddress = useOnboardingStore((state) => state.setWalletAddress)

  const trimmedAddress = walletAddress.trim()
  const hasError = trimmedAddress.length > 0 && trimmedAddress.length < WALLET_MIN_LENGTH

  const helperText = useMemo(() => {
    if (trimmedAddress.length === 0) return "Paste or type your wallet address"
    if (hasError) return `Wallet address must be at least ${WALLET_MIN_LENGTH} characters`
    return "Wallet address looks good"
  }, [trimmedAddress, hasError])

  const canContinue = trimmedAddress.length >= WALLET_MIN_LENGTH

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
              <Text className="text-[18px] font-semi text-ink">Crypto Wallet</Text>
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
                <Text className="text-[28px]">🔐</Text>
              </View>
              <Text className="mt-7 text-center text-[30px] font-semi leading-[34px] text-ink">
                Connect your wallet
              </Text>
              <Text className="mt-2 text-center text-[16px] leading-6 text-muted">
                We use your address to build your crypto portfolio view.
              </Text>
            </View>

            <View className="mt-8">
              <Text className="text-sm font-semi tracking-[1.6px] text-muted">WALLET ADDRESS</Text>
              <TextInput
                value={walletAddress}
                onChangeText={setWalletAddress}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="0x... or your wallet address"
                placeholderTextColor="#9CA3AF"
                className={cn(
                  "mt-3 rounded-xl2 border bg-card px-4 py-4 text-[16px] text-ink",
                  hasError ? "border-[#EF4444]" : "border-border",
                )}
              />
              <Text className={cn("mt-2 text-sm", hasError ? "text-[#DC2626]" : "text-muted")}>
                {helperText}
              </Text>
            </View>

            <View className="mt-8">
              <Pressable
                className={cn(
                  "h-16 items-center justify-center rounded-full",
                  canContinue ? "bg-[#08153A]" : "bg-[#EDF0F6]",
                )}
                disabled={!canContinue}
                onPress={() => router.push("/onboarding/step-4")}
                accessibilityRole="button"
              >
                <Text
                  className={cn("text-[20px] font-semi", canContinue ? "text-white" : "text-muted")}
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
