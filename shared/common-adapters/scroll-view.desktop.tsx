import * as React from 'react'
import * as Styles from '@/styles'
import type {RefreshControlProps, GestureResponderEvent} from 'react-native'


export type ScrollEvent = {
  nativeEvent?: {
    contentSize: {height: number; width: number}
    zoomScale: number
    contentOffset: {x: number; y: number}
  }
  currentTarget?: HTMLDivElement
}

export type ScrollViewRef = {
  scrollTo: (arg0: {x: number; y: number; animated?: boolean}) => void
  scrollToEnd: (options: {animated?: boolean; duration?: number}) => void
}

type Props = {
  children?: React.ReactNode
  contentContainerStyle?: Styles.StylesCrossPlatform
  style?: Styles.StylesCrossPlatform
  onScroll?: (event: ScrollEvent) => void
  className?: string
  ref?: React.Ref<ScrollViewRef>
  showsVerticalScrollIndicator?: boolean
  showsHorizontalScrollIndicator?: boolean
  bounces?: boolean
  contentInset?: {top?: number; left?: number; bottom?: number; right?: number}
  contentInsetAdjustmentBehavior?: 'automatic' | 'scrollableAxes' | 'never' | 'always'
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
function ScrollView(props: Props) {
  const {className, contentContainerStyle, onScroll, style, children, ref} = props
  const {showsHorizontalScrollIndicator, showsVerticalScrollIndicator} = props
  const hideScroll = showsVerticalScrollIndicator === false && showsHorizontalScrollIndicator === false
  const cn = Styles.classNames(
    // TODO: make it work for horizontal/vertical separately
    // .hide-vertical-scrollbar::-webkit-scrollbar:vertical doesn't work.
    {'hide-scrollbar': hideScroll},
    {'scroll-container': hideScroll},
    className
  )
  const divRef = React.useRef<HTMLDivElement>(null)
  React.useImperativeHandle(
    ref,
    () => ({
      scrollTo: (arg0: {x: number; y: number; animated?: boolean}) => {
        divRef.current?.scrollTo({left: arg0.x, top: arg0.y})
      },
      scrollToEnd: () => {
        divRef.current?.scrollTo({
          left: divRef.current.scrollWidth,
        })
      },
    }),
    [divRef]
  )

  const onScroll_ = (e: React.UIEvent<HTMLDivElement>) => {
    onScroll?.({currentTarget: e.currentTarget})
  }

  return (
    <div
      className={cn}
      style={Styles.collapseStylesDesktop([styles.overflowAuto, style])}
      onScroll={onScroll_}
      ref={divRef}
    >
      <div style={Styles.castStyleDesktop(contentContainerStyle)}>{children}</div>
    </div>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  overflowAuto: Styles.platformStyles({
    isElectron: {
      overflow: 'auto',
    },
  }),
}))

export default ScrollView
