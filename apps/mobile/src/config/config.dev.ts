/**
 * These are configuration settings for the dev environment.
 *
 * Do not include API secrets in this file or anywhere in your JS.
 *
 * https://reactnative.dev/docs/security#storing-sensitive-info
 */
const apiUrl = process.env.EXPO_PUBLIC_API_URL || "https://finly-backend.up.railway.app"
const marketDataUrl = process.env.EXPO_PUBLIC_MARKET_DATA_URL || apiUrl

export default {
  API_URL: apiUrl,
  MARKET_DATA_URL: marketDataUrl,
}
