// @flow
import React from 'react'
import {Box, Text, Avatar} from '../../../common-adapters'
import {globalStyles, globalMargins, globalColors} from '../../../styles'

import type {Props} from './text'

const _marginColor = (followState) => ({
  'You': globalColors.white,
  'Following': globalColors.green2,
  'NotFollowing': globalColors.blue,
  'Broken': globalColors.red,
}[followState])

const MessageText = ({author, message, followState, messageState, style}: Props) => (
  <Box style={{...globalStyles.flexBoxRow, padding: globalMargins.tiny, ...style}}>
    <Box style={{width: 2, alignSelf: 'stretch', backgroundColor: _marginColor(followState)}} />
    <Avatar size={24} username={author} style={{marginRight: globalMargins.tiny}} />
    <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
      <Text type='BodySemibold' style={{...(followState === 'You' ? globalStyles.fontItalic : null)}}>{author}</Text>
      <Text type={messageState === 'pending' ? 'BodySmallItalic' : 'Body'}>{message}</Text>
    </Box>
  </Box>
)

export default MessageText
