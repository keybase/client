// @flow
import React from 'react'
import {Avatar, Icon, Text} from '../../../../common-adapters'
import {globalStyles, globalMargins, globalColors} from '../../../../styles'
import {withHandlers} from 'recompose'
import {marginColor, colorForAuthor} from '../shared'

import type {Props} from '.'

const LeftMarker = ({author, isYou, isFollowing, isBroken}) => (
  <div style={{..._leftMarkerStyle, backgroundColor: marginColor(author, isYou, isFollowing, isBroken)}} />
)

const UserAvatar = ({author, showImage}) => (
  <div style={_userAvatarStyle}>
    {showImage && <Avatar size={24} username={author} />}
  </div>
)

const Username = ({author, isYou, isFollowing, isBroken, includeHeader}) => {
  if (!includeHeader) return null
  const style = {color: colorForAuthor(author, isYou, isFollowing, isBroken), ...(isYou ? globalStyles.italic : null), marginBottom: 2}
  return <Text type='BodySmallSemibold' style={style}>{author}</Text>
}

const ActionButton = ({isRevoked, onIconClick}) => (
  <div className='action-button'>
    {isRevoked && <Icon type='iconfont-exclamation' style={_exclamationStyle} />}
    <Icon type='iconfont-ellipsis' style={_ellipsisStyle} onClick={onIconClick} />
  </div>
)

const EditedMark = ({isEdited}) => (
  isEdited ? <Text type='BodySmall' style={_editedStyle}>EDITED</Text> : null
)

const Failure = ({failureDescription, onShowEditor, onRetry}) => {
  if (!failureDescription) return null
  const error = `Failed to send${failureDescription ? ` -  ${failureDescription}` : ''}. `
  const resolveByEdit = failureDescription === 'message is too long'
  return (
    <Text type='BodySmall'>
      <Text type='BodySmall' style={{color: globalColors.red, fontSize: 9}}>{'┏(>_<)┓'}</Text>
      <Text type='BodySmall' style={{color: globalColors.red}}> {error}</Text>
      {resolveByEdit &&
        <Text type='BodySmall' style={{color: globalColors.red, ...globalStyles.textDecoration('underline')}} onClick={onShowEditor}>Edit</Text>}
      {!resolveByEdit &&
        <Text type='BodySmall' style={{color: globalColors.red, ...globalStyles.textDecoration('underline')}} onClick={onRetry}>Retry</Text>}
    </Text>
  )
}

const Content = ({author, isYou, isFollowing, isBroken, messageKey, isEdited, message, includeHeader, children, onIconClick, onRetry, onShowEditor, isRevoked, failureDescription}) => (
  <div style={_flexOneColumn} className='message-wrapper'>
    <Username includeHeader={includeHeader} author={author} isYou={isYou} isFollowing={isFollowing} isBroken={isBroken} />
    <div style={_textContainerStyle} className='message' data-message-key={messageKey}>
      <div style={_flexOneColumn}>
        {children}
        <EditedMark isEdited={isEdited} />
      </div>
      <ActionButton isRevoked={isRevoked} onIconClick={onIconClick} />
    </div>
    <Failure failureDescription={failureDescription} onRetry={onRetry} onShowEditor={onShowEditor} />
  </div>
)

const MessageWrapper = ({author, isYou, isFollowing, isBroken, includeHeader, messageKey, isEdited, isFirstNewMessage, isSelected, children, message, failureDescription}: Props) => (
  <div style={{..._flexOneRow, ...(isFirstNewMessage ? _stylesFirstNewMessage : null), ...(isSelected ? _stylesSelected : null)}}>
    <LeftMarker author={author} isYou={isYou} isFollowing={isFollowing} isBroken={isBroken} />
    <div style={_flexOneRow}>
      <UserAvatar author={author} showImage={includeHeader} />
      <Content
        message={message}
        author={author}
        isYou={isYou}
        failureDescription={failureDescription}
        isFollowing={isFollowing}
        isBroken={isBroken}
        messageKey={messageKey}
        includeHeader={includeHeader}
        isEdited={isEdited}>
        {children}
      </Content>
    </div>
  </div>
)

const _stylesFirstNewMessage = {
  borderTop: `solid 1px ${globalColors.orange}`,
}

const _stylesSelected = {
  backgroundColor: `${globalColors.black_05}`,
}

const _exclamationStyle = {
  color: globalColors.blue,
  fontSize: 10,
}

const _ellipsisStyle = {
  fontSize: 16,
  marginLeft: globalMargins.tiny,
  marginRight: globalMargins.xtiny,
}

const _textContainerStyle = {
  ...globalStyles.flexBoxRow,
  borderRadius: 4,
  flex: 1,
  marginLeft: -globalMargins.xtiny,
  marginRight: globalMargins.xtiny,
  paddingLeft: globalMargins.xtiny,
  paddingRight: globalMargins.xtiny,
}

const _editedStyle = {
  color: globalColors.black_20,
}

const _leftMarkerStyle = {
  alignSelf: 'stretch',
  marginRight: globalMargins.tiny,
  width: 2,
}

const _userAvatarStyle = {
  height: 1, // don't let avatar size push down the whole row
  width: 32,
}

const _flexOneRow = {
  ...globalStyles.flexBoxRow,
  flex: 1,
}

const _flexOneColumn = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
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
