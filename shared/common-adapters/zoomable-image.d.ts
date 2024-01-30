import type * as React from 'react'
import type * as Styles from '@/styles'

export type Props = {
  src: string
  style?: Styles.StylesCrossPlatform
  zoomRatio?: number
  onLoaded?: () => void
  onIsZoomed?: (z: boolean) => void // desktop only
  dragPan?: boolean // desktop only, pan on drag only
  onChanged?: (e: {height: number; width: number; x: number; y: number; scale: number}) => void
  // mobile only, called if swiping while not zoomed
  onSwipe?: (left: boolean) => void
  onTap?: () => void
}

export declare const ZoomableImage: (p: Props) => React.ReactNode
export default ZoomableImage
