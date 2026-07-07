import type * as React from 'react'
import type {Animated, ViewStyle} from 'react-native'

export type SwipeableMethods = {
  close: () => void
  reset: () => void
}

export type Props = {
  children?: React.ReactNode
  renderRightActions?: (
    progress: Animated.AnimatedDivision<number>,
    translation: Animated.Value
  ) => React.ReactNode
  onSwipeableOpenStartDrag?: () => void
  onSwipeableWillOpen?: (direction: 'left') => void
  containerStyle?: ViewStyle
}
