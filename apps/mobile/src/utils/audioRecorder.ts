/**
 * Audio recording utility.
 * Uses expo-av on native, browser MediaRecorder on web.
 */
import { Platform } from "react-native"

// ---------------------------------------------------------------------------
// Shared interface
// ---------------------------------------------------------------------------

let _stopFn: (() => Promise<RecordingResult | null>) | null = null
let _cancelFn: (() => Promise<void>) | null = null

export interface RecordingResult {
  /** File URI (native) — may be empty on web */
  uri: string | null
  /** Base64 audio data (web) — null on native */
  base64: string | null
  /** MIME type of the recorded audio */
  mimeType: string
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

export async function startRecording(): Promise<void> {
  if (Platform.OS === "web") {
    await startRecordingWeb()
  } else {
    await startRecordingNative()
  }
}

// ---------------------------------------------------------------------------
// Stop → returns result
// ---------------------------------------------------------------------------

export async function stopRecording(): Promise<RecordingResult | null> {
  if (_stopFn) {
    const result = await _stopFn()
    _stopFn = null
    _cancelFn = null
    return result
  }
  return null
}

// ---------------------------------------------------------------------------
// Cancel
// ---------------------------------------------------------------------------

export async function cancelRecording(): Promise<void> {
  if (_cancelFn) {
    await _cancelFn()
    _stopFn = null
    _cancelFn = null
  }
}

// ---------------------------------------------------------------------------
// Native (expo-av)
// ---------------------------------------------------------------------------

async function startRecordingNative(): Promise<void> {
  const { Audio } = await import("expo-av")

  const { granted } = await Audio.requestPermissionsAsync()
  if (!granted) throw new Error("Microphone permission not granted")

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  })

  const { recording } = await Audio.Recording.createAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY,
  )

  _stopFn = async () => {
    await recording.stopAndUnloadAsync()
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    })
    const uri = recording.getURI()
    return { uri: uri ?? null, base64: null, mimeType: "audio/m4a" }
  }

  _cancelFn = async () => {
    try {
      await recording.stopAndUnloadAsync()
    } catch {
      // ignore
    }
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    })
  }
}

// ---------------------------------------------------------------------------
// Web (MediaRecorder)
// ---------------------------------------------------------------------------

async function startRecordingWeb(): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

  // Pick a supported mime type
  const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? "audio/webm;codecs=opus"
    : "audio/webm"

  const mediaRecorder = new MediaRecorder(stream, { mimeType })
  const chunks: Blob[] = []

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  mediaRecorder.start()

  _stopFn = () =>
    new Promise<RecordingResult | null>((resolve) => {
      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach((t) => t.stop())

        const blob = new Blob(chunks, { type: "audio/webm" })
        // Convert to base64
        const reader = new FileReader()
        reader.onloadend = () => {
          const dataUrl = reader.result as string
          // Strip "data:audio/webm;base64," prefix
          const base64 = dataUrl.split(",")[1] ?? null
          resolve({ uri: null, base64, mimeType: "audio/webm" })
        }
        reader.readAsDataURL(blob)
      }
      mediaRecorder.stop()
    })

  _cancelFn = async () => {
    try {
      mediaRecorder.stop()
    } catch {
      // ignore
    }
    stream.getTracks().forEach((t) => t.stop())
  }
}
