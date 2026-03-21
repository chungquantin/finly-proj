import AsyncStorage from "@react-native-async-storage/async-storage"

export const storage = {
  async getString(key: string): Promise<string | null> {
    return AsyncStorage.getItem(key)
  },
  async set(key: string, value: string): Promise<void> {
    await AsyncStorage.setItem(key, value)
  },
  async delete(key: string): Promise<void> {
    await AsyncStorage.removeItem(key)
  },
  async clearAll(): Promise<void> {
    await AsyncStorage.clear()
  },
  async getAllKeys(): Promise<readonly string[]> {
    return AsyncStorage.getAllKeys()
  },
}

/**
 * Loads a string from storage.
 *
 * @param key The key to fetch.
 */
export async function loadString(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key)
  } catch {
    return null
  }
}

/**
 * Saves a string to storage.
 *
 * @param key The key to fetch.
 * @param value The value to store.
 */
export async function saveString(key: string, value: string): Promise<boolean> {
  try {
    await AsyncStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

/**
 * Loads something from storage and runs it thru JSON.parse.
 *
 * @param key The key to fetch.
 */
export async function load<T>(key: string): Promise<T | null> {
  let almostThere: string | null = null
  try {
    almostThere = await loadString(key)
    return JSON.parse(almostThere ?? "") as T
  } catch {
    return (almostThere as T) ?? null
  }
}

/**
 * Saves an object to storage.
 *
 * @param key The key to fetch.
 * @param value The value to store.
 */
export async function save(key: string, value: unknown): Promise<boolean> {
  try {
    await saveString(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

/**
 * Removes something from storage.
 *
 * @param key The key to kill.
 */
export async function remove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key)
  } catch {}
}

/**
 * Burn it all to the ground.
 */
export async function clear(): Promise<void> {
  try {
    await AsyncStorage.clear()
  } catch {}
}
