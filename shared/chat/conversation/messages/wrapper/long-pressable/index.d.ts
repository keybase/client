import * as React from 'react'
import * as Styles from '../../../../../styles'

export type Props = {
  children: React.ReactNode
  // mobile
  onLongPress?: () => void
  onSwipeLeft?: () => void
  style?: Styles.StylesCrossPlatform

  // desktop
  className?: string
  onContextMenu?: () => void
  onMouseOver?: () => void
}
export default class LongPressable extends React.Component<Props> {}
