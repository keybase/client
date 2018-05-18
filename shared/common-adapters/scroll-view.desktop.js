// @flow
import * as React from 'react'

type Props = {|
  children?: React.Node,
  contentContainerStyle?: Object,
  style?: Object,
|}

const ScrollView = (props: Props) => {
  const {contentContainerStyle, style, ...rest} = props
  return (
    <div style={{overflow: 'auto', ...style}}>
      <div style={contentContainerStyle} {...rest} />
    </div>
  )
}

export default ScrollView
