// @flow
import React from 'react'
import {Avatar, Icon, Text, Box, ClickableBox} from '../../../../common-adapters'
import {globalStyles, globalMargins, globalColors} from '../../../../styles'
import {isMobile} from '../../../../constants/platform'
import {marginColor, colorForAuthor} from '../shared'
import Timestamp from '../timestamp'

import type {Props} from '.'

const LeftMarker = ({author, isYou, isFollowing, isBroken}) => (
  <Box style={{..._leftMarkerStyle, backgroundColor: marginColor(author, isYou, isFollowing, isBroken)}} />
)

const UserAvatar = ({author, showImage, onClick}) => (
  <ClickableBox style={_userAvatarStyle} onClick={onClick}>
    {showImage && <Avatar size={24} username={author} skipBackground={true} />}
  </ClickableBox>
)

const Username = ({author, isYou, isFollowing, isBroken, includeHeader, onClick}) => {
  if (!includeHeader) return null
  const style = {
    color: colorForAuthor(author, isYou, isFollowing, isBroken),
    ...(isYou ? globalStyles.italic : null),
    marginBottom: 2,
  }
  return (
    <ClickableBox onClick={onClick}>
      <Text type="BodySmallSemibold" style={style}>{author}</Text>
    </ClickableBox>
  )
}

const ActionButton = ({onAction}) => (
  <Box className="action-button">
    {!isMobile && <Icon type="iconfont-ellipsis" style={_ellipsisStyle} onClick={onAction} />}
  </Box>
)

const EditedMark = ({isEdited}) =>
  isEdited ? <Text type="BodySmall" style={_editedStyle}>EDITED</Text> : null

const Failure = ({failureDescription, onShowEditor, onRetry}) => {
  if (!failureDescription) return null
  const error = `Failed to send${failureDescription ? ` -  ${failureDescription}` : ''}. `
  const resolveByEdit = failureDescription === 'message is too long'
  return (
    <Text type="BodySmall">
      <Text type="BodySmall" style={_failStyleFace}>{'┏(>_<)┓'}</Text>
      <Text type="BodySmall" style={_failStyle}> {error}</Text>
      {resolveByEdit && <Text type="BodySmall" style={_failStyleUnderline} onClick={onShowEditor}>Edit</Text>}
      {!resolveByEdit && <Text type="BodySmall" style={_failStyleUnderline} onClick={onRetry}>Retry</Text>}
    </Text>
  )
}

const MessageWrapper = (props: Props) => (
  <Box style={props.includeHeader ? _containerWithHeaderStyle : _containerNoHeaderStyle}>
    {props.timestamp && <Timestamp timestamp={props.timestamp} />}
    <Box
      style={{
        ..._flexOneRow,
        ...(props.isFirstNewMessage ? _stylesFirstNewMessage : null),
        ...(props.isSelected ? _stylesSelected : null),
      }}
    >
      <LeftMarker
        author={props.author}
        isYou={props.isYou}
        isFollowing={props.isFollowing}
        isBroken={props.isBroken}
      />
      <Box style={props.includeHeader ? _rightSideWithHeaderStyle : _rightSideNoHeaderStyle}>
        <UserAvatar author={props.author} showImage={props.includeHeader} onClick={props.onClick} />
        <Box style={_flexOneColumn} className="message-wrapper">
          <Username
            author={props.author}
            isYou={props.isYou}
            isFollowing={props.isFollowing}
            isBroken={props.isBroken}
            includeHeader={props.includeHeader}
            onClick={props.onClick}
          />
          <Box style={_textContainerStyle} className="message" data-message-key={props.messageKey}>
            <Box style={_flexOneColumn}>
              <props.innerClass
                messageKey={props.messageKey}
                measure={props.measure}
                onAction={props.onAction}
              />
              <EditedMark isEdited={props.isEdited} />
            </Box>
            <ActionButton isRevoked={props.isRevoked} onAction={props.onAction} />
            {props.isRevoked && <Icon type="iconfont-exclamation" style={_exclamationStyle} />}
          </Box>
          <Failure
            failureDescription={props.failureDescription}
            onRetry={props.onRetry}
            onShowEditor={props.onShowEditor}
          />
        </Box>
      </Box>
    </Box>
  </Box>
)

const _flexOneRow = {
  ...globalStyles.flexBoxRow,
  flex: 1,
}

const _flexOneColumn = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
}

const _containerNoHeaderStyle = {
  ...globalStyles.flexBoxColumn,
}

const _containerWithHeaderStyle = {
  ..._containerNoHeaderStyle,
}

const _rightSideNoHeaderStyle = {
  ..._flexOneRow,
  paddingRight: globalMargins.tiny,
  paddingBottom: 2,
}

const _rightSideWithHeaderStyle = {
  ..._rightSideNoHeaderStyle,
  paddingTop: 6,
}

const _stylesFirstNewMessage = {
  borderBottomWidth: 0,
  borderLeftWidth: 0,
  borderRightWidth: 0,
  borderStyle: 'solid',
  borderTopColor: globalColors.orange,
  borderTopWidth: 1,
}

const _stylesSelected = {
  backgroundColor: globalColors.black_05,
}

const _exclamationStyle = {
  color: globalColors.blue,
  fontSize: 11,
  paddingBottom: globalMargins.xtiny,
  paddingTop: globalMargins.xtiny,
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
  width: 32,
}

const _failStyle = {
  color: globalColors.red,
}
const _failStyleUnderline = {
  ..._failStyle,
  ...globalStyles.textDecoration('underline'),
}
const _failStyleFace = {
  ..._failStyle,
  fontSize: 9,
}

export default MessageWrapper
