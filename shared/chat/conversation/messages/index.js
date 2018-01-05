// @flow
import * as Constants from '../../../constants/chat'
import * as Types from '../../../constants/types/chat'
import Attachment from './attachment/container'
import ErrorMessage from './error/container'
import Header from './header/container'
import ResetUser from './resetUser/container'
import JoinedLeft from './joinedleft/container'
import System from './system/container'
import ProfileResetNotice from '../notices/profile-reset-notice/container'
import * as React from 'react'
import TextMessage from './text/container'
import Timestamp from './timestamp/container'
import Wrapper from './wrapper/container'
import {Box} from '../../../common-adapters'

const factory = (
  messageKey: Types.MessageKey,
  prevMessageKey: ?Types.MessageKey,
  onAction: (
    message: Types.ServerMessage,
    localMessageState: Types.LocalMessageState,
    event: SyntheticEvent<>
  ) => void,
  onShowEditor: (message: Types.ServerMessage, event: SyntheticEvent<>) => void,
  isSelected: boolean,
  measure: () => void
) => {
  const kind = Constants.messageKeyKind(messageKey)
  switch (kind) {
    case 'joinedleft':
      return <JoinedLeft messageKey={messageKey} />
    case 'system':
      return <System messageKey={messageKey} />
    case 'resetUser':
      return <ResetUser messageKey={messageKey} />
    case 'header':
      return <Header messageKey={messageKey} />
    case 'outboxIDAttachment': // fallthrough
    case 'messageIDAttachment':
      return (
        <Wrapper
          innerClass={Attachment}
          isSelected={isSelected}
          measure={measure}
          messageKey={messageKey}
          onAction={onAction}
          onShowEditor={onShowEditor}
          prevMessageKey={prevMessageKey}
        />
      )
    case 'error': // fallthrough
    case 'errorInvisible': // fallthrough
    case 'messageIDError':
      return <ErrorMessage messageKey={messageKey} />
    case 'outboxIDText': // fallthrough
    case 'messageIDText':
      return (
        <Wrapper
          innerClass={TextMessage}
          isSelected={isSelected}
          measure={measure}
          messageKey={messageKey}
          onAction={onAction}
          onShowEditor={onShowEditor}
          prevMessageKey={prevMessageKey}
        />
      )
    case 'supersedes':
      return <ProfileResetNotice />
    case 'timestamp':
      return <Timestamp messageKey={messageKey} />
    case 'messageIDUnhandled':
      return null
  }

  return <Box data-message-key={messageKey} />
}

export default factory
