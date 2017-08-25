// @flow
import * as React from 'react'
import type {Props} from './scroll-view'

const ScrollView = (props: Props) => {
  const {contentContainerStyle, style, ...restProps} = props
  const contentContainerProps = {
    style: contentContainerStyle,
    ...restProps,
  }
  return (
    <div style={{overflow: 'auto', ...style}}>
      <div {...contentContainerProps} />
    </div>
  )
}

export default ScrollView
