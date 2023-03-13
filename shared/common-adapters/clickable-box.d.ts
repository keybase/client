import * as React from 'react'
import * as Styles from '../styles'

export type Props = {
  className?: string
  children?: any
  style?: Styles.StylesCrossPlatform
  onClick?: (event: React.BaseSyntheticEvent) => void
  onDoubleClick?: (event: React.BaseSyntheticEvent) => void
  onPress?: void
  onLongPress?: (event: React.BaseSyntheticEvent) => void
  underlayColor?: string
  onPressIn?: () => void
  onPressOut?: () => void
  // mobile only
  feedback?: boolean
  activeOpacity?: number
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only'
  // desktop only
  hoverColor?: string | null
  onMouseOver?: (event: React.MouseEvent) => void
  onMouseEnter?: (event: React.MouseEvent) => void
  onMouseLeave?: (event: React.MouseEvent) => void
  onMouseDown?: (event: React.MouseEvent) => void
  onMouseMove?: (event: React.MouseEvent) => void
  onMouseUp?: (event: React.MouseEvent) => void
  title?: string
}

declare class ClickableBox extends React.Component<Props> {}

export type Props2 = {
  // mobile only
  onLongPress?: () => void
  // desktop only
  onMouseOver?: (event: React.MouseEvent) => void

  onClick?: (event: React.BaseSyntheticEvent) => void
  children: React.ReactNode
  className?: string
  style?: Styles.StylesCrossPlatform
}
export declare class ClickableBox2 extends React.Component<Props2> {}

export default ClickableBox
