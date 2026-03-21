/* eslint-disable no-restricted-imports */
import { Pressable, Switch, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"

import type { HeartbeatRuleResponse } from "@/services/api/types"

const BORDER = "#C7D0DC"
const BLUE = "#2453FF"

const operatorLabels: Record<string, string> = {
  gt: "above",
  lt: "below",
  gte: "at or above",
  lte: "at or below",
}

const metricLabels: Record<string, string> = {
  price: "price",
  price_change_pct: "change %",
  volume: "volume",
}

function formatCondition(parsed: HeartbeatRuleResponse["parsed_condition"]): string {
  const ticker = parsed.ticker ?? "?"
  const metric = metricLabels[parsed.metric] ?? parsed.metric
  const op = operatorLabels[parsed.operator] ?? parsed.operator
  const threshold =
    parsed.metric === "price_change_pct"
      ? `${parsed.threshold}%`
      : String(parsed.threshold)
  return `${ticker} ${metric} ${op} ${threshold}`
}

type RuleCardProps = {
  rule: HeartbeatRuleResponse
  onToggle: (ruleId: string) => void
  onDelete: (ruleId: string) => void
}

export function RuleCard({ rule, onToggle, onDelete }: RuleCardProps) {
  return (
    <View
      className="flex-row items-center justify-between border-b py-4"
      style={{ borderColor: BORDER, opacity: rule.is_active ? 1 : 0.5 }}
    >
      <View className="flex-1 pr-3">
        <Text className="font-sans text-[16px] font-medium text-[#0F1728]">
          {rule.raw_rule}
        </Text>
        <Text className="mt-1 font-sans text-[13px] text-[#7A8699]">
          {formatCondition(rule.parsed_condition)}
        </Text>
      </View>

      <View className="flex-row items-center gap-3">
        <Switch
          value={rule.is_active}
          onValueChange={() => onToggle(rule.id)}
          trackColor={{ false: "#D5DEEC", true: BLUE }}
          thumbColor="#FFFFFF"
        />
        <Pressable
          className="rounded-full p-2"
          onPress={() => onDelete(rule.id)}
          hitSlop={8}
        >
          <Ionicons name="trash-outline" size={18} color="#7A8699" />
        </Pressable>
      </View>
    </View>
  )
}
