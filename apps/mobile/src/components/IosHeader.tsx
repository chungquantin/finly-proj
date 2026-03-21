/* eslint-disable no-restricted-imports */
import { Pressable, Text, View } from "react-native"

type IosHeaderProps = {
  title: string
  leftLabel?: string
  rightLabel?: string
  onLeftPress?: () => void
  onRightPress?: () => void
  titleClassName?: string
  rightLabelClassName?: string
  rightContainerClassName?: string
}

export function IosHeader({
  title,
  leftLabel,
  rightLabel,
  onLeftPress,
  onRightPress,
  titleClassName,
  rightLabelClassName,
  rightContainerClassName,
}: IosHeaderProps) {
  return (
    <View className="flex-row items-center justify-between px-4 pb-3 pt-2">
      {onLeftPress ? (
        <Pressable
          className="h-10 min-w-10 items-center justify-center rounded-full border border-[#E9EEF7] bg-[#F6F8FD] px-2"
          onPress={onLeftPress}
        >
          <Text className="font-sans text-[18px] text-[#7A8699]">{leftLabel ?? " "}</Text>
        </Pressable>
      ) : (
        <View className="h-10 min-w-10 px-2" />
      )}

      <Text
        className={`font-sans text-[30px] font-semibold leading-[34px] text-[#0F1728] ${titleClassName ?? ""}`}
      >
        {title}
      </Text>

      {onRightPress ? (
        <Pressable
          className={`h-10 min-w-10 items-center justify-center rounded-full border border-[#E9EEF7] bg-[#F6F8FD] px-2 ${rightContainerClassName ?? ""}`}
          onPress={onRightPress}
        >
          <Text
            className={`font-sans text-[15px] font-semibold text-[#7A8699] ${rightLabelClassName ?? ""}`}
          >
            {rightLabel ?? " "}
          </Text>
        </Pressable>
      ) : rightLabel ? (
        <View
          className={`h-10 min-w-10 items-center justify-center px-2 ${rightContainerClassName ?? ""}`}
        >
          <Text
            className={`font-sans text-[15px] font-semibold text-[#7A8699] ${rightLabelClassName ?? ""}`}
          >
            {rightLabel}
          </Text>
        </View>
      ) : (
        <View className="h-10 min-w-10 px-2" />
      )}
    </View>
  )
}
