// @flow
import React from 'react'
import {Box} from './'
import {NativeTouchableWithoutFeedback} from './native-wrappers.native'
import {globalColors, globalMargins, globalStyles} from '../styles'

import type {Props} from './popup-dialog'

export function PopupDialog({children, onClose, fill, styleCover, styleContainer}: Props) {
  return (
    <NativeTouchableWithoutFeedback onPress={onClose}>
      <Box style={{...coverStyle, ...styleCover}}>
        <NativeTouchableWithoutFeedback>
          <Box style={{...containerStyle, ...styleContainer}}>
            {children}
          </Box>
        </NativeTouchableWithoutFeedback>
      </Box>
    </NativeTouchableWithoutFeedback>
  )
}

const coverStyle = {
  ...globalStyles.flexBoxCenter,
  backgroundColor: globalColors.midnightBlue_75,
  position: 'absolute',
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
  paddingLeft: globalMargins.large,
  paddingRight: globalMargins.large,
  paddingTop: globalMargins.small,
  paddingBottom: globalMargins.small,
}

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  position: 'relative',
  flex: 1,
  backgroundColor: globalColors.white,
  borderRadius: 4,
}

export default PopupDialog
