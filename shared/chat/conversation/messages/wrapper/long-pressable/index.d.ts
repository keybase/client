import * as React from 'react'
import * as Kb from '../../../../../common-adapters'

export type Props = {
  children: React.ReactNode
  // mobile
  onLongPress?: () => void
  onSwipeLeft?: () => void
  style?: Kb.Styles.StylesCrossPlatform

  // desktop
  className?: string
  onContextMenu?: () => void
  onMouseOver?: () => void
}
export default class LongPressable extends React.Component<Props> {}
