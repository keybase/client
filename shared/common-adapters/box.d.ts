import type * as React from 'react'
import type {StylesCrossPlatform, globalMargins} from '@/styles'
import type {View, NativeSyntheticEvent} from 'react-native'
import type {MeasureRef} from './measure-ref'

export type LayoutEvent = NativeSyntheticEvent<{
  layout: {
    x: number
    y: number
    width: number
    height: number
  }
}>

export type Box2Props = {
  alignItems?: 'center' | 'flex-start' | 'flex-end' | 'stretch'
  alignSelf?: 'center' | 'flex-start' | 'flex-end' | 'stretch'
  children?: React.ReactNode
  centerChildren?: boolean
  className?: string
  collapsable?: boolean
  direction: 'horizontal' | 'vertical' | 'horizontalReverse' | 'verticalReverse'
  flex?: number
  fullHeight?: boolean
  fullWidth?: boolean
  justifyContent?: 'center' | 'flex-start' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly'
  noShrink?: boolean
  overflow?: 'hidden' | 'scroll' | 'visible' | 'auto'
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
  padding?: keyof typeof globalMargins
  pointerEvents?: 'none' | 'box-none'
  relative?: boolean
  style?: StylesCrossPlatform
  gap?: keyof typeof globalMargins
  gapStart?: boolean
  gapEnd?: boolean
  title?: string
  tooltip?: string
}

export declare const Box2: (p: Box2Props) => React.ReactNode
// wrapped by reanimated
export declare function Box2Animated(p: Box2Props & {ref?: React.Ref<View>}): React.ReactNode
// Box2 but with a ref for targetting popups
export declare function Box2Measure(p: Box2Props & {ref?: React.Ref<MeasureRef>}): React.ReactNode
// desktop only
export declare function Box2Div(p: Box2Props & {ref?: React.Ref<HTMLDivElement>}): React.ReactNode
// mobile only
export declare function Box2View(p: Box2Props & {ref?: React.Ref<View>}): React.ReactNode
