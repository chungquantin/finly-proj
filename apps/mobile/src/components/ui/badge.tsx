/* eslint-disable no-restricted-imports */
import { Text, View, type ViewProps } from "react-native"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva("rounded-full px-3 py-1", {
  variants: {
    variant: {
      neutral: "bg-lilac",
      success: "bg-mint",
      warning: "bg-lemon",
    },
  },
  defaultVariants: {
    variant: "neutral",
  },
})

type BadgeProps = ViewProps &
  VariantProps<typeof badgeVariants> & {
    className?: string
    label: string
  }

export function Badge({ className, variant, label, ...props }: BadgeProps) {
  return (
    <View className={cn(badgeVariants({ variant }), className)} {...props}>
      <Text className="font-medium text-xs text-ink">{label}</Text>
    </View>
  )
}
