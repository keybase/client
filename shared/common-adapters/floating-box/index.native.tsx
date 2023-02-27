import * as React from 'react'
import Box from '../box'
import {Keyboard, StyleSheet} from 'react-native'
import {Portal} from '../portal.native'
import type {Props} from '.'

export default class FloatingBox extends React.Component<Props> {
  componentDidMount() {
    if (this.props.hideKeyboard) {
      Keyboard.dismiss()
    }
  }
  render() {
    const props = this.props
    return (
      <Portal hostName="popup-root">
        <Box pointerEvents="box-none" style={[StyleSheet.absoluteFill, props.containerStyle]}>
          {props.children}
        </Box>
      </Portal>
    )
  }
}
