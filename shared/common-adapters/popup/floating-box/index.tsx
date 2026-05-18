import * as React from 'react'
import * as Styles from '@/styles'
import {Box2} from '@/common-adapters/box'
import {Keyboard} from 'react-native'
import noop from 'lodash/noop'
import type {Props} from './index.shared'

type RFBProps = {
  attachTo: Props['attachTo']
  disableEscapeKey: Props['disableEscapeKey']
  position: string
  positionFallbacks: Props['positionFallbacks']
  matchDimension: boolean
  onClosePopup: () => void
  remeasureHint: Props['remeasureHint']
  propagateOutsideClicks: Props['propagateOutsideClicks']
  style: Props['containerStyle']
  offset: Props['offset']
  children?: React.ReactNode
}

const DesktopFloatingBox = (props: Props) => {
  const {RelativeFloatingBox} = require('./relative-floating-box.desktop') as {
    RelativeFloatingBox: React.ComponentType<RFBProps>
  }
  const {attachTo, disableEscapeKey, position, positionFallbacks, children, offset} = props
  const {onHidden, remeasureHint, propagateOutsideClicks, containerStyle, matchDimension} = props

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

type PortalProps = {hostName?: string; children?: React.ReactNode}

const NativeFloatingBox = (p: Props) => {
  const {Portal} = require('../../portal.native') as {Portal: React.ComponentType<PortalProps>}
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
