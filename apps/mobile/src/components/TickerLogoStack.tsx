/* eslint-disable no-restricted-imports */
import { View } from "react-native"

import { TickerLogo } from "@/components/TickerLogo"
import { getTickerLogoUri } from "@/utils/tickerLogo"

type TickerLogoStackProps = {
  tickers: string[]
  size?: number
  max?: number
}

export function TickerLogoStack({ tickers, size = 40, max = 4 }: TickerLogoStackProps) {
  return (
    <View className="flex-row items-center">
      {tickers.slice(0, max).map((ticker, index) => (
        <View key={ticker} className={index === 0 ? "ml-0" : "-ml-2.5"}>
          <TickerLogo ticker={ticker} logoUri={getTickerLogoUri(ticker)} size={size} />
        </View>
      ))}
    </View>
  )
}
