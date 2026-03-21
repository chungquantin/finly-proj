/* eslint-disable no-restricted-imports */
import { useCallback, useEffect, useRef, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  Image,
  ImageStyle,
  Pressable,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
} from "react-native"
import { useRouter } from "expo-router"
import { MotiView } from "moti"

import { Text } from "@/components/Text"
import { FINLY_DEFAULT_USER_ID } from "@/services/agentUser"
import { api } from "@/services/api"
import type { VoiceOnboardingResponse } from "@/services/api/types"
import { useOnboardingStore } from "@/stores/onboardingStore"
import type { RiskExpertise, InvestmentHorizon, FinancialKnowledge } from "@/stores/onboardingStore"
import { lightTheme } from "@/theme/theme"

type ChatMessage = {
  id: string
  role: "assistant" | "user"
  text: string
}

const riskMap: Record<string, RiskExpertise> = {
  beginner: "beginner",
  intermediate: "intermediate",
  expert: "expert",
}

const horizonMap: Record<string, InvestmentHorizon> = {
  short: "short",
  medium: "medium",
  long: "long",
}

const knowledgeMap: Record<string, FinancialKnowledge> = {
  novice: "novice",
  savvy: "savvy",
  pro: "pro",
}

export function OnboardingChatScreen() {
  const router = useRouter()
  const flatListRef = useRef<FlatList>(null)
  const inflightAssistantIdRef = useRef<string | null>(null)
  const hasInitializedRef = useRef(false)
  const theme = lightTheme

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isBusy, setIsBusy] = useState(false)
  const [textInput, setTextInput] = useState("")
  const [isComplete, setIsComplete] = useState(false)

  const setName = useOnboardingStore((s) => s.setName)
  const setRiskExpertise = useOnboardingStore((s) => s.setRiskExpertise)
  const setInvestmentHorizon = useOnboardingStore((s) => s.setInvestmentHorizon)
  const setFinancialKnowledge = useOnboardingStore((s) => s.setFinancialKnowledge)
  const setInvestorProfileReviewed = useOnboardingStore((s) => s.setInvestorProfileReviewed)
  const setAccountSelectionCompleted = useOnboardingStore((s) => s.setAccountSelectionCompleted)
  const setOnboardingCompleted = useOnboardingStore((s) => s.setOnboardingCompleted)

  const addMessage = useCallback((role: "assistant" | "user", text: string, id?: string) => {
    const messageId = id ?? `${Date.now()}-${Math.random()}`
    setMessages((prev) => [...prev, { id: messageId, role, text }])
    return messageId
  }, [])

  const appendToMessage = useCallback((id: string, delta: string) => {
    if (!delta) return
    setMessages((prev) =>
      prev.map((msg) => (msg.id === id ? { ...msg, text: `${msg.text}${delta}` } : msg)),
    )
  }, [])

  const replaceMessageText = useCallback((id: string, text: string) => {
    setMessages((prev) => prev.map((msg) => (msg.id === id ? { ...msg, text } : msg)))
  }, [])

  const applyResponse = useCallback(
    (data: VoiceOnboardingResponse, assistantMessageId?: string) => {
      if (assistantMessageId) replaceMessageText(assistantMessageId, data.message)
      else addMessage("assistant", data.message)

      if (data.is_complete && data.profile) {
        setIsComplete(true)
        const p = data.profile

        if (p.name) setName(p.name)
        if (p.risk && riskMap[p.risk]) setRiskExpertise(riskMap[p.risk])
        if (p.horizon && horizonMap[p.horizon]) setInvestmentHorizon(horizonMap[p.horizon])
        if (p.knowledge && knowledgeMap[p.knowledge])
          setFinancialKnowledge(knowledgeMap[p.knowledge])

        // Navigate to investor profile so users can review/edit prefilled values.
        setTimeout(() => {
          router.push("/onboarding/step-2")
        }, 2000)
      }
    },
    [
      addMessage,
      replaceMessageText,
      router,
      setName,
      setRiskExpertise,
      setInvestmentHorizon,
      setFinancialKnowledge,
    ],
  )

  // Fetch initial greeting on mount
  useEffect(() => {
    if (hasInitializedRef.current) return
    hasInitializedRef.current = true

    let mounted = true

    async function fetchGreeting() {
      setIsBusy(true)
      try {
        setInvestorProfileReviewed(false)
        setAccountSelectionCompleted(false)
        setOnboardingCompleted(false)

        // Reset any previous conversation
        await api.voiceOnboardingReset(FINLY_DEFAULT_USER_ID)

        const result = await api.voiceOnboardingGreeting(FINLY_DEFAULT_USER_ID)
        if (mounted && result.kind === "ok") {
          applyResponse(result.data)
        }
      } catch (e) {
        if (__DEV__) console.warn("Onboarding greeting error:", e)
        if (mounted) {
          addMessage(
            "assistant",
            "Hey there! I'm Finly, your AI investment advisor. What's your name?",
          )
        }
      } finally {
        if (mounted) setIsBusy(false)
      }
    }

    fetchGreeting()
    return () => {
      mounted = false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true })
      }, 100)
    }
  }, [messages.length])

  const handleTextSend = useCallback(async () => {
    const msg = textInput.trim()
    if (!msg || isBusy || isComplete) return

    setTextInput("")
    addMessage("user", msg)
    setIsBusy(true)
    const assistantMessageId = addMessage("assistant", "")
    inflightAssistantIdRef.current = assistantMessageId

    try {
      const streamResult = await api.voiceOnboardingMessageStream(
        FINLY_DEFAULT_USER_ID,
        msg,
        (event) => {
          if (event.type === "delta" && event.delta) {
            appendToMessage(assistantMessageId, event.delta)
          }
          if (event.type === "done" && event.result) {
            applyResponse(event.result, assistantMessageId)
          }
          if (event.type === "error") {
            replaceMessageText(assistantMessageId, "Something went wrong. Could you try again?")
          }
        },
      )

      if (streamResult.kind !== "ok") {
        replaceMessageText(assistantMessageId, "Something went wrong. Could you try again?")
      }
    } catch (e) {
      if (__DEV__) console.warn("Onboarding text error:", e)
      replaceMessageText(assistantMessageId, "Something went wrong. Could you try again?")
    } finally {
      inflightAssistantIdRef.current = null
      setIsBusy(false)
    }
  }, [
    textInput,
    isBusy,
    isComplete,
    addMessage,
    appendToMessage,
    applyResponse,
    replaceMessageText,
  ])

  const handleSkip = useCallback(() => {
    router.push("/onboarding/step-2")
  }, [router])

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => {
      const isUser = item.role === "user"
      const isTyping =
        !isUser && isBusy && inflightAssistantIdRef.current === item.id && !item.text.trim()

      return (
        <MotiView
          from={{ opacity: 0, translateY: 8 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 250 }}
        >
          <View className={`mb-3 flex-row ${isUser ? "justify-end" : "justify-start"}`}>
            {!isUser && (
              <Image
                source={require("../../assets/images/finly-logo.jpg")}
                style={$assistantAvatarImage}
              />
            )}
            <View
              className="max-w-[80%] rounded-[20px] px-4 py-3"
              style={{
                backgroundColor: isUser ? theme.colors.tint : theme.colors.palette.neutral300,
              }}
            >
              {isTyping ? (
                <View className="flex-row items-center">
                  <ActivityIndicator size="small" color={theme.colors.textDim} />
                  <Text size="xs" style={[$typingText, { color: theme.colors.textDim }]}>
                    Finly is typing...
                  </Text>
                </View>
              ) : (
                <Text size="md" style={isUser ? $userMessageText : $assistantMessageText}>
                  {item.text}
                </Text>
              )}
            </View>
          </View>
        </MotiView>
      )
    },
    [isBusy, theme.colors.palette.neutral300, theme.colors.textDim, theme.colors.tint],
  )

  return (
    <View className="flex-1 bg-white" style={{ backgroundColor: theme.colors.surface }}>
      {/* Header */}
      <View
        className="border-b bg-white px-4 pb-4 pt-14"
        style={{ borderBottomColor: theme.colors.separator, backgroundColor: theme.colors.surface }}
      >
        <Text
          size="xs"
          weight="semiBold"
          style={[$stepText, { color: theme.colors.palette.neutral500 }]}
        >
          STEP 1 OF 3
        </Text>
        <Text
          preset="subheading"
          weight="semiBold"
          style={[$titleText, { color: theme.colors.text }]}
        >
          Let&apos;s get to know you
        </Text>
        <Text size="sm" style={[$subtitleText, { color: theme.colors.textDim }]}>
          Chat with Finly to set up your investor profile
        </Text>
      </View>

      {/* Chat messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={$chatContent}
        showsVerticalScrollIndicator={false}
      />

      {isBusy && (
        <View className="px-4 pb-2">
          <Text size="xs" style={[$workingText, { color: theme.colors.palette.neutral500 }]}>
            Finly is working on your response...
          </Text>
        </View>
      )}

      {/* Completion banner */}
      {isComplete && (
        <MotiView
          from={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "timing", duration: 300 }}
        >
          <View
            className="mx-4 mb-2 rounded-[16px] px-4 py-3"
            style={{ backgroundColor: theme.colors.successBackground }}
          >
            <Text
              size="sm"
              weight="semiBold"
              style={[$successText, { color: theme.colors.success }]}
            >
              Profile captured! Review your investor profile next.
            </Text>
          </View>
        </MotiView>
      )}

      {/* Input area */}
      {!isComplete && (
        <View
          className="border-t bg-white px-4 pb-10 pt-3"
          style={{ borderTopColor: theme.colors.separator, backgroundColor: theme.colors.surface }}
        >
          <View className="flex-row items-center">
            <TextInput
              className="mr-3 flex-1 rounded-[20px] border px-4 py-3"
              placeholder="Type your response..."
              placeholderTextColor={theme.colors.textDim}
              value={textInput}
              onChangeText={setTextInput}
              onSubmitEditing={handleTextSend}
              editable={!isBusy}
              returnKeyType="send"
              style={[
                $input,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.palette.neutral200,
                  color: theme.colors.text,
                  fontFamily: theme.typography.primary.normal,
                },
              ]}
            />
            <Pressable
              className="h-11 w-11 items-center justify-center rounded-full"
              style={{ backgroundColor: theme.colors.tint }}
              onPress={handleTextSend}
              disabled={isBusy || !textInput.trim()}
            >
              {isBusy ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text size="md" weight="bold" style={$sendText}>
                  {">"}
                </Text>
              )}
            </Pressable>
          </View>

          {/* Skip link */}
          <Pressable className="mt-3 items-center" onPress={handleSkip}>
            <Text size="xs" style={[$skipText, { color: theme.colors.palette.neutral500 }]}>
              Skip for now
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  )
}

const $chatContent: ViewStyle = {
  paddingHorizontal: 16,
  paddingTop: 20,
  paddingBottom: 12,
}

const $stepText: TextStyle = {
  textAlign: "center",
  letterSpacing: 1.2,
}

const $titleText: TextStyle = {
  marginTop: 4,
  textAlign: "center",
}

const $subtitleText: TextStyle = {
  marginTop: 4,
  textAlign: "center",
}

const $assistantAvatarImage: ImageStyle = {
  width: 32,
  height: 32,
  borderRadius: 16,
  marginRight: 8,
  overflow: "hidden",
}

const $assistantMessageText: TextStyle = {
  color: "#111111",
}

const $userMessageText: TextStyle = {
  color: "#FFFFFF",
}

const $successText: TextStyle = {
  textAlign: "center",
}

const $input: TextStyle = {
  fontSize: 16,
  lineHeight: 22,
}

const $sendText: TextStyle = {
  color: "#FFFFFF",
}

const $skipText: TextStyle = {
  textAlign: "center",
}

const $typingText: TextStyle = {
  marginLeft: 8,
}

const $workingText: TextStyle = {
  textAlign: "left",
}
