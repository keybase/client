import * as React from 'react'
import Box from '../box'
import {NativeKeyboard} from '../native-wrappers.native'
import {Gateway} from 'react-gateway'
import {Props} from './index.types'
import {globalStyles} from '../../styles'

export default class FloatingBox extends React.Component<Props> {
  componentWillMount() {
    if (this.props.hideKeyboard) {
      NativeKeyboard.dismiss()
    }
  }
  render() {
    const props = this.props
    return (
      <Gateway into={props.dest || 'popup-root'}>
        <Box pointerEvents="box-none" style={[globalStyles.fillAbsolute, props.containerStyle]}>
          {props.children}
        </Box>
      </Gateway>
    )
  }
}
