import { create } from "zustand"

import { loadString, remove, saveString } from "@/utils/storage"

export type RiskExpertise = "beginner" | "intermediate" | "expert"
export type InvestmentHorizon = "short" | "medium" | "long"
export type FinancialKnowledge = "novice" | "savvy" | "pro"
export type PortfolioType = "crypto" | "stock"
export type StockAccountId = "growth-tech" | "dividend-core" | "balanced-index"

export type OnboardingState = {
  name: string
  riskExpertise: RiskExpertise
  investmentHorizon: InvestmentHorizon
  financialKnowledge: FinancialKnowledge
  portfolioType: PortfolioType | null
  walletAddress: string
  stockAccountId: StockAccountId | null
  onboardingCompleted: boolean
  setName: (value: string) => void
  setRiskExpertise: (value: RiskExpertise) => void
  setInvestmentHorizon: (value: InvestmentHorizon) => void
  setFinancialKnowledge: (value: FinancialKnowledge) => void
  setPortfolioType: (value: PortfolioType | null) => void
  setWalletAddress: (value: string) => void
  setStockAccountId: (value: StockAccountId | null) => void
  setOnboardingCompleted: (value: boolean) => void
  completeOnboarding: () => void
  reset: () => void
}

const STORAGE_KEY = "finly.onboarding.profile.v1"
const STORAGE_VERSION = 4

const initialState: Pick<
  OnboardingState,
  | "name"
  | "riskExpertise"
  | "investmentHorizon"
  | "financialKnowledge"
  | "portfolioType"
  | "walletAddress"
  | "stockAccountId"
  | "onboardingCompleted"
> = {
  name: "",
  riskExpertise: "beginner",
  investmentHorizon: "medium",
  financialKnowledge: "savvy",
  portfolioType: null,
  walletAddress: "",
  stockAccountId: null,
  onboardingCompleted: false,
}

type PersistedState = Pick<
  OnboardingState,
  | "name"
  | "riskExpertise"
  | "investmentHorizon"
  | "financialKnowledge"
  | "portfolioType"
  | "walletAddress"
  | "stockAccountId"
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
  stockAccountId?: unknown
  stockImportMethod?: unknown
  importMethod?: unknown
}

const selectPersistedState = (state: OnboardingState): PersistedState => ({
  name: state.name,
  riskExpertise: state.riskExpertise,
  investmentHorizon: state.investmentHorizon,
  financialKnowledge: state.financialKnowledge,
  portfolioType: state.portfolioType,
  walletAddress: state.walletAddress,
  stockAccountId: state.stockAccountId,
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

const asStockAccountId = (value: unknown): StockAccountId | null => {
  if (value === "growth-tech" || value === "dividend-core" || value === "balanced-index")
    return value
  return null
}

const fromLegacyImportMethod = (value: unknown): StockAccountId | null => {
  if (value === "screenshot") return "growth-tech"
  if (value === "manual") return "dividend-core"
  if (value === "csv") return "balanced-index"
  return null
}

const parsePersistedState = (value: unknown): PersistedState | null => {
  if (!isObjectRecord(value)) return null

  const stateRecord = isObjectRecord(value.state) ? value.state : value
  const legacyRecord = stateRecord as LegacyPersistedState

  const name = typeof stateRecord.name === "string" ? stateRecord.name : ""
  const riskExpertise = asRiskExpertise(stateRecord.riskExpertise) ?? initialState.riskExpertise
  const investmentHorizon =
    asInvestmentHorizon(stateRecord.investmentHorizon) ?? initialState.investmentHorizon
  const financialKnowledge =
    asFinancialKnowledge(stateRecord.financialKnowledge) ?? initialState.financialKnowledge

  const portfolioType = asPortfolioType(stateRecord.portfolioType)
  const walletAddress =
    typeof stateRecord.walletAddress === "string" ? stateRecord.walletAddress : ""

  // Backward compatibility: old payload used `stockImportMethod` / `importMethod`.
  const stockAccountId =
    asStockAccountId(stateRecord.stockAccountId) ??
    asStockAccountId(legacyRecord.stockAccountId) ??
    fromLegacyImportMethod(legacyRecord.stockImportMethod) ??
    fromLegacyImportMethod(legacyRecord.importMethod)

  const onboardingCompleted =
    typeof stateRecord.onboardingCompleted === "boolean" ? stateRecord.onboardingCompleted : false

  return {
    name,
    riskExpertise,
    investmentHorizon,
    financialKnowledge,
    portfolioType,
    walletAddress,
    stockAccountId,
    onboardingCompleted,
  }
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...initialState,
  setName: (name) => set({ name }),
  setRiskExpertise: (riskExpertise) => set({ riskExpertise }),
  setInvestmentHorizon: (investmentHorizon) => set({ investmentHorizon }),
  setFinancialKnowledge: (financialKnowledge) => set({ financialKnowledge }),
  setPortfolioType: (portfolioType) =>
    set((state) => {
      if (portfolioType === "crypto") {
        return {
          ...state,
          portfolioType,
          stockAccountId: null,
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
      stockAccountId: null,
    })),
  setStockAccountId: (stockAccountId) =>
    set((state) => ({
      ...state,
      stockAccountId,
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
