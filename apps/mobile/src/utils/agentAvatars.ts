import type { ImageSourcePropType } from "react-native"

const avatarPalettes = [
  { background: "#EEF3FF", accent: "#2453FF", ring: "#DCE5FF" },
  { background: "#FFF4EA", accent: "#D96B2B", ring: "#FFE4D0" },
  { background: "#ECFFF5", accent: "#169B62", ring: "#CEF5E0" },
  { background: "#FFF0F6", accent: "#C2437D", ring: "#FFD8E8" },
  { background: "#F3F0FF", accent: "#6A4CE0", ring: "#E0D8FF" },
  { background: "#EEFDFC", accent: "#178A8A", ring: "#D2F6F4" },
] as const

const hashString = (value: string) =>
  value.split("").reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7)

const avatarImageByRole: Record<string, ImageSourcePropType> = {
  advisor: require("../../assets/images/finly-avatars/finly-advisor.jpg"),
  analyst: require("../../assets/images/finly-avatars/finly-analyst.jpg"),
  researcher: require("../../assets/images/finly-avatars/finly-researcher.jpg"),
  trader: require("../../assets/images/finly-avatars/finly-trader.jpg"),
}

const normalizeRoleKey = (value: string) => {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return "advisor"

  if (normalized.includes("analyst")) return "analyst"
  if (normalized.includes("research")) return "researcher"
  if (normalized.includes("trader")) return "trader"
  if (normalized.includes("advisor")) return "advisor"
  if (normalized.includes("risk")) return "trader"
  if (normalized.includes("portfolio")) return "advisor"

  return normalized
}

export const getRandomAgentAvatar = (seed: string) => {
  const hash = hashString(seed)
  const normalizedRole = normalizeRoleKey(seed)
  return {
    image: avatarImageByRole[normalizedRole] ?? avatarImageByRole.advisor,
    palette: avatarPalettes[hash % avatarPalettes.length],
  }
}
