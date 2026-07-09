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
  // When false, the swipe pan handlers are not attached (children stay mounted, so toggling this
  // does NOT remount the row). Used to shed per-row touch evaluation during fast scroll.
  enabled?: boolean
}
