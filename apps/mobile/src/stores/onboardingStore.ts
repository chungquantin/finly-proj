import { create } from "zustand"

import { loadString, remove, saveString } from "@/utils/storage"

export type RiskExpertise = "beginner" | "intermediate" | "expert"
export type InvestmentHorizon = "short" | "medium" | "long"
export type FinancialKnowledge = "novice" | "savvy" | "pro"
export type PortfolioType = "crypto" | "stock"
export type StockAccountId = "growth-tech" | "dividend-core" | "balanced-index"
export type OnboardingLifecycle =
  | "started"
  | "in_progress"
  | "profile_ready"
  | "completed"
  | "error"

export type OnboardingState = {
  name: string
  riskExpertise: RiskExpertise
  investmentHorizon: InvestmentHorizon
  financialKnowledge: FinancialKnowledge
  portfolioType: PortfolioType | null
  walletAddress: string
  stockAccountId: StockAccountId | null
  investorProfileReviewed: boolean
  accountSelectionCompleted: boolean
  onboardingCompleted: boolean
  onboardingLifecycle: OnboardingLifecycle
  onboardingError: string | null
  setName: (value: string) => void
  setRiskExpertise: (value: RiskExpertise) => void
  setInvestmentHorizon: (value: InvestmentHorizon) => void
  setFinancialKnowledge: (value: FinancialKnowledge) => void
  setPortfolioType: (value: PortfolioType | null) => void
  setWalletAddress: (value: string) => void
  setStockAccountId: (value: StockAccountId | null) => void
  setInvestorProfileReviewed: (value: boolean) => void
  setAccountSelectionCompleted: (value: boolean) => void
  setOnboardingCompleted: (value: boolean) => void
  setOnboardingLifecycle: (value: OnboardingLifecycle) => void
  setOnboardingError: (value: string | null) => void
  completeOnboarding: () => void
  reset: () => void
}

const STORAGE_KEY = "finly.onboarding.profile.v1"
const STORAGE_VERSION = 5

const initialState: Pick<
  OnboardingState,
  | "name"
  | "riskExpertise"
  | "investmentHorizon"
  | "financialKnowledge"
  | "portfolioType"
  | "walletAddress"
  | "stockAccountId"
  | "investorProfileReviewed"
  | "accountSelectionCompleted"
  | "onboardingCompleted"
  | "onboardingLifecycle"
  | "onboardingError"
> = {
  name: "",
  riskExpertise: "beginner",
  investmentHorizon: "medium",
  financialKnowledge: "savvy",
  portfolioType: null,
  walletAddress: "",
  stockAccountId: null,
  investorProfileReviewed: false,
  accountSelectionCompleted: false,
  onboardingCompleted: false,
  onboardingLifecycle: "started",
  onboardingError: null,
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
  | "investorProfileReviewed"
  | "accountSelectionCompleted"
  | "onboardingCompleted"
  | "onboardingLifecycle"
  | "onboardingError"
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
  investorProfileReviewed: state.investorProfileReviewed,
  accountSelectionCompleted: state.accountSelectionCompleted,
  onboardingCompleted: state.onboardingCompleted,
  onboardingLifecycle: state.onboardingLifecycle,
  onboardingError: state.onboardingError,
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

const asOnboardingLifecycle = (value: unknown): OnboardingLifecycle | null => {
  if (
    value === "started" ||
    value === "in_progress" ||
    value === "profile_ready" ||
    value === "completed" ||
    value === "error"
  )
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
  const onboardingLifecycle =
    asOnboardingLifecycle(stateRecord.onboardingLifecycle) ??
    (onboardingCompleted ? "completed" : "started")
  const onboardingError =
    typeof stateRecord.onboardingError === "string" ? stateRecord.onboardingError : null
  const investorProfileReviewed =
    typeof stateRecord.investorProfileReviewed === "boolean"
      ? stateRecord.investorProfileReviewed
      : false
  const accountSelectionCompleted =
    typeof stateRecord.accountSelectionCompleted === "boolean"
      ? stateRecord.accountSelectionCompleted
      : false

  return {
    name,
    riskExpertise,
    investmentHorizon,
    financialKnowledge,
    portfolioType,
    walletAddress,
    stockAccountId,
    investorProfileReviewed,
    accountSelectionCompleted,
    onboardingCompleted,
    onboardingLifecycle,
    onboardingError,
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
  setInvestorProfileReviewed: (investorProfileReviewed) => set({ investorProfileReviewed }),
  setAccountSelectionCompleted: (accountSelectionCompleted) => set({ accountSelectionCompleted }),
  setOnboardingCompleted: (onboardingCompleted) =>
    set({
      onboardingCompleted,
      onboardingLifecycle: onboardingCompleted ? "completed" : "in_progress",
      onboardingError: null,
    }),
  setOnboardingLifecycle: (onboardingLifecycle) => set({ onboardingLifecycle }),
  setOnboardingError: (onboardingError) => set({ onboardingError }),
  completeOnboarding: () =>
    set({ onboardingCompleted: true, onboardingLifecycle: "completed", onboardingError: null }),
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
