/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Nunito_400Regular"],
        medium: ["Nunito_500Medium"],
        semi: ["Nunito_600SemiBold"],
        bold: ["Nunito_700Bold"],
      },
      colors: {
        background: "#F9F9F9",
        card: "#FFFFFF",
        ink: "#1A1A1A",
        muted: "#666666",
        border: "#E5E7EB",
        lilac: "#D8B4FE",
        sky: "#DBEAFE",
        peach: "#FFCFE1",
        cloud: "#F3F4F6",
        mint: "#DCFCE7",
        lemon: "#FEF3C7",
        accent: "#A855F7",
        success: "#4ADE80",
        warning: "#FFD233",
      },
      boxShadow: {
        card: "0px 8px 20px rgba(26, 26, 26, 0.06)",
      },
      borderRadius: {
        xl2: "24px",
        xl3: "32px",
      },
    },
  },
  plugins: [],
}
