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
  ...globalStyles.fillAbsolute,
  backgroundColor: globalColors.midnightBlue_75,
  paddingLeft: globalMargins.large,
  paddingRight: globalMargins.large,
  paddingTop: globalMargins.small,
  paddingBottom: globalMargins.small,
}

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  position: 'relative',
  flexGrow: 1,
  backgroundColor: globalColors.white,
  borderRadius: 4,
}

export default PopupDialog
