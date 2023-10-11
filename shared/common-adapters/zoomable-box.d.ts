import type * as React from 'react'

export type Props = {
  maxZoom?: number
  minZoom?: number
  zoomScale?: number
  onLayout?: (e: any) => void
  onZoom?: (e: {height: number; width: number; x: number; y: number; scale: number}) => void
  style?: any
  bounces?: boolean
  children?: React.ReactNode
  key?: React.Key
  showsVerticalScrollIndicator?: boolean
  showsHorizontalScrollIndicator?: boolean
  contentContainerStyle?: any
}

declare const ZoomableBox: (p: Props) => React.ReactNode
