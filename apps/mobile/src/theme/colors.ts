const palette = {
  neutral100: "#FFFFFF",
  neutral200: "#F7F9FC",
  neutral300: "#EEF2F7",
  neutral400: "#DCE3EE",
  neutral500: "#A3ACBB",
  neutral600: "#72809A",
  neutral700: "#445065",
  neutral800: "#182033",
  neutral900: "#0D1324",

  primary100: "#EEF3FF",
  primary200: "#DDE7FF",
  primary300: "#BCD0FF",
  primary400: "#7A9DFF",
  primary500: "#2453FF",
  primary600: "#1537CC",

  secondary100: "#F3F6FF",
  secondary200: "#E5ECFF",
  secondary300: "#CEDBFF",
  secondary400: "#9DB5FF",
  secondary500: "#4C72FF",

  accent100: "#FFF4E8",
  accent200: "#FFE4BF",
  accent300: "#FFC978",
  accent400: "#FFAE42",
  accent500: "#F58A24",

  success100: "#EAFBF1",
  success500: "#22B45A",

  angry100: "#FFECEC",
  angry500: "#F04438",

  pastelPink: "#FFE6EF",
  pastelBlue: "#EEF3FF",
  pastelWarm: "#FFF4E8",

  overlay20: "rgba(13, 19, 36, 0.2)",
  overlay50: "rgba(13, 19, 36, 0.5)",
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
  text: palette.neutral900,
  /**
   * Secondary text information.
   */
  textDim: palette.neutral700,
  /**
   * The default color of the screen background.
   */
  background: "#FBFCFF",
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
  border: palette.neutral300,
  /**
   * The main tinting color.
   */
  tint: palette.primary500,
  /**
   * The inactive tinting color.
   */
  tintInactive: palette.neutral400,
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
