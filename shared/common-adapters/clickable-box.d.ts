import * as React from 'react'
import {StylesCrossPlatform} from '../styles'

export type Props = {
  className?: string
  children?: any
  style?: StylesCrossPlatform
  onClick?: (event: React.BaseSyntheticEvent) => void
  onDoubleClick?: (event: React.BaseSyntheticEvent) => void
  onPress?: void
  onLongPress?: (event: React.BaseSyntheticEvent) => void
  underlayColor?: string
  onPressIn?: () => void
  onPressOut?: () => void
  feedback?: boolean
  // mobile only
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
export default ClickableBox
