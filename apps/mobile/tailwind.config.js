/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        sans: ["spaceGroteskRegular"],
        medium: ["spaceGroteskMedium"],
        semi: ["spaceGroteskSemiBold"],
        bold: ["spaceGroteskBold"],
      },
      colors: {
        background: "#f6f5ff",
        card: "#ffffff",
        ink: "#1b1a23",
        muted: "#79758b",
        border: "#ebe8ff",
        lilac: "#e4d9ff",
        sky: "#d8f4ff",
        peach: "#ffe4c9",
        mint: "#dff7e8",
        lemon: "#fff5ba",
        accent: "#7d6bff",
        success: "#2fba89",
      },
      boxShadow: {
        card: "0px 8px 24px rgba(80, 76, 121, 0.12)",
      },
      borderRadius: {
        xl2: "22px",
        xl3: "28px",
      },
    },
  },
  plugins: [],
}
