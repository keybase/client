import * as React from 'react'
import {StylesCrossPlatform, globalMargins} from '../styles'
export type Props = any

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
  alignSelf?: null | 'center' | 'flex-start' | 'flex-end' | 'stretch'
  children?: React.ReactNode
  centerChildren?: boolean
  className?: string | null
  collapsable?: boolean
  direction: 'horizontal' | 'vertical' | 'horizontalReverse' | 'verticalReverse'
  fullHeight?: boolean
  fullWidth?: boolean
  noShrink?: boolean
  onDragLeave?: (syntheticDragEvent: React.DragEvent<Element>) => void // desktop only
  onDragOver?: (syntheticDragEvent: React.DragEvent<Element>) => void // desktop only
  onDrop?: (syntheticDragEvent: React.DragEvent<Element>) => void // desktop
  // only
  onLayout?: (evt: LayoutEvent) => void // mobile only
  onMouseDown?: (syntheticEvent: React.SyntheticEvent) => void // desktop only
  onMouseLeave?: (syntheticEvent: React.SyntheticEvent) => void // desktop only
  onMouseUp?: (syntheticEvent: React.SyntheticEvent) => void // desktop only
  onMouseOver?: (syntheticEvent: React.SyntheticEvent) => void // desktop only
  onCopyCapture?: (syntheticEvent: React.SyntheticEvent) => void // desktop only
  onContextMenu?: () => void // desktop only
  pointerEvents?: 'none' | 'box-none'
  style?: StylesCrossPlatform
  gap?: keyof typeof globalMargins
  gapStart?: boolean
  gapEnd?: boolean
}

/**
 * Box is deprecated, use Box2 instead
 **/
export declare class Box extends React.Component<Props> {}
export declare class Box2 extends React.Component<Box2Props> {}
export default Box
