import { useEffect, useMemo, useRef, useState } from "react"
/* eslint-disable no-restricted-imports */
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type ScrollView as ScrollViewType,
  type ViewStyle,
} from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { SafeAreaView } from "react-native-safe-area-context"

import { TickerLogo } from "@/components/TickerLogo"
import { useAgentBoardStore } from "@/stores/agentBoardStore"
import { getRandomAgentAvatar } from "@/utils/agentAvatars"
import { useSelectedPortfolioData } from "@/utils/selectedPortfolio"

const BLUE = "#2453FF"
const BLUE_SURFACE = "#F4F7FF"
const BORDER = "#EEF2F7"

const formatMessageTime = (value: string) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ""
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export default function ThreadDetailRoute() {
  const router = useRouter()
  const { holdings } = useSelectedPortfolioData()
  const { id } = useLocalSearchParams<{ id: string }>()
  const thread = useAgentBoardStore((state) => state.threads.find((item) => item.id === id))
  const sendThreadMessage = useAgentBoardStore((state) => state.sendThreadMessage)
  const regenerateReport = useAgentBoardStore((state) => state.regenerateReport)
  const closeThread = useAgentBoardStore((state) => state.closeThread)
  const scrollViewRef = useRef<ScrollViewType>(null)
  const [draft, setDraft] = useState("")
  const [isOptionsVisible, setIsOptionsVisible] = useState(false)

  const canSend = draft.trim().length > 0 && !thread?.isBusy

  const participantAvatars = useMemo(
    () =>
      (thread?.participantAgentIds ?? []).map((agentId) => ({
        id: agentId,
        avatar: getRandomAgentAvatar(agentId),
      })),
    [thread?.participantAgentIds],
  )

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true })
  }, [thread?.messages.length])

  if (!thread) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
        <Text className="font-sans text-[28px] font-semibold text-[#0F1728]">Thread not found</Text>
        <Pressable
          className="mt-4 rounded-full bg-[#2453FF] px-5 py-3"
          onPress={() => router.back()}
        >
          <Text className="font-sans text-[17px] font-semibold text-white">Go back</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  const threadHolding = holdings.find((holding) => holding.ticker === thread.ticker)

  const handleSend = async () => {
    const nextMessage = draft.trim()
    if (!nextMessage) return
    setDraft("")
    await sendThreadMessage(thread.id, nextMessage)
    scrollViewRef.current?.scrollToEnd({ animated: true })
  }

  const handleRegenerate = async () => {
    await regenerateReport(thread.id)
    scrollViewRef.current?.scrollToEnd({ animated: true })
  }

  const handleCloseThread = () => {
    closeThread(thread.id)
    if (router.canGoBack()) {
      router.back()
      return
    }
    router.replace("/(tabs)/board")
  }

  return (
    <SafeAreaView className="flex-1 bg-[#FBFCFF]">
      <View className="flex-1 bg-[#FBFCFF]">
        <View className="px-4 pb-4 pt-2">
          <View
            className="flex-row items-center justify-between rounded-[28px] border bg-white px-3 py-3"
            style={{ borderColor: BORDER }}
          >
            <Pressable
              className="h-11 w-11 items-center justify-center rounded-full"
              style={{ backgroundColor: BLUE_SURFACE }}
              onPress={() => router.back()}
            >
              <Ionicons name="chevron-back" size={24} color={BLUE} />
            </Pressable>

            <View className="ml-3 flex-1 flex-row items-center">
              <TickerLogo ticker={thread.ticker} logoUri={threadHolding?.logoUri} />

              <View className="ml-3 flex-1">
                <Text className="font-sans text-[20px] font-semibold text-[#0F1728]">
                  {thread.title}
                </Text>
                <Text className="font-sans text-[14px] text-[#7A8699]">{thread.intake}</Text>
              </View>
            </View>

            <Pressable
              className="h-11 w-11 items-center justify-center rounded-full"
              style={{ backgroundColor: BLUE_SURFACE }}
              onPress={() => setIsOptionsVisible(true)}
            >
              <Ionicons name="ellipsis-horizontal" size={20} color={BLUE} />
            </Pressable>
          </View>
        </View>

        <ScrollView
          ref={scrollViewRef}
          className="flex-1"
          contentContainerStyle={$threadContent}
          showsVerticalScrollIndicator={false}
        >
          <View className="rounded-[24px] border border-[#EEF2F7] bg-white p-4">
            <Text className="font-sans text-[12px] font-semibold tracking-[1.2px] text-[#7A8699]">
              STATUS
            </Text>
            <Text className="mt-2 font-sans text-[20px] font-semibold text-[#0F1728]">
              {thread.stage === "intake"
                ? `Intake in progress (${thread.followUpCount}/2 follow-ups used)`
                : thread.stage === "report_loading"
                  ? "Generating team report"
                  : thread.stage === "error"
                    ? "Needs attention"
                    : `${thread.decision} on ${thread.ticker}`}
            </Text>
            <Text className="mt-2 font-sans text-[15px] leading-6 text-[#607089]">
              {thread.lastError || thread.summary}
            </Text>
            {thread.isBusy ? (
              <View className="mt-3 flex-row items-center">
                <ActivityIndicator color={BLUE} />
                <Text className="ml-3 font-sans text-[14px] text-[#607089]">
                  Finly is working on this thread.
                </Text>
              </View>
            ) : null}
          </View>

          {thread.memoryUpdates.length > 0 ? (
            <View className="mt-4 rounded-[24px] border border-[#E7F0FF] bg-[#F4F7FF] p-4">
              <Text className="font-sans text-[12px] font-semibold tracking-[1.2px] text-[#4E6AA8]">
                MEMORY UPDATES
              </Text>
              <Text className="mt-2 font-sans text-[15px] leading-6 text-[#36507D]">
                {thread.memoryUpdates.join(", ")}
              </Text>
            </View>
          ) : null}

          {thread.report ? (
            <View className="mt-4 rounded-[24px] border border-[#EEF2F7] bg-white p-4">
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="font-sans text-[12px] font-semibold tracking-[1.2px] text-[#7A8699]">
                    FINAL REPORT
                  </Text>
                  <Text className="mt-2 font-sans text-[24px] font-semibold text-[#0F1728]">
                    {thread.report.decision} {thread.report.ticker}
                  </Text>
                </View>

                <Pressable
                  className="rounded-full bg-[#08153A] px-4 py-2"
                  onPress={handleRegenerate}
                  disabled={thread.isBusy}
                >
                  <Text className="font-sans text-[13px] font-semibold text-white">Regenerate</Text>
                </Pressable>
              </View>

              <Text className="mt-3 font-sans text-[16px] leading-7 text-[#425168]">
                {thread.report.summary}
              </Text>

              {thread.report.additional_tickers.length > 0 ? (
                <View className="mt-4">
                  <Text className="font-sans text-[12px] font-semibold tracking-[1.2px] text-[#7A8699]">
                    OTHER IDEAS
                  </Text>
                  {thread.report.additional_tickers.map((item) => (
                    <View key={item.ticker} className="mt-2 rounded-[18px] bg-[#F7F9FC] px-4 py-3">
                      <Text className="font-sans text-[15px] font-semibold text-[#0F1728]">
                        {item.ticker}
                      </Text>
                      <Text className="mt-1 font-sans text-[14px] leading-6 text-[#607089]">
                        {item.reason}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {thread.report?.specialist_insights?.length ? (
            <View className="mt-4">
              <Text className="mb-3 font-sans text-[12px] font-semibold tracking-[1.2px] text-[#7A8699]">
                HOW THE TEAM GOT THERE
              </Text>
              {thread.report.specialist_insights.map((insight) => {
                const avatar = getRandomAgentAvatar(insight.role)
                return (
                  <View
                    key={insight.role}
                    className="mb-3 rounded-[24px] border border-[#EEF2F7] bg-white p-4"
                  >
                    <View className="flex-row items-center">
                      <View
                        className="h-10 w-10 items-center justify-center rounded-full"
                        style={{ backgroundColor: avatar.palette.background }}
                      >
                        <Text className="font-sans text-[18px]">{avatar.glyph}</Text>
                      </View>
                      <View className="ml-3 flex-1">
                        <Text className="font-sans text-[18px] font-semibold text-[#0F1728] capitalize">
                          {insight.role}
                        </Text>
                        <Text className="font-sans text-[14px] text-[#607089]">
                          {insight.summary}
                        </Text>
                      </View>
                    </View>

                    <Text className="mt-3 font-sans text-[15px] leading-6 text-[#425168]">
                      {insight.full_analysis}
                    </Text>
                  </View>
                )
              })}
            </View>
          ) : null}

          <View className="mt-4">
            <Text className="mb-3 font-sans text-[12px] font-semibold tracking-[1.2px] text-[#7A8699]">
              CONVERSATION
            </Text>
            {thread.messages.map((item) => {
              const isUser = item.role === "user"
              const isSystem = item.role === "system"
              const avatar = !isUser && !isSystem ? getRandomAgentAvatar(item.author) : null

              return (
                <View
                  key={item.id}
                  className={`mb-4 ${isUser ? "items-end" : "items-start"}`}
                  style={isUser ? $outgoingRow : undefined}
                >
                  {isSystem ? (
                    <View className="self-center rounded-full bg-[#F4F7FF] px-4 py-2">
                      <Text className="font-sans text-[13px] text-[#607089]">{item.content}</Text>
                    </View>
                  ) : !isUser ? (
                    <View className="mb-1 flex-row items-end">
                      <View
                        className="mr-2 h-8 w-8 items-center justify-center rounded-full"
                        style={{ backgroundColor: avatar?.palette.background ?? "#DDE7FF" }}
                      >
                        <Text className="font-sans text-[16px]">{avatar?.glyph ?? "🧠"}</Text>
                      </View>

                      <View className="max-w-[78%]">
                        <Text className="mb-1 ml-1 font-sans text-[13px] text-[#98A1B2]">
                          {item.author}
                        </Text>
                        <View
                          className="rounded-[20px] rounded-bl-[8px] border bg-[#F7F9FC] px-4 py-3"
                          style={{ borderColor: BORDER }}
                        >
                          <Text className="font-sans text-[17px] leading-6 text-[#0F1728]">
                            {item.content}
                          </Text>
                        </View>
                        <Text className="ml-2 mt-1 font-sans text-[12px] text-[#98A1B2]">
                          {formatMessageTime(item.createdAt)}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View className="max-w-[78%]">
                      <View style={$outgoingBubble}>
                        <Text className="font-sans text-[18px] leading-6 text-white">
                          {item.content}
                        </Text>
                      </View>

                      <View className="mt-2 flex-row items-center justify-end">
                        {participantAvatars.map(
                          ({ id: agentIdValue, avatar: participant }, index) => (
                            <View
                              key={`${item.id}-${agentIdValue}`}
                              className={`h-7 w-7 items-center justify-center rounded-full border-2 border-white ${
                                index === 0 ? "" : "-ml-1.5"
                              }`}
                              style={{ backgroundColor: participant.palette.background }}
                            >
                              <Text className="font-sans text-[14px]">{participant.glyph}</Text>
                            </View>
                          ),
                        )}
                      </View>
                      <Text className="mt-1 text-right font-sans text-[12px] text-[#98A1B2]">
                        {formatMessageTime(item.createdAt)}
                      </Text>
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        </ScrollView>

        <View className="border-t bg-white px-3 pb-4 pt-3" style={{ borderColor: BORDER }}>
          <View className="flex-row items-center">
            <Pressable
              className="mr-2 h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: BLUE_SURFACE }}
              onPress={() => setIsOptionsVisible(true)}
            >
              <Ionicons name="ellipsis-horizontal" size={20} color={BLUE} />
            </Pressable>

            <View className="flex-1 flex-row items-center rounded-full bg-[#F3F6FC] px-4 py-2.5">
              <TextInput
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={() => {
                  void handleSend()
                }}
                placeholder={
                  thread.stage === "intake"
                    ? "Answer Finly's follow-up"
                    : "Ask the team to refine the report"
                }
                placeholderTextColor="#94A0B3"
                className="flex-1 text-[16px] text-[#0F1728]"
                returnKeyType="send"
                editable={!thread.isBusy}
              />
            </View>

            <Pressable
              className="ml-2 h-10 w-10 items-center justify-center rounded-full"
              style={canSend ? $sendButtonActive : $sendButtonDisabled}
              onPress={() => {
                void handleSend()
              }}
              disabled={!canSend}
            >
              {thread.isBusy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
              )}
            </Pressable>
          </View>
        </View>

        <Modal
          transparent
          animationType="fade"
          visible={isOptionsVisible}
          onRequestClose={() => setIsOptionsVisible(false)}
        >
          <Pressable style={$modalBackdrop} onPress={() => setIsOptionsVisible(false)}>
            <Pressable style={$modalCard} onPress={() => {}}>
              <Text className="font-sans text-[18px] font-semibold text-[#0F1728]">
                Thread actions
              </Text>
              <OptionRow
                icon="refresh-outline"
                label="Regenerate report"
                onPress={() => {
                  setIsOptionsVisible(false)
                  void handleRegenerate()
                }}
              />
              <OptionRow
                icon="close-outline"
                label="Close"
                onPress={() => {
                  setIsOptionsVisible(false)
                  handleCloseThread()
                }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </SafeAreaView>
  )
}

function OptionRow({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onPress: () => void
}) {
  return (
    <Pressable
      className="mt-3 flex-row items-center rounded-[18px] bg-[#F7F9FC] px-4 py-3"
      onPress={onPress}
    >
      <Ionicons name={icon} size={20} color={BLUE} />
      <Text className="ml-3 font-sans text-[16px] text-[#0F1728]">{label}</Text>
    </Pressable>
  )
}

const $threadContent: ViewStyle = {
  paddingHorizontal: 16,
  paddingTop: 20,
  paddingBottom: 32,
  backgroundColor: "#FBFCFF",
}

const $outgoingRow: ViewStyle = {
  alignSelf: "flex-end",
}

const $outgoingBubble: ViewStyle = {
  borderRadius: 22,
  borderBottomRightRadius: 8,
  paddingHorizontal: 16,
  paddingVertical: 12,
  backgroundColor: BLUE,
}

const $modalBackdrop: ViewStyle = {
  flex: 1,
  justifyContent: "flex-end",
  backgroundColor: "rgba(15, 23, 40, 0.28)",
  padding: 16,
}

const $modalCard: ViewStyle = {
  borderRadius: 28,
  backgroundColor: "#FFFFFF",
  padding: 20,
}

const $sendButtonActive: ViewStyle = {
  backgroundColor: BLUE,
}

const $sendButtonDisabled: ViewStyle = {
  backgroundColor: "#BFD0FF",
}
