// @flow
import React from 'react'
import {Box, Text, Avatar} from '../../../common-adapters'
import {globalStyles, globalMargins, globalColors} from '../../../styles'
import * as Constants from '../../../constants/chat'

import type {Props} from './text'

const _marginColor = (followState) => ({
  'You': globalColors.white,
  'Following': globalColors.green2,
  'NotFollowing': globalColors.blue,
  'Broken': globalColors.red,
}[followState])

const MessageText = ({text, messageState, style}: {text: string, messageState: Constants.MessageState, style: Object}) => {
  switch (messageState) {
    case 'failed':
    case 'pending':
      return <Text type='Body' style={{color: globalColors.black_40, ...style}}>{text}</Text>
    case 'sent':
    default:
      return <Text style={style} type='Body'>{text}</Text>
  }
}

const colorForAuthor = (followState: Constants.FollowState) => {
  if (followState === 'You') {
    return globalColors.black_75
  } else {
    return _marginColor(followState)
  }
}

const Retry = ({onRetry}: {onRetry: () => void}) => (
  <Box>
    <Text type='BodySmall' style={{fontSize: 9, color: globalColors.red}}>{'┏(>_<)┓'}</Text>
    <Text type='BodySmall' style={{color: globalColors.red}}> Failed to send. </Text>
    <Text type='BodySmall' style={{color: globalColors.red, textDecoration: 'underline'}} onClick={onRetry}>Retry</Text>
  </Box>
)

const MessageTextWrapper = ({author, message, messageState, followState, style, includeHeader, onRetry}: Props) => (
  <Box style={{...globalStyles.flexBoxRow, ...style}}>
    <Box style={{width: 2, marginRight: globalMargins.tiny, alignSelf: 'stretch', backgroundColor: _marginColor(followState)}} />
    <Box style={{...globalStyles.flexBoxRow, paddingTop: (includeHeader ? globalMargins.tiny : 0)}}>
      {includeHeader
        ? <Avatar size={24} username={author} style={{marginRight: globalMargins.tiny}} />
        : <Box style={{width: 32}} />}
      <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
        {includeHeader && <Text type='BodySmallSemibold' style={{color: colorForAuthor(followState), ...(followState === 'You' ? globalStyles.italic : null)}}>{author}</Text>}
        <MessageText text={message} messageState={messageState} style={{marginTop: globalMargins.xtiny}} />
        {messageState === 'failed' && <Retry onRetry={onRetry} />}
      </Box>
    </Box>
  </Box>
)

export default MessageTextWrapper
