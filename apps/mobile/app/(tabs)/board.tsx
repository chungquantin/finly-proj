import { useEffect, useRef, useState } from "react"
/* eslint-disable no-restricted-imports */
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type ScrollView as ScrollViewType,
  type ViewStyle,
} from "react-native"
import { useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs"
import { SafeAreaView } from "react-native-safe-area-context"

import { getRandomAgentAvatar } from "@/utils/agentAvatars"
import { boardMessages, teamAgents } from "@/utils/mockAppData"

const BLUE = "#2453FF"
const BLUE_SURFACE = "#F4F7FF"
const BORDER = "#EEF2F7"

export default function BoardTab() {
  const router = useRouter()
  const tabBarHeight = useBottomTabBarHeight()
  const scrollViewRef = useRef<ScrollViewType>(null)
  const [messages, setMessages] = useState(boardMessages)
  const [draft, setDraft] = useState("")
  const [isOptionsVisible, setIsOptionsVisible] = useState(false)
  const agentIdByName = Object.fromEntries(teamAgents.map((agent) => [agent.name, agent.id]))
  const stackedAgentAvatars = teamAgents.slice(0, 3).map((agent) => ({
    id: agent.id,
    avatar: getRandomAgentAvatar(agent.id),
  }))
  const canSend = draft.trim().length > 0

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true })
  }, [messages])

  const handleSend = () => {
    const nextMessage = draft.trim()
    if (!nextMessage) return

    setMessages((current) => [
      ...current,
      {
        id: String(current.length + 1),
        author: "You",
        role: "user",
        avatar: "YU",
        message: nextMessage,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ])
    setDraft("")
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
              hitSlop={10}
              onPress={() => router.push("/(tabs)/home")}
            >
              <Ionicons name="chevron-back" size={24} color={BLUE} />
            </Pressable>

            <View className="flex-1 flex-row items-center px-3">
              <View className="h-11 w-11 items-center justify-center rounded-full bg-[#2453FF]">
                <Text className="font-sans text-[15px] font-semibold text-white">FB</Text>
              </View>

              <View className="ml-3 flex-1">
                <Text className="font-sans text-[20px] font-semibold tracking-[-0.3px] text-[#0F1728]">
                  Board Chat
                </Text>
                <Text className="font-sans text-[14px] text-[#7A8699]">
                  4 agents live on rebalance watch
                </Text>
              </View>
            </View>

            <View className="flex-row items-center">
              <Pressable
                className="h-11 w-11 items-center justify-center rounded-full"
                style={{ backgroundColor: BLUE_SURFACE }}
                hitSlop={10}
              >
                <Ionicons name="search" size={20} color={BLUE} />
              </Pressable>
              <Pressable
                className="ml-2 h-11 w-11 items-center justify-center rounded-full"
                style={{ backgroundColor: BLUE_SURFACE }}
                hitSlop={10}
              >
                <Ionicons name="ellipsis-horizontal" size={20} color={BLUE} />
              </Pressable>
            </View>
          </View>
        </View>

        <ScrollView
          ref={scrollViewRef}
          className="flex-1"
          contentContainerStyle={[
            $threadContent,
            {
              paddingBottom: tabBarHeight + 120,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((item) => {
            const isUser = item.role === "user"
            const agentId = agentIdByName[item.author]
            const avatar = agentId ? getRandomAgentAvatar(agentId) : null

            return (
              <View
                key={item.id}
                className={`mb-4 ${isUser ? "items-end" : "items-start"}`}
                style={isUser ? $outgoingRow : undefined}
              >
                {!isUser ? (
                  <View className="mb-1 flex-row items-end">
                    <Pressable
                      className="mr-2"
                      disabled={!agentId}
                      onPress={() => {
                        if (agentId) router.push(`/agent/${agentId}`)
                      }}
                    >
                      <View
                        className="h-8 w-8 items-center justify-center rounded-full"
                        style={{ backgroundColor: avatar?.palette.background ?? "#DDE7FF" }}
                      >
                        <Text className="font-sans text-[16px]">
                          {avatar?.glyph ?? item.avatar}
                        </Text>
                      </View>
                    </Pressable>

                    <View className="max-w-[78%]">
                      <Text className="mb-1 ml-1 font-sans text-[13px] text-[#98A1B2]">
                        {item.author}
                      </Text>

                      <Pressable
                        disabled={!agentId}
                        onPress={() => {
                          if (agentId) router.push(`/agent/${agentId}`)
                        }}
                      >
                        <View
                          className="rounded-[20px] rounded-bl-[8px] border bg-[#F7F9FC] px-4 py-3"
                          style={{ borderColor: BORDER }}
                        >
                          <Text className="font-sans text-[17px] leading-6 text-[#0F1728]">
                            {item.message}
                          </Text>
                        </View>
                      </Pressable>

                      {item.reaction ? (
                        <Text className="ml-3 mt-1 font-sans text-[17px]">{item.reaction}</Text>
                      ) : null}
                    </View>
                  </View>
                ) : (
                  <View className="max-w-[78%]">
                    <View style={$outgoingBubble}>
                      <Text className="font-sans text-[18px] leading-6 text-white">
                        {item.message}
                      </Text>
                    </View>

                    <View className="mt-2 flex-row items-center justify-end">
                      <View className="flex-row">
                        {stackedAgentAvatars.map(({ id, avatar }, index) => (
                          <View
                            key={`${item.id}-${id}`}
                            className="-ml-1.5 h-7 w-7 items-center justify-center rounded-full border-2 border-white"
                            hitSlop={8}
                            style={index === 0 ? undefined : $stackedAvatar}
                          >
                            <View
                              className="h-full w-full items-center justify-center rounded-full"
                              style={{ backgroundColor: avatar.palette.background }}
                            >
                              <Text className="font-sans text-[14px]">{avatar.glyph}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>
                )}
              </View>
            )
          })}
        </ScrollView>

        <View
          className="border-t bg-white px-3 pt-3"
          style={{ borderColor: BORDER, paddingBottom: tabBarHeight + 12 }}
        >
          <View className="flex-row items-center">
            <Pressable
              className="mr-2 h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: BLUE_SURFACE }}
              hitSlop={8}
              onPress={() => setIsOptionsVisible(true)}
            >
              <Ionicons name="ellipsis-horizontal" size={20} color={BLUE} />
            </Pressable>

            <View className="flex-1 flex-row items-center rounded-full bg-[#F3F6FC] px-4 py-2.5">
              <TextInput
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={handleSend}
                placeholder="Reply to the board"
                placeholderTextColor="#94A0B3"
                className="flex-1 text-[16px] text-[#0F1728]"
                returnKeyType="send"
              />
            </View>

            <Pressable
              className="ml-2 h-10 w-10 items-center justify-center rounded-full"
              style={canSend ? $sendButtonActive : $sendButtonDisabled}
              hitSlop={8}
              onPress={handleSend}
              disabled={!canSend}
            >
              <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
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
                Board actions
              </Text>
              <OptionRow
                icon="bookmark-outline"
                label="Save this thread"
                onPress={() => setIsOptionsVisible(false)}
              />
              <OptionRow
                icon="notifications-outline"
                label="Mute board updates"
                onPress={() => setIsOptionsVisible(false)}
              />
              <OptionRow
                icon="people-outline"
                label="View participating agents"
                onPress={() => setIsOptionsVisible(false)}
              />
              <OptionRow
                icon="close-outline"
                label="Close"
                onPress={() => setIsOptionsVisible(false)}
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
  shadowColor: BLUE,
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.1,
  shadowRadius: 18,
  elevation: 4,
}

const $stackedAvatar: ViewStyle = {
  marginLeft: -6,
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
