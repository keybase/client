// @flow
import React, {Component} from 'react'
import {Avatar, Box, Icon, Text, Markdown} from '../../../common-adapters'
import {globalStyles, globalMargins, globalColors} from '../../../styles'
import * as Constants from '../../../constants/chat'
import type {TextMessage} from '../../../constants/chat'

import type {Props} from './text'

const _marginColor = (followState) => ({
  'You': globalColors.white,
  'Following': globalColors.green2,
  'NotFollowing': globalColors.blue,
  'Broken': globalColors.red,
}[followState])

const MessageText = ({message, style}: {message: TextMessage, style: Object}) => {
  const text = message.message.stringValue()
  switch (message.messageState) {
    case 'failed':
    case 'pending':
      return <Markdown style={{color: globalColors.black_40, ...globalStyles.selectable, ...style}}>{text}</Markdown>
    case 'sent':
    default:
      return <Markdown style={{...globalStyles.selectable, ...style}}>{text}</Markdown>
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

export default class MessageTextComponent extends Component<void, Props, void> {
  render () {
    const {message, style, includeHeader, isFirstNewMessage, onRetry, onAction} = this.props
    return (
      <Box style={{...globalStyles.flexBoxColumn, flex: 1, ...(isFirstNewMessage ? stylesFirstNewMessage : null), ...style}} className='message'>
        <Box style={{...globalStyles.flexBoxRow, flex: 1}}>
          <Box style={{width: 2, marginRight: globalMargins.tiny, alignSelf: 'stretch', backgroundColor: _marginColor(message.followState)}} />
          <Box style={{...globalStyles.flexBoxRow, flex: 1, paddingTop: (includeHeader ? globalMargins.tiny : 0)}}>
            {includeHeader
              ? <Avatar size={24} username={message.author} style={{marginRight: globalMargins.tiny}} />
              : <Box style={{width: 32}} />}
            <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
              {includeHeader && <Text type='BodySmallSemibold' style={{color: colorForAuthor(message.followState), ...(message.followState === 'You' ? globalStyles.italic : null)}}>{message.author}</Text>}
              <Box style={{...globalStyles.flexBoxRow, flex: 1}}>
                <MessageText message={message} style={{marginTop: globalMargins.xtiny, flex: 1}} />
                <div className='action-button'>
                  <Icon type='iconfont-ellipsis' style={{marginLeft: globalMargins.tiny, marginRight: globalMargins.tiny}} onClick={onAction} />
                </div>
              </Box>
              {message.messageState === 'failed' && <Retry onRetry={onRetry} />}
            </Box>
          </Box>
        </Box>
      </Box>
    )
  }
}

const stylesFirstNewMessage = {
  borderTop: `solid 1px ${globalColors.orange}`,
}
