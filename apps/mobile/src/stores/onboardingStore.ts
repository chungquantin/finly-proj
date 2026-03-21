import { create } from "zustand"

import { loadString, remove, saveString } from "@/utils/storage"

export type RiskExpertise = "beginner" | "intermediate" | "expert"
export type InvestmentHorizon = "short" | "medium" | "long"
export type FinancialKnowledge = "novice" | "savvy" | "pro"
export type PortfolioType = "crypto" | "stock"
export type StockImportMethod = "screenshot" | "manual" | "csv"

export type OnboardingState = {
  riskExpertise: RiskExpertise
  investmentHorizon: InvestmentHorizon
  financialKnowledge: FinancialKnowledge
  portfolioType: PortfolioType | null
  walletAddress: string
  stockImportMethod: StockImportMethod | null
  onboardingCompleted: boolean
  setRiskExpertise: (value: RiskExpertise) => void
  setInvestmentHorizon: (value: InvestmentHorizon) => void
  setFinancialKnowledge: (value: FinancialKnowledge) => void
  setPortfolioType: (value: PortfolioType | null) => void
  setWalletAddress: (value: string) => void
  setStockImportMethod: (value: StockImportMethod | null) => void
  setOnboardingCompleted: (value: boolean) => void
  completeOnboarding: () => void
  reset: () => void
}

const STORAGE_KEY = "finly.onboarding.profile.v1"
const STORAGE_VERSION = 2

const initialState: Pick<
  OnboardingState,
  | "riskExpertise"
  | "investmentHorizon"
  | "financialKnowledge"
  | "portfolioType"
  | "walletAddress"
  | "stockImportMethod"
  | "onboardingCompleted"
> = {
  riskExpertise: "beginner",
  investmentHorizon: "medium",
  financialKnowledge: "savvy",
  portfolioType: null,
  walletAddress: "",
  stockImportMethod: null,
  onboardingCompleted: false,
}

type PersistedState = Pick<
  OnboardingState,
  | "riskExpertise"
  | "investmentHorizon"
  | "financialKnowledge"
  | "portfolioType"
  | "walletAddress"
  | "stockImportMethod"
  | "onboardingCompleted"
>

type PersistedPayload = {
  state: PersistedState
  version: number
}

type LegacyPersistedState = {
  riskExpertise?: unknown
  investmentHorizon?: unknown
  financialKnowledge?: unknown
  importMethod?: unknown
}

const selectPersistedState = (state: OnboardingState): PersistedState => ({
  riskExpertise: state.riskExpertise,
  investmentHorizon: state.investmentHorizon,
  financialKnowledge: state.financialKnowledge,
  portfolioType: state.portfolioType,
  walletAddress: state.walletAddress,
  stockImportMethod: state.stockImportMethod,
  onboardingCompleted: state.onboardingCompleted,
})

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const asRiskExpertise = (value: unknown): RiskExpertise | null => {
  if (value === "beginner" || value === "intermediate" || value === "expert") return value
  return null
}

const asInvestmentHorizon = (value: unknown): InvestmentHorizon | null => {
  if (value === "short" || value === "medium" || value === "long") return value
  return null
}

const asFinancialKnowledge = (value: unknown): FinancialKnowledge | null => {
  if (value === "novice" || value === "savvy" || value === "pro") return value
  return null
}

const asPortfolioType = (value: unknown): PortfolioType | null => {
  if (value === "crypto" || value === "stock") return value
  return null
}

const asStockImportMethod = (value: unknown): StockImportMethod | null => {
  if (value === "screenshot" || value === "manual" || value === "csv") return value
  return null
}

const parsePersistedState = (value: unknown): PersistedState | null => {
  if (!isObjectRecord(value)) return null

  const stateRecord = isObjectRecord(value.state) ? value.state : value
  const legacyRecord = stateRecord as LegacyPersistedState

  const riskExpertise = asRiskExpertise(stateRecord.riskExpertise) ?? initialState.riskExpertise
  const investmentHorizon =
    asInvestmentHorizon(stateRecord.investmentHorizon) ?? initialState.investmentHorizon
  const financialKnowledge =
    asFinancialKnowledge(stateRecord.financialKnowledge) ?? initialState.financialKnowledge

  const portfolioType = asPortfolioType(stateRecord.portfolioType)
  const walletAddress =
    typeof stateRecord.walletAddress === "string" ? stateRecord.walletAddress : ""

  // Backward compatibility: old payload used `importMethod`.
  const stockImportMethod =
    asStockImportMethod(stateRecord.stockImportMethod) ??
    asStockImportMethod(legacyRecord.importMethod)

  const onboardingCompleted =
    typeof stateRecord.onboardingCompleted === "boolean" ? stateRecord.onboardingCompleted : false

  return {
    riskExpertise,
    investmentHorizon,
    financialKnowledge,
    portfolioType,
    walletAddress,
    stockImportMethod,
    onboardingCompleted,
  }
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...initialState,
  setRiskExpertise: (riskExpertise) => set({ riskExpertise }),
  setInvestmentHorizon: (investmentHorizon) => set({ investmentHorizon }),
  setFinancialKnowledge: (financialKnowledge) => set({ financialKnowledge }),
  setPortfolioType: (portfolioType) =>
    set((state) => {
      if (portfolioType === "crypto") {
        return {
          ...state,
          portfolioType,
          stockImportMethod: null,
        }
      }

      if (portfolioType === "stock") {
        return {
          ...state,
          portfolioType,
          walletAddress: "",
        }
      }

      return {
        ...state,
        portfolioType,
      }
    }),
  setWalletAddress: (walletAddress) =>
    set((state) => ({
      ...state,
      walletAddress,
      portfolioType: state.portfolioType ?? "crypto",
      stockImportMethod: null,
    })),
  setStockImportMethod: (stockImportMethod) =>
    set((state) => ({
      ...state,
      stockImportMethod,
      portfolioType: state.portfolioType ?? "stock",
      walletAddress: "",
    })),
  setOnboardingCompleted: (onboardingCompleted) => set({ onboardingCompleted }),
  completeOnboarding: () => set({ onboardingCompleted: true }),
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
