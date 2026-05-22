import type * as React from 'react'
import type {Animated} from 'react-native'

export type SwipeableMethods = {
  close: () => void
  reset: () => void
}

type Props = {
  children?: React.ReactNode
  renderRightActions?: (
    progress: Animated.AnimatedDivision<number>,
    translation: Animated.Value
  ) => React.ReactNode
  onSwipeableOpenStartDrag?: () => void
  onSwipeableWillOpen?: (direction: 'left') => void
  containerStyle?: object
}

const SwipeableRow = (_p: Props & {ref?: React.Ref<SwipeableMethods>}) => null
export default SwipeableRow
