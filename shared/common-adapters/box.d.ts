import type * as React from 'react'
import type {StylesCrossPlatform, globalMargins} from '../styles'
import type {MeasureRef} from './measure-ref'

export type Props = {
  onMoveShouldSetResponder?: any
  onMouseDown?: (syntheticEvent: React.MouseEvent) => void // desktop only
  onMouseLeave?: (syntheticEvent: React.MouseEvent) => void // desktop only
  onMouseUp?: (syntheticEvent: React.MouseEvent) => void // desktop only
  onMouseOver?: (syntheticEvent: React.MouseEvent) => void // desktop only
  onStartShouldSetResponder?: any
  pointerEvents?: 'none' | 'box-none'
  onLayout?: (evt: LayoutEvent) => void // mobile only
  onClick?: (event: React.MouseEvent) => void
  children?: React.ReactNode
  collapsable?: boolean
  className?: string
  style?: any
  ref?: never
}

export type LayoutEvent = {
  nativeEvent: {
    layout: {
      x: number
      y: number
      width: number
      height: number
    }
  }
}

export type Box2Props = {
  alignItems?: 'center' | 'flex-start' | 'flex-end' | 'stretch'
  alignSelf?: 'center' | 'flex-start' | 'flex-end' | 'stretch'
  children?: React.ReactNode
  centerChildren?: boolean
  className?: string
  collapsable?: boolean
  direction: 'horizontal' | 'vertical' | 'horizontalReverse' | 'verticalReverse'
  fullHeight?: boolean
  fullWidth?: boolean
  noShrink?: boolean
  onDragLeave?: (syntheticDragEvent: React.DragEvent) => void // desktop only
  onDragOver?: (syntheticDragEvent: React.DragEvent) => void // desktop only
  onDrop?: (syntheticDragEvent: React.DragEvent) => void // desktop only
  onLayout?: (evt: LayoutEvent) => void // mobile only
  onMouseDown?: (syntheticEvent: React.MouseEvent) => void // desktop only
  onMouseMove?: (syntheticEvent: React.MouseEvent) => void // desktop only
  onMouseLeave?: (syntheticEvent: React.MouseEvent) => void // desktop only
  onMouseUp?: (syntheticEvent: React.MouseEvent) => void // desktop only
  onMouseOver?: (syntheticEvent: React.MouseEvent) => void // desktop only
  onCopyCapture?: (syntheticEvent: React.SyntheticEvent) => void // desktop only
  onContextMenu?: () => void // desktop only
  pointerEvents?: 'none' | 'box-none'
  style?: StylesCrossPlatform
  gap?: keyof typeof globalMargins
  gapStart?: boolean
  gapEnd?: boolean
  ref?: never
}

/**
 * Box is deprecated, use Box2 instead
 **/
export declare const Box: (p: Props) => React.ReactNode
export declare const Box2: (p: Box2Props) => React.ReactNode
// Box2 but with a special ref, split in case there's overhead we barely need
export declare const Box2Measure: ReturnType<typeof React.forwardRef<MeasureRef, Box2Props>>
export default Box
