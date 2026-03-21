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

const riskLevels: RiskExpertise[] = ["beginner", "intermediate", "expert"]
const horizons: InvestmentHorizon[] = ["short", "medium", "long"]
const knowledgeLevels: FinancialKnowledge[] = ["novice", "savvy", "pro"]

export default function SettingsTab() {
  const router = useRouter()

  const name = useOnboardingStore((state) => state.name)
  const riskExpertise = useOnboardingStore((state) => state.riskExpertise)
  const investmentHorizon = useOnboardingStore((state) => state.investmentHorizon)
  const financialKnowledge = useOnboardingStore((state) => state.financialKnowledge)
  const walletAddress = useOnboardingStore((state) => state.walletAddress)

  const setName = useOnboardingStore((state) => state.setName)
  const setRiskExpertise = useOnboardingStore((state) => state.setRiskExpertise)
  const setInvestmentHorizon = useOnboardingStore((state) => state.setInvestmentHorizon)
  const setFinancialKnowledge = useOnboardingStore((state) => state.setFinancialKnowledge)
  const setWalletAddress = useOnboardingStore((state) => state.setWalletAddress)
  const reset = useOnboardingStore((state) => state.reset)

  const restartOnboarding = () => {
    reset()
    router.replace("/onboarding/step-1")
  }

  return (
    <SafeAreaView className="flex-1 bg-[#FBFCFF]">
      <ScrollView className="flex-1" contentContainerStyle={$scrollContent}>
        <IosHeader title="Investor Profile" leftLabel="‹" rightLabel="" />

        <View className="px-4">
          <SectionCard>
            <Text className="font-sans text-[22px] font-semibold text-[#0F1728]">Name</Text>
            <TextInput
              className="mt-3 rounded-[20px] border border-[#E7EAF2] bg-[#F6F8FF] px-4 py-3 text-[15px] text-[#0F1728]"
              placeholder="Enter your name"
              placeholderTextColor="#98A1B2"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoCorrect={false}
            />
          </SectionCard>

          <SectionCard className="mt-4">
            <Text className="font-sans text-[22px] font-semibold text-[#0F1728]">Risk Profile</Text>
            <View className="mt-3 flex-row gap-2">
              {riskLevels.map((risk) => (
                <Chip
                  key={risk}
                  label={risk}
                  selected={riskExpertise === risk}
                  onPress={() => setRiskExpertise(risk)}
                />
              ))}
            </View>
          </SectionCard>

          <SectionCard className="mt-4">
            <Text className="font-sans text-[22px] font-semibold text-[#0F1728]">
              Investment Horizon
            </Text>
            <View className="mt-3 flex-row gap-2">
              {horizons.map((horizon) => (
                <Chip
                  key={horizon}
                  label={horizon}
                  selected={investmentHorizon === horizon}
                  onPress={() => setInvestmentHorizon(horizon)}
                />
              ))}
            </View>
          </SectionCard>

          <SectionCard className="mt-4">
            <Text className="font-sans text-[22px] font-semibold text-[#0F1728]">
              Financial Knowledge
            </Text>
            <View className="mt-3 flex-row gap-2">
              {knowledgeLevels.map((level) => (
                <Chip
                  key={level}
                  label={level}
                  selected={financialKnowledge === level}
                  onPress={() => setFinancialKnowledge(level)}
                />
              ))}
            </View>
          </SectionCard>

          <SectionCard className="mt-4">
            <Text className="font-sans text-[15px] font-semibold text-[#7A8699]">
              Wallet Address
            </Text>
            <TextInput
              className="mt-3 rounded-[20px] border border-[#E7EAF2] bg-[#F6F8FF] px-4 py-3 text-[15px] text-[#0F1728]"
              placeholder="0x..."
              placeholderTextColor="#98A1B2"
              value={walletAddress}
              onChangeText={setWalletAddress}
              autoCapitalize="none"
            />
          </SectionCard>

          <Pressable
            className="mt-5 h-14 items-center justify-center rounded-[22px] bg-[#FF3B30]"
            onPress={restartOnboarding}
          >
            <Text className="font-sans text-[17px] font-semibold text-white">
              Reset & Restart Onboarding
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <View className={`rounded-[28px] border border-[#EEF2F7] bg-white p-4 ${className ?? ""}`}>
      {children}
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
      className={`rounded-full px-4 py-2.5 ${selected ? "bg-[#2453FF]" : "bg-[#F3F6FC]"}`}
      onPress={onPress}
    >
      <Text className={`font-sans text-[15px] ${selected ? "text-white" : "text-[#6B7586]"}`}>
        {label}
      </Text>
    </Pressable>
  )
}

const $scrollContent = {
  paddingBottom: 120,
}
