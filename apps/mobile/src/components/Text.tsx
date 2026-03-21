/* eslint-disable no-restricted-imports */
import { ReactNode, forwardRef, ForwardedRef } from "react"
import * as ReactNative from "react-native"
import { StyleProp, TextProps as RNTextProps, TextStyle } from "react-native"
import { TOptions } from "i18next"
import { cssInterop } from "nativewind"

import { isRTL, TxKeyPath } from "@/i18n"
import { translate } from "@/i18n/translate"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle, ThemedStyleArray } from "@/theme/types"
import { typography } from "@/theme/typography"

type Sizes = keyof typeof $sizeStyles
type Weights = keyof typeof typography.primary
type Presets = "default" | "bold" | "heading" | "subheading" | "formLabel" | "formHelper"

export interface TextProps extends RNTextProps {
  /**
   * Text which is looked up via i18n.
   */
  tx?: TxKeyPath
  /**
   * The text to display if not using `tx` or nested components.
   */
  text?: string
  /**
   * Optional options to pass to i18n. Useful for interpolation
   * as well as explicitly setting locale or translation fallbacks.
   */
  txOptions?: TOptions
  /**
   * An optional style override useful for padding & margin.
   */
  style?: StyleProp<TextStyle>
  /**
   * One of the different types of text presets.
   */
  preset?: Presets
  /**
   * Text weight modifier.
   */
  weight?: Weights
  /**
   * Text size modifier.
   */
  size?: Sizes
  /**
   * Children components.
   */
  children?: ReactNode
}

/**
 * For your text displaying needs.
 * This component is a HOC over the built-in React Native one.
 * @see [Documentation and Examples]{@link https://docs.infinite.red/ignite-cli/boilerplate/app/components/Text/}
 * @param {TextProps} props - The props for the `Text` component.
 * @returns {JSX.Element} The rendered `Text` component.
 */
export const Text = cssInterop(
  forwardRef(function Text(props: TextProps, ref: ForwardedRef<ReactNative.Text>) {
    const { weight, size, tx, txOptions, text, children, style: $styleOverride, ...rest } = props
    const { themed } = useAppTheme()

    const i18nText = tx && translate(tx, txOptions)
    const content = i18nText || text || children

    const preset: Presets = props.preset ?? "default"
    const $styles: StyleProp<TextStyle> = [
      $rtlStyle,
      themed($presets[preset]),
      weight && $fontWeightStyles[weight],
      size && $sizeStyles[size],
      $styleOverride,
    ]

    return (
      <ReactNative.Text {...rest} style={$styles} ref={ref}>
        {content}
      </ReactNative.Text>
    )
  }),
  { className: "style" },
)

const $sizeStyles = {
  xxl: { fontSize: 32, lineHeight: 38, letterSpacing: -0.6 } satisfies TextStyle,
  xl: { fontSize: 27, lineHeight: 33, letterSpacing: -0.45 } satisfies TextStyle,
  lg: { fontSize: 22, lineHeight: 28, letterSpacing: -0.3 } satisfies TextStyle,
  md: { fontSize: 17, lineHeight: 22, letterSpacing: -0.15 } satisfies TextStyle,
  sm: { fontSize: 15, lineHeight: 20 } satisfies TextStyle,
  xs: { fontSize: 13, lineHeight: 18 } satisfies TextStyle,
  xxs: { fontSize: 11, lineHeight: 14 } satisfies TextStyle,
}

const iosFontWeights: Record<Weights, TextStyle["fontWeight"]> = {
  light: "300",
  normal: "400",
  medium: "500",
  semiBold: "600",
  bold: "700",
}

const systemFontFamilies = new Set(["System", "system-ui"])

const $fontWeightStyles = Object.entries(typography.primary).reduce((acc, [weight, fontFamily]) => {
  const textStyle: TextStyle = { fontFamily }

  if (systemFontFamilies.has(fontFamily)) {
    textStyle.fontWeight = iosFontWeights[weight as Weights]
  }

  return { ...acc, [weight]: textStyle }
}, {}) as Record<Weights, TextStyle>

const $baseStyle: ThemedStyle<TextStyle> = (theme) => ({
  ...$sizeStyles.sm,
  ...$fontWeightStyles.normal,
  color: theme.colors.text,
})

const $presets: Record<Presets, ThemedStyleArray<TextStyle>> = {
  default: [$baseStyle],
  bold: [$baseStyle, { ...$fontWeightStyles.bold }],
  heading: [
    $baseStyle,
    {
      ...$sizeStyles.xxl,
      ...$fontWeightStyles.bold,
    },
  ],
  subheading: [$baseStyle, { ...$sizeStyles.lg, ...$fontWeightStyles.medium }],
  formLabel: [$baseStyle, { ...$fontWeightStyles.medium }],
  formHelper: [$baseStyle, { ...$sizeStyles.sm, ...$fontWeightStyles.normal }],
}
const $rtlStyle: TextStyle = isRTL ? { writingDirection: "rtl" } : {}
