// @flow
import * as React from 'react'
import {collapseStyles} from '../styles'
import type {Props} from './scroll-view'

const ScrollView = (props: Props) => {
  const {contentContainerStyle, style, hideVerticalScroll, ...rest} = props
  const className = hideVerticalScroll ? 'hide-scrollbar scroll-container' : ''
  const overflowStyle = hideVerticalScroll ? overflowHidden : overflowAuto
  return (
    <div style={collapseStyles([overflowStyle, style])} onScroll={props.onScroll} className={className}>
      <div style={contentContainerStyle} {...rest} />
    </div>
  )
}

// not using a stylesheet because StylesCrossPlatform
// doesn't include overflowX and overflowY
const overflowAuto = {
  overflow: 'auto',
}
const overflowHidden = {
  overflowX: 'hidden',
  overflowY: 'auto',
}

export default ScrollView
