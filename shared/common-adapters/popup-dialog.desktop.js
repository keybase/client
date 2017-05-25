// @flow
import React from 'react'
import {Box, Icon} from './'
import EscapeHandler from '../util/escape-handler'
import {globalColors, globalMargins, globalStyles} from '../styles'

import type {Props} from './popup-dialog'

function stopBubbling(ev) {
  ev.stopPropagation()
}

export function PopupDialog({
  children,
  onClose,
  fill,
  styleCover,
  styleContainer,
  styleClose,
  styleClipContainer,
  allowClipBubbling,
}: Props) {
  return (
    <EscapeHandler onESC={onClose}>
      <Box style={{...coverStyle, ...styleCover}} onClick={onClose}>
        <Box style={{...containerStyle, ...(fill ? containerFillStyle : null), ...styleContainer}}>
          <Icon type="iconfont-close" style={{...closeStyle, ...styleClose}} />
          <Box
            style={{...clipContainerStyle, ...styleClipContainer}}
            onClick={allowClipBubbling ? undefined : stopBubbling}
          >
            {children}
          </Box>
        </Box>
      </Box>
    </EscapeHandler>
  )
}

const coverStyle = {
  ...globalStyles.flexBoxColumn,
  background: globalColors.midnightBlue_75,
  justifyContent: 'center',
  alignItems: 'center',
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
  ...globalStyles.flexBoxRow,
  position: 'relative',
  maxWidth: '100%',
  maxHeight: '100%',
}

const containerFillStyle = {
  width: '100%',
  height: '100%',
}

const clipContainerStyle = {
  ...globalStyles.flexBoxColumn,
  position: 'relative',
  flex: 1,
  background: globalColors.white,
  boxShadow: `0 2px 5px 0 ${globalColors.black_20}`,
  borderRadius: 4,
  maxWidth: '100%',
}

const closeStyle = {
  position: 'absolute',
  right: -16 - globalMargins.tiny + 2, // FIXME: 2px fudge since icon isn't sized to 16px extents
  color: globalColors.white,
  cursor: 'pointer',
}

export default PopupDialog
