import * as React from 'react'
import type * as Types from '../../../../../constants/types/chat2'

export type Props = {
  children: React.ReactNode
  // mobile
  highlighted?: boolean
  onLongPress?: () => void
  onSwipeLeft?: () => void
  // desktop
  className?: string
  onContextMenu?: () => void
  onMouseOver?: () => void
}
export default class LongPressable extends React.Component<Props> {}
