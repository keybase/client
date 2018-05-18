// @flow
import * as React from 'react'
import Box from '../box'

export default class FloatingBox extends React.Component<any, {}> {
  state = {}
  render() {
    return <Box style={this.props.containerStyle}>{this.props.children}</Box>
  }
}
