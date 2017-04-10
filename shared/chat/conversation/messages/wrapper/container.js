// @flow
import * as Constants from '../../../../constants/chat'
import Wrapper from '.'
import createCachedSelector from 're-reselect'
import {compose, withHandlers, lifecycle} from 'recompose'
import {connect} from 'react-redux'
import {Map} from 'immutable'

import type {Props} from '.'
import type {TypedState} from '../../../../constants/reducer'
import type {OwnProps} from './container'

const getMessage = createCachedSelector(
  [Constants.getMessageFromMessageKey],
  (message: Constants.TextMessage) => message,
)((state, messageKey) => messageKey)

// TODO more reselect?

const mapStateToProps = (state: TypedState, {messageKey, prevMessageKey, children, isSelected, innerClass, measure}: OwnProps) => {
  const conversationState = Constants.getSelectedConversationStates(state)

  const message = getMessage(state, messageKey)
  const author = message.author
  const _editedCount = message.editedCount
  const isEdited = message.type === 'Text' && _editedCount > 0
  const isRevoked = !!message.senderDeviceRevokedAt
  const failureDescription = message.messageState === 'failed' ? message.failureDescription : null
  const isYou = Constants.getYou(state) === author
  const isFollowing = Constants.getFollowingMap(state)[author]
  const isBroken = Constants.getMetaDataMap(state).get(author, Map()).get('brokenTracker', false)

  const isFirstNewMessage = conversationState && message && conversationState.get('firstNewMessageID') === message.messageID
  const prevMessage = getMessage(state, prevMessageKey)
  const skipMsgHeader = prevMessage && prevMessage.type === 'Text' && prevMessage.author === author
  const includeHeader = isFirstNewMessage || !skipMsgHeader
  const isEditing = message === Constants.getEditingMessage(state)

  return {
    // Not for outside consumption
    _editedCount,
    _message: message,
    author,
    children,
    failureDescription,
    includeHeader,
    innerClass,
    isBroken,
    isEdited,
    isEditing,
    isFirstNewMessage,
    isFollowing,
    isRevoked,
    isSelected,
    isYou,
    measure,
    messageKey,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {onAction}: OwnProps) => ({
  _onAction: onAction,
  // onRetry: (outboxID: Constants.OutboxIDKey) => void,
  // onShowEditor: (message: Constants.Message, event: any) => void,
  // onIconClick: (event: any) => void,
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  withHandlers({
    onAction: props => event => props._onAction(props._message, event),
  }),
  lifecycle({
    componentDidUpdate: function (prevProps: Props & {_editedCount: number}) {
      if (this.props._editedCount !== prevProps._editedCount) {
        this.props.measure()
      }
    },
  })
)(Wrapper)
