import * as React from 'react'
import {RefreshControlProps} from 'react-native'
import {StylesCrossPlatform} from '../styles'

export type Props = {
  children?: React.ReactNode
  contentContainerStyle?: StylesCrossPlatform
  style?: StylesCrossPlatform
  onScroll?: React.UIEventHandler<any> | null
  className?: string | null
  ref?: React.Ref<any> | null
  // desktop only
  hideVerticalScroll?: boolean
  // mobile only
  bounces?: boolean
  centerContent?: boolean
  minimumZoomScale?: number
  maximumZoomScale?: number
  onLayout?: Function
  scrollEventThrottle?: number
  scrollsToTop?: boolean
  indicatorStyle?: string
  alwaysBounceVertical?: boolean
  alwaysBounceHorizontal?: boolean
  showsVerticalScrollIndicator?: boolean
  showsHorizontalScrollIndicator?: boolean
  horizontal?: boolean
  snapToInterval?: number
  refreshControl?: React.ReactElement<RefreshControlProps>
}

export default class ScrollView extends React.Component<Props> {
  scrollTo: ((arg0: {x: number; y: number; animated?: boolean}) => void) | null
}
