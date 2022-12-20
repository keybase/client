import * as React from 'react'
import Box from '../box'
import {NativeKeyboard} from '../native-wrappers.native'
import {Portal} from '@gorhom/portal'
import type {Props} from '.'
import {globalStyles} from '../../styles'

export default class FloatingBox extends React.Component<Props> {
  componentDidMount() {
    if (this.props.hideKeyboard) {
      NativeKeyboard.dismiss()
    }
  }
  render() {
    const props = this.props
    return (
      <Portal hostName={props.dest || 'popup-root'}>
        <Box pointerEvents="box-none" style={[globalStyles.fillAbsolute, props.containerStyle]}>
          {props.children}
        </Box>
      </Portal>
    )
  }
}
