import type {MeasureRef} from '../../measure-ref'
import * as React from 'react'
import {Box2} from '@/common-adapters/box'
import * as Styles from '@/styles'
import {Keyboard} from 'react-native'
import {Portal} from '../../portal.native'


export type Props = {
  children?: React.ReactNode
  onHidden?: () => void
  attachTo?: React.RefObject<MeasureRef | null>
  disableEscapeKey?: boolean
  propagateOutsideClicks?: boolean
  containerStyle?: Styles.StylesCrossPlatform
  matchDimension?: boolean
  remeasureHint?: number
  position?: Styles.Position
  positionFallbacks?: ReadonlyArray<Styles.Position>
  hideKeyboard?: boolean
  offset?: number
}
const Kb = {
  Box2,
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
      <Kb.Box2
        direction="vertical"
        pointerEvents="box-none"
        style={Styles.collapseStyles([Styles.globalStyles.fillAbsolute, containerStyle])}
      >
        {children}
      </Kb.Box2>
    </Kb.Portal>
  )
}

export default FloatingBox
