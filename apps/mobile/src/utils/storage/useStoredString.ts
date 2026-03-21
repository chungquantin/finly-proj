import { useEffect, useState } from "react"

import { loadString, remove, saveString } from "@/utils/storage"

export function useStoredString(key: string): [string | undefined, (value?: string) => void] {
  const [value, setValue] = useState<string | undefined>(undefined)

  useEffect(() => {
    let cancelled = false

    const hydrate = async () => {
      const stored = await loadString(key)
      if (!cancelled) {
        setValue(stored ?? undefined)
      }
    }

    hydrate()

    return () => {
      cancelled = true
    }
  }, [key])

  const setPersistedValue = (nextValue?: string) => {
    setValue(nextValue)

    if (nextValue === undefined) {
      void remove(key)
      return
    }

    void saveString(key, nextValue)
  }

  return [value, setPersistedValue]
}
