import { create } from "zustand"

import { loadString, remove, saveString } from "@/utils/storage"

export type AgentObjectiveOverrides = Record<string, string>

type AgentPreferencesState = {
  primaryObjectives: AgentObjectiveOverrides
  setPrimaryObjective: (agentId: string, objective: string) => void
  clearPrimaryObjective: (agentId: string) => void
}

type PersistedState = Pick<AgentPreferencesState, "primaryObjectives">

type PersistedPayload = {
  state: PersistedState
  version: number
}

const STORAGE_KEY = "finly.agent-preferences.v1"
const STORAGE_VERSION = 1

const initialState: PersistedState = {
  primaryObjectives: {},
}

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const parsePersistedState = (value: unknown): PersistedState | null => {
  if (!isObjectRecord(value)) return null

  const stateRecord = isObjectRecord(value.state) ? value.state : value
  if (!isObjectRecord(stateRecord.primaryObjectives)) {
    return initialState
  }

  const primaryObjectives = Object.fromEntries(
    Object.entries(stateRecord.primaryObjectives).filter(
      ([agentId, objective]) => typeof agentId === "string" && typeof objective === "string",
    ),
  )

  return { primaryObjectives }
}

const selectPersistedState = (state: AgentPreferencesState): PersistedState => ({
  primaryObjectives: state.primaryObjectives,
})

export const useAgentPreferencesStore = create<AgentPreferencesState>((set) => ({
  ...initialState,
  setPrimaryObjective: (agentId, objective) =>
    set((state) => ({
      primaryObjectives: {
        ...state.primaryObjectives,
        [agentId]: objective.trim(),
      },
    })),
  clearPrimaryObjective: (agentId) =>
    set((state) => {
      const nextObjectives = { ...state.primaryObjectives }
      delete nextObjectives[agentId]

      return { primaryObjectives: nextObjectives }
    }),
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

    useAgentPreferencesStore.setState({ ...persistedState })
  } catch {
    await remove(STORAGE_KEY)
  }
})()

useAgentPreferencesStore.subscribe((state) => {
  const payload: PersistedPayload = {
    state: selectPersistedState(state),
    version: STORAGE_VERSION,
  }

  void saveString(STORAGE_KEY, JSON.stringify(payload))
})
