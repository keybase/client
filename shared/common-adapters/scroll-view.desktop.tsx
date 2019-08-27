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
    hideScroll,
    hideVerticalScroll,
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
  const cn = Styles.classNames(
    {'hide-scrollbar': hideScroll || hideVerticalScroll},
    {'scroll-container': hideVerticalScroll},
    className
  )
  const overflowStyle = hideVerticalScroll ? styles.overflowHidden : styles.overflowAuto
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
      style={Styles.collapseStyles([overflowStyle, style])}
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
  overflowHidden: {
    overflowX: 'hidden',
    overflowY: 'auto',
  },
}))

export default ScrollView
