import * as React from 'react'
import * as Styles from '../styles'
import {Props} from './scroll-view'

const ScrollView = (props: Props) => {
  const {
    alwaysBounceHorizontal,
    alwaysBounceVertical,
    bounces,
    centerContent,
    className,
    contentContainerStyle,
    hideVerticalScroll,
    horizontal,
    indicatorStyle,
    maximumZoomScale,
    minimumZoomScale,
    onLayout,
    onScroll,
    ref,
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
    {'hide-scrollbar': hideVerticalScroll},
    {'scroll-container': hideVerticalScroll},
    className
  )
  const overflowStyle = hideVerticalScroll ? styles.overflowHidden : styles.overflowAuto
  return (
    <div
      className={cn}
      style={Styles.collapseStyles([overflowStyle, style])}
      onScroll={props.onScroll || undefined}
    >
      <div style={contentContainerStyle as any} {...rest} />
    </div>
  )
}

const styles = Styles.styleSheetCreate({
  overflowAuto: {
    overflow: 'auto',
  },
  overflowHidden: {
    overflowX: 'hidden',
    overflowY: 'auto',
  },
})

export default ScrollView
