/* eslint-disable no-restricted-imports */
// eslint-disable-next-line no-restricted-imports
import { TextInput, type TextInputProps } from "react-native"

import { cn } from "@/lib/utils"

export function Input({ className, ...props }: TextInputProps & { className?: string }) {
  return (
    <TextInput
      className={cn(
        "h-12 rounded-full border border-border bg-white px-4 font-sans text-base text-ink",
        className,
      )}
      placeholderTextColor="#908ca8"
      {...props}
    />
  )
}
