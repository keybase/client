// @flow
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as ProfileGen from '../../../../actions/profile-gen'
import * as TrackerGen from '../../../../actions/tracker-gen'
import * as Types from '../../../../constants/types/chat2'
import * as Constants from '../../../../constants/chat2/message'
import {WrapperAuthor} from '.'
import {setDisplayName, compose, connect, type TypedState} from '../../../../util/container'
import {formatTimeForMessages} from '../../../../util/timestamp'
import {isMobile} from '../../../../constants/platform'

const mapStateToProps = (state: TypedState, {message, previous, innerClass, isEditing}) => {
  const isYou = state.config.username === message.author
  const isFollowing = state.config.following.has(message.author)
  const isBroken = state.users.infoMap.getIn([message.author, 'broken'], false)
  const lastPositionOrdinal = state.chat2.orangeLineMap.get(message.conversationIDKey)
  const lastPositionExists = !!previous && lastPositionOrdinal === previous.ordinal
  const messageSent = !message.submitState
  const messageFailed = message.submitState === 'failed'
  const messagePending = message.submitState === 'pending'
  const isExplodingUnreadable = message.explodingUnreadable

  return {
    innerClass,
    isBroken,
    isEditing,
    isExplodingUnreadable,
    isFollowing,
    isYou,
    lastPositionExists,
    message,
    messageFailed,
    messagePending,
    messageSent,
    previous,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onAuthorClick: (username: string) =>
    isMobile
      ? dispatch(ProfileGen.createShowUserProfile({username}))
      : dispatch(TrackerGen.createGetProfile({forceDisplay: true, ignoreCache: true, username})),
  _onCancel: (conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal) =>
    dispatch(Chat2Gen.createMessageDelete({conversationIDKey, ordinal})),
  _onEdit: (conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal) =>
    dispatch(Chat2Gen.createMessageSetEditing({conversationIDKey, ordinal})),
  _onRetry: (conversationIDKey: Types.ConversationIDKey, outboxID: Types.OutboxID) =>
    dispatch(Chat2Gen.createMessageRetry({conversationIDKey, outboxID})),
})

const mergeProps = (stateProps, dispatchProps, {measure}) => {
  const {message, previous} = stateProps

  const sequentialUserMessages =
    previous &&
    previous.author === message.author &&
    (previous.type === 'text' || previous.type === 'deleted' || previous.type === 'attachment')

  const oldEnough = Constants.enoughTimeBetweenMessages(message, previous)

  const timestamp =
    stateProps.lastPositionExists || !previous || oldEnough ? formatTimeForMessages(message.timestamp) : null

  const includeHeader = !previous || !sequentialUserMessages || !!timestamp

  let failureDescription = null
  if ((message.type === 'text' || message.type === 'attachment') && message.errorReason) {
    failureDescription = stateProps.isYou ? `Failed to send: ${message.errorReason}` : message.errorReason
  }

  return {
    author: message.author,
    exploded: message.exploded,
    explodedBy: message.explodedBy,
    explodesAt: message.explodingTime,
    exploding: message.exploding,
    failureDescription,
    includeHeader,
    innerClass: stateProps.innerClass,
    isBroken: stateProps.isBroken,
    isEdited: message.hasBeenEdited,
    isEditing: stateProps.isEditing,
    isExplodingUnreadable: stateProps.isExplodingUnreadable,
    isFollowing: stateProps.isFollowing,
    isRevoked: !!message.deviceRevokedAt,
    isYou: stateProps.isYou,
    measure,
    message,
    messageFailed: stateProps.messageFailed,
    // `messageKey` should be unique for the message as long
    // as threads aren't switched
    messageKey: `${message.conversationIDKey}:${Types.ordinalToNumber(message.ordinal)}`,
    messagePending: stateProps.messagePending,
    messageSent: stateProps.messageSent,
    onAuthorClick: () => dispatchProps._onAuthorClick(message.author),
    onCancel: stateProps.isYou
      ? () => dispatchProps._onCancel(message.conversationIDKey, message.ordinal)
      : null,
    onEdit: stateProps.isYou ? () => dispatchProps._onEdit(message.conversationIDKey, message.ordinal) : null,
    onRetry: stateProps.isYou
      ? () => message.outboxID && dispatchProps._onRetry(message.conversationIDKey, message.outboxID)
      : null,
    timestamp,
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('WrapperAuthor')
)(WrapperAuthor)
