// @flow
import * as Constants from '../../../constants/chat'
import React, {PureComponent} from 'react'
import shallowEqual from 'shallowequal'
import {Avatar, Icon, Text} from '../../../common-adapters'
import {Map} from 'immutable'
import {globalStyles, globalMargins, globalColors} from '../../../styles'
import {withHandlers} from 'recompose'

import type {FollowingMap, MetaDataMap} from '../../../constants/chat'

type Props = {
  includeHeader: boolean,
  isFirstNewMessage: boolean,
  onRetry: () => void,
  onAction: (message: Constants.ServerMessage, event: any) => void,
  style: Object,
  isSelected: boolean,
  children: React$Element<*>,
  message: Constants.TextMessage | Constants.AttachmentMessage,
  you: string,
  followingMap: FollowingMap,
  metaDataMap: MetaDataMap,
}

const marginColor = (user: string, you: string, followingMap: FollowingMap, metaDataMap: MetaDataMap) => {
  if (user === you) {
    return globalColors.white
  } else {
    if (metaDataMap.get(user, Map()).get('brokenTracker', false)) {
      return globalColors.red
    }
    return followingMap[user] ? globalColors.green2 : globalColors.blue
  }
}

const colorForAuthor = (user: string, you: string, followingMap: FollowingMap, metaDataMap: MetaDataMap) => {
  if (user === you) {
    return globalColors.black_75
  } else {
    return marginColor(user, you, followingMap, metaDataMap)
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

      // Messages can be updated, for example progress state on attachments
      if (key === 'message') {
        return shallowEqual(obj, oth)
      }

      return undefined
    })
  }

  render () {
    const {children, message, style, includeHeader, isFirstNewMessage, onRetry, onIconClick, isSelected, you, followingMap, metaDataMap} = this.props
    return (
      <div style={{...globalStyles.flexBoxColumn, flex: 1, ...(isFirstNewMessage ? _stylesFirstNewMessage : null), ...(isSelected ? _stylesSelected : null), ...style}}>
        <div style={_marginContainerStyle}>
          <div style={{width: 2, marginRight: globalMargins.tiny, alignSelf: 'stretch', backgroundColor: marginColor(message.author, you, followingMap, metaDataMap)}} />
          <div style={{...globalStyles.flexBoxRow, flex: 1, paddingTop: (includeHeader ? globalMargins.tiny : 0)}}>
            {includeHeader
              ? <Avatar size={24} username={message.author} style={_avatarStyle} />
              : <div style={_noHeaderStyle} />}
            <div style={_bodyContainerStyle}>
              {includeHeader && <Text type='BodySmallSemibold' style={{color: colorForAuthor(message.author, you, followingMap, metaDataMap), ...(message.author === you ? globalStyles.italic : null), marginBottom: 2}}>{message.author}</Text>}
              <div style={_textContainerStyle} className='message' data-message-key={message.key}>
                <div style={_childrenWrapStyle}>
                  {children}
                </div>
                <div className='action-button'>
                  {message.senderDeviceRevokedAt && <Icon type='iconfont-exclamation' style={_exclamationStyle} />}
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

const _childrenWrapStyle = {
  flex: 1,
  ...globalStyles.flexBoxColumn,
}

const _stylesFirstNewMessage = {
  borderTop: `solid 1px ${globalColors.orange}`,
}

const _stylesSelected = {
  backgroundColor: `${globalColors.black_05}`,
}

const _exclamationStyle = {
  fontSize: 10,
  color: globalColors.blue,
}

const _ellipsisStyle = {
  fontSize: 16,
  marginLeft: globalMargins.tiny,
  marginRight: globalMargins.xtiny,
}

const _textContainerStyle = {
  ...globalStyles.flexBoxRow,
  flex: 1,
  paddingLeft: globalMargins.xtiny,
  paddingRight: globalMargins.xtiny,
  marginLeft: -globalMargins.xtiny,
  marginRight: globalMargins.xtiny,
  borderRadius: 4,
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
  onRetry: (props: Props) => () => {
    props.message.outboxID && props.onRetry(props.message.outboxID)
  },
})(_MessageComponent)
