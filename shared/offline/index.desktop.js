// @flow
import logger from '../logger'
import * as React from 'react'
import {Box, Text, Icon} from '../common-adapters'
import {globalStyles, globalColors} from '../styles'
import {reachabilityReachable} from '../constants/types/rpc-gen'
import {ignoreDisconnectOverlay} from '../local-debug.desktop'
import flags from '../util/feature-flags'

import type {Props} from './index'

const Offline = ({reachable, appFocused}: Props) => {
  if (reachable !== reachabilityReachable.no) {
    return null
  }

  if (ignoreDisconnectOverlay) {
    logger.warn('Ignoring disconnect overlay')
    return null
  }

  const message = 'Keybase is currently unreachable. Trying to reconnect you…'
  return (
    <Box style={containerOverlayStyle}>
      <Box style={overlayRowStyle}>
        <Text center={true} type="BodySmallSemibold" style={textStyle}>
          {message}
        </Text>
      </Box>
      <Box style={overlayFillStyle}>{appFocused && <Icon type="icon-loader-connecting-266" />}</Box>
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

const textStyle = {color: globalColors.white}

const overlayRowStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  backgroundColor: globalColors.blue,
  justifyContent: 'center',
  padding: 8,
}

const containerOverlayStyle = {
  ...globalStyles.flexBoxColumn,
  bottom: 0,
  left: flags.useNewRouter ? 0 : 80,
  position: 'absolute',
  right: 0,
  top: 0,
  zIndex: 1000,
}

export default Offline
