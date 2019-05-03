// @flow
import * as React from 'react'
import Box from '../box'
import {Gateway} from 'react-gateway'
import type {Props} from './index.types'
import {globalStyles} from '../../styles'
import {NativeKeyboard} from '../native-wrappers.native'

class FloatingBox extends React.Component<Props> {
  componentWillMount() {
    NativeKeyboard.dismiss()
  }

  render() {
    return (
      <Gateway into={this.props.dest || 'popup-root'}>
        <Box pointerEvents="box-none" style={[globalStyles.fillAbsolute, this.props.containerStyle]}>
          {this.props.children}
        </Box>
      </Gateway>
    )
  }
}
export default FloatingBox
