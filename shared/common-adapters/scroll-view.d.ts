import type * as React from 'react'
import type {RefreshControlProps, GestureResponderEvent} from 'react-native'
import type {StylesCrossPlatform} from '@/styles'

export type ScrollEvent = {
  nativeEvent?: {
    contentSize: {
      height: number
      width: number
    }
    zoomScale: number
    contentOffset: {
      x: number
      y: number
    }
  }
  currentTarget?: HTMLDivElement
}

export type Props = {
  children?: React.ReactNode | undefined
  contentContainerStyle?: StylesCrossPlatform | undefined
  style?: StylesCrossPlatform | undefined
  onScroll?: ((event: ScrollEvent) => void) | undefined
  className?: string | undefined
  ref?: React.Ref<ScrollViewRef> | undefined
  showsVerticalScrollIndicator?: boolean | undefined
  showsHorizontalScrollIndicator?: boolean | undefined
  // mobile only
  bounces?: boolean | undefined
  contentInset?: {top?: number; left?: number; bottom?: number; right?: number} | undefined
  contentInsetAdjustmentBehavior?: 'automatic' | 'scrollableAxes' | 'never' | 'always' | undefined
  centerContent?: boolean | undefined
  zoomScale?: number | undefined
  minimumZoomScale?: number | undefined
  maximumZoomScale?: number | undefined
  onLayout?: ((...a: Array<unknown>) => void) | undefined
  scrollEventThrottle?: number | undefined
  scrollsToTop?: boolean | undefined
  indicatorStyle?: string | undefined
  alwaysBounceVertical?: boolean | undefined
  alwaysBounceHorizontal?: boolean | undefined
  horizontal?: boolean | undefined
  snapToInterval?: number | undefined
  refreshControl?: React.ReactElement<RefreshControlProps> | undefined
  onTouchStart?: ((e: GestureResponderEvent) => void) | undefined
  onTouchEnd?: ((e: GestureResponderEvent) => void) | undefined
}

export interface ScrollViewRef {
  scrollTo: (arg0: {x: number; y: number; animated?: boolean}) => void
  scrollToEnd: (options: {animated?: boolean; duration?: number}) => void
}

declare function ScrollView(props: Props): React.ReactElement

export default ScrollView
