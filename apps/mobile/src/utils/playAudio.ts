/**
 * Play base64-encoded audio (mp3) from TTS responses.
 */
import { Audio } from "expo-av"

let currentSound: Audio.Sound | null = null

/**
 * Play a base64-encoded mp3 string. Stops any currently playing audio first.
 */
export async function playBase64Audio(b64: string): Promise<void> {
  try {
    if (currentSound) {
      await currentSound.stopAsync().catch(() => {})
      await currentSound.unloadAsync().catch(() => {})
      currentSound = null
    }

    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    })

    // expo-av supports data URIs directly
    const uri = `data:audio/mp3;base64,${b64}`
    const { sound } = await Audio.Sound.createAsync({ uri })
    currentSound = sound

    sound.setOnPlaybackStatusUpdate((status) => {
      if ("didJustFinish" in status && status.didJustFinish) {
        sound.unloadAsync().catch(() => {})
        if (currentSound === sound) currentSound = null
      }
    })

    await sound.playAsync()
  } catch (e) {
    if (__DEV__) console.warn("TTS playback error:", e)
  }
}

/**
 * Stop any currently playing TTS audio.
 */
export async function stopAudio(): Promise<void> {
  if (currentSound) {
    await currentSound.stopAsync().catch(() => {})
    await currentSound.unloadAsync().catch(() => {})
    currentSound = null
  }
}
