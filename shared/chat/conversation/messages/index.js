// @flow
import * as Constants from '../../../constants/chat'
// import AttachmentMessageRender from './attachment'
// import MessageText from './text'
import React from 'react'
import Timestamp from './timestamp/container'
import Header from './header/container'
import ErrorMessage from './error/container'
// import ProfileResetNotice from '../notices/profile-reset-notice'
import {Box, Text /*, Icon */} from '../../../common-adapters'
// import {formatTimeForMessages} from '../../../util/timestamp'
import {globalStyles /*, globalColors */} from '../../../styles'
// import {isMobile} from '../../../constants/platform'

const factory = (messageKey: Constants.MessageKey) => {
  const kind = Constants.messageKeyKind(messageKey)
  switch (kind) {
    // case 'invisibleError': {
    // }
    case 'header': {
      return <Header messageKey={messageKey} />
    }
    // case 'messageIDAttachment': {
    // }
    case 'error': // fallthrough
    case 'errorInvisible': // fallthrough
    case 'messageIDError': {
      return <ErrorMessage messageKey={messageKey} />
        // <Box key={key} style={{...style, ...errorStyle}}>
          // <Text type='BodySmallItalic' key={key} style={{color: globalColors.red}}>{message.reason}</Text>
        // </Box>
      // )
    }
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
      // to del
      return (
        <Box style={TEMP}>
          <Text type='BodySmall' style={TEMP}>{kind}:{messageKey.substring(0, 5)}</Text>
        </Box>
      )
    }
  }

  // TODO put back
  // return <Box data-messageKey={messageKey} />
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
  // }
// }

// const errorStyle = {
  // ...globalStyles.flexBoxRow,
  // justifyContent: 'center',
  // padding: 5,
// }

export default factory
