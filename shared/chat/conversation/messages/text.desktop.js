// @flow
import * as Constants from '../../../constants/chat'
import React, {PureComponent} from 'react'
import {Avatar, Box, Icon, Text, Markdown} from '../../../common-adapters'
import {globalStyles, globalMargins, globalColors} from '../../../styles'
import {withHandlers} from 'recompose'

import type {Props} from './text'
import type {TextMessage} from '../../../constants/chat'

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

class _MessageTextComponent extends PureComponent<void, Props & {onIconClick: (event: any) => void}, void> {
  render () {
    const {message, style, includeHeader, isFirstNewMessage, onRetry, onIconClick} = this.props
    return (
      <Box style={{...globalStyles.flexBoxColumn, flex: 1, ...(isFirstNewMessage ? stylesFirstNewMessage : null), ...style}} className='message'>
        <Box style={{...globalStyles.flexBoxRow, flex: 1}}>
          <Box style={{width: 2, marginRight: globalMargins.tiny, alignSelf: 'stretch', backgroundColor: _marginColor(message.followState)}} />
          <Box style={{...globalStyles.flexBoxRow, flex: 1, paddingTop: (includeHeader ? globalMargins.tiny : 0)}}>
            {includeHeader
              ? <Avatar size={24} username={message.author} style={_avatarStyle} />
              : <Box style={{width: 32}} />}
            <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
              {includeHeader && <Text type='BodySmallSemibold' style={{color: colorForAuthor(message.followState), ...(message.followState === 'You' ? globalStyles.italic : null)}}>{message.author}</Text>}
              <Box style={{...globalStyles.flexBoxRow, flex: 1}}>
                <MessageText message={message} style={{marginTop: globalMargins.xtiny, flex: 1}} />
                <div className='action-button'>
                  {message.senderDeviceRevokedAt && <Icon type='iconfont-info' style={{fontSize: 10, color: globalColors.blue}} />}
                  <Icon type='iconfont-ellipsis' style={{fontSize: 13, marginLeft: globalMargins.xtiny, marginRight: globalMargins.tiny}} onClick={onIconClick} />
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

const _avatarStyle = {
  marginRight: globalMargins.tiny,
}

export default withHandlers({
  onIconClick: (props: Props) => event => {
    props.onAction(props.message, event)
  },
})(_MessageTextComponent)

const stylesFirstNewMessage = {
  borderTop: `solid 1px ${globalColors.orange}`,
}
