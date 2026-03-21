/* eslint-disable no-restricted-imports */
import { useMemo } from "react"
import { Pressable, Text, View, ViewStyle } from "react-native"
import { useRouter } from "expo-router"
import { MotiView } from "moti"

import { AiryScreenShell } from "../components/AiryScreenShell"
import { IosHeader } from "../components/IosHeader"
import { TickerLogoStack } from "../components/TickerLogoStack"
import { cn } from "../lib/utils"
import { useMarketData } from "../services/marketData"
import { useOnboardingStore } from "../stores/onboardingStore"
import { MOCK_STOCK_ACCOUNTS, getMockStockAccountHoldings } from "../utils/mockStockAccounts"

const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)

export function OnboardingStep2Screen() {
  const router = useRouter()

  const stockAccountId = useOnboardingStore((state) => state.stockAccountId)
  const setStockAccountId = useOnboardingStore((state) => state.setStockAccountId)
  const setAccountSelectionCompleted = useOnboardingStore(
    (state) => state.setAccountSelectionCompleted,
  )
  const allTickers = useMemo(
    () =>
      Array.from(
        new Set(
          MOCK_STOCK_ACCOUNTS.flatMap((account) =>
            getMockStockAccountHoldings(account).map((holding) => holding.ticker.toUpperCase()),
          ),
        ),
      ),
    [],
  )
  const { quotes, isLoading, hasLiveQuotes } = useMarketData(allTickers)

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
          title="Import portfolio"
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
            <Text className="font-sans text-[12px] font-semibold tracking-[1.2px] text-[#8E8E93]">
              STEP 2 OF 3
            </Text>
            <Text className="font-sans mt-2 text-[25px] font-semibold leading-[30px] text-[#111111]">
              Choose an account
            </Text>
            <Text className="font-sans mt-1.5 text-[15px] leading-5 text-[#6B7280]">
              Pick one demo account and we will import its holdings.
            </Text>

            <View className="mt-4 h-1.5 w-full rounded-full bg-[#E9EBF2]">
              <View className="h-1.5 w-2/3 rounded-full bg-[#2453FF]" />
            </View>
          </View>
        </MotiView>

        <MotiView
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 300, delay: 80 }}
        >
          <View className="mt-4 gap-4">
            {MOCK_STOCK_ACCOUNTS.map((account) => {
              const holdings = getMockStockAccountHoldings(account)
              const selected = stockAccountId === account.id
              const totalValue = holdings.reduce((sum, holding) => {
                const quote = quotes[holding.ticker.toUpperCase()]
                const price = quote?.price ?? holding.avg_cost
                return sum + holding.quantity * price
              }, 0)
              const hasAnyLiveQuote = holdings.some((holding) =>
                Boolean(quotes[holding.ticker.toUpperCase()]),
              )

              return (
                <Pressable
                  key={account.id}
                  onPress={() => setStockAccountId(account.id)}
                  className={cn(
                    "rounded-[24px] border bg-white px-4 py-4",
                    selected ? "border-[#2453FF] bg-[#F8FAFF]" : "border-[#F1F2F6]",
                  )}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 pr-3">
                      <TickerLogoStack tickers={account.logos} size={40} />

                      <Text className="font-sans mt-3 text-[17px] font-semibold text-[#111111]">
                        {account.name}
                      </Text>
                      <Text className="font-sans mt-1 text-[14px] text-[#6B7280]">
                        {account.provider} · {holdings.length} tickers
                      </Text>
                      <Text className="font-sans mt-0.5 text-[14px] font-semibold text-[#0F1728]">
                        {money(totalValue)}
                      </Text>
                      <Text className="font-sans mt-1 text-[12px] text-[#6B7280]">
                        {isLoading
                          ? "Loading live quotes..."
                          : hasAnyLiveQuote
                            ? "Live market value"
                            : "Estimated from account cost basis"}
                      </Text>
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

        <Text className="font-sans mt-3 text-center text-[12px] text-[#8E8E93]">
          {isLoading
            ? "Fetching market data..."
            : hasLiveQuotes
              ? "Using live market data for supported tickers."
              : "Live quotes unavailable. Showing fallback values."}
        </Text>

        <MotiView
          from={{ opacity: 0, translateY: 14 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 300, delay: 150 }}
        >
          <View className="mt-4">
            <Pressable
              className={cn(
                "h-14 items-center justify-center rounded-[22px]",
                stockAccountId ? "bg-[#34C759]" : "bg-[#E7EAF3]",
              )}
              disabled={!stockAccountId}
              onPress={() => {
                setAccountSelectionCompleted(true)
                router.push("/onboarding/step-4")
              }}
              accessibilityRole="button"
            >
              <Text
                className={cn(
                  "font-sans text-[17px] font-semibold",
                  stockAccountId ? "text-white" : "text-muted",
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
