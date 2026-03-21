/* eslint-disable no-restricted-imports */
import { useEffect, useMemo, useState } from "react"
import { Image, View } from "react-native"

import { Text } from "@/components/Text"
import { getTickerLogoUris } from "@/utils/tickerLogo"

type TickerLogoProps = {
  ticker: string
  logoUri?: string
  size?: number
}

const DARK_BADGE_TICKERS = new Set(["AAPL"])

function shouldUseDarkBadge(ticker: string, logoUri?: string) {
  const normalizedTicker = ticker.trim().toUpperCase()
  if (DARK_BADGE_TICKERS.has(normalizedTicker)) return true

  const normalizedUri = logoUri?.toLowerCase() ?? ""
  return normalizedUri.includes("/aapl.")
}

export function TickerLogo({ ticker, logoUri, size = 48 }: TickerLogoProps) {
  const candidateUris = useMemo(() => {
    const fallbackUris = getTickerLogoUris(ticker)
    if (!logoUri) return fallbackUris
    return Array.from(new Set([logoUri, ...fallbackUris]))
  }, [logoUri, ticker])
  const [hasError, setHasError] = useState(false)
  const [uriIndex, setUriIndex] = useState(0)
  const activeUri = candidateUris[uriIndex]
  const useDarkBadge = shouldUseDarkBadge(ticker, activeUri)
  const imageSize = Math.round(size * 0.58)
  const textSize = Math.max(10, Math.round(size * 0.31))

  useEffect(() => {
    setHasError(false)
    setUriIndex(0)
  }, [candidateUris])

  const badgeStyle = {
    width: size,
    height: size,
    shadowColor: "#111111",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  } as const

  if (!activeUri || hasError) {
    return (
      <View
        className={`items-center justify-center rounded-full border ${useDarkBadge ? "border-[#1F1F22] bg-[#111111]" : "border-[#F3F4F8] bg-white"}`}
        style={badgeStyle}
      >
        <Text
          className={useDarkBadge ? "text-white" : "text-[#2453FF]"}
          style={{ fontSize: textSize }}
          weight="semiBold"
        >
          {ticker.slice(0, 2)}
        </Text>
      </View>
    )
  }

  return (
    <View
      className={`items-center justify-center rounded-full border ${useDarkBadge ? "border-[#1F1F22] bg-[#111111]" : "border-[#F3F4F8] bg-white"}`}
      style={badgeStyle}
    >
      <Image
        source={{ uri: activeUri }}
        style={{ width: imageSize, height: imageSize }}
        resizeMode="contain"
        onError={() => {
          if (uriIndex < candidateUris.length - 1) {
            setUriIndex((current) => current + 1)
            return
          }
          setHasError(true)
        }}
      />
    </View>
  )
}
