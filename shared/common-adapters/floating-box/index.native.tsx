import * as React from 'react'
import Box from '@/common-adapters/box'
import * as Styles from '@/styles'
import {Keyboard} from 'react-native'
import {Portal} from '../portal.native'
import type {Props} from '.'

const Kb = {
  Box,
  Portal,
}

const FloatingBox = (p: Props) => {
  const {hideKeyboard, children, containerStyle} = p
  const [lastHK, setLastHK] = React.useState(hideKeyboard)
  if (lastHK !== hideKeyboard) {
    setLastHK(hideKeyboard)
    if (hideKeyboard) {
      Keyboard.dismiss()
    }
  }

  return (
    <Kb.Portal hostName="popup-root">
      <Kb.Box
        pointerEvents="box-none"
        style={Styles.collapseStyles([Styles.globalStyles.fillAbsolute, containerStyle])}
      >
        {children}
      </Kb.Box>
    </Kb.Portal>
  )
}

export default FloatingBox
