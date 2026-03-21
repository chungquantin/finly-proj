/* eslint-disable no-restricted-imports */
import { useMemo } from "react"
import { Pressable, Text, TextInput, View, ViewStyle } from "react-native"
import { useRouter } from "expo-router"
import { MotiView } from "moti"

import { AiryScreenShell } from "../components/AiryScreenShell"
import { IosHeader } from "../components/IosHeader"
import { cn } from "../lib/utils"
import { useOnboardingStore } from "../stores/onboardingStore"

const WALLET_MIN_LENGTH = 8

export function OnboardingCryptoWalletScreen() {
  const router = useRouter()

  const walletAddress = useOnboardingStore((state) => state.walletAddress)
  const setWalletAddress = useOnboardingStore((state) => state.setWalletAddress)
  const setAccountSelectionCompleted = useOnboardingStore(
    (state) => state.setAccountSelectionCompleted,
  )

  const trimmedAddress = walletAddress.trim()
  const hasError = trimmedAddress.length > 0 && trimmedAddress.length < WALLET_MIN_LENGTH

  const helperText = useMemo(() => {
    if (trimmedAddress.length === 0) return "Paste or type your wallet address"
    if (hasError) return `Wallet address must be at least ${WALLET_MIN_LENGTH} characters`
    return "Wallet address looks good"
  }, [trimmedAddress, hasError])

  const canContinue = trimmedAddress.length >= WALLET_MIN_LENGTH
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back()
      return
    }

    router.replace("/onboarding/step-2")
  }

  return (
    <AiryScreenShell variant="soft" contentContainerStyle={$contentContainer}>
      <View className="mt-2 rounded-[36px] border border-[#F1F2F6] bg-white px-4 pb-6 pt-5">
        <IosHeader
          title="Connect wallet"
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
              STEP 3 OF 4
            </Text>
            <Text className="mt-2 text-[25px] font-semibold leading-[30px] text-[#111111]">
              Connect your wallet
            </Text>
            <Text className="mt-1.5 text-[15px] leading-5 text-[#6B7280]">
              We use your address to build your crypto portfolio view.
            </Text>

            <View className="mt-4 h-1.5 w-full rounded-full bg-[#E9EBF2]">
              <View className="h-1.5 w-3/4 rounded-full bg-[#2453FF]" />
            </View>
          </View>
        </MotiView>

        <MotiView
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 300, delay: 80 }}
        >
          <View className="mt-4 rounded-[24px] border border-[#F1F2F6] bg-white p-4">
            <Text className="text-[13px] font-semibold tracking-[1.5px] text-muted">
              WALLET ADDRESS
            </Text>
            <TextInput
              value={walletAddress}
              onChangeText={setWalletAddress}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="0x... or your wallet address"
              placeholderTextColor="#9CA3AF"
              className={cn(
                "mt-3 rounded-[22px] border bg-[#F8F9FC] px-4 py-4 text-[15px] text-ink",
                hasError ? "border-[#EF4444]" : "border-[#E7EAF2]",
              )}
            />
            <Text className={cn("mt-2 text-[13px]", hasError ? "text-[#DC2626]" : "text-muted")}>
              {helperText}
            </Text>
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
                canContinue ? "bg-[#34C759]" : "bg-[#E7EAF3]",
              )}
              disabled={!canContinue}
              onPress={() => {
                setAccountSelectionCompleted(true)
                router.push("/onboarding/step-4")
              }}
              accessibilityRole="button"
            >
              <Text
                className={cn(
                  "text-[17px] font-semibold",
                  canContinue ? "text-white" : "text-muted",
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
