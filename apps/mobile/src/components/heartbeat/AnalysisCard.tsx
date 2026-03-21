/* eslint-disable no-restricted-imports */
import { useState } from "react"
import { Pressable, Text, View } from "react-native"

import { TickerLogo } from "@/components/TickerLogo"
import type { HeartbeatResultResponse } from "@/services/api/types"
import { getTickerLogoUri } from "@/utils/tickerLogo"

const BORDER = "#C7D0DC"

const decisionColors: Record<string, { bg: string; text: string }> = {
  BUY: { bg: "#E9F7EF", text: "#1F8A4C" },
  HOLD: { bg: "#FFF8E6", text: "#B8860B" },
  SELL: { bg: "#FFF1F1", text: "#D64545" },
  ERROR: { bg: "#FFF1F1", text: "#D64545" },
}

const formatTimestamp = (value: string) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ""
  return parsed.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

type AnalysisCardProps = {
  result: HeartbeatResultResponse
  onMarkRead?: (resultId: string) => void
}

export function AnalysisCard({ result, onMarkRead }: AnalysisCardProps) {
  const [expanded, setExpanded] = useState(false)
  const colors = decisionColors[result.decision] ?? decisionColors.HOLD

  const handlePress = () => {
    setExpanded((prev) => !prev)
    if (!result.is_read && onMarkRead) {
      onMarkRead(result.id)
    }
  }

  return (
    <Pressable
      className="border-b py-4"
      style={{ borderColor: BORDER }}
      onPress={handlePress}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <TickerLogo ticker={result.ticker} logoUri={getTickerLogoUri(result.ticker)} />
          <View className="ml-3">
            <Text className="font-sans text-[18px] font-semibold text-[#0F1728]">
              {result.ticker}
            </Text>
            <Text className="font-sans text-[13px] text-[#7A8699]">
              {formatTimestamp(result.created_at)}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-2">
          {!result.is_read && (
            <View className="h-2.5 w-2.5 rounded-full bg-[#2453FF]" />
          )}
          <View
            className="rounded-full px-3 py-1.5"
            style={{ backgroundColor: colors.bg }}
          >
            <Text
              className="font-sans text-[12px] font-semibold"
              style={{ color: colors.text }}
            >
              {result.decision}
            </Text>
          </View>
        </View>
      </View>

      <Text
        className="mt-2 font-sans text-[15px] leading-6 text-[#445065]"
        numberOfLines={expanded ? undefined : 3}
      >
        {result.summary}
      </Text>

      {expanded && result.full_analysis ? (
        <View className="mt-3 rounded-[16px] bg-[#F6F8FF] px-4 py-3">
          <Text className="font-sans text-[13px] font-semibold tracking-[1px] text-[#7A8699]">
            FULL ANALYSIS
          </Text>
          <Text className="mt-2 font-sans text-[14px] leading-6 text-[#607089]">
            {result.full_analysis}
          </Text>
        </View>
      ) : null}
    </Pressable>
  )
}
