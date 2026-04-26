import type * as React from 'react'
import type {StylesCrossPlatform, globalMargins} from '@/styles'
import type {NativeSyntheticEvent} from 'react-native'
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
  alignItems?: 'center' | 'flex-start' | 'flex-end' | 'stretch' | undefined
  alignSelf?: 'center' | 'flex-start' | 'flex-end' | 'stretch' | undefined
  children?: React.ReactNode | undefined
  centerChildren?: boolean | undefined
  className?: string | undefined
  collapsable?: boolean | undefined
  direction: 'horizontal' | 'vertical' | 'horizontalReverse' | 'verticalReverse'
  flex?: number | undefined
  fullHeight?: boolean | undefined
  fullWidth?: boolean | undefined
  justifyContent?: 'center' | 'flex-start' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly' | undefined
  noShrink?: boolean | undefined
  overflow?: 'hidden' | 'scroll' | 'visible' | 'auto' | undefined
  onDragLeave?: ((syntheticDragEvent: React.DragEvent) => void) | undefined // desktop only
  onDragOver?: ((syntheticDragEvent: React.DragEvent) => void) | undefined // desktop only
  onDrop?: ((syntheticDragEvent: React.DragEvent) => void) | undefined // desktop only
  onLayout?: ((evt: LayoutEvent) => void) | undefined // mobile only
  onMouseDown?: ((syntheticEvent: React.MouseEvent) => void) | undefined // desktop only
  onMouseMove?: ((syntheticEvent: React.MouseEvent) => void) | undefined // desktop only
  onMouseLeave?: ((syntheticEvent: React.MouseEvent) => void) | undefined // desktop only
  onMouseUp?: ((syntheticEvent: React.MouseEvent) => void) | undefined // desktop only
  onMouseOver?: ((syntheticEvent: React.MouseEvent) => void) | undefined // desktop only
  onCopyCapture?: ((syntheticEvent: React.SyntheticEvent) => void) | undefined // desktop only
  onContextMenu?: (() => void) | undefined // desktop only
  padding?: keyof typeof globalMargins | undefined
  pointerEvents?: 'none' | 'box-none' | undefined
  relative?: boolean | undefined
  style?: StylesCrossPlatform | undefined
  gap?: keyof typeof globalMargins | undefined
  gapStart?: boolean | undefined
  gapEnd?: boolean | undefined
  title?: string | undefined
  tooltip?: string | undefined
}

export declare function Box2(p: Box2Props & {ref?: React.Ref<MeasureRef> | undefined}): React.ReactNode
// wrapped by reanimated
export declare function Box2Animated(p: Box2Props & {ref?: React.Ref<MeasureRef> | undefined}): React.ReactNode
