import * as React from 'react'
import * as Styles from '@/styles'
import {Box2} from '@/common-adapters/box'
import {Keyboard} from 'react-native'
import noop from 'lodash/noop'
import type {Props} from './index.shared'
import type {MeasureRef} from '../../measure-ref'
import {Portal} from '../../portal.native'

type RFBProps = {
  attachTo?: React.RefObject<MeasureRef | null>
  position: Styles.Position
  positionFallbacks?: ReadonlyArray<Styles.Position>
  matchDimension?: boolean
  onClosePopup: () => void
  propagateOutsideClicks?: boolean
  remeasureHint?: number
  style?: Styles.StylesCrossPlatform
  children: React.ReactNode
  disableEscapeKey?: boolean
  offset?: number
}

const DesktopFloatingBox = (props: Props) => {
  const {attachTo, disableEscapeKey, position, positionFallbacks, children, offset} = props
  const {onHidden, remeasureHint, propagateOutsideClicks, containerStyle, matchDimension} = props
  const {RelativeFloatingBox} = require('./relative-floating-box.desktop') as {
    RelativeFloatingBox: React.ComponentType<RFBProps>
  }

  return (
    <RelativeFloatingBox
      attachTo={attachTo}
      disableEscapeKey={disableEscapeKey}
      position={position || 'bottom center'}
      positionFallbacks={positionFallbacks}
      matchDimension={!!matchDimension}
      onClosePopup={onHidden || noop}
      remeasureHint={remeasureHint}
      propagateOutsideClicks={propagateOutsideClicks}
      style={containerStyle}
      offset={offset}
    >
      {children}
    </RelativeFloatingBox>
  )
}

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

export default isMobile ? NativeFloatingBox : DesktopFloatingBox
