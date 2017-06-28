// @flow
import * as Constants from '../constants/chat'
import createCachedSelector from 're-reselect'

const lookupMessageProps = createCachedSelector(
  [Constants.getMessageFromMessageKey, Constants.getLocalMessageStateFromMessageKey],
  (message: Constants.TextMessage, localMessageState: Constants.LocalMessageState) => ({
    message,
    localMessageState,
  })
)((state, messageKey) => messageKey)

export {lookupMessageProps}
