// @flow
import * as Constants from '../../../constants/chat'
import Attachment from './attachment/container'
import ErrorMessage from './error/container'
import Header from './header/container'
import ProfileResetNotice from '../notices/profile-reset-notice/container'
import React from 'react'
import TextMessage from './text/container'
import Timestamp from './timestamp/container'
import Wrapper from './wrapper/container'
import {Box} from '../../../common-adapters'

const factory = (
  messageKey: Constants.MessageKey,
  prevMessageKey: ?Constants.MessageKey,
  onAction: (message: Constants.ServerMessage, event: any) => void,
  onShowEditor: (message: Constants.ServerMessage, event: any) => void,
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
        isSelected={isSelected}
        measure={measure}
        messageKey={messageKey}
        onAction={onAction}
        onShowEditor={onShowEditor}
        prevMessageKey={prevMessageKey} />
    case 'error': // fallthrough
    case 'errorInvisible': // fallthrough
    case 'messageIDError':
      return <ErrorMessage messageKey={messageKey} />
    case 'outboxIDText': // fallthrough
    case 'messageIDText':
      return <Wrapper
        innerClass={TextMessage}
        isSelected={isSelected}
        measure={measure}
        messageKey={messageKey}
        onAction={onAction}
        onShowEditor={onShowEditor}
        prevMessageKey={prevMessageKey} />
    case 'supersedes':
      return <ProfileResetNotice />
    case 'timestamp':
      return <Timestamp messageKey={messageKey} />
    case 'messageIDUnhandled':
      return <Box data-unhandled={true} data-messageKey={messageKey} />
  }

  return <Box data-messageKey={messageKey} />
}

export default factory
