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
  feedback?: boolean
  activeOpacity?: number
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
  onLongPress?: () => void
  hitSlop?: number
  testID?: string
  onMouseOver?: (event: React.MouseEvent) => void
  onClick?: () => void
  children: React.ReactNode
  className?: string
  style?: Styles.StylesCrossPlatform
}

export type {MeasureRef}
