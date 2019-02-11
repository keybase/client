// @flow
import * as React from 'react'
import * as Styles from '../styles'
import type {Props} from './scroll-view'

const ScrollView = (props: Props) => {
  const {contentContainerStyle, style, hideVerticalScroll, ...rest} = props
  const className = Styles.classNames(
    {'hide-scrollbar': hideVerticalScroll},
    {'scroll-container': hideVerticalScroll}
  )
  const overflowStyle = hideVerticalScroll ? styles.overflowHidden : styles.overflowAuto
  return (
    <div
      style={Styles.collapseStyles([overflowStyle, style])}
      onScroll={props.onScroll}
      className={className}
    >
      <div style={contentContainerStyle} {...rest} />
    </div>
  )
}

// not using a stylesheet because StylesCrossPlatform
// doesn't include overflowX and overflowY
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
