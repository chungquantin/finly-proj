import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { loadString, remove, saveString } from "@/utils/storage"

export type RiskExpertise = "beginner" | "intermediate" | "expert"
export type InvestmentHorizon = "short" | "medium" | "long"
export type FinancialKnowledge = "novice" | "savvy" | "pro"
export type ImportMethod = "screenshot" | "manual" | "csv" | null

type OnboardingState = {
  riskExpertise: RiskExpertise
  investmentHorizon: InvestmentHorizon
  financialKnowledge: FinancialKnowledge
  importMethod: ImportMethod
  setRiskExpertise: (value: RiskExpertise) => void
  setInvestmentHorizon: (value: InvestmentHorizon) => void
  setFinancialKnowledge: (value: FinancialKnowledge) => void
  setImportMethod: (value: ImportMethod) => void
  reset: () => void
}

const STORAGE_KEY = "finly.onboarding.profile.v1"

const mmkvStorage = {
  getItem: async (name: string) => (await loadString(name)) ?? null,
  setItem: async (name: string, value: string) => {
    await saveString(name, value)
  },
  removeItem: async (name: string) => {
    await remove(name)
  },
}

const initialState = {
  riskExpertise: "beginner" as RiskExpertise,
  investmentHorizon: "medium" as InvestmentHorizon,
  financialKnowledge: "savvy" as FinancialKnowledge,
  importMethod: null as ImportMethod,
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      ...initialState,
      setRiskExpertise: (riskExpertise) => set({ riskExpertise }),
      setInvestmentHorizon: (investmentHorizon) => set({ investmentHorizon }),
      setFinancialKnowledge: (financialKnowledge) => set({ financialKnowledge }),
      setImportMethod: (importMethod) => set({ importMethod }),
      reset: () => set({ ...initialState }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => mmkvStorage),
      version: 1,
    },
  ),
)
