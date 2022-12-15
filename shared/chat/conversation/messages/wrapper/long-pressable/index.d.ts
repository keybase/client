import * as React from 'react'
import * as Styles from '../../../../../styles'
export default class LongPressable extends React.Component<{
  children: React.ReactNode
  // mobile
  onLongPress?: () => void
  onPress?: () => void
  onSwipeLeft?: () => void
  style?: Styles.StylesCrossPlatform
  // desktop
  className?: string
  onContextMenu?: () => void
  onMouseOver?: () => void
}> {}
