import * as React from 'react'
import Box from '../../box'
import {Props} from '../index.types'

export default class FloatingBox extends React.Component<Props, {}> {
  state = {}
  render() {
    return <Box style={this.props.containerStyle}>{this.props.children}</Box>
  }
}
