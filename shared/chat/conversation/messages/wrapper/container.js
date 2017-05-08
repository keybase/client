// @flow
import * as Constants from '../../../../constants/chat'
import * as Creators from '../../../../actions/chat/creators'
import Wrapper from '.'
import createCachedSelector from 're-reselect'
import {compose, withHandlers, lifecycle} from 'recompose'
import {connect} from 'react-redux'
import {Map} from 'immutable'
import {formatTimeForMessages} from '../../../../util/timestamp'

import type {Props} from '.'
import type {TypedState} from '../../../../constants/reducer'
import type {OwnProps, StateProps, DispatchProps} from './container'

const getMessage = createCachedSelector(
  [Constants.getMessageFromMessageKey],
  (message: Constants.TextMessage) => message,
)((state, messageKey) => messageKey)

// TODO more reselect?

const mapStateToProps = (state: TypedState, {messageKey, prevMessageKey}: OwnProps): StateProps => {
  const conversationState = Constants.getSelectedConversationStates(state)
  const selectedConversationIDKey = Constants.getSelectedConversation(state)

  const message = getMessage(state, messageKey)
  if (!message) {
    throw new Error(`Can't find message for wrapper ${messageKey}`)
  }
  const author = message.author
  const _editedCount = message.editedCount || 0
  const isEdited = message.type === 'Text' && _editedCount > 0
  const isRevoked = !!message.senderDeviceRevokedAt
  const failureDescription = message.messageState === 'failed' ? message.failureDescription : null
  const isYou = Constants.getYou(state) === author
  const isFollowing = !!Constants.getFollowingMap(state)[author]
  const isBroken = Constants.getMetaDataMap(state).get(author, Map()).get('brokenTracker', false)

  const isFirstNewMessage = !!(conversationState && message && message.messageID && conversationState.get('firstNewMessageID') === message.messageID)
  const prevMessage = getMessage(state, prevMessageKey)
  const skipMsgHeader = prevMessage && prevMessage.type === 'Text' && prevMessage.author === author

  const firstMessageEver = !prevMessage
  const firstLegitMessage = prevMessage && Constants.messageKeyValue(prevMessage.key) === '1'
  const oldEnough = (
      prevMessage &&
      prevMessage.timestamp &&
      message.timestamp &&
      message.timestamp - prevMessage.timestamp > Constants.howLongBetweenTimestampsMs
    )

  const timestamp = (firstMessageEver || firstLegitMessage || oldEnough) ? formatTimeForMessages(message.timestamp) : null
  const includeHeader = isFirstNewMessage || !skipMsgHeader
  const isEditing = message === Constants.getEditingMessage(state)

  return {
    // Not for outside consumption
    _editedCount,
    _message: message,
    _selectedConversationIDKey: selectedConversationIDKey,
    author,
    failureDescription,
    includeHeader,
    isBroken,
    isEdited,
    isEditing,
    isFirstNewMessage,
    isFollowing,
    isRevoked,
    isYou,
    timestamp,
  }
}

const mapDispatchToProps = (dispatch: Dispatch): DispatchProps => ({
  _onRetryAttachment: (message: Constants.AttachmentMessage) => dispatch(Creators.retryAttachment(message)),
  _onRetryText: (conversationIDKey: Constants.ConversationIDKey, outboxID: Constants.OutboxIDKey) => dispatch(Creators.retryMessage(conversationIDKey, outboxID)),
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps, ownProps: OwnProps) => ({
  _editedCount: stateProps._editedCount,
  _message: stateProps._message,
  _onAction: ownProps.onAction,
  _onShowEditor: ownProps.onShowEditor,
  author: stateProps.author,
  failureDescription: stateProps.failureDescription,
  includeHeader: stateProps.includeHeader,
  innerClass: ownProps.innerClass,
  isBroken: stateProps.isBroken,
  isEdited: stateProps.isEdited,
  isEditing: stateProps.isEditing,
  isFirstNewMessage: stateProps.isFirstNewMessage,
  isFollowing: stateProps.isFollowing,
  isRevoked: stateProps.isRevoked,
  isSelected: ownProps.isSelected,
  isYou: stateProps.isYou,
  measure: ownProps.measure,
  messageKey: ownProps.messageKey,
  onRetry: () => {
    if (stateProps._message.type === 'Attachment') {
      dispatchProps._onRetryAttachment(stateProps._message)
    } else if (stateProps._selectedConversationIDKey && stateProps._message.outboxID) {
      dispatchProps._onRetryText(stateProps._selectedConversationIDKey, stateProps._message.outboxID)
    }
  },
  timestamp: stateProps.timestamp,
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  withHandlers({
    onAction: props => event => props._onAction(props._message, event),
    onShowEditor: props => event => props._onShowEditor(props._message, event),
  }),
  lifecycle({
    componentDidUpdate: function (prevProps: Props & {_editedCount: number}) {
      if (this.props.measure && (
        (this.props._editedCount !== prevProps._editedCount) ||
        (this.props.isFirstNewMessage !== prevProps.isFirstNewMessage) ||
        (this.props.timestamp !== prevProps.timestamp)
      )) {
        this.props.measure()
      }
    },
  })
)(Wrapper)
