// @flow
import * as Constants from '../../../../constants/chat'
import Wrapper from '.'
import createCachedSelector from 're-reselect'
import {compose} from 'recompose'
import {connect} from 'react-redux'
import {Map} from 'immutable'

import type {TypedState} from '../../../../constants/reducer'
import type {OwnProps} from './container'

const getMessage = createCachedSelector(
  [Constants.getMessageFromMessageKey],
  (message: Constants.TextMessage) => message,
)((state, messageKey) => messageKey)

// TODO more reselect?

const mapStateToProps = (state: TypedState, {messageKey, prevMessageKey, children}: OwnProps) => {
  const conversationState = Constants.getSelectedConversationStates(state)

  const message = getMessage(state, messageKey)
  const author = message.author
  const isEdited = message.type === 'Text' && message.editedCount > 0
  const isRevoked = message.senderDeviceRevokedAt
  const failureDescription = message.messageState === 'failed' ? message.failureDescription : null
  const isYou = Constants.getYou(state) === author
  const isFollowing = Constants.getFollowingMap(state)[author]
  const isBroken = Constants.getMetaDataMap(state).get(author, Map()).get('brokenTracker', false)

  const isFirstNewMessage = conversationState && conversationState.get('firstNewMessageID')
  const prevMessage = getMessage(state, prevMessageKey)
  const skipMsgHeader = prevMessage && prevMessage.type === 'Text' && prevMessage.author === author
  const includeHeader = isFirstNewMessage || !skipMsgHeader
  const isEditing = message === Constants.getEditingMessage(state)
  const isSelected = false // TODO

  return {
    author,
    children,
    failureDescription,
    includeHeader,
    isBroken,
    isEdited,
    isEditing,
    isFirstNewMessage,
    isFollowing,
    isRevoked,
    isSelected,
    isYou,
    messageKey,
  }
}

export default compose(
  connect(mapStateToProps, () => ({})),
)(Wrapper)
