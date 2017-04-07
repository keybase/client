// @flow
import * as Constants from '../../../../constants/chat'
import Wrapper from '.'
import createCachedSelector from 're-reselect'
import {compose} from 'recompose'
import {connect} from 'react-redux'
import {Map} from 'immutable'

import type {TypedState} from '../../../../constants/reducer'
import type {OwnProps} from './container'

// TODO don't send it all down
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
  const isYou = Constants.getYou(state) === author
  const isFollowing = Constants.getFollowingMap(state)[author]
  const isBroken = Constants.getMetaDataMap(state).get(author, Map()).get('brokenTracker', false)

  const isFirstNewMessage = conversationState && conversationState.get('firstNewMessageID')
  const prevMessage = getMessage(state, prevMessageKey)
  const skipMsgHeader = prevMessage && prevMessage.type === 'Text' && prevMessage.author === author
  const includeHeader = isFirstNewMessage || !skipMsgHeader

  return {
    author,
    children,
    includeHeader,
    isBroken,
    isEdited,
    isFirstNewMessage,
    isFollowing,
    isSelected: false, // TODO plumb this through
    isYou,
    message, // TODO don't send directly
    messageKey,
    isRevoked,
  }
}

export default compose(
  connect(mapStateToProps, () => ({})),
)(Wrapper)
