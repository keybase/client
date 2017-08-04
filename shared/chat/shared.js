// @flow
import * as Constants from '../constants/chat'
import {OrderedSet} from 'immutable'
import createCachedSelector from 're-reselect'

const lookupMessageProps = createCachedSelector(
  [
    Constants.getMessageFromMessageKey,
    Constants.getLocalMessageStateFromMessageKey,
    Constants.getMessageUpdates,
  ],
  (
    message: Constants.TextMessage,
    localMessageState: Constants.LocalMessageState,
    messageUpdates: OrderedSet<Constants.EditingMessage | Constants.UpdatingAttachment>
  ) => {
    if (messageUpdates.count()) {
      return {
        message: Constants.applyMessageUpdates(message, messageUpdates),
        localMessageState,
      }
    }
    return {
      message,
      localMessageState,
    }
  }
)((state, messageKey) => messageKey || 'null')

export {lookupMessageProps}
