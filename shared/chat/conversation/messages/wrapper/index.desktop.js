// @flow
import React from 'react'
import {Avatar, Icon, Text} from '../../../../common-adapters'
import {globalStyles, globalMargins, globalColors} from '../../../../styles'
import {withHandlers} from 'recompose'
import {marginColor, colorForAuthor} from '../shared'
import Failure from '../failure'

import type {Props} from '.'

    // const {children, message, style, includeHeader, isFirstNewMessage, onRetry, onShowEditor, onIconClick, isSelected, you, followingMap, metaDataMap} = this.props
// type MessageProps = Props & {onIconClick: (event: any) => void, onRetry: () => void, onShowEditor: () => void}

const MessageWrapper = (props: Props) => (
  <div style={{..._marginContainerStyle, flex: 1, ...(props.isFirstNewMessage ? _stylesFirstNewMessage : null), ...(props.isSelected ? _stylesSelected : null)}}>
    <div style={{width: 2, marginRight: globalMargins.tiny, alignSelf: 'stretch', backgroundColor: marginColor(props.author, props.isYou, props.isFollowing, props.isBroken)}} />
    <div style={{...globalStyles.flexBoxRow, flex: 1, paddingTop: (props.includeHeader ? globalMargins.tiny : 0)}}>
      {props.includeHeader
        ? <Avatar size={24} username={props.author} style={_avatarStyle} />
        : <div style={_noHeaderStyle} />}
      <div style={_bodyContainerStyle} className='message-wrapper'>
        {props.includeHeader && <Text type='BodySmallSemibold' style={{color: colorForAuthor(props.author, props.isYou, props.isFollowing, props.isBroken), ...(props.isYou ? globalStyles.italic : null), marginBottom: 2}}>{props.author}</Text>}
        <div style={_textContainerStyle} className='message' data-message-key={props.message.key}>
          <div style={_childrenWrapStyle}>
            {props.children}
            {props.message.type === 'Text' && props.message.editedCount > 0 && <Text type='BodySmall' style={_editedStyle}>EDITED</Text>}
          </div>
          <div className='action-button'>
            {props.message.senderDeviceRevokedAt && <Icon type='iconfont-exclamation' style={_exclamationStyle} />}
            <Icon type='iconfont-ellipsis' style={_ellipsisStyle} onClick={props.onIconClick} />
          </div>
        </div>
        {props.message.messageState === 'failed' && <Failure failureDescription={props.message.failureDescription} onRetry={props.onRetry} onShowEditor={props.onShowEditor} />}
      </div>
    </div>
  </div>
)

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

const _editedStyle = {
  color: globalColors.black_20,
}

export default withHandlers({
  onIconClick: (props: Props) => event => {
    props.onAction(props.message, event)
  },
  onRetry: (props: Props) => () => {
    props.message.outboxID && props.onRetry(props.message.outboxID)
  },
  onShowEditor: (props: Props) => event => {
    props.onShowEditor(props.message, event)
  },
})(MessageWrapper)
