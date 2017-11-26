// @flow
import * as Constants from '../constants/chat'
import * as Types from '../constants/types/chat'
import createCachedSelector from 're-reselect'

const lookupMessageProps = createCachedSelector(
  [Constants.getMessageFromMessageKey, Constants.getLocalMessageStateFromMessageKey],
  (message: Types.TextMessage, localMessageState: Types.LocalMessageState) => ({
    message,
    localMessageState,
  })
)((state, messageKey) => messageKey || 'null')

export {lookupMessageProps}
