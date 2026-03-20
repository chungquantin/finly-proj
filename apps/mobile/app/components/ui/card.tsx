import { View, type ViewProps } from "react-native"

import { cn } from "@/lib/utils"

export function Card({ className, ...props }: ViewProps & { className?: string }) {
  return (
    <View
      className={cn("rounded-xl2 border border-border bg-card shadow-card", className)}
      {...props}
    />
  )
}

export function CardContent({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={cn("p-4", className)} {...props} />
}
