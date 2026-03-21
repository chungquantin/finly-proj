const investorAvatarEmojis = ["😀", "😎", "🥳", "🦄", "🌈", "🚀", "🧠", "🐼", "🍀", "🎯"] as const

const hashString = (value: string) =>
  value.split("").reduce((hash, character) => hash * 31 + character.charCodeAt(0), 0)

export function getInvestorAvatarEmoji(name: string) {
  const normalizedName = name.trim().toLowerCase()
  const seed = normalizedName.length > 0 ? normalizedName : "investor"
  const index = Math.abs(hashString(seed)) % investorAvatarEmojis.length

  return investorAvatarEmojis[index]
}
