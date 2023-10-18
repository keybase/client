import type * as React from 'react'
import type * as Styles from '../styles'

export type Props = {
  maxZoom?: number
  minZoom?: number
  zoomScale?: number
  onLayout?: (e: any) => void
  onZoom?: (e: {height: number; width: number; x: number; y: number; scale: number}) => void
  style?: Styles.StylesCrossPlatform
  bounces?: boolean
  children?: React.ReactNode
  key?: React.Key
  showsVerticalScrollIndicator?: boolean
  showsHorizontalScrollIndicator?: boolean
  contentContainerStyle?: Styles.StylesCrossPlatform
}

declare const ZoomableBox: (p: Props) => React.ReactNode
