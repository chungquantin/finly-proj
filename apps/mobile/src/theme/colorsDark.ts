const palette = {
  neutral900: "#FFFFFF",
  neutral800: "#F3F4F6",
  neutral700: "#D1D5DB",
  neutral600: "#9CA3AF",
  neutral500: "#6B7280",
  neutral400: "#4B5563",
  neutral300: "#374151",
  neutral200: "#111827",
  neutral100: "#0B1220",

  primary600: "#E9D5FF",
  primary500: "#D8B4FE",
  primary400: "#C084FC",
  primary300: "#A855F7",
  primary200: "#9333EA",
  primary100: "#7E22CE",

  secondary500: "#DBEAFE",
  secondary400: "#93C5FD",
  secondary300: "#60A5FA",
  secondary200: "#3B82F6",
  secondary100: "#2563EB",

  accent500: "#FEF3C7",
  accent400: "#FCD34D",
  accent300: "#FFD233",
  accent200: "#F59E0B",
  accent100: "#B45309",

  success100: "#14532D",
  success500: "#4ADE80",

  angry100: "#7F1D1D",
  angry500: "#C03403",

  pastelPink: "#831843",
  pastelBlue: "#1E3A8A",
  pastelWarm: "#78350F",

  overlay20: "rgba(25, 16, 21, 0.2)",
  overlay50: "rgba(25, 16, 21, 0.5)",
} as const

export const colors = {
  palette,
  transparent: "rgba(0, 0, 0, 0)",
  text: palette.neutral800,
  textDim: palette.neutral600,
  background: palette.neutral200,
  surface: palette.neutral100,
  surfacePastelPink: palette.pastelPink,
  surfacePastelBlue: palette.pastelBlue,
  surfacePastelWarm: palette.pastelWarm,
  border: palette.neutral400,
  tint: palette.primary500,
  tintInactive: palette.neutral300,
  separator: palette.neutral300,
  success: palette.success500,
  successBackground: palette.success100,
  error: palette.angry500,
  errorBackground: palette.angry100,
} as const
