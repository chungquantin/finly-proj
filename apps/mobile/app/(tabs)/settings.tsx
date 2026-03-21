/* eslint-disable no-restricted-imports */
import { Pressable, ScrollView, Text, TextInput, View } from "react-native"
import { useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"

import { IosHeader } from "@/components/IosHeader"
import {
  FinancialKnowledge,
  InvestmentHorizon,
  RiskExpertise,
  useOnboardingStore,
} from "@/stores/onboardingStore"
import { getInvestorAvatarEmoji } from "@/utils/investorAvatar"

const riskLevels: RiskExpertise[] = ["beginner", "intermediate", "expert"]
const horizons: InvestmentHorizon[] = ["short", "medium", "long"]
const knowledgeLevels: FinancialKnowledge[] = ["novice", "savvy", "pro"]
const surfaceBorder = "#E5E9F2"
const groupedBackground = "#F2F4F8"
const dangerBorder = "#F3D1CD"

export default function SettingsTab() {
  const router = useRouter()

  const name = useOnboardingStore((state) => state.name)
  const riskExpertise = useOnboardingStore((state) => state.riskExpertise)
  const investmentHorizon = useOnboardingStore((state) => state.investmentHorizon)
  const financialKnowledge = useOnboardingStore((state) => state.financialKnowledge)

  const setName = useOnboardingStore((state) => state.setName)
  const setRiskExpertise = useOnboardingStore((state) => state.setRiskExpertise)
  const setInvestmentHorizon = useOnboardingStore((state) => state.setInvestmentHorizon)
  const setFinancialKnowledge = useOnboardingStore((state) => state.setFinancialKnowledge)
  const reset = useOnboardingStore((state) => state.reset)

  const restartOnboarding = () => {
    reset()
    router.replace("/onboarding/step-1")
  }

  const hasName = name.trim().length > 0
  const avatarEmoji = getInvestorAvatarEmoji(name)
  const profileTitle = hasName ? name.trim() : "Your investor profile"
  const profileSubtitle = [
    riskLabel(riskExpertise),
    horizonLabel(investmentHorizon),
    knowledgeLabel(financialKnowledge),
  ].join(" • ")

  return (
    <SafeAreaView className="flex-1 bg-[#F2F2F7]">
      <ScrollView className="flex-1" contentContainerStyle={$scrollContent}>
        <IosHeader title="Settings" titleClassName="text-[20px] leading-[24px]" />

        <View className="px-4">
          <View
            className="overflow-hidden rounded-[30px] border bg-white px-5 pb-5 pt-4"
            style={{ borderColor: surfaceBorder }}
          >
            <View className="flex-row items-center justify-between">
              <View className="h-14 w-14 items-center justify-center rounded-full bg-[#2453FF]">
                <Text className="font-sans text-[22px] font-semibold text-white">
                  {avatarEmoji}
                </Text>
              </View>
              <View className="rounded-full bg-[#EEF3FF] px-3 py-2">
                <Text className="font-sans text-[12px] font-semibold tracking-[0.4px] text-[#2453FF]">
                  PROFILE ACTIVE
                </Text>
              </View>
            </View>

            <Text className="mt-4 font-sans text-[28px] font-semibold leading-[32px] tracking-[-0.7px] text-[#0F1728]">
              {profileTitle}
            </Text>
            <Text className="mt-2 font-sans text-[15px] leading-[22px] text-[#6B7280]">
              Keep these preferences current so Finly can tune recommendations to your comfort level
              and goals.
            </Text>

            <View className="mt-4 flex-row flex-wrap gap-2">
              <SummaryPill label={profileSubtitle} />
            </View>
          </View>

          <SettingsSection
            title="Identity"
            description="This helps personalize your experience across the app."
            className="mt-4"
          >
            <InputField
              label="Display Name"
              placeholder="Enter your name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoCorrect={false}
            />
          </SettingsSection>

          <SettingsSection
            title="Risk Tolerance"
            description="Choose the level of uncertainty you are comfortable with."
            className="mt-4"
          >
            <SegmentedGroup>
              {riskLevels.map((risk) => (
                <Chip
                  key={risk}
                  label={riskLabel(risk)}
                  selected={riskExpertise === risk}
                  onPress={() => setRiskExpertise(risk)}
                />
              ))}
            </SegmentedGroup>
          </SettingsSection>

          <SettingsSection
            title="Time Horizon"
            description="Longer horizons generally support more volatility."
            className="mt-4"
          >
            <SegmentedGroup>
              {horizons.map((horizon) => (
                <Chip
                  key={horizon}
                  label={horizon}
                  selected={investmentHorizon === horizon}
                  onPress={() => setInvestmentHorizon(horizon)}
                />
              ))}
            </SegmentedGroup>
          </SettingsSection>

          <SettingsSection
            title="Financial Knowledge"
            description="Used to calibrate how detailed market explanations should be."
            className="mt-4"
          >
            <SegmentedGroup>
              {knowledgeLevels.map((level) => (
                <Chip
                  key={level}
                  label={knowledgeLabel(level)}
                  selected={financialKnowledge === level}
                  onPress={() => setFinancialKnowledge(level)}
                />
              ))}
            </SegmentedGroup>
          </SettingsSection>

          <View
            className="mt-4 rounded-[28px] border bg-white p-4"
            style={{ borderColor: dangerBorder }}
          >
            <Text className="font-sans text-[20px] font-semibold text-[#0F1728]">Danger Zone</Text>
            <Text className="mt-2 font-sans text-[14px] leading-[20px] text-[#7A8699]">
              This clears your onboarding answers and sends you back to the first setup step.
            </Text>

            <Pressable
              className="mt-4 h-14 items-center justify-center rounded-[18px] bg-[#FF453A]"
              onPress={restartOnboarding}
            >
              <Text className="font-sans text-[16px] font-semibold text-white">
                Reset Onboarding
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function SettingsSection({
  children,
  className,
  title,
  description,
}: {
  children: React.ReactNode
  className?: string
  title: string
  description: string
}) {
  return (
    <View
      className={`rounded-[28px] border bg-white p-4 ${className ?? ""}`}
      style={{ borderColor: surfaceBorder }}
    >
      <Text className="font-sans text-[20px] font-semibold text-[#0F1728]">{title}</Text>
      <Text className="mt-1 font-sans text-[14px] leading-[20px] text-[#7A8699]">
        {description}
      </Text>
      <View className="mt-4">{children}</View>
    </View>
  )
}

function InputField({
  label,
  ...inputProps
}: {
  label: string
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View
      className="rounded-[22px] border px-4 pb-4 pt-3"
      style={{ borderColor: surfaceBorder, backgroundColor: groupedBackground }}
    >
      <Text className="font-sans text-[13px] font-semibold tracking-[0.2px] text-[#6B7280]">
        {label}
      </Text>
      <TextInput
        className="mt-2 font-sans text-[17px] leading-[22px] text-[#0F1728]"
        placeholderTextColor="#98A1B2"
        {...inputProps}
      />
    </View>
  )
}

function SegmentedGroup({ children }: { children: React.ReactNode }) {
  return (
    <View
      className="flex-row flex-wrap rounded-[24px] border p-1.5"
      style={{ borderColor: surfaceBorder, backgroundColor: groupedBackground }}
    >
      {children}
    </View>
  )
}

function SummaryPill({ label }: { label: string }) {
  return (
    <View className="rounded-full bg-[#F3F5FA] px-3 py-2">
      <Text className="font-sans text-[13px] text-[#667085]">{label}</Text>
    </View>
  )
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      className={`mb-1 mr-1 min-h-11 min-w-[94px] flex-1 items-center justify-center rounded-[18px] px-4 py-3 ${
        selected ? "bg-[#2453FF]" : "bg-transparent"
      }`}
      onPress={onPress}
    >
      <Text
        className={`font-sans text-[15px] font-medium ${selected ? "text-white" : "text-[#6B7586]"}`}
      >
        {capitalize(label)}
      </Text>
    </Pressable>
  )
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function riskLabel(value: RiskExpertise) {
  switch (value) {
    case "beginner":
      return "Low"
    case "intermediate":
      return "Mid"
    default:
      return "High"
  }
}

function horizonLabel(value: InvestmentHorizon) {
  switch (value) {
    case "short":
      return "Short term"
    case "medium":
      return "Mid term"
    default:
      return "Long term"
  }
}

function knowledgeLabel(value: FinancialKnowledge) {
  switch (value) {
    case "novice":
      return "Beginner"
    case "savvy":
      return "Intermediate"
    default:
      return "Advanced"
  }
}

const $scrollContent = {
  paddingBottom: 120,
}
