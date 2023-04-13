import * as React from 'react'
import Box from '../box'
import {Keyboard, StyleSheet} from 'react-native'
import {Portal} from '../portal.native'
import type {Props} from '.'

const Kb = {
  Box,
  Portal,
}

const FloatingBox = (p: Props) => {
  const {hideKeyboard, children, containerStyle} = p

  React.useEffect(() => {
    if (hideKeyboard) {
      Keyboard.dismiss()
    }
  }, [hideKeyboard])

  return (
    <Kb.Portal hostName="popup-root">
      <Kb.Box pointerEvents="box-none" style={[StyleSheet.absoluteFill, containerStyle]}>
        {children}
      </Kb.Box>
    </Kb.Portal>
  )
}

export default FloatingBox
