import type * as React from 'react'
import type * as Styles from '@/styles'
import type {MeasureRef} from './measure-ref'

export type Props = {
  className?: string
  children?: React.ReactNode
  style?: Styles.StylesCrossPlatform
  onClick?: (event: React.BaseSyntheticEvent) => void
  onDoubleClick?: (event: React.BaseSyntheticEvent) => void
  onPress?: never
  onLongPress?: (event: React.BaseSyntheticEvent) => void
  underlayColor?: string
  onPressIn?: () => void
  onPressOut?: () => void
  // mobile only
  feedback?: boolean
  activeOpacity?: number
  // desktop only
  hoverColor?: string
  onMouseOver?: (event: React.MouseEvent) => void
  onMouseEnter?: (event: React.MouseEvent) => void
  onMouseLeave?: (event: React.MouseEvent) => void
  onMouseDown?: (event: React.MouseEvent) => void
  onMouseMove?: (event: React.MouseEvent) => void
  onMouseUp?: (event: React.MouseEvent) => void
  title?: string
  tooltip?: string
}

export type Props2 = {
  // mobile only
  onLongPress?: () => void
  hitSlop?: number
  // desktop only
  onMouseOver?: (event: React.MouseEvent) => void

  onClick?: (event: React.BaseSyntheticEvent) => void
  children: React.ReactNode
  className?: string
  style?: Styles.StylesCrossPlatform
}

export declare const ClickableBox: ReturnType<typeof React.forwardRef<MeasureRef, Props>>
export declare const ClickableBox2: ReturnType<typeof React.forwardRef<MeasureRef, Props2>>
export default ClickableBox
