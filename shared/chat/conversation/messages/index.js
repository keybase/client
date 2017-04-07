// @flow
import * as Constants from '../../../constants/chat'
import AttachmentMessageRender from './attachment'
import MessageText from './text'
import React from 'react'
import Timestamp from './timestamp/container'
import LoadingMore from './loading-more'
import ProfileResetNotice from '../notices/profile-reset-notice'
import {Box, Text, Icon} from '../../../common-adapters'
import {formatTimeForMessages} from '../../../util/timestamp'
import {globalStyles, globalColors} from '../../../styles'
import {isMobile} from '../../../constants/platform'

const factory = (messageKey: Constants.MessageKey) => {
  const kind = Constants.messageKeyKind(messageKey)
  switch (kind) {
    // case 'invisibleError': {
    // }
    // case 'loadingMore': {
    // }
    // case 'messageIDAttachment': {
    // }
    // case 'messageIDError': {
    // }
    // case 'messageIDText': {
    // }
    // case 'outboxID': {
    // }
    // case 'tempAttachment': {
    // }
    case 'timestamp': {
      return <Timestamp messageKey={messageKey} />
    }
    default: {
      return (
        <Box style={TEMP}>
          <Text type='BodySmall' style={TEMP}>{kind}:{messageKey.substring(0, 5)}</Text>
        </Box>
      )
    }
  }
}

const TEMP = {
  height: 50,
}

// import type {Options} from './index'

// const factory = (options: Options) => {
  // const {message, includeHeader, key, isEditing, isFirstNewMessage, isSelected, onAction, onLoadAttachment, onOpenConversation, onOpenInFileUI, onOpenInPopup, onRetry, onRetryAttachment, onShowEditor, style, you, metaDataMap, followingMap, moreToLoad} = options

  // if (!message) {
    // return <Box key={key} style={style} />
  // }

  // switch (message.type) {
    // case 'Text':
      // return <MessageText
        // key={key}
        // you={you}
        // metaDataMap={metaDataMap}
        // followingMap={followingMap}
        // style={style}
        // message={message}
        // onRetry={onRetry}
        // onShowEditor={onShowEditor}
        // includeHeader={includeHeader}
        // isFirstNewMessage={isFirstNewMessage}
        // isSelected={isSelected}
        // isEditing={isEditing}
        // onAction={onAction}
        // />
    // case 'Supersedes':
      // return <ProfileResetNotice
        // onOpenOlderConversation={() => onOpenConversation(message.supersedes)}
        // username={message.username}
        // style={style}
        // key={`supersedes:${message.supersedes}`}
        // />
    // case 'Attachment':
      // return <AttachmentMessageRender
        // key={key}
        // style={style}
        // you={you}
        // metaDataMap={metaDataMap}
        // followingMap={followingMap}
        // message={message}
        // onRetry={() => onRetryAttachment(message)}
        // includeHeader={includeHeader}
        // isFirstNewMessage={isFirstNewMessage}
        // onLoadAttachment={onLoadAttachment}
        // onOpenInFileUI={onOpenInFileUI}
        // onOpenInPopup={onOpenInPopup}
        // messageID={message.messageID}
        // onAction={onAction}
        // />
    // case 'LoadingMore':
      // return <LoadingMore style={{...style}} key={key} hasMoreItems={moreToLoad} />
    // case 'ChatSecuredHeader':
      // return (
        // <Box key={key} style={{...globalStyles.flexBoxColumn, alignItems: 'center', flex: 1, justifyContent: 'center', height: 116}}>
          // {!moreToLoad && <Icon type={isMobile ? 'icon-secure-static-266' : 'icon-secure-266'} />}
        // </Box>
      // )
    // case 'Error':
      // return (
        // <Box key={key} style={{...style, ...errorStyle}}>
          // <Text type='BodySmallItalic' key={key} style={{color: globalColors.red}}>{message.reason}</Text>
        // </Box>
      // )
    // case 'InvisibleError':
      // return <Box key={key} style={style} data-msgType={message.type} />
    // default:
      // return <Box key={key} style={style} data-msgType={message.type} />
  // }
// }

const errorStyle = {
  ...globalStyles.flexBoxRow,
  justifyContent: 'center',
  padding: 5,
}

export default factory
