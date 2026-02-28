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
  children?: React.ReactNode
  contentContainerStyle?: StylesCrossPlatform
  style?: StylesCrossPlatform
  onScroll?: (event: ScrollEvent) => void
  className?: string
  ref?: React.Ref<ScrollViewRef>
  showsVerticalScrollIndicator?: boolean
  showsHorizontalScrollIndicator?: boolean
  // mobile only
  bounces?: boolean
  contentInset?: {top?: number; left?: number; bottom?: number; right?: number}
  centerContent?: boolean
  zoomScale?: number
  minimumZoomScale?: number
  maximumZoomScale?: number
  onLayout?: (...a: Array<unknown>) => void
  scrollEventThrottle?: number
  scrollsToTop?: boolean
  indicatorStyle?: string
  alwaysBounceVertical?: boolean
  alwaysBounceHorizontal?: boolean
  horizontal?: boolean
  snapToInterval?: number
  refreshControl?: React.ReactElement<RefreshControlProps>
  onTouchStart?: (e: GestureResponderEvent) => void
  onTouchEnd?: (e: GestureResponderEvent) => void
}

export interface ScrollViewRef {
  scrollTo: (arg0: {x: number; y: number; animated?: boolean}) => void
  scrollToEnd: (options: {animated?: boolean; duration?: number}) => void
}

declare const ScrollView: React.ForwardRefExoticComponent<Props & React.RefAttributes<ScrollViewRef>>

export default ScrollView
