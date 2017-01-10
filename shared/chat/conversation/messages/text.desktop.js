// @flow
import * as Constants from '../../../constants/chat'
import React, {PureComponent} from 'react'
import shallowEqual from 'shallowequal'
import {Avatar, Icon, Text, Markdown} from '../../../common-adapters'
import {globalStyles, globalMargins, globalColors} from '../../../styles'
import {withHandlers, shouldUpdate, compose} from 'recompose'

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
  <div>
    <Text type='BodySmall' style={{fontSize: 9, color: globalColors.red}}>{'┏(>_<)┓'}</Text>
    <Text type='BodySmall' style={{color: globalColors.red}}> Failed to send. </Text>
    <Text type='BodySmall' style={{color: globalColors.red, textDecoration: 'underline'}} onClick={onRetry}>Retry</Text>
  </div>
)

class _MessageTextComponent extends PureComponent<void, Props & {onIconClick: (event: any) => void, onRetry: (event: any) => void}, void> {
  render () {
    const {message, style, includeHeader, isFirstNewMessage, isSelected, onRetry, onIconClick} = this.props
    return (
      <div style={{...globalStyles.flexBoxColumn, flex: 1, ...(isFirstNewMessage ? _stylesFirstNewMessage : null), ...(isSelected ? _stylesSelected : null), ...style}} className='message'>
        <div style={_marginContainerStyle}>
          <div style={{width: 2, marginRight: globalMargins.tiny, alignSelf: 'stretch', backgroundColor: _marginColor(message.followState)}} />
          <div style={{...globalStyles.flexBoxRow, flex: 1, paddingTop: (includeHeader ? globalMargins.tiny : 0)}}>
            {includeHeader
              ? <Avatar size={24} username={message.author} style={_avatarStyle} />
              : <div style={_noHeaderStyle} />}
            <div style={_bodyContainerStyle}>
              {includeHeader && <Text type='BodySmallSemibold' style={{color: colorForAuthor(message.followState), ...(message.followState === 'You' ? globalStyles.italic : null)}}>{message.author}</Text>}
              <div style={_textContainerStyle}>
                <MessageText message={message} style={_messageTextStyle} />
                <div className='action-button'>
                  {message.senderDeviceRevokedAt && <Icon type='iconfont-info' style={_infoStyle} />}
                  <Icon type='iconfont-ellipsis' style={_ellipsisStyle} onClick={onIconClick} />
                </div>
              </div>
              {message.messageState === 'failed' && <Retry onRetry={onRetry} />}
            </div>
          </div>
        </div>
      </div>
    )
  }
}

const _infoStyle = {
  fontSize: 10,
  color: globalColors.blue,
}

const _ellipsisStyle = {
  fontSize: 13,
  marginLeft: globalMargins.xtiny,
  marginRight: globalMargins.tiny,
}

const _messageTextStyle = {
  marginTop: globalMargins.xtiny,
  flex: 1,
}

const _textContainerStyle = {
  ...globalStyles.flexBoxRow,
  flex: 1,
}

const _marginContainerStyle = {
  ...globalStyles.flexBoxRow,
  flex: 1,
}

const _bodyContainerStyle = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
}

const _noHeaderStyle = {
  width: 32,
}

const _avatarStyle = {
  marginRight: globalMargins.tiny,
}

const _stylesFirstNewMessage = {
  borderTop: `solid 1px ${globalColors.orange}`,
}

const _stylesSelected = {
  backgroundColor: `${globalColors.black_05}`,
}

export default compose(
  shouldUpdate((props: Props, nextProps: Props) => {
    return !shallowEqual(props, nextProps, (obj, oth, key) => {
      if (key === 'style') {
        return shallowEqual(obj, oth)
      }
      return undefined
    })
  }),
  withHandlers({
    onIconClick: (props: Props) => event => {
      props.onAction(props.message, event)
    },
    onRetry: (props: Props) => () => {
      props.message.outboxID && props.onRetry(props.message.outboxID)
    },
  })
)(_MessageTextComponent)
