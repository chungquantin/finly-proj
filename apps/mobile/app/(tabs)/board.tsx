/* eslint-disable no-restricted-imports */
import { Pressable, ScrollView, Text, View } from "react-native"
import { useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { SafeAreaView } from "react-native-safe-area-context"

import { TickerLogo } from "@/components/TickerLogo"
import { getRandomAgentAvatar } from "@/utils/agentAvatars"
import { boardThreads, holdings } from "@/utils/mockAppData"

const BLUE = "#2453FF"
const BLUE_SURFACE = "#F4F7FF"
const BORDER = "#EEF2F7"

const decisionColors = {
  Buy: { background: "#E9F7EF", text: "#1F8A4C" },
  Sell: { background: "#FFF1F1", text: "#D64545" },
  Position: { background: "#EEF3FF", text: BLUE },
} as const

export default function BoardTab() {
  const router = useRouter()

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
                Open a conversation with the agent board
              </Text>
            </View>

            <Pressable
              className="h-11 w-11 items-center justify-center rounded-full"
              style={{ backgroundColor: BLUE_SURFACE }}
            >
              <Ionicons name="search" size={20} color={BLUE} />
            </Pressable>
          </View>
        </View>

        <View className="px-4">
          <View className="rounded-[30px] border border-[#EEF2F7] bg-white p-4">
            <Text className="font-sans text-[13px] font-semibold tracking-[1.2px] text-[#7A8699]">
              LIVE BOARD
            </Text>
            <Text className="mt-2 font-sans text-[28px] font-semibold leading-[34px] text-[#0F1728]">
              Active decision threads
            </Text>
            <Text className="mt-2 font-sans text-[15px] leading-6 text-[#7A8699]">
              Each thread captures a board-level discussion for one position, including intake,
              recommendation, and agent debate.
            </Text>
          </View>

          <View className="mt-4 gap-3">
            {boardThreads.map((thread) => (
              <Pressable
                key={thread.id}
                className="rounded-[28px] border bg-white p-4"
                style={{ borderColor: BORDER }}
                onPress={() => router.push(`/thread/${thread.id}`)}
              >
                <View className="mb-3 flex-row items-center">
                  <TickerLogo
                    ticker={thread.ticker}
                    logoUri={holdings.find((holding) => holding.ticker === thread.ticker)?.logoUri}
                  />
                  <Text className="ml-3 font-sans text-[16px] font-semibold text-[#0F1728]">
                    {thread.ticker}
                  </Text>
                </View>

                <View className="flex-row items-start justify-between">
                  <View className="flex-1 pr-3">
                    <View
                      className="rounded-full px-3 py-1.5 self-start"
                      style={{
                        backgroundColor: decisionColors[thread.decision].background,
                      }}
                    >
                      <Text
                        className="font-sans text-[12px] font-semibold"
                        style={{ color: decisionColors[thread.decision].text }}
                      >
                        {thread.decision}
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
                    <Text className="font-sans text-[13px] text-[#7A8699]">{thread.updatedAt}</Text>
                    {thread.unreadCount > 0 ? (
                      <View className="mt-2 rounded-full bg-[#2453FF] px-2.5 py-1">
                        <Text className="font-sans text-[12px] font-semibold text-white">
                          {thread.unreadCount} new
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                <Text className="mt-3 font-sans text-[15px] leading-6 text-[#425168]">
                  {thread.summary}
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
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const $content = {
  paddingBottom: 120,
}
