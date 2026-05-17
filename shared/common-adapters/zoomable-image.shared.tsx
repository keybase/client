import type * as Styles from '@/styles'

export type Props = {
  src: string
  style?: Styles.StylesCrossPlatform
  zoomRatio?: number
  onLoaded?: () => void
  onError?: () => void
  onIsZoomed?: (z: boolean) => void
  dragPan?: boolean
  forceDims?: {height: number; width: number}
  onChanged?: (e: {height: number; width: number; x: number; y: number; scale: number}) => void
  onSwipe?: (left: boolean) => void
  onTap?: () => void
  srcDims?: {height: number; width: number}
  boxCacheKey?: string
}
