import * as React from 'react'
import {StylesCrossPlatform, globalMargins} from '../styles'
export type Props = any

export type Box2Props = {
  alignItems?: 'center' | 'flex-start' | 'flex-end' | 'stretch'
  alignSelf?: null | 'center' | 'flex-start' | 'flex-end' | 'stretch'
  children?: React.ReactNode
  centerChildren?: boolean
  className?: string | null
  direction: 'horizontal' | 'vertical' | 'horizontalReverse' | 'verticalReverse'
  fullHeight?: boolean
  fullWidth?: boolean
  noShrink?: boolean
  onDragLeave?: (syntheticDragEvent: React.DragEvent<Element>) => void // desktop only
  onDragOver?: (syntheticDragEvent: React.DragEvent<Element>) => void // desktop only
  onDrop?: (syntheticDragEvent: React.DragEvent<Element>) => void // desktop
  // only
  onLayout?: (evt: {
    nativeEvent: {
      layout: {
        x: number
        y: number
        width: number
        height: number
      }
    }
  }) => void // mobile only
  onMouseLeave?: (syntheticEvent: React.SyntheticEvent) => void // desktop only
  onMouseOver?: (syntheticEvent: React.SyntheticEvent) => void // desktop only
  onCopyCapture?: (syntheticEvent: React.SyntheticEvent) => void // desktop only
  pointerEvents?: 'none'
  style?: StylesCrossPlatform
  gap?: keyof typeof globalMargins
  gapStart?: boolean
  gapEnd?: boolean
}

export declare class Box extends React.Component<Props> {}
export declare class Box2 extends React.Component<Box2Props> {}
export default Box
