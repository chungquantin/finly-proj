/* eslint-disable no-restricted-imports */
import { Pressable, Text, View } from "react-native"

import { TickerLogo } from "@/components/TickerLogo"

type HoldingRowProps = {
  name: string
  logoUri?: string
  ticker: string
  shares?: number
  value: string
  allocationPercent: number
  changePercent: number
  onPress: () => void
  onViewBoard?: () => void
  borderColor?: string
}

export function HoldingRow({
  name,
  logoUri,
  ticker,
  value,
  allocationPercent,
  changePercent,
  onPress,
  borderColor = "#EDEFF4",
}: HoldingRowProps) {
  return (
    <Pressable
      className="flex-row items-center justify-between border-b py-4 last:border-b-0"
      style={{ borderColor }}
      onPress={onPress}
    >
      <View className="flex-row items-center flex-1 pr-3">
        <TickerLogo ticker={ticker} logoUri={logoUri} />
        <View className="ml-3">
          <Text className="font-sans text-[18px] font-semibold text-[#0F1728]">{name}</Text>
          <Text className="font-sans text-[16px] text-[#7A8699]">{ticker}</Text>
        </View>
      </View>
      <View className="items-end">
        <Text className="font-sans text-[20px] font-semibold text-[#0F1728]">{value}</Text>
        <Text
          className={`font-sans text-[15px] ${changePercent >= 0 ? "text-[#22B45A]" : "text-[#F04438]"}`}
        >
          {changePercent >= 0 ? "+" : ""}
          {changePercent}%
        </Text>
        <Text className="mt-1 font-sans text-[13px] text-[#7A8699]">
          {allocationPercent.toFixed(1)}% of portfolio
        </Text>
      </View>
    </Pressable>
  )
}
