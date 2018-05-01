// @flow
import * as React from 'react'
import Box from '../box'
import type {Props} from '../floating-box'

export default class FloatingBox extends React.Component<Props, {}> {
  static getDerivedStateFromProps = (props: Props) => ({})
  render() {
    return <Box style={this.props.containerStyle}>{this.props.children}</Box>
  }
}
