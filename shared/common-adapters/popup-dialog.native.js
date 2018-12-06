// @flow
import * as React from 'react'
import Box from './box'
import {NativeTouchableWithoutFeedback} from './native-wrappers.native'
import {globalColors, globalMargins, globalStyles} from '../styles'

import type {Props} from './popup-dialog'

export function PopupDialog({children, onClose, fill, styleCover, styleContainer}: Props) {
  return (
    <NativeTouchableWithoutFeedback onPress={onClose}>
      <Box style={{...coverStyle, ...styleCover}}>
        <NativeTouchableWithoutFeedback>
          <Box style={{...containerStyle, ...styleContainer}}>{children}</Box>
        </NativeTouchableWithoutFeedback>
      </Box>
    </NativeTouchableWithoutFeedback>
  )
}

const coverStyle = {
  ...globalStyles.flexBoxCenter,
  ...globalStyles.fillAbsolute,
  backgroundColor: globalColors.black_75,
  paddingBottom: globalMargins.small,
  paddingLeft: globalMargins.large,
  paddingRight: globalMargins.large,
  paddingTop: globalMargins.small,
}

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  backgroundColor: globalColors.white,
  borderRadius: 4,
  flexGrow: 1,
  position: 'relative',
}

export default PopupDialog
