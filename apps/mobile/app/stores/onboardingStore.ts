import { create } from "zustand"

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
const STORAGE_VERSION = 1

const initialState = {
  riskExpertise: "beginner" as RiskExpertise,
  investmentHorizon: "medium" as InvestmentHorizon,
  financialKnowledge: "savvy" as FinancialKnowledge,
  importMethod: null as ImportMethod,
}

type PersistedState = Pick<
  OnboardingState,
  "riskExpertise" | "investmentHorizon" | "financialKnowledge" | "importMethod"
>

type PersistedPayload = {
  state: PersistedState
  version: number
}

const selectPersistedState = (state: OnboardingState): PersistedState => ({
  riskExpertise: state.riskExpertise,
  investmentHorizon: state.investmentHorizon,
  financialKnowledge: state.financialKnowledge,
  importMethod: state.importMethod,
})

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const parsePersistedState = (value: unknown): PersistedState | null => {
  if (!isObjectRecord(value)) return null

  const stateRecord = isObjectRecord(value.state) ? value.state : value
  const riskExpertise = stateRecord.riskExpertise
  const investmentHorizon = stateRecord.investmentHorizon
  const financialKnowledge = stateRecord.financialKnowledge
  const importMethod = stateRecord.importMethod

  const isRiskExpertise = riskExpertise === "beginner" || riskExpertise === "intermediate" || riskExpertise === "expert"
  const isInvestmentHorizon = investmentHorizon === "short" || investmentHorizon === "medium" || investmentHorizon === "long"
  const isFinancialKnowledge = financialKnowledge === "novice" || financialKnowledge === "savvy" || financialKnowledge === "pro"
  const isImportMethod =
    importMethod === null || importMethod === "screenshot" || importMethod === "manual" || importMethod === "csv"

  if (!isRiskExpertise || !isInvestmentHorizon || !isFinancialKnowledge || !isImportMethod) return null

  return {
    riskExpertise,
    investmentHorizon,
    financialKnowledge,
    importMethod,
  }
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...initialState,
  setRiskExpertise: (riskExpertise) => set({ riskExpertise }),
  setInvestmentHorizon: (investmentHorizon) => set({ investmentHorizon }),
  setFinancialKnowledge: (financialKnowledge) => set({ financialKnowledge }),
  setImportMethod: (importMethod) => set({ importMethod }),
  reset: () => set({ ...initialState }),
}))

void (async () => {
  const saved = await loadString(STORAGE_KEY)
  if (!saved) return

  try {
    const parsed = JSON.parse(saved) as PersistedPayload | PersistedState
    const persistedState = parsePersistedState(parsed)
    if (!persistedState) {
      await remove(STORAGE_KEY)
      return
    }

    useOnboardingStore.setState({ ...persistedState })
  } catch {
    await remove(STORAGE_KEY)
  }
})()

useOnboardingStore.subscribe((state) => {
  const payload: PersistedPayload = {
    state: selectPersistedState(state),
    version: STORAGE_VERSION,
  }

  void saveString(STORAGE_KEY, JSON.stringify(payload))
})
