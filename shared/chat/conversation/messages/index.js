// @flow
import * as Constants from '../../../constants/chat'
import Attachment from './attachment/container'
// import AttachmentMessageRender from './attachment'
// import MessageText from './text'
import React from 'react'
import Timestamp from './timestamp/container'
import Header from './header/container'
import Wrapper from './wrapper/container'
import TextMessage from './text/container'
import ErrorMessage from './error/container'
// import ProfileResetNotice from '../notices/profile-reset-notice'
import {Box, Text} from '../../../common-adapters'
// import {formatTimeForMessages} from '../../../util/timestamp'
// import {globalStyles} from '../../../styles'
// import {isMobile} from '../../../constants/platform'

const factory = (
  messageKey: Constants.MessageKey,
  prevMessageKey: ?Constants.MessageKey,
  onAction: (message: Constants.ServerMessage, event: any) => void,
  isSelected: boolean,
  measure: () => void
) => {
  const kind = Constants.messageKeyKind(messageKey)
  switch (kind) {
    case 'header':
      return <Header messageKey={messageKey} />
    case 'messageIDAttachment':
      return <Wrapper
        innerClass={Attachment}
        measure={measure}
        messageKey={messageKey}
        onAction={onAction}
        prevMessageKey={prevMessageKey} />
    case 'error': // fallthrough
    case 'errorInvisible': // fallthrough
    case 'messageIDError':
      return <ErrorMessage messageKey={messageKey} />
    case 'outboxIDText': // fallthrough
    case 'messageIDText':
      return <Wrapper
        innerClass={TextMessage}
        measure={measure}
        messageKey={messageKey}
        onAction={onAction}
        prevMessageKey={prevMessageKey} />
    case 'timestamp':
      return <Timestamp messageKey={messageKey} />
  }

  // TEMP just to see them
  return (
    <Box style={TEMP}>
      <Text type='BodySmall' style={TEMP}>{kind}:{messageKey.substring(0, 5)}</Text>
    </Box>
  )
  return <Box data-messageKey={messageKey} />
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
  // }
// }

// const errorStyle = {
  // ...globalStyles.flexBoxRow,
  // justifyContent: 'center',
  // padding: 5,
// }

export default factory
