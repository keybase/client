import * as React from 'react'
import * as Styles from '@/styles'
import {RefreshControl, ScrollView as NativeScrollView} from 'react-native'
import type {ScrollViewProps, RefreshControlProps, GestureResponderEvent} from 'react-native'
import type {StylesCrossPlatform} from '@/styles'

export type ScrollViewRef = {
  scrollTo: (arg0: {x: number; y: number; animated?: boolean}) => void
  scrollToEnd: (options: {animated?: boolean; duration?: number}) => void
}

type ScrollEvent = {
  nativeEvent?: {
    contentSize: {height: number; width: number}
    zoomScale: number
    contentOffset: {x: number; y: number}
  }
  currentTarget?: HTMLDivElement
}

type Props = {
  children?: React.ReactNode
  contentContainerStyle?: StylesCrossPlatform
  style?: StylesCrossPlatform
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
  // convenience for pull-to-refresh, mobile only. Ignored if refreshControl is passed
  onRefresh?: () => void
  refreshing?: boolean
  onTouchStart?: (e: GestureResponderEvent) => void
  onTouchEnd?: (e: GestureResponderEvent) => void
  testID?: string
}

type DivScrollable = {
  scrollTo: (opts: {left?: number; top?: number}) => void
  readonly scrollWidth: number
}

function ScrollView(props: Props) {
  const {ref: outerRef, onRefresh, refreshing, ...rest} = props

  const divRef = React.useRef<DivScrollable | null>(null)
  const innerRef = React.useRef<NativeScrollView | null>(null)

  React.useImperativeHandle(outerRef, () => ({
    scrollTo: (args: {x: number; y: number; animated?: boolean}) => {
      if (isMobile) {
        innerRef.current?.scrollTo(args)
      } else {
        divRef.current?.scrollTo({left: args.x, top: args.y})
      }
    },
    scrollToEnd: (opts?: {animated?: boolean; duration?: number}) => {
      if (isMobile) {
        innerRef.current?.scrollToEnd(opts)
      } else {
        divRef.current?.scrollTo({left: divRef.current.scrollWidth})
      }
    },
  }))

  if (!isMobile) {
    const {className, contentContainerStyle, onScroll, style, children, testID} = rest
    const {showsHorizontalScrollIndicator, showsVerticalScrollIndicator} = rest
    const hideScroll =
      showsVerticalScrollIndicator === false && showsHorizontalScrollIndicator === false
    const cn = Styles.classNames(
      {'hide-scrollbar': hideScroll},
      {'scroll-container': hideScroll},
      className
    )
    const onScroll_ = (e: {currentTarget: DivScrollable}) => {
      onScroll?.({currentTarget: e.currentTarget as never})
    }
    return (
      <div
        className={cn}
        data-testid={testID}
        style={Styles.collapseStylesDesktop([styles.overflowAuto, style]) as React.CSSProperties}
        onScroll={onScroll_ as never}
        ref={divRef as React.RefObject<HTMLDivElement>}
      >
        <div style={Styles.castStyleDesktop(contentContainerStyle)}>{children}</div>
      </div>
    )
  }

  const nativeProps = rest as ScrollViewProps
  const refreshControl =
    nativeProps.refreshControl ??
    (onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined)
  const keyboardShouldPersistTaps = nativeProps.keyboardShouldPersistTaps ?? 'handled'
  const contentInsetAdjustmentBehavior =
    nativeProps.contentInsetAdjustmentBehavior ?? 'automatic'
  return (
    <NativeScrollView
      ref={innerRef}
      {...nativeProps}
      refreshControl={refreshControl}
      contentInsetAdjustmentBehavior={contentInsetAdjustmentBehavior}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      overScrollMode="never"
    />
  )
}

const styles = Styles.styleSheetCreate(() => ({
  overflowAuto: Styles.platformStyles({
    isElectron: {overflow: 'auto'},
  }),
}))

export default ScrollView
