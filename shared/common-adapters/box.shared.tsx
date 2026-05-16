import type {NativeSyntheticEvent} from 'react-native'
import type * as React from 'react'
import type * as Styles from '@/styles'

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
  onDragLeave?: (syntheticDragEvent: React.DragEvent) => void
  onDragOver?: (syntheticDragEvent: React.DragEvent) => void
  onDrop?: (syntheticDragEvent: React.DragEvent) => void
  onLayout?: (evt: LayoutEvent) => void
  onMouseDown?: (syntheticEvent: React.MouseEvent) => void
  onMouseMove?: (syntheticEvent: React.MouseEvent) => void
  onMouseLeave?: (syntheticEvent: React.MouseEvent) => void
  onMouseUp?: (syntheticEvent: React.MouseEvent) => void
  onMouseOver?: (syntheticEvent: React.MouseEvent) => void
  onCopyCapture?: (syntheticEvent: React.SyntheticEvent) => void
  onContextMenu?: () => void
  padding?: keyof typeof Styles.globalMargins
  pointerEvents?: 'none' | 'box-none'
  relative?: boolean
  style?: Styles.StylesCrossPlatform
  gap?: keyof typeof Styles.globalMargins
  gapStart?: boolean
  gapEnd?: boolean
  title?: string
  tooltip?: string
}

export type LayoutEvent = NativeSyntheticEvent<{
  layout: {
    x: number
    y: number
    width: number
    height: number
  }
}>
