import * as React from 'react'
import {StylesCrossPlatform} from '../styles'

export type Props = {
  className?: string | null
  children?: any
  style?: StylesCrossPlatform
  onClick?: (event: React.SyntheticEvent) => void | null
  onDoubleClick?: (event: React.SyntheticEvent) => void | null
  onPress?: void
  onLongPress?: (event: React.SyntheticEvent) => void | null
  underlayColor?: string | null
  onPressIn?: () => void | null
  onPressOut?: () => void | null
  feedback?: boolean
  // mobile only
  activeOpacity?: number
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only' | null
  // desktop only
  hoverColor?: string | null
  onMouseOver?: (event: React.MouseEvent) => void | null
  onMouseEnter?: (event: React.MouseEvent) => void | null
  onMouseLeave?: (event: React.MouseEvent) => void | null
  onMouseDown?: (event: React.MouseEvent) => void | null
  onMouseMove?: (event: React.MouseEvent) => void | null
  onMouseUp?: (event: React.MouseEvent) => void | null
  title?: string
}

declare class ClickableBox extends React.Component<Props> {}
export default ClickableBox
