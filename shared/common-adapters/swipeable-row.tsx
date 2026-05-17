import type * as React from 'react'
import type * as Reanimated from 'react-native-reanimated'

export type SwipeableMethods = {
  close: () => void
}

type Props = {
  children?: React.ReactNode
  renderRightActions?: (
    progress: Reanimated.SharedValue<number>,
    translation: Reanimated.SharedValue<number>
  ) => React.ReactNode
  onSwipeableOpenStartDrag?: () => void
  onSwipeableWillOpen?: (direction: 'left') => void
  containerStyle?: object
}

const SwipeableRow = (_p: Props & {ref?: React.Ref<SwipeableMethods>}) => null
export default SwipeableRow
