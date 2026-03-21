import { useMemo, useState } from "react"
/* eslint-disable no-restricted-imports */
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native"
import { useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { SafeAreaView } from "react-native-safe-area-context"

import { TickerLogo } from "@/components/TickerLogo"
import { useAgentBoardStore } from "@/stores/agentBoardStore"
import { getRandomAgentAvatar } from "@/utils/agentAvatars"
import { useSelectedPortfolioData } from "@/utils/selectedPortfolio"

const BLUE = "#2453FF"
const BORDER = "#EEF2F7"

const decisionColors = {
  Buy: { background: "#E9F7EF", text: "#1F8A4C" },
  Sell: { background: "#FFF1F1", text: "#D64545" },
  Position: { background: "#EEF3FF", text: BLUE },
} as const

const formatTimestamp = (value: string) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "now"
  return parsed.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function BoardTab() {
  const router = useRouter()
  const { holdings } = useSelectedPortfolioData()
  const threads = useAgentBoardStore((state) => state.threads)
  const hydrated = useAgentBoardStore((state) => state.hydrated)
  const startThread = useAgentBoardStore((state) => state.startThread)
  const [searchQuery, setSearchQuery] = useState("")
  const [draft, setDraft] = useState("")

  const filteredThreads = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return threads

    return threads.filter((thread) =>
      [thread.title, thread.ticker, thread.intake, thread.summary, thread.report?.full_report]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    )
  }, [searchQuery, threads])

  const handleCreateThread = () => {
    const nextMessage = draft.trim()
    if (!nextMessage) return

    const threadId = startThread(nextMessage)
    setDraft("")
    router.push(`/thread/${threadId}`)
  }

  return (
    <SafeAreaView className="flex-1 bg-[#FBFCFF]">
      <ScrollView className="flex-1" contentContainerStyle={$content}>
        <View className="px-4 pb-4 pt-2">
          <View
            className="flex-row items-center justify-between rounded-[28px] border bg-white px-3 py-3"
            style={{ borderColor: BORDER }}
          >
            <View className="flex-1">
              <Text className="font-sans text-[20px] font-semibold tracking-[-0.3px] text-[#0F1728]">
                Board Threads
              </Text>
              <Text className="font-sans text-[14px] text-[#7A8699]">
                Explain what you want, let Finly narrow it down, then review the team report
              </Text>
            </View>
          </View>
        </View>

        <View className="px-4">
          <View className="rounded-[30px] border border-[#EEF2F7] bg-white p-4">
            <Text className="font-sans text-[13px] font-semibold tracking-[1.2px] text-[#7A8699]">
              NEW THREAD
            </Text>
            <View className="mt-3 flex-row items-center">
              <View className="flex-1 rounded-full bg-[#F3F6FC] px-4 py-2.5">
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  onSubmitEditing={handleCreateThread}
                  placeholder="I want to invest in ESG names with lower downside"
                  placeholderTextColor="#94A0B3"
                  className="font-sans text-[16px] text-[#0F1728]"
                  returnKeyType="send"
                />
              </View>
              <Pressable
                className="ml-2 h-11 w-11 items-center justify-center rounded-full"
                style={draft.trim() ? $sendButtonActive : $sendButtonDisabled}
                onPress={handleCreateThread}
                disabled={!draft.trim()}
              >
                <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>

          <View className="mt-4 rounded-[28px] border border-[#EEF2F7] bg-white px-4 py-3">
            <View className="flex-row items-center rounded-full bg-[#F4F7FF] px-4 py-2.5">
              <Ionicons name="search" size={18} color="#7A8699" />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search board conversations"
                placeholderTextColor="#94A0B3"
                className="ml-3 flex-1 font-sans text-[15px] text-[#0F1728]"
              />
            </View>
          </View>

          <View className="mt-4 gap-3">
            {!hydrated ? (
              <View className="rounded-[28px] border border-[#EEF2F7] bg-white p-5">
                <ActivityIndicator color={BLUE} />
              </View>
            ) : null}

            {hydrated &&
              filteredThreads.map((thread) => (
                <Pressable
                  key={thread.id}
                  className="rounded-[28px] border bg-white p-4"
                  style={{ borderColor: BORDER }}
                  onPress={() => router.push(`/thread/${thread.id}`)}
                >
                  <View className="mb-3 flex-row items-center">
                    <TickerLogo
                      ticker={thread.ticker}
                      logoUri={
                        holdings.find((holding) => holding.ticker === thread.ticker)?.logoUri
                      }
                    />
                    <Text className="ml-3 font-sans text-[16px] font-semibold text-[#0F1728]">
                      {thread.ticker}
                    </Text>
                  </View>

                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 pr-3">
                      <View
                        className="self-start rounded-full px-3 py-1.5"
                        style={{
                          backgroundColor: decisionColors[thread.decision].background,
                        }}
                      >
                        <Text
                          className="font-sans text-[12px] font-semibold"
                          style={{ color: decisionColors[thread.decision].text }}
                        >
                          {thread.stage === "intake"
                            ? `Intake ${thread.followUpCount}/2`
                            : thread.stage === "report_loading"
                              ? "Generating"
                              : thread.decision}
                        </Text>
                      </View>

                      <Text className="mt-3 font-sans text-[21px] font-semibold text-[#0F1728]">
                        {thread.title}
                      </Text>
                      <Text className="mt-1 font-sans text-[15px] text-[#607089]">
                        Intake: {thread.intake}
                      </Text>
                    </View>

                    <View className="items-end">
                      <Text className="font-sans text-[13px] text-[#7A8699]">
                        {formatTimestamp(thread.updatedAt)}
                      </Text>
                      {thread.isBusy ? <ActivityIndicator className="mt-2" color={BLUE} /> : null}
                    </View>
                  </View>

                  <Text className="mt-3 font-sans text-[15px] leading-6 text-[#425168]">
                    {thread.lastError || thread.summary}
                  </Text>

                  <View className="mt-4 flex-row items-center justify-between">
                    <View className="flex-row items-center">
                      {thread.participantAgentIds.map((agentId, index) => {
                        const avatar = getRandomAgentAvatar(agentId)

                        return (
                          <View
                            key={agentId}
                            className={`h-8 w-8 items-center justify-center rounded-full border-2 border-white ${
                              index === 0 ? "" : "-ml-2"
                            }`}
                            style={{ backgroundColor: avatar.palette.background }}
                          >
                            <Text className="font-sans text-[15px]">{avatar.glyph}</Text>
                          </View>
                        )
                      })}
                    </View>

                    <Text className="font-sans text-[13px] text-[#7A8699]">
                      {thread.messages.length} updates
                    </Text>
                  </View>
                </Pressable>
              ))}

            {hydrated && filteredThreads.length === 0 ? (
              <View className="rounded-[28px] border border-[#EEF2F7] bg-white p-5">
                <Text className="font-sans text-[18px] font-semibold text-[#0F1728]">
                  No conversations yet
                </Text>
                <Text className="mt-2 font-sans text-[15px] leading-6 text-[#7A8699]">
                  Start with a natural goal like “I want steady dividend income” or “Help me find an
                  ESG stock.”
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const $content = {
  paddingBottom: 120,
}

const $sendButtonActive = {
  backgroundColor: BLUE,
}

const $sendButtonDisabled = {
  backgroundColor: "#BFD0FF",
}
