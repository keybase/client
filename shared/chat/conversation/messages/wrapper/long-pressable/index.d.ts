import type * as React from 'react'
import type * as Kb from '@/common-adapters'

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
declare const LongPressable: ReturnType<typeof React.forwardRef<Kb.MeasureRef, Props>>
export default LongPressable
