import type * as React from 'react'
import type * as Styles from '@/styles'
import type {LayoutChangeEvent} from 'react-native'

export type Props = {
  maxZoom?: number
  minZoom?: number
  zoomScale?: number
  contentSize?:
    | {
        width: number
        height: number
      }
    | undefined
  onLayout?: (e: Partial<LayoutChangeEvent>) => void
  onZoom?: (e: {height: number; width: number; x: number; y: number; scale: number}) => void
  style?: Styles.StylesCrossPlatform
  bounces?: boolean
  children?: React.ReactNode
  key?: React.Key
  showsVerticalScrollIndicator?: boolean
  showsHorizontalScrollIndicator?: boolean
  contentContainerStyle?: Styles.StylesCrossPlatform
  onSwipe?: (left: boolean) => void
  onTap?: () => void
}

declare const ZoomableBox: (p: Props) => React.ReactNode
