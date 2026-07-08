import * as React from 'react'
import * as Styles from '@/styles'
import {Box2} from '@/common-adapters/box'
import {Keyboard} from 'react-native'
import type {Props} from './index.shared'
import {Portal} from '../../portal'

const NativeFloatingBox = (p: Props) => {
  const {hideKeyboard, children, containerStyle} = p
  const [lastHK, setLastHK] = React.useState(hideKeyboard)
  if (lastHK !== hideKeyboard) {
    setLastHK(hideKeyboard)
    if (hideKeyboard) {
      Keyboard.dismiss()
    }
  }

  return (
    <Portal hostName="popup-root">
      <Box2
        direction="vertical"
        pointerEvents="box-none"
        style={Styles.collapseStyles([Styles.globalStyles.fillAbsolute, containerStyle])}
      >
        {children}
      </Box2>
    </Portal>
  )
}

export default NativeFloatingBox
