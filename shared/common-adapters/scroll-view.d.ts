import * as React from 'react'
import type {RefreshControlProps, GestureResponderEvent} from 'react-native'
import type {StylesCrossPlatform} from '@/styles'

export type Props = {
  children?: React.ReactNode
  contentContainerStyle?: StylesCrossPlatform
  style?: StylesCrossPlatform
  onScroll?: (
    e: Partial<
      React.BaseSyntheticEvent<{
        contentSize: {
          height: number
          width: number
        }
        zoomScale: number
        contentOffset: {
          x: number
          y: number
        }
      }>
    >
  ) => void
  className?: string
  ref?: React.Ref<any>
  showsVerticalScrollIndicator?: boolean
  showsHorizontalScrollIndicator?: boolean
  // mobile only
  bounces?: boolean
  contentInset?: {top?: number; left?: number; bottom?: number; right?: number}
  centerContent?: boolean
  zoomScale?: number
  minimumZoomScale?: number
  maximumZoomScale?: number
  onLayout?: Function
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

export default class ScrollView extends React.Component<Props> {
  scrollTo: ((arg0: {x: number; y: number; animated?: boolean}) => void) | null
  scrollToEnd: (options: {animated?: boolean; duration?: number}) => void
}
