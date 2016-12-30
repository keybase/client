// @flow
import React from 'react'
import {Box, Text} from '../../../common-adapters/index'
import {globalColors, globalStyles} from '../../../styles'

import type {Props} from './'

const AttachmentPopup = ({message, onClose}: Props) => (
  <Box style={stylesCover} onClick={onClose}>
    <Box style={globalStyles.flexBoxColumn}>
      <Text type='BodySemibold' style={{color: globalColors.white}}>Hello, world!</Text>
      <Text type='Body' style={{color: globalColors.white}}>Path: {message.previewPath}</Text>
    </Box>
  </Box>
)

const stylesCover = {
  ...globalStyles.flexBoxColumn,
  background: globalColors.midnightBlue_75,
  justifyContent: 'center',
  alignItems: 'center',
  position: 'absolute',
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
}

export default AttachmentPopup
