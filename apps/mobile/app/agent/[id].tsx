/* eslint-disable no-restricted-imports */
import { useEffect, useMemo, useState } from "react"
import { Pressable, ScrollView, Text, TextInput, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"

import { IosHeader } from "@/components/IosHeader"
import { useAgentPreferencesStore } from "@/stores/agentPreferencesStore"
import { getRandomAgentAvatar } from "@/utils/agentAvatars"
import { teamAgents } from "@/utils/mockAppData"

export default function AgentDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()

  const agent = teamAgents.find((item) => item.id === id)
  const primaryObjectiveOverride = useAgentPreferencesStore((state) =>
    agent ? state.primaryObjectives[agent.id] : undefined,
  )
  const setPrimaryObjective = useAgentPreferencesStore((state) => state.setPrimaryObjective)
  const clearPrimaryObjective = useAgentPreferencesStore((state) => state.clearPrimaryObjective)
  const avatar = agent ? getRandomAgentAvatar(agent.id) : null
  const displayedPrimaryObjective = useMemo(
    () => primaryObjectiveOverride?.trim() || agent?.primaryObjective || "",
    [agent?.primaryObjective, primaryObjectiveOverride],
  )
  const [isEditingObjective, setIsEditingObjective] = useState(false)
  const [draftObjective, setDraftObjective] = useState(displayedPrimaryObjective)

  useEffect(() => {
    setDraftObjective(displayedPrimaryObjective)
  }, [displayedPrimaryObjective])

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
            <EditablePrimaryObjectiveSection
              value={displayedPrimaryObjective}
              defaultValue={agent.primaryObjective}
              isEditing={isEditingObjective}
              draftValue={draftObjective}
              onChangeDraft={setDraftObjective}
              onStartEditing={() => setIsEditingObjective(true)}
              onCancel={() => {
                setDraftObjective(displayedPrimaryObjective)
                setIsEditingObjective(false)
              }}
              onSave={() => {
                const nextObjective = draftObjective.trim()
                if (!nextObjective) return

                if (nextObjective === agent.primaryObjective) {
                  clearPrimaryObjective(agent.id)
                } else {
                  setPrimaryObjective(agent.id, nextObjective)
                }

                setDraftObjective(nextObjective)
                setIsEditingObjective(false)
              }}
              onReset={() => {
                clearPrimaryObjective(agent.id)
                setDraftObjective(agent.primaryObjective)
                setIsEditingObjective(false)
              }}
            />

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

function EditablePrimaryObjectiveSection({
  value,
  defaultValue,
  isEditing,
  draftValue,
  onChangeDraft,
  onStartEditing,
  onCancel,
  onSave,
  onReset,
}: {
  value: string
  defaultValue: string
  isEditing: boolean
  draftValue: string
  onChangeDraft: (value: string) => void
  onStartEditing: () => void
  onCancel: () => void
  onSave: () => void
  onReset: () => void
}) {
  const hasCustomObjective = value !== defaultValue
  const isDraftEmpty = draftValue.trim().length === 0

  return (
    <View className="mt-5 rounded-[24px] bg-[#FBFBFD] p-4">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="flex-1 text-[18px] font-semibold text-[#111111]">Primary objective</Text>
        {!isEditing ? (
          <Pressable className="rounded-full bg-[#EEF3FF] px-3 py-2" onPress={onStartEditing}>
            <Text className="text-[13px] font-semibold text-[#2453FF]">Edit</Text>
          </Pressable>
        ) : null}
      </View>

      <Text className="mt-2 text-[13px] leading-5 text-[#8E8E93]">
        Change what this agent optimizes for, like protecting downside, maximizing upside, or
        staying inside a sector mandate.
      </Text>

      {isEditing ? (
        <>
          <View className="mt-4 rounded-[20px] border border-[#D9DFEA] bg-white px-4 py-3">
            <TextInput
              className="min-h-[104px] text-[15px] leading-6 text-[#111111]"
              value={draftValue}
              onChangeText={onChangeDraft}
              multiline
              textAlignVertical="top"
              placeholder="Describe the primary objective for this agent"
              placeholderTextColor="#98A1B2"
            />
          </View>

          <View className="mt-4 flex-row flex-wrap gap-2">
            <Pressable
              className={`rounded-full px-4 py-3 ${isDraftEmpty ? "bg-[#D9DFEA]" : "bg-[#2453FF]"}`}
              disabled={isDraftEmpty}
              onPress={onSave}
            >
              <Text className="text-[14px] font-semibold text-white">Save objective</Text>
            </Pressable>
            <Pressable className="rounded-full bg-white px-4 py-3" onPress={onCancel}>
              <Text className="text-[14px] font-semibold text-[#111111]">Cancel</Text>
            </Pressable>
            {hasCustomObjective ? (
              <Pressable className="rounded-full bg-[#FFF1F0] px-4 py-3" onPress={onReset}>
                <Text className="text-[14px] font-semibold text-[#D92D20]">Reset default</Text>
              </Pressable>
            ) : null}
          </View>
        </>
      ) : (
        <>
          <Text className="mt-3 text-[15px] leading-7 text-[#4B5563]">{value}</Text>
          {hasCustomObjective ? (
            <View className="mt-4 self-start rounded-full bg-[#ECFFF5] px-3 py-2">
              <Text className="text-[13px] font-semibold text-[#15945E]">
                Custom objective active
              </Text>
            </View>
          ) : null}
        </>
      )}
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
