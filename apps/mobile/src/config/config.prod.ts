/**
 * These are configuration settings for the production environment.
 *
 * Do not include API secrets in this file or anywhere in your JS.
 *
 * https://reactnative.dev/docs/security#storing-sensitive-info
 */
const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000"
const marketDataUrl = process.env.EXPO_PUBLIC_MARKET_DATA_URL || apiUrl
const agentServerUrl = process.env.EXPO_PUBLIC_AGENT_SERVER_URL || "http://localhost:8001"

export default {
  API_URL: apiUrl,
  MARKET_DATA_URL: marketDataUrl,
  AGENT_SERVER_URL: agentServerUrl,
}
