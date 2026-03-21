/* eslint-disable no-restricted-imports */
import { Pressable, ScrollView, Text, TextInput, View, type ViewStyle } from "react-native"
import { useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs"
import { SafeAreaView } from "react-native-safe-area-context"

import { getRandomAgentAvatar } from "@/utils/agentAvatars"
import { boardMessages, teamAgents } from "@/utils/mockAppData"

export default function BoardTab() {
  const router = useRouter()
  const tabBarHeight = useBottomTabBarHeight()
  const agentIdByName = Object.fromEntries(teamAgents.map((agent) => [agent.name, agent.id]))
  const stackedAgentAvatars = teamAgents.slice(0, 3).map((agent) => ({
    id: agent.id,
    avatar: getRandomAgentAvatar(agent.id),
  }))

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 bg-white">
        <View className="px-4 pb-4 pt-2">
          <View className="flex-row items-center justify-between rounded-[28px] border border-[#EEF2F8] bg-white px-3 py-3">
            <Pressable
              className="h-11 w-11 items-center justify-center rounded-full bg-[#F5F8FF]"
              hitSlop={10}
              onPress={() => router.push("/(tabs)/home")}
            >
              <Ionicons name="chevron-back" size={24} color="#2453FF" />
            </Pressable>

            <View className="flex-1 flex-row items-center px-3">
              <View className="h-11 w-11 items-center justify-center rounded-full bg-[#2453FF]">
                <Text className="text-[15px] font-semibold text-white">FB</Text>
              </View>

              <View className="ml-3 flex-1">
                <Text className="text-[20px] font-semibold text-[#151515]">Board Chat</Text>
                <Text className="text-[14px] text-[#7C8798]">4 agents live on rebalance watch</Text>
              </View>
            </View>

            <View className="flex-row items-center">
              <Pressable
                className="h-11 w-11 items-center justify-center rounded-full bg-[#F5F8FF]"
                hitSlop={10}
              >
                <Ionicons name="search" size={20} color="#2453FF" />
              </Pressable>
              <Pressable
                className="ml-2 h-11 w-11 items-center justify-center rounded-full bg-[#F5F8FF]"
                hitSlop={10}
              >
                <Ionicons name="ellipsis-horizontal" size={20} color="#2453FF" />
              </Pressable>
            </View>
          </View>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={[
            $threadContent,
            {
              paddingBottom: tabBarHeight + 120,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {boardMessages.map((item) => {
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
                        <Text className="text-[16px]">{avatar?.glyph ?? item.avatar}</Text>
                      </View>
                    </Pressable>

                    <View className="max-w-[78%]">
                      <Text className="mb-1 ml-1 text-[13px] text-[#A0A4AE]">{item.author}</Text>

                      <Pressable
                        disabled={!agentId}
                        onPress={() => {
                          if (agentId) router.push(`/agent/${agentId}`)
                        }}
                      >
                        <View className="rounded-[20px] rounded-bl-[8px] border border-[#EDF1F7] bg-[#F7F9FC] px-4 py-3">
                          <Text className="text-[17px] leading-6 text-[#141414]">
                            {item.message}
                          </Text>
                        </View>
                      </Pressable>

                      {item.reaction ? (
                        <Text className="ml-3 mt-1 text-[17px]">{item.reaction}</Text>
                      ) : null}
                    </View>
                  </View>
                ) : (
                  <View className="max-w-[78%]">
                    <View style={$outgoingBubble}>
                      <Text className="text-[18px] leading-6 text-white">{item.message}</Text>
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
                              <Text className="text-[14px]">{avatar.glyph}</Text>
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
          className="border-t border-[#EEF2F7] bg-white px-3 pt-3"
          style={{ paddingBottom: tabBarHeight + 12 }}
        >
          <View className="flex-row items-center">
            <View className="mr-3 flex-row items-center">
              <Pressable className="mr-1 h-9 w-9 items-center justify-center" hitSlop={8}>
                <Ionicons name="add-circle" size={24} color="#2453FF" />
              </Pressable>
              <Pressable className="mr-1 h-9 w-9 items-center justify-center" hitSlop={8}>
                <Ionicons name="camera" size={22} color="#2453FF" />
              </Pressable>
              <Pressable className="mr-1 h-9 w-9 items-center justify-center" hitSlop={8}>
                <Ionicons name="image" size={22} color="#2453FF" />
              </Pressable>
              <Pressable className="h-9 w-9 items-center justify-center" hitSlop={8}>
                <Ionicons name="mic" size={22} color="#2453FF" />
              </Pressable>
            </View>

            <View className="flex-1 flex-row items-center rounded-full bg-[#F5F8FF] px-4 py-2.5">
              <TextInput
                editable={false}
                placeholder="Reply to the board"
                placeholderTextColor="#8F95A3"
                className="flex-1 text-[16px] text-[#111111]"
              />
              <Ionicons name="happy" size={22} color="#2453FF" />
            </View>

            <Pressable
              className="ml-2 h-10 w-10 items-center justify-center rounded-full bg-[#2453FF]"
              hitSlop={8}
            >
              <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  )
}

const $threadContent: ViewStyle = {
  paddingHorizontal: 16,
  paddingTop: 20,
  backgroundColor: "#FFFFFF",
}

const $outgoingRow: ViewStyle = {
  alignSelf: "flex-end",
}

const $outgoingBubble: ViewStyle = {
  borderRadius: 22,
  borderBottomRightRadius: 8,
  paddingHorizontal: 16,
  paddingVertical: 12,
  backgroundColor: "#2453FF",
  shadowColor: "#2453FF",
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.12,
  shadowRadius: 16,
  elevation: 4,
}

const $stackedAvatar: ViewStyle = {
  marginLeft: -6,
}
