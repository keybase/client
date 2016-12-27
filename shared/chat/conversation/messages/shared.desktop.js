// @flow
import React, {PureComponent} from 'react'
import {Avatar, Icon, Text} from '../../../common-adapters'
import {globalStyles, globalMargins, globalColors} from '../../../styles'
import * as Constants from '../../../constants/chat'
import {withHandlers} from 'recompose'
import shallowEqual from 'shallowequal'

type Props = {
  includeHeader: boolean,
  isFirstNewMessage: boolean,
  onRetry: () => void,
  onAction: (message: Constants.ServerMessage, event: any) => void,
  style: Object,
  isSelected: boolean,
  children: React$Element<*>,
  message: Constants.TextMessage | Constants.AttachmentMessage,
}

const _marginColor = (followState) => ({
  'You': globalColors.white,
  'Following': globalColors.green2,
  'NotFollowing': globalColors.blue,
  'Broken': globalColors.red,
}[followState])

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

type MessageProps = Props & {onIconClick: (event: any) => void}

class _MessageComponent extends PureComponent<void, MessageProps, void> {
  shouldComponentUpdate (nextProps: MessageProps) {
    return !shallowEqual(this.props, nextProps, (obj, oth, key) => {
      if (key === 'style') {
        return shallowEqual(obj, oth)
      }
      return undefined
    })
  }

  render () {
    const {children, message, style, includeHeader, isFirstNewMessage, onRetry, onIconClick} = this.props
    return (
      <div style={{...globalStyles.flexBoxColumn, flex: 1, ...(isFirstNewMessage ? stylesFirstNewMessage : null), ...style}} className='message'>
        <div style={_marginContainerStyle}>
          <div style={{width: 2, marginRight: globalMargins.tiny, alignSelf: 'stretch', backgroundColor: _marginColor(message.followState)}} />
          <div style={{...globalStyles.flexBoxRow, flex: 1, paddingTop: (includeHeader ? globalMargins.tiny : 0)}}>
            {includeHeader
              ? <Avatar size={24} username={message.author} style={_avatarStyle} />
              : <div style={_noHeaderStyle} />}
            <div style={_bodyContainerStyle}>
              {includeHeader && <Text type='BodySmallSemibold' style={{color: colorForAuthor(message.followState), ...(message.followState === 'You' ? globalStyles.italic : null)}}>{message.author}</Text>}
              <div style={_textContainerStyle}>
                <div style={{flex: 1}}>
                  {children}
                </div>
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

const stylesFirstNewMessage = {
  borderTop: `solid 1px ${globalColors.orange}`,
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

export default withHandlers({
  onIconClick: (props: Props) => event => {
    props.onAction(props.message, event)
  },
})(_MessageComponent)
