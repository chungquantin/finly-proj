const mockLoadString = jest.fn()
const mockSaveString = jest.fn()
const mockRemove = jest.fn()

jest.mock("@/utils/storage", () => ({
  loadString: (...args: unknown[]) => mockLoadString(...args),
  saveString: (...args: unknown[]) => mockSaveString(...args),
  remove: (...args: unknown[]) => mockRemove(...args),
}))

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe("onboardingStore", () => {
  beforeEach(() => {
    jest.resetModules()
    mockLoadString.mockReset()
    mockSaveString.mockReset()
    mockRemove.mockReset()

    mockLoadString.mockResolvedValue(null)
    mockSaveString.mockResolvedValue(true)
    mockRemove.mockResolvedValue(undefined)
  })

  it("hydrates from legacy payload and maps importMethod -> stockAccountId", async () => {
    mockLoadString.mockResolvedValueOnce(
      JSON.stringify({
        state: {
          riskExpertise: "intermediate",
          investmentHorizon: "long",
          financialKnowledge: "pro",
          importMethod: "csv",
        },
        version: 1,
      }),
    )

    const { useOnboardingStore } = require("./onboardingStore")
    await flush()

    const state = useOnboardingStore.getState()

    expect(state.riskExpertise).toBe("intermediate")
    expect(state.investmentHorizon).toBe("long")
    expect(state.financialKnowledge).toBe("pro")
    expect(state.stockAccountId).toBe("balanced-index")
    expect(state.portfolioType).toBeNull()
  })

  it("enforces branch guards between crypto wallet and stock import", async () => {
    const { useOnboardingStore } = require("./onboardingStore")

    useOnboardingStore.getState().setStockAccountId("dividend-core")
    useOnboardingStore.getState().setPortfolioType("crypto")

    let state = useOnboardingStore.getState()
    expect(state.portfolioType).toBe("crypto")
    expect(state.stockAccountId).toBeNull()

    useOnboardingStore.getState().setWalletAddress("0xabc123456789")
    useOnboardingStore.getState().setPortfolioType("stock")

    state = useOnboardingStore.getState()
    expect(state.portfolioType).toBe("stock")
    expect(state.walletAddress).toBe("")
  })

  it("persists new onboarding fields", async () => {
    const { useOnboardingStore } = require("./onboardingStore")

    useOnboardingStore.getState().setRiskExpertise("expert")
    useOnboardingStore.getState().setPortfolioType("crypto")
    useOnboardingStore.getState().setWalletAddress("0xabc123456789")
    useOnboardingStore.getState().setOnboardingCompleted(true)

    const saveCalls = mockSaveString.mock.calls
    expect(saveCalls.length).toBeGreaterThan(0)

    const latestPayload = JSON.parse(saveCalls[saveCalls.length - 1][1])

    expect(latestPayload.version).toBe(4)
    expect(latestPayload.state.riskExpertise).toBe("expert")
    expect(latestPayload.state.portfolioType).toBe("crypto")
    expect(latestPayload.state.walletAddress).toBe("0xabc123456789")
    expect(latestPayload.state.onboardingCompleted).toBe(true)
  })
})
