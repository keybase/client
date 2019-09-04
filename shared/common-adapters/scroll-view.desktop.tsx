import * as React from 'react'
import * as Styles from '../styles'
import {Props} from './scroll-view'

const ScrollView = React.forwardRef((props: Props, ref) => {
  const {
    alwaysBounceHorizontal,
    alwaysBounceVertical,
    bounces,
    centerContent,
    className,
    contentContainerStyle,
    horizontal,
    indicatorStyle,
    maximumZoomScale,
    minimumZoomScale,
    onLayout,
    onScroll,
    refreshControl,
    scrollEventThrottle,
    scrollsToTop,
    showsHorizontalScrollIndicator,
    showsVerticalScrollIndicator,
    snapToInterval,
    style,
    ...rest
  } = props
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
      scrollToEnd: () => {
        divRef.current &&
          divRef.current.scrollTo({
            left: divRef.current.scrollWidth,
          })
      },
    }),
    [divRef]
  )
  return (
    <div
      className={cn}
      style={Styles.collapseStyles([styles.overflowAuto, style])}
      onScroll={props.onScroll || undefined}
      ref={divRef}
    >
      <div style={contentContainerStyle as any} {...rest} />
    </div>
  )
})

const styles = Styles.styleSheetCreate(() => ({
  overflowAuto: {
    overflow: 'auto',
  },
}))

export default ScrollView
