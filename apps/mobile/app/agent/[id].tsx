/* eslint-disable no-restricted-imports */
import { Pressable, ScrollView, Text, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"

import { IosHeader } from "@/components/IosHeader"
import { getRandomAgentAvatar } from "@/utils/agentAvatars"
import { teamAgents } from "@/utils/mockAppData"

export default function AgentDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()

  const agent = teamAgents.find((item) => item.id === id)
  const avatar = agent ? getRandomAgentAvatar(agent.id) : null

  if (!agent) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-[28px] font-semibold text-[#111111]">Agent not found</Text>
        <Pressable
          className="mt-4 rounded-full bg-[#2453FF] px-5 py-3"
          onPress={() => router.back()}
        >
          <Text className="text-[17px] font-semibold text-white">Go Back</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1" contentContainerStyle={$scrollContent}>
        <IosHeader
          title={agent.name}
          leftLabel="‹"
          rightLabel="..."
          onLeftPress={() => router.back()}
        />

        <View className="px-4">
          <View className="rounded-[30px] border border-[#F1F2F6] bg-white p-5">
            <View
              className="h-24 w-24 items-center justify-center rounded-full border-[6px]"
              style={{
                backgroundColor: avatar?.palette.background,
                borderColor: avatar?.palette.ring,
              }}
            >
              <Text className="text-[42px]">{avatar?.glyph}</Text>
            </View>
            <Text className="mt-4 text-[31px] font-semibold text-[#111111]">{agent.role}</Text>
            <Text className="mt-1 text-[17px] leading-6 text-[#8E8E93]">{agent.specialty}</Text>
            <Text className="mt-4 text-[16px] leading-7 text-[#4B5563]">{agent.bio}</Text>

            <View className="mt-5 flex-row flex-wrap gap-2">
              <Badge label={agent.status} backgroundColor="#EEF3FF" textColor="#2453FF" />
              <Badge label={agent.timeHorizon} backgroundColor="#FFF6E8" textColor="#B86A00" />
              <Badge label={agent.riskBias} backgroundColor="#ECFFF5" textColor="#15945E" />
            </View>

            <View className="mt-5 rounded-[24px] bg-[#F7F8FB] p-4">
              <View className="flex-row flex-wrap justify-between">
                <Stat label="Status" value={agent.status} />
                <Stat label="Confidence" value={`${(agent.confidence * 100).toFixed(0)}%`} />
                <Stat label="Updated" value={agent.lastUpdate} />
              </View>
            </View>

            <Section title="Mission" body={agent.mandate} />
            <Section title="Primary objective" body={agent.primaryObjective} />

            <View className="mt-5 rounded-[24px] bg-[#FBFBFD] p-4">
              <Text className="text-[18px] font-semibold text-[#111111]">Operating profile</Text>
              <View className="mt-4">
                <AttributeRow label="Desk" value={agent.location} />
                <AttributeRow label="Coverage" value={agent.coverage} />
                <AttributeRow label="Decision style" value={agent.decisionStyle} />
                <AttributeRow label="Response cadence" value={agent.responseCadence} />
              </View>
            </View>

            <View className="mt-5 rounded-[24px] bg-[#FBFBFD] p-4">
              <Text className="text-[18px] font-semibold text-[#111111]">Key focus</Text>
              <TagList items={agent.focusAreas} />
            </View>

            <View className="mt-5 rounded-[24px] bg-[#FBFBFD] p-4">
              <Text className="text-[18px] font-semibold text-[#111111]">Strengths</Text>
              <BulletList items={agent.strengths} />
            </View>

            <View className="mt-5 rounded-[24px] bg-[#FBFBFD] p-4">
              <Text className="text-[18px] font-semibold text-[#111111]">Watching now</Text>
              <TagList items={agent.watchlist} />
            </View>

            <View className="mt-5 rounded-[24px] bg-[#FBFBFD] p-4">
              <Text className="text-[18px] font-semibold text-[#111111]">Attributes</Text>
              <View className="mt-4 gap-3">
                {agent.attributes.map((attribute) => (
                  <AttributeRow
                    key={attribute.label}
                    label={attribute.label}
                    value={attribute.value}
                  />
                ))}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="mb-3 min-w-[30%] last:mb-0">
      <Text className="text-[13px] text-[#8E8E93]">{label}</Text>
      <Text className="text-[20px] font-semibold text-[#111111]">{value}</Text>
    </View>
  )
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <View className="mt-5 rounded-[24px] bg-[#FBFBFD] p-4">
      <Text className="text-[18px] font-semibold text-[#111111]">{title}</Text>
      <Text className="mt-3 text-[15px] leading-7 text-[#4B5563]">{body}</Text>
    </View>
  )
}

function Badge({
  label,
  backgroundColor,
  textColor,
}: {
  label: string
  backgroundColor: string
  textColor: string
}) {
  return (
    <View className="rounded-full px-3 py-2" style={{ backgroundColor }}>
      <Text className="text-[13px] font-semibold capitalize" style={{ color: textColor }}>
        {label}
      </Text>
    </View>
  )
}

function AttributeRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between border-b border-[#EEF1F6] pb-3 last:border-b-0 last:pb-0">
      <Text className="mr-4 flex-1 text-[14px] text-[#8E8E93]">{label}</Text>
      <Text className="max-w-[60%] text-right text-[15px] font-semibold leading-6 text-[#111111]">
        {value}
      </Text>
    </View>
  )
}

function TagList({ items }: { items: string[] }) {
  return (
    <View className="mt-4 flex-row flex-wrap gap-2">
      {items.map((item) => (
        <View key={item} className="rounded-full bg-[#F3F5FA] px-3 py-2">
          <Text className="text-[13px] font-medium text-[#445065]">{item}</Text>
        </View>
      ))}
    </View>
  )
}

function BulletList({ items }: { items: string[] }) {
  return (
    <View className="mt-4 gap-3">
      {items.map((item) => (
        <View key={item} className="flex-row">
          <Text className="mr-2 text-[16px] leading-7 text-[#2453FF]">•</Text>
          <Text className="flex-1 text-[15px] leading-7 text-[#4B5563]">{item}</Text>
        </View>
      ))}
    </View>
  )
}

const $scrollContent = {
  paddingBottom: 32,
}
