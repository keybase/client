// @flow
import React from 'react'
import {Box, Text, Icon} from '../common-adapters'
import {globalStyles, globalColors} from '../styles'
import {ReachabilityReachable} from '../constants/types/flow-types'
import {ignoreDisconnectOverlay} from '../local-debug'

import type {Props} from './index'

const Offline = ({reachable}: Props) => {
  if (reachable !== ReachabilityReachable.no) {
    return null
  }

  if (ignoreDisconnectOverlay) {
    console.warn('Ignoring disconnect overlay')
    return null
  }

  const message = 'Keybase is currently unreachable. Trying to reconnect you…'
  return (
    <Box style={containerOverlayStyle}>
      <Box style={overlayRowStyle}>
        <Text type="BodySemibold" style={textStyle}>{message}</Text>
      </Box>
      <Box style={overlayFillStyle}>
        <Icon type="icon-loader-connecting-266" />
      </Box>
    </Box>
  )
}

const overlayFillStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  backgroundColor: globalColors.white,
  flex: 1,
  justifyContent: 'center',
}

const textStyle = {
  color: globalColors.white,
  textAlign: 'center',
}

const overlayRowStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  backgroundColor: globalColors.blue,
  justifyContent: 'center',
  padding: 8,
  paddingTop: 28,
}

const containerOverlayStyle = {
  ...globalStyles.flexBoxColumn,
  bottom: 0,
  left: 0,
  position: 'absolute',
  right: 0,
  top: 0,
}

export default Offline
