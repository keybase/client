// @flow
import * as React from 'react'
import type {Props} from './scroll-view'

const ScrollView = (props: Props) => {
  const {contentContainerStyle, style, ...rest} = props
  return (
    <div style={{overflow: 'auto', ...style}}>
      <div style={contentContainerStyle} {...rest} />
    </div>
  )
}

export default ScrollView
