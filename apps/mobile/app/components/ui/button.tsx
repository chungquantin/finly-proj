/* eslint-disable no-restricted-imports */
// eslint-disable-next-line no-restricted-imports
import type { ComponentPropsWithoutRef } from "react"
import { Pressable, Text } from "react-native"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva("items-center justify-center rounded-full px-5 py-3 active:opacity-90", {
  variants: {
    variant: {
      primary: "bg-accent",
      secondary: "border border-border bg-card",
      ghost: "bg-transparent",
    },
    size: {
      sm: "h-10 px-4",
      md: "h-12 px-5",
      lg: "h-14 px-6",
    },
  },
  defaultVariants: {
    variant: "primary",
    size: "md",
  },
})

const buttonTextVariants = cva("font-semi", {
  variants: {
    variant: {
      primary: "text-white",
      secondary: "text-ink",
      ghost: "text-ink",
    },
    size: {
      sm: "text-sm",
      md: "text-base",
      lg: "text-base",
    },
  },
  defaultVariants: {
    variant: "primary",
    size: "md",
  },
})

type ButtonProps = ComponentPropsWithoutRef<typeof Pressable> &
  VariantProps<typeof buttonVariants> & {
    textClassName?: string
    label: string
  }

export function Button({ className, textClassName, variant, size, label, ...props }: ButtonProps) {
  return (
    <Pressable className={cn(buttonVariants({ variant, size }), className)} {...props}>
      <Text className={cn(buttonTextVariants({ variant, size }), textClassName)}>{label}</Text>
    </Pressable>
  )
}
