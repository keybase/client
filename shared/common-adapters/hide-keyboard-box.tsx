import * as React from 'react'
import ClickableBox from './clickable-box'
import {Keyboard} from 'react-native'

const Kb = {
  ClickableBox,
}

const HideKeyboardBox = (p: {children: React.ReactNode}) => {
  const onHide = React.useCallback(() => Keyboard.dismiss(), [])
  return <Kb.ClickableBox onClick={onHide}>{p.children}</Kb.ClickableBox>
}

export default HideKeyboardBox
