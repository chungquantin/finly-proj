const palette = {
  neutral100: "#FFFFFF",
  neutral200: "#F9F9F9",
  neutral300: "#E5E7EB",
  neutral400: "#D1D5DB",
  neutral500: "#9CA3AF",
  neutral600: "#666666",
  neutral700: "#374151",
  neutral800: "#191015",
  neutral900: "#000000",

  primary100: "#F3E8FF",
  primary200: "#E9D5FF",
  primary300: "#D8B4FE",
  primary400: "#C084FC",
  primary500: "#A855F7",
  primary600: "#9333EA",

  secondary100: "#DBEAFE",
  secondary200: "#BFDBFE",
  secondary300: "#93C5FD",
  secondary400: "#60A5FA",
  secondary500: "#3B82F6",

  accent100: "#FEF3C7",
  accent200: "#FDE68A",
  accent300: "#FCD34D",
  accent400: "#FFD233",
  accent500: "#F59E0B",

  success100: "#DCFCE7",
  success500: "#4ADE80",

  angry100: "#FEE2E2",
  angry500: "#C03403",

  pastelPink: "#FFCFE1",
  pastelBlue: "#DBEAFE",
  pastelWarm: "#FEF3C7",

  overlay20: "rgba(25, 16, 21, 0.2)",
  overlay50: "rgba(25, 16, 21, 0.5)",
} as const

export const colors = {
  /**
   * The palette is available to use, but prefer using the name.
   * This is only included for rare, one-off cases. Try to use
   * semantic names as much as possible.
   */
  palette,
  /**
   * A helper for making something see-thru.
   */
  transparent: "rgba(0, 0, 0, 0)",
  /**
   * The default text color in many components.
   */
  text: palette.neutral800,
  /**
   * Secondary text information.
   */
  textDim: palette.neutral600,
  /**
   * The default color of the screen background.
   */
  background: palette.neutral200,
  /**
   * Main elevated surface for cards and sheets.
   */
  surface: palette.neutral100,
  /**
   * Pastel surfaces for bento category cards.
   */
  surfacePastelPink: palette.pastelPink,
  surfacePastelBlue: palette.pastelBlue,
  surfacePastelWarm: palette.pastelWarm,
  /**
   * The default border color.
   */
  border: palette.neutral400,
  /**
   * The main tinting color.
   */
  tint: palette.primary500,
  /**
   * The inactive tinting color.
   */
  tintInactive: palette.neutral300,
  /**
   * A subtle color used for lines.
   */
  separator: palette.neutral300,
  /**
   * Success color for positive account states.
   */
  success: palette.success500,
  successBackground: palette.success100,
  /**
   * Error messages.
   */
  error: palette.angry500,
  /**
   * Error Background.
   */
  errorBackground: palette.angry100,
} as const
