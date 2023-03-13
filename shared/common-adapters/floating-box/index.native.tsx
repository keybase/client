import * as React from 'react'
import Box from '../box'
import {Keyboard, StyleSheet} from 'react-native'
import {Portal} from '../portal.native'
import type {Props} from '.'

const FloatingBox = (p: Props) => {
  const {hideKeyboard, children, containerStyle} = p

  React.useEffect(() => {
    if (hideKeyboard) {
      Keyboard.dismiss()
    }
  }, [hideKeyboard])

  return (
    <Portal hostName="popup-root">
      <Box pointerEvents="box-none" style={[StyleSheet.absoluteFill, containerStyle]}>
        {children}
      </Box>
    </Portal>
  )
}

export default FloatingBox
